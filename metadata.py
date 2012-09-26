#!/usr/bin/python2.5
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

"""Handler for intrinsic properties pipeline update requests from the client.

This module allows the client to retrieve updates regarding intrinsic properties
of relevant layers. Such updates are performed separately by retriever module.
"""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import datetime
import time
import urllib2

import simplejson as json

import map  # Allow use of the name 'map'.  # pylint: disable-msg=W0622
import metadata_retriever as retriever

from google.appengine.api import memcache
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


def GetIntrinsicPropertiesRecord(source):
  """Creates a dictionary object wih intrinsic properties of a source.

  Args:
    source: A source address, formatted as a JSON string.

  Returns:
    A dictionary with instrinsic properties that belongs to the given source or
    None if there is no information about the given source.
  """
  metadata = retriever.SourceMetadataModel.get_by_key_name(source)
  if metadata:
    record = {}
    for prop in [
        'content_hash', 'content_last_modified', 'content_length',
        'has_features', 'has_unsupported_kml', 'server_error_occurred'
    ]:
      value = getattr(metadata, prop, None)
      if value is not None:
        record[prop] = value
    return record
  else:
    return None


class Metadata(webapp.RequestHandler):
  def get(self):  # pylint: disable-msg=C6409
    """HTTP GET request handler for Metadata."""
    # Comma cannot be used as the separation character, since it can possibly
    # already exist in the layer address, since an adress is a JSON.
    layer_addresses = self.request.get('layers')
    if layer_addresses:
      layer_addresses = urllib2.unquote(layer_addresses).split('$')
    token = self.request.get('token')

    sources = []

    map_layer_addresses = memcache.get(token)
    if map_layer_addresses:
      sources += map_layer_addresses
      # Keep the memcache entry fresh to avoid expiration.
      memcache.set(token, map_layer_addresses,
                   map.DEFAULT_LAYER_ADDRESS_CACHE_SECONDS)

    if layer_addresses:
      sources += layer_addresses

    result = {}
    for source in sources:
      if source:
        record = GetIntrinsicPropertiesRecord(source)
        if record:
          result[source] = record

    # This ensures correct serialization of datetime objects.
    def Serializer(o):
      if isinstance(o, datetime.datetime):
        return round(time.mktime(o.timetuple()))
    self.response.out.write(json.dumps(result, default=Serializer))


def main():
  run_wsgi_app(webapp.WSGIApplication([(r'.*', Metadata)]))

if __name__ == '__main__':
  main()
