#!/usr/bin/python2.7
# Copyright 2013 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.
"""A converter that takes a GeoRSS feed and adds custom icons.

The GeoRSS is converted into KML.
"""

# App Engine requires that we put this first.  # pylint: disable=C6203,C6204
import base_handler

KML_CONTENT_TYPE = 'application/vnd.google-earth.kml+xml'
KML_DOCUMENT_TEMPLATE = """\
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.2">
%s</kml>
"""

import hashlib
import random
import re
import string

import webapp2

import xml_utils

from google.appengine.api import memcache
from google.appengine.api import urlfetch

TTL = 120


class IconCache(object):
  """A cache of seen icons that also tracks their KML-safe names."""

  def __init__(self):
    self.icons = {}
    self.safe_icon_names = set()

  def Add(self, icon):
    """Adds an icon to the cache, and returns its safe name."""
    safe_name = self.icons.get(icon)
    if safe_name:
      return safe_name
    # turn the name into something safe.
    safe_name = re.sub(r'[^_A-Za-z0-9]', '_', icon).lower()
    if safe_name in self.safe_icon_names:
      while True:
        try_name = (safe_name + random.choice(string.ascii_letters)
                    + random.choice(string.ascii_letters))
        if try_name not in self.safe_icon_names:
          safe_name = try_name
          break
    self.icons[icon] = safe_name
    self.safe_icon_names.add(safe_name)
    return safe_name

  def __iter__(self):
    return iter(sorted(self.icons.items()))


class Rss2Kml(base_handler.BaseHandler):
  """Converts a GeoRSS feed to KML according to styling parameters."""

  def MandatoryParam(self, key):
    value = str(self.request.get(key))
    if not value:
      raise ValueError('%s is mandatory' % key)
    return value

  def get(self):  # pylint:disable=g-bad-name
    """GET handler.

    Query Parameters:
      ib: icon base path. Should have a single '$' sign, which will be replaced
      with the matching icon name.
      url: georss URL
      field: the RSS element in the RSS item to inspect
      s: repeated parameter of icon:altitude:substring. Order matters.
      p: parameter of border:fill for polygons, each aabbggrr strings.
      Will check the specified field for the substring (case insensitive).
      First one to be found, the icon will be substituted into the 'icon_base'.
      If the substring contains the character 0x01 (^a) the string will be
      split on that, and each term must be present to match.
      The altitude will be set on the point. Larger numbers will appear
      on top - use for more important alerts.
      Make sure the last entry matches everything.
      If icon is the empty string, this entry will be dropped.

    Raises:
      ValueError: If any required arguments are missing.
    """
    cache_key = 'RSS2KML+' + hashlib.sha1(self.request.query_string).hexdigest()

    kml = memcache.get(cache_key)
    if kml is not None:
      last_mod = memcache.get(cache_key + 'last_mod')
      self.RespondWithKml(kml, last_mod)
      return

    icon_base = self.MandatoryParam('ib')
    url = self.MandatoryParam('url')
    rss_field = self.MandatoryParam('field')
    search_queries = self.request.get_all('s')
    # TODO(arb): Maybe support multiple polygon styles?
    polygon_style = self.request.get('p')

    searches = []
    for search in search_queries:
      icon, altitude, search_string = (search.split(':', 2) + ['', ''])[:3]
      # Note that we don't use altitude right now in the KML output.
      searches.append((search_string.lower().split(chr(1)), icon, altitude))
    if not searches:
      raise ValueError('need to specify searches - s is mandatory')
    rss_response = urlfetch.fetch(url, validate_certificate=False,
                                  deadline=30)
    rss_text = rss_response.content
    last_modified_header = rss_response.headers.get('Last-modified')
    doc = self.GenerateKml(rss_text, icon_base, rss_field, searches,
                           polygon_style)
    kml = KML_DOCUMENT_TEMPLATE % xml_utils.Serialize(doc)
    self.RespondWithKml(kml, last_modified_header)
    memcache.set(cache_key, kml, TTL)
    memcache.set(cache_key + 'last_mod', last_modified_header, TTL)

  def RespondWithKml(self, kml, last_modified_header):
    self.response.write(kml)
    self.response.headers['Content-Type'] = KML_CONTENT_TYPE
    self.response.headers['Last-modified'] = last_modified_header
    self.response.headers['Cache-Control'] = (
        'public, max-age=180, must-revalidate')

  def GenerateKml(self, rss, icon_base, rss_field, searches, polygon_style):
    """Turn a GeoRSS feed into KML."""
    element = xml_utils.Xml
    xml = xml_utils.Parse(rss)
    # Get the first child of the root - the RSS <channel> tag.
    channel_xml = xml[0]
    placemarks = []

    seen_icons = IconCache()
    for entry in channel_xml.findall('item'):
      placemarks.append(self.ConvertEntry(entry, searches, rss_field,
                                          seen_icons))

    # Now create the icon styles
    styles = []
    if polygon_style:
      border, fill = polygon_style.split(':')
      polystyle = [
          element('PolyStyle',
                  element('color', fill),
                  element('colorMode', 'normal'),
                  element('fill', 1),
                  element('outline', 1)),
          element('LineStyle',
                  element('color', border),
                  element('colorMode', 'normal'))]
    else:
      polystyle = []
    for icon, safe_name in seen_icons:
      url = icon_base.replace('$', icon)
      styles.append(
          element(
              'Style', {'id': 'style_%s' % safe_name},
              element(
                  'IconStyle', element('Icon', element('href', url))),
              *polystyle))

    return element('Document', styles, placemarks)

  def ConvertEntry(self, entry, searches, rss_field, seen_icons):
    """Converts an RSS entry to a KML placemark.

    Looks at the appropriate field from the RSS item, selects the correct icon,
    then returns the KML Placemark with the icon set.

    Args:
      entry: The RSS <item> element.
      searches: A list of 3-tuples - search, icon, altitude.
      rss_field: The RSS item element to check for the search strings.
      seen_icons: An IconCache - used to track the seen icons.
    Returns:
      The new KML Placemark element.
    """
    item_values = {}
    # TODO(arb): Multiple points/polygons
    for child in entry:
      item_values.setdefault(child.tag.split('}')[-1], []).append(child.text)
    # Now find the icon
    # Icon searching only supports single-valued fields, like 'category',
    # not ones that can appear multiple times.
    field_value = item_values[rss_field][0].lower()
    icon_value = None
    for search_strings, icon, unused_altitude in searches:
      # Make sure all search strings match.
      if all(x in field_value for x in search_strings):
        if not icon:
          return
        icon_value = seen_icons.Add(icon)
        break
    return self.CreatePlacemark(item_values, icon_value)

  def CreatePlacemark(self, item_values, icon_value):
    """Creates a KML Placemark for a given RSS item.

    Args:
      item_values: A dictionary of RSS tag names to tag contents.
      icon_value: The icon to use for this item.

    Returns:
      The newly created KML Placemark.
    """
    element = xml_utils.Xml

    point_elements = []
    for point in item_values.get('point', []):
      p_lat, p_lon = point.split()
      point_elements.append(element(
          'Point', element('coordinates', '%s,%s,%s' % (p_lon, p_lat, 0))))

    polygon_elements = []
    for poly in item_values.get('polygon', []):
      vals = poly.split()
      poly = zip(vals[1::2], vals[0::2])
      polygon = '\n'.join('%s,%s,0' % x for x in poly)
      polygon_elements.append(element(
          'Polygon',
          element(
              'outerBoundaryIs', element(
                  'LinearRing', element('coordinates', polygon)))))

    # in the following, the [0] is because we want the first (hopefully only)
    # instance of each of the given tags.
    return element(
        'Placemark',
        element('name', item_values.get('title')[0]),
        element('description', item_values.get('description')[0]),
        element('MultiGeometry', *[point_elements + polygon_elements]),
        element('styleUrl', '#style_%s' % icon_value),
        id=item_values.get('guid')[0])


app = webapp2.WSGIApplication([('.*', Rss2Kml)])
