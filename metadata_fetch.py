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

"""Fetches the metadata for a layer and stores it in memcache.

The metadata subsystem has the following external behaviour:

  - Metadata is retrieved on demand -- i.e. not until someone views a map.

  - The first user to view a map triggers metadata fetches for all the layers
    in it.  That user will initially see no metadata in the UI; after a few
    moments, it should start filling in (metadata_model.js periodically polls
    the metadata.py endpoint to get new metadata).

  - Fetched metadata is cached on the server in memcache, so all subsequent
    visitors to the map should get the latest metadata immediately on load.

  - As long as there are visitors to the map, the metadata for its layers will
    keep getting periodically refreshed.  After 24 hours pass with no page
    views, the refreshing will stop and the metadata will expire from memcache.

This is implemented using two memcache keys per layer source address:

  - ['metadata', address] contains the source's metadata.  It expires after
    1 hour -- i.e. metadata will disappear from the UI if we don't update it
    in an hour.  This can only happen if we stop queueing metadata_fetch tasks,
    or if the queue is so busy that it takes over an hour to cycle back to this
    item.  (Even if the remote server goes down, that shouldn't keep us from
    updating the metadata with the fetch_error_occurred flag.)

  - ['metadata_active', address] is a flag indicating that the metadata for a
    particular source should be kept up to date.  As long as this flag is
    present, we'll keep queuing metadata_fetch tasks to periodically refetch
    the metadata.  After 24 hours, the flag expires, and the next person to
    view the map will initially see no metadata.  This flag is also a lock to
    ensure that each source has at most one task queued at all times.

Tasks to fetch metadata are queued as follows:

  - When a map is requested, map.py pulls the metadata for all its layers (that
    happen to have metadata available) from memcache and includes it in the
    delivered page, and then calls ActivateSources.

  - ActivateSources iterates over all the sources.  For each source that isn't
    active yet (i.e. has no 'metadata_active' flag), it sets the flag and
    queues a metadata_fetch.py task.  (It uses memcache.add() to atomically set
    the 'metadata_active' flag only if it is not already set.)  If the flag is
    already set, it extends the lifetime of the flag by 24 hours.

  - The task queued by ActivateSources is the first in a chain: each time a
    metadata_fetch.py task runs, it fetches the metadata and then queues the
    next metadata_fetch.py task for that source if the source is still active.
    It chooses a task frequency depending on the size of the fetch (big files
    are fetched less often, to keep from overusing bandwidth).

  - Adding or editing layers can cause metadata_model.js to query metadata.py
    to ask about sources that weren't delivered with the original map.  This
    also invokes ActivateSources to activate the requested sources.

Metadata is stored in memcache as a dictionary with these keys, and sent to the
browser as JSON.  'fetch_time' is always present; all other fields are optional.

'fetch_*' fields pertain to the last attempt to fetch metadata:
  - 'fetch_time': Time of metadata fetch attempt (seconds since the epoch).
  - 'fetch_impossible': True if the source address is syntactically invalid
        (forever unfetchable regardless of any change in the external universe).
  - 'fetch_error_occurred': True if the HTTP status code indicated an error or
        if the request could not be performed at all (e.g. no such domain).
  - 'fetch_status': The HTTP status code returned by the server.
  - 'fetch_length': The length of the content in the last transaction.  This
        can differ from 'length' if we get a 304 or a ResponseTooLargeError.
  - 'fetch_last_modified': "Last-modified" header string from the server.  In
        order to guarantee that we send "If-modified-since" to the server using
        the server's preferred date format, we resend exactly this string. The
        'update_time' field typically conveys the same information, but could
        differ if e.g. the content itself contains a more accurate update time.
  - 'fetch_etag': "Etag" header string from the server.

All other fields tell us about the source data itself:
  - 'update_time': Last update time of source data (seconds since the epoch).
  - 'length': Length of the source data in bytes.
  - 'md5_hash': MD5 hash of the source data.
  - 'ill_formed': True if the source data is syntactically or structurally
        invalid for the layer type.
  - 'has_no_features': True if the source data is known to have no displayable
        features (i.e. no placemarks in KML, or no items in GeoRSS).
  - 'has_unsupported_kml': True if the source data is known to contain KML
        features that are unsupported by the Maps API.
"""
__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import calendar
import datetime
import email.utils
import hashlib
import json
import logging
import StringIO
import time
import xml.etree.ElementTree
import zipfile

import base_handler
import cache
import maproot
import model

from google.appengine.api import taskqueue
from google.appengine.api import urlfetch
from google.appengine.ext import db

MAX_FETCH_SECONDS = 10  # time to wait for a response from remote servers
METADATA_TTL_SECONDS = 3600  # time that a metadata record stays cached

# TODO(kpy): Add overall rate-limiting (total bandwidth across all sources).
MIN_DELAY_SECONDS = 60  # fetch each source at most once per minute
MIN_DELAY_AFTER_ERROR_SECONDS = 600  # on failure, wait at least 10 minutes
MAX_DELAY_HOURS = 24  # fetch each source at least once a day

# When estimating the costs we impose on remote servers, we take the content
# length in bytes and add 50000 to account for request setup and HTTP headers.
HTTP_FIXED_COST = 50000

# Daily limit to how much data we request from the remote server, per source.
MAX_MEGABYTES_PER_DAY_PER_SOURCE = 50

# Limitations of KML support in the Maps API's KmlLayer, documented at:
#     https://developers.google.com/kml/documentation/kmlelementsinmaps
#     https://developers.google.com/kml/documentation/mapsSupport
KML_MAX_FEATURES = 1000
KML_MAX_NETWORK_LINKS = 10
KML_SUPPORTED_TAGS = set([
    # Acceptable Atom tags:
    'author', 'link', 'name',
    # Acceptable KML tags:
    'BalloonStyle', 'Change', 'Data', 'Document', 'ExtendedData', 'Folder',
    'GroundOverlay', 'Icon', 'IconStyle', 'LatLonAltBox', 'LatLonBox',
    'LineString', 'LineStyle', 'LinearRing', 'Link', 'Lod', 'MultiGeometry',
    'NetworkLink', 'NetworkLinkControl', 'Placemark', 'Point', 'PolyStyle',
    'Polygon', 'ScreenOverlay', 'Snippet', 'Style', 'Update', 'Url', 'color',
    'coordinates', 'description', 'east', 'expires', 'fill', 'h', 'heading',
    'hint', 'hotSpot', 'href', 'innerBoundaryIs', 'kml', 'latitude',
    'longitude', 'maxAltitude', 'maxFadeExtent', 'maxLodPixels', 'minAltitude',
    'minFadeExtent', 'minLodPixels', 'name', 'north', 'open', 'outerBoundaryIs',
    'outline', 'range', 'refreshInterval', 'refreshMode', 'size', 'south',
    'styleUrl', 'targetHref', 'text', 'value', 'viewRefreshMode',
    'viewRefreshTime', 'visibility', 'w', 'west', 'width', 'x', 'y'])


class MetadataFetchLog(db.Model):
  """Just a log of fetches.  The metadata we actually use is in memcache."""
  log_time = db.DateTimeProperty(auto_now=True)
  address = db.StringProperty()
  fetch_time = db.DateTimeProperty()
  fetch_status = db.IntegerProperty()
  fetch_length = db.IntegerProperty()
  update_time = db.DateTimeProperty()
  length = db.IntegerProperty()
  md5_hash = db.StringProperty()
  metadata_json = db.TextProperty()

  @staticmethod
  def Log(address, metadata):
    """Stores a log entry.  Guaranteed not to raise an exception."""
    try:
      utcdatetime = lambda t: t and datetime.datetime.utcfromtimestamp(t)
      MetadataFetchLog(address=address,
                       fetch_time=utcdatetime(metadata['fetch_time']),
                       fetch_status=metadata.get('fetch_status'),
                       fetch_length=metadata.get('fetch_length'),
                       update_time=utcdatetime(metadata.get('update_time')),
                       md5_hash=metadata.get('md5_hash'),
                       metadata_json=json.dumps(metadata)).put()
    except Exception, e:  # pylint: disable=broad-except
      logging.exception(e)


def GetKml(content):
  """Gets the KML content from a string, unzipping a KMZ archive if necessary.

  Args:
    content: A string containing the data from a KML or KMZ file.

  Returns:
    If the data is in zip format: the string contents of the unpacked doc.kml
    file or the first .kml file present, or None if there is no .kml file in
    the zip archive.  Otherwise, just returns the content itself.
  """
  try:
    archive = zipfile.ZipFile(StringIO.StringIO(content))
  except zipfile.BadZipfile:
    return content  # not a zip archive
  try:
    return archive.read('doc.kml')
  except KeyError:
    for name in archive.namelist():  # look for first .kml file
      if name.endswith('.kml'):
        return archive.read(name)


def GetAllXmlTags(content):
  """Gets a list of all tag names (without XML namespaces) in a string of XML.

  Args:
    content: A string with valid XML structure.

  Returns:
    A list of all the tag names, with their XML namespaces removed.
  """
  return [element.tag.split('}')[-1]
          for element in xml.etree.ElementTree.XML(content).getiterator()]


def HasUnsupportedKml(content):
  """Checks whether a KML file has any features unsupported by the Maps API.

  This method does not perform full checking; for example, it does not check
  whether KML files referenced in NetworkLinks contain unsupported features.

  Args:
    content: A string of KML content.

  Returns:
    True if there are any unsupported features found in the KML file.
  """
  tags = GetAllXmlTags(content)
  return (tags.count('Placemark') > KML_MAX_FEATURES or
          tags.count('NetworkLink') > KML_MAX_NETWORK_LINKS or
          not KML_SUPPORTED_TAGS.issuperset(tags))


def GatherMetadata(layer_type, response):
  """Gathers the metadata for a layer into a dictionary.

  Args:
    layer_type: A string, one of the constants defined in maproot.LayerType.
    response: A urlfetch Response object.

  Returns:
    The metadata (the 'fetch_time' key is not set; that is left to the caller).
  """
  content = response.content
  if layer_type == maproot.LayerType.KML:
    content = GetKml(content) or ''
  metadata = {
      'fetch_status': response.status_code,
      'fetch_length': len(content),
      'length': len(content),
      'md5_hash': hashlib.md5(content).hexdigest()
  }
  # response.headers treats dictionary keys as case-insensitive.
  last_modified_header = response.headers.get('Last-modified')
  if last_modified_header:
    metadata['fetch_last_modified'] = last_modified_header
    last_modified_tuple = email.utils.parsedate(last_modified_header)
    if last_modified_tuple:
      metadata['update_time'] = calendar.timegm(last_modified_tuple)
  if 'Etag' in response.headers:
    metadata['fetch_etag'] = response.headers['Etag']

  try:
    if layer_type == maproot.LayerType.KML:
      # TODO(cimamoglu): Look for placemarks within network links.
      tags = GetAllXmlTags(content)
      if not set(tags) & set(['Placemark', 'NetworkLink', 'GroundOverlay']):
        metadata['has_no_features'] = True
      if set(tags) & set(['NetworkLink', 'GroundOverlay']):
        if 'update_time' in metadata:
          del metadata['update_time']  # we don't know the actual update time
      if HasUnsupportedKml(content):
        metadata['has_unsupported_kml'] = True

    if layer_type == maproot.LayerType.GEORSS:
      if 'item' not in GetAllXmlTags(content):
        metadata['has_no_features'] = True

  except xml.etree.ElementTree.ParseError:
    logging.warn('Content is not valid XML')
    metadata['ill_formed'] = True

  return metadata


def FetchAndUpdateMetadata(metadata, address):
  """Fetches a layer and produces an updated metadata dictionary for the layer.

  Args:
    metadata: The current metadata dictionary associated with the URL, or None.
    address: The source address, a string in the form "<type>:<url>".

  Returns:
    The new metadata dictionary (without 'fetch_time'; the caller must set it).
  """
  if ':' not in address:
    return {'fetch_impossible': True}
  layer_type, url = address.split(':', 1)
  logging.info('Fetching metadata for source: %s', address)
  headers = {}
  if metadata and 'fetch_etag' in metadata:
    headers['If-none-match'] = metadata['fetch_etag']
  elif metadata and 'fetch_last_modified' in metadata:
    headers['If-modified-since'] = metadata['fetch_last_modified']
  try:
    response = urlfetch.fetch(url, headers=headers, deadline=MAX_FETCH_SECONDS)
  except urlfetch.Error, e:
    logging.warn('%r from urlfetch for source: %s', e, address)
    if isinstance(e, urlfetch.InvalidURLError):
      return {'fetch_impossible': True}
    if isinstance(e, urlfetch.ResponseTooLargeError):  # over 32 megabytes
      return {'fetch_error_occurred': True, 'fetch_length': 32e6}
    return {'fetch_error_occurred': True}
  logging.info('HTTP status %d for source: %s', response.status_code, address)
  if response.status_code == 304:  # not modified
    return dict(metadata, fetch_status=304, fetch_length=len(response.content))
  if response.status_code == 200:  # success
    return GatherMetadata(layer_type, response)
  return {'fetch_status': response.status_code, 'fetch_error_occurred': True}


def DetermineFetchDelay(metadata):
  """Decides how long to wait before fetching a layer's data again."""
  # Estimate delay based on a metric of cost expended by the remote server.
  fetch_cost = HTTP_FIXED_COST + metadata.get('fetch_length', 0)
  delay = int(fetch_cost / (MAX_MEGABYTES_PER_DAY_PER_SOURCE * 1e6 / 24 / 3600))

  # Also keep the delay within our minimum and maximum bounds.
  min_seconds = (metadata.get('fetch_error_occurred') and
                 MIN_DELAY_AFTER_ERROR_SECONDS or MIN_DELAY_SECONDS)
  return max(min_seconds, min(MAX_DELAY_HOURS * 3600, delay))


def UpdateMetadata(address):
  """Updates the cached metadata dictionary for a single source."""
  fetch_time = int(time.time())
  metadata = cache.Get(['metadata', address])
  metadata = FetchAndUpdateMetadata(metadata, address)
  metadata['fetch_time'] = fetch_time
  cache.Set(['metadata', address], metadata, METADATA_TTL_SECONDS)
  logging.info('Updated metadata: %r', metadata)
  MetadataFetchLog.Log(address, metadata)


def ScheduleFetch(address, countdown=None):
  """Schedules the next fetch task for a source."""
  metadata = cache.Get(['metadata', address]) or {}
  if not metadata.get('fetch_impossible'):
    if countdown is None:
      countdown = DetermineFetchDelay(metadata)
    logging.info('Scheduling fetch in %d s: %s', countdown, address)
    taskqueue.add(
        queue_name='metadata', countdown=countdown, method='GET',
        url=model.Config.Get('root_path', '') + '/.metadata_fetch',
        params={'source': address})


class MetadataFetch(base_handler.BaseHandler):
  """Fetches the metadata for a source."""

  def Get(self):
    """Updates the cached metadata for a source, if it's active."""
    source = self.request.get('source')
    if cache.Get(['metadata_active', source]):
      UpdateMetadata(source)
      ScheduleFetch(source)
    else:
      logging.info('Source is no longer active: %s', source)
