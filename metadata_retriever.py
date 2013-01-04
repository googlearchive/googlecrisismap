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

"""URL endpoint for updating intrinsic properties."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import datetime
import email.utils
import hashlib
import logging
import StringIO
import urllib2
from xml.etree import ElementTree
from xml.parsers.expat import ExpatError
import zipfile

import maproot

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


# The maximum size of the downloaded content from a data source, in bytes.
MAX_CONTENT_SIZE = 10 * 1024 * 1024


class SourceMetadataModel(db.Model):
  """Intrinsic properties of a source.

  Also, keeps track of check frequency and the most recent check time.
  """
  # The latest time that the source data is modified.
  content_last_modified = db.DateTimeProperty()
  # MD5 hash of the source data.
  content_hash = db.StringProperty()
  # Size of the source data in bytes.
  content_length = db.IntegerProperty()
  # Whether the data source is known to contain no displayable features
  # (for KML, this means no placemarks; for GeoRSS, this means no items).
  has_no_features = db.BooleanProperty()
  # Whether the KML file contains any features unsupported by the Maps API.
  has_unsupported_kml = db.BooleanProperty()
  # Entity tag from HTTP headers, in case last modified field does not exist.
  server_etag = db.StringProperty()
  # Last modified time from HTTP headers, kept as the original string sent from
  # the server. Usually, this will carry the same information as
  # content_last_modified time field above, yet it is important to send  back
  # the exact same string for "If-modified-since" within request, as recommended
  # by the HTTP spec.
  server_last_modified = db.StringProperty()
  # Whether an error occurred in the server side. In this case, the frontend
  # can show a message to differentiate such situation from a merely empty map.
  server_error_occurred = db.BooleanProperty()

  # Metadata about the entity itself.
  # The last time when the source data is checked.
  last_checked = db.DateTimeProperty()
  # Interval for checking for updates, in minutes.
  check_interval_minutes = db.IntegerProperty(default=15)

  def NeedsUpdate(self):
    """Determines if the source data must be checked."""
    if getattr(self, 'last_checked', None) is None:
      return True
    if getattr(self, 'check_interval_minutes', None) is None:
      return True
    time_difference = datetime.datetime.utcnow() - self.last_checked
    return time_difference > datetime.timedelta(0, 60 *
                                                self.check_interval_minutes)


def CreateMetadata(key_name, url_handle, content, old_metadata):
  """Creates a new SourceMetadataModel with given data.

  The data, given through arguments, are used to fill in the properties of the
  new object.

  Args:
    key_name: A string, key of the object. This is a JSON string with address
        information.
    url_handle: The URL handler, a file-like object.
    content: The content of the source data.
    old_metadata: The old SourceMetadataModel object which the newly created
        one takes place. check_interval_minutes property is copied into the new
        object.

  Returns:
    A new SourceMetadataModel object, constructed with the given data.
  """
  metadata = SourceMetadataModel(key_name=key_name)
  if (hasattr(old_metadata, 'check_interval_minutes') and
      old_metadata.check_interval_minutes is not None):
    metadata.check_interval_minutes = old_metadata.check_interval_minutes
  # According to HTTP spec, header names are case insensitive. urllib2
  # complies with this rule.
  if 'Last-modified' in url_handle.headers:
    metadata.content_last_modified = (datetime.datetime(*email.utils.parsedate(
        url_handle.headers['Last-modified'])[:6]))
    metadata.server_last_modified = url_handle.headers['Last-modified']
  if 'Etag' in url_handle.headers:
    metadata.server_etag = url_handle.headers['Etag']
  metadata.content_length = len(content)
  metadata.content_hash = hashlib.md5(content).hexdigest()
  metadata.last_checked = datetime.datetime.utcnow()
  return metadata


def CreateErrorMetadata(key_name, old_metadata):
  """Creates a new SourceMetadataModel object in case of error while update.

  This method is called when there's a server side error while trying to update
  the intrinsic properties.

  Args:
    key_name: A string, key of the object. This is a JSON string with address
        information.
    old_metadata: The old SourceMetadataModel object which the newly created
        one takes place. check_interval_minutes property is copied into the new
        object.

  Returns:
    A new SourceMetadataModel object, constructed with the given data.
    server_error_occurred propert is always True.
  """
  check_interval = old_metadata.check_interval_minutes if old_metadata else None
  metadata = SourceMetadataModel(key_name=key_name,
                                 check_interval_minutes=check_interval)
  metadata.server_error_occurred = True
  metadata.last_checked = datetime.datetime.utcnow()
  return metadata


def GetKml(url_handle):
  """Reads the content of a KML file via a given URL handle.

  If the file is zipped (i.e. a valid .kmz file), then this function unzips it,
  looking for a doc.kml file. If it can't find one, it returns the
  alphabetically first .kml file.

  Args:
    url_handle: The URL handle.

  Returns:
    The content of KML file, if it exists and is not empty. None otherwise.
  """
  content = url_handle.read(MAX_CONTENT_SIZE)
  try:
    z = zipfile.ZipFile(StringIO.StringIO(content))
  except zipfile.BadZipfile:
    # If the file is not .kmz, then it's a .kml
    return content

  try:
    content = z.read('doc.kml')
  except KeyError:
    names = z.namelist()
    names = sorted(filter(lambda f: f.endswith('.kml'), names))
    if not names:
      return None
    content = z.read(names[0])
  return content


def GetAllXmlTags(content):
  """Returns the list of tags of all elements in a string of XML.

  Strips all namespaces. This list loses the tree structure of XML.

  Args:
    content: A string with valid XML structure.

  Returns:
    A list of strings of all elements tags with their namespaces stripped.
  """
  xml = ElementTree.XML(content)
  tags = []
  # Remove all the namespace prefixes from the tags.
  for elem in xml.getiterator():
    tags.append(elem.tag.split('}')[-1])
  return tags


def HasUnsupportedKml(content):
  """Checks whether a KML file has any features unsupported by the Maps API.

  This method does not perform full checking can possibly give a wrong result.

  Information about all supported features can be obtained from the following:
  https://developers.google.com/kml/documentation/kmlelementsinmaps
  https://developers.google.com/kml/documentation/mapsSupport

  Args:
    content: The content of a valid KML file.

  Returns:
    True if there are any unsupported aspects of the KML file.
  """
  # Use capital letters for constants.  # pylint: disable=C6409
  MAX_FEATURES = 1000
  MAX_NETWORK_LINKS = 10
  SUPPORTED_ELEMENTS = set(
      ['atom:author', 'atom:link', 'atom:name', 'coordinates', 'Data',
       'description', 'east', 'expires', 'fill', 'Folder', 'GroundOverlay',
       'h', 'heading', 'hint', 'hotSpot', 'href', 'Icon', 'IconStyle',
       'innerBoundaryIs', 'kml', 'latitude', 'LatLonAltBox', 'LatLonBox',
       'LinearRing', 'LineString', 'LineStyle', 'Link', 'Lod', 'longitude',
       'maxAltitude', 'maxFadeExtent', 'maxLodPixels', 'minAltitude',
       'minFadeExtent', 'minLodPixels', 'name', 'NetworkLink', 'north', 'open',
       'outerBoundaryIs', 'outline', 'Placemark', 'Point', 'Polygon',
       'PolyStyle', 'range', 'refreshMode', 'ScreenOverlay', 'size', 'Snippet',
       'south', 'Style', 'text', 'Url', 'value', 'viewRefreshTime', 'w',
       'west', 'width', 'x', 'y', 'Document', 'ExtendedData', 'BalloonStyle',
       'Change', 'color', 'MultiGeometry', 'NetworkLinkControl',
       'refreshInterval', 'targetHref', 'Update', 'viewRefreshMode',
       'visibility'])

  tags = GetAllXmlTags(content)
  if tags.count('Placemark') > MAX_FEATURES:
    return True
  if tags.count('NetworkLink') > MAX_NETWORK_LINKS:
    return True
  return not SUPPORTED_ELEMENTS.issuperset(tags)


def CreateConnection(url, metadata):
  """Create an HTTP connection.

  Args:
    url: The URL to fetch.
    metadata: The SourceMetadata entity associated with the URL.

  Returns:
    If successful (HTTP status code 200), return the URL handle.
    If the URL is not modified since the last inspection (304), returns None.
    In any other error, re-raise the exception.
  """
  request = urllib2.Request(url)
  if hasattr(metadata, 'server_last_modified'):
    request.add_header('If-Modified-Since', metadata.server_last_modified)
  if hasattr(metadata, 'server_etag'):
    request.add_header('If-None-Match', metadata.server_etag)
  opener = urllib2.build_opener()
  # TODO(cimamoglu): Handle redirection.
  try:
    url_handle = opener.open(request)
  # If successful, HTTP 200 status code will not raise an exception.
  except urllib2.HTTPError, e:
    # 304 is not an error essentially, so just return None.
    if getattr(e, 'code', None) == 304:
      return None
    else:
      # If there really is an error, re-raise the exception to be handled by
      # the caller.
      logging.error('HTTPError at URL %s:   msg:%s   headers:%s   code:%s',
                    url, e.msg, e.hdrs, e.code)
      raise
  return url_handle


def UpdateFromKml(address):
  """Updates the SourceMetadata entity of a KML source.

  Args:
    address: URL address of the KML source, a string.

  Returns:
    SourceMetadata entity associated with the source.
  """
  # Key name is URL for KML.
  metadata = SourceMetadataModel.get_by_key_name(address)
  if not metadata or metadata.NeedsUpdate():
    logging.info('Layer needs update, fetching: %s', address)
    try:
      url_handle = CreateConnection(address, metadata)
      if url_handle:
        content = GetKml(url_handle)
        metadata = CreateMetadata(address, url_handle, content, metadata)
        url_handle.close()
        xml_tags = GetAllXmlTags(content)
        # TODO(cimamoglu): Look for placemarks within network links.
        metadata.has_no_features = ('Placemark' not in xml_tags and
                                    'NetworkLink' not in xml_tags)
        metadata.has_unsupported_kml = HasUnsupportedKml(content)
    except urllib2.HTTPError:
      metadata = CreateErrorMetadata(address, metadata)
    except ExpatError:
      logging.error('Error in parsing XML at address: %s', address)
    metadata.put()
  return metadata


def UpdateFromGeorss(address):
  """Updates the SourceMetadata entity of a GeoRSS source.

  Args:
    address: URL address of the GeoRSS source, a string.

  Returns:
    SourceMetadata entity associated with the source.
  """
  # Key name is URL for GeoRSS.
  metadata = SourceMetadataModel.get_by_key_name(address)
  if not metadata or metadata.NeedsUpdate():
    logging.info('Layer needs update, fetching: %s', address)
    try:
      url_handle = CreateConnection(address, metadata)
      if url_handle:
        content = url_handle.read(MAX_CONTENT_SIZE)
        metadata = CreateMetadata(address, url_handle, content, metadata)
        url_handle.close()
        metadata.has_no_features = 'item' not in GetAllXmlTags(content)
    except urllib2.HTTPError:
      metadata = CreateErrorMetadata(address, metadata)
    except ExpatError:
      logging.error('Error in parsing GeoRSS at address: %s', address)
    metadata.put()
  return metadata


def UpdateSourceMetadata(address, layer_type):
  """Updates the metadata of a layer based on its type.

  Args:
    address: Address of the data source, a string.
    layer_type: Type of the layer, a string.
  """
  if layer_type == maproot.LayerType.KML:
    UpdateFromKml(address)
  elif layer_type == maproot.LayerType.GEORSS:
    UpdateFromGeorss(address)
  else:
    pass


class MetadataRetriever(webapp.RequestHandler):
  """Updates intrinsic properties of a layer."""

  def post(self):  # pylint: disable-msg=C6409
    """Updates intrinsic properties of a layer."""
    address = self.request.get('address')
    layer_type = self.request.get('type')
    UpdateSourceMetadata(address, layer_type)


application = webapp.WSGIApplication([
    ('/crisismap/metadata_retriever', MetadataRetriever),
], debug=True)


def main():
  run_wsgi_app(application)


if __name__ == '__main__':
  main()
