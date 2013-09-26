#!/usr/bin/python
# Copyright 2012 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""A proxy that validates JSON, localizes it, and returns JSON or JSONP."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import httplib
import json
import logging
import pickle
import re
import urlparse

import base_handler

from google.appengine.api import memcache
from google.appengine.api import urlfetch

CACHE_SECONDS = 120  # seconds to cache each fetched URL
MAX_OUTBOUND_QPM_PER_IP = 30  # maximum outbound HTTP fetches/min per client IP
HTTP_TOO_MANY_REQUESTS = 429  # this HTTP status code is not defined in httplib

# Regular expression for a JSON string enclosed by a JavaScript function call.
# \w+ is broader than the official definition of a JavaScript identifier,
# but it's safe to be broad in what we match, since we're removing it.
JSON_CALLBACK_RE = re.compile(r'^\w+\((.*)\)[\s;]*$', re.UNICODE | re.DOTALL)


def SanitizeUrl(url):
  """Checks and returns a URL that is safe to fetch, or raises an error.

  Args:
    url: A URL.

  Returns:
    The URL, only if it is considered safe to fetch.

  Raises:
    base_handler.Error: The URL was missing or not safe to fetch.
  """
  scheme, netloc, path, query, _ = urlparse.urlsplit(url)
  if scheme in ['http', 'https'] and '.' in netloc:
    return urlparse.urlunsplit((scheme, netloc, path, query, ''))
  raise base_handler.Error(httplib.BAD_REQUEST, 'Missing or invalid URL.')


def ParseJson(json_string):
  """Parses a JSON or JSONP string and returns the parsed object."""
  match = JSON_CALLBACK_RE.match(json_string)
  if match:
    json_string = match.group(1)  # remove the function call around the JSON
  try:
    return json.loads(json_string)
  except (TypeError, ValueError):
    raise base_handler.Error(httplib.FORBIDDEN, 'Invalid JSON.')


def AssertRateLimitNotExceeded(client_ip):
  """Raises an error if the given IP exceeds its allowed request rate."""
  cache_key = pickle.dumps(('jsonp.qpm', client_ip))
  if memcache.get(cache_key) >= MAX_OUTBOUND_QPM_PER_IP:
    raise base_handler.Error(HTTP_TOO_MANY_REQUESTS,
                             'Rate limit exceeded; please try again later.')
  memcache.add(cache_key, 0, 60)
  memcache.incr(cache_key)


def FetchJson(url, post_json, use_cache, client_ip, referrer=None):
  """Fetches a URL, parses it as JSON, and caches the resulting object.

  Args:
    url: A string, the URL to fetch.
    post_json: An optional string.  If specified, we do a POST instead of a
        GET, and post this data with Content-Type: application/json.
    use_cache: A boolean; if true, look in the cache, and if cached data is
        present, return that instead of actually performing the fetch.
    client_ip: A string, the IP address of the client.  If the fetch rate per
        client exceeds MAX_OUTBOUND_QPM_PER_IP requests per minute, we abort.
    referrer: An optional string, the "Referer:" header to use in the request.

  Returns:
    A dictionary or list parsed from the fetched JSON.

  Raises:
    base_handler.Error: The request failed or exceeded the rate limit.
  """
  url = SanitizeUrl(url)
  cache_key = pickle.dumps(('jsonp.content', url, post_json))
  value = None
  if use_cache:
    value = memcache.get(cache_key)
  if value is None:
    AssertRateLimitNotExceeded(client_ip)
    method = post_json and 'POST' or 'GET'
    headers = post_json and {'Content-Type': 'application/json'} or {}
    if referrer:
      headers['Referer'] = referrer
    result = urlfetch.fetch(url, post_json, method, headers)
    if result.status_code != httplib.OK:
      logging.warn('Request for url=%r post_json=%r returned status %r: %r',
                   url, post_json, result.status_code, result.content)
      raise base_handler.Error(result.status_code, 'Request failed.')
    value = ParseJson(result.content)
    memcache.set(cache_key, value, CACHE_SECONDS)
  return value


def PopLocalizedChild(parent, field_name, lang):
  """Finds and removes a localized child object in a MapRoot data structure.

  Both MapRoot and Layer structures have a field ("localized_map_roots" or
  "localized_layers") that contains an array of localized versions of the
  MapRoot or Layer object.  Each element of the array is a dictionary with a
  "language" key and a "map_root" key, or a "language" key and a "layer" key.
  This function finds the localized MapRoot or Layer object for a given
  language, returns it, and removes the array of all the localizations from
  the parent object.

  Args:
    parent: A MapRoot or Layer structure, as a Python dictionary.
    field_name: A string, either "map_root" or "layer".
    lang: The language code to look for in the "language" field.

  Returns:
    The child MapRoot or Layer object containing localized fields.
  """
  for localization in parent.pop('localized_%ss' % field_name, ()):
    if localization.get('language') == lang:
      return localization.get(field_name, {})


def LocalizeLayer(layer, lang):
  """Localizes a Layer object in place and discards unused localizations.

  Args:
    layer: A Layer structure as a dictionary, to be modified in place.
    lang: A string, the language code for the language to localize to.
  """
  layer.update(PopLocalizedChild(layer, 'layer', lang) or {})
  for sublayer in layer.get('sublayers', ()):
    LocalizeLayer(sublayer, lang)


def LocalizeMapRoot(map_root, lang):
  """Localizes a MapRoot object in place and discards unused localizations.

  Args:
    map_root: A MapRoot structure as a dictionary, to be modified in place.
    lang: A string, the language code for the language to localize to.
  """
  map_root.update(PopLocalizedChild(map_root, 'map_root', lang) or {})
  for layer in map_root.get('layers', ()):
    LocalizeLayer(layer, lang)


class Jsonp(base_handler.BaseHandler):
  """A proxy that validates JSON, localizes it, and returns JSON or JSONP.

  Accepts these query parameters:
    - url: Required.  A URL from which to fetch JSON.  The URL must provide
      syntactically valid JSON, or valid JSON wrapped in a function call.
    - post_json: Optional.  If non-empty, we do a POST instead of a GET and
      send this data with Content-Type: application/json.
    - no_cache: Optional.  If specified, we fetch the JSON directly from the
      source URL instead of consulting the cache (up to CACHE_SECONDS old).
    - callback: Optional.  A callback function name.  If provided, the
      returned JSON is wrapped in a JavaScript function call.
    - hl: Optional.  A BCP 47 language code.  If specified, the JSON is
      treated as MapRoot and localized to the specified language, and the
      localizations for other languages are discarded.
  """
  # This class needs no __init__ method.  # pylint: disable=no-init

  def Get(self):
    url = self.request.get('url', '')
    post_json = self.request.get('post_json', '')
    use_cache = not self.request.get('no_cache')
    hl = self.request.get('hl', '')
    data = FetchJson(url, post_json, use_cache, self.request.remote_addr,
                     self.request.headers.get('Referer'))
    if hl:
      LocalizeMapRoot(data, hl)
    self.WriteJson(data)
