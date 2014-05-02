#!/usr/bin/python
# Copyright 2014 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Displays a card containing a list of nearby features for a given topic."""

import cgi
import json
import logging
import math
import re
import urllib

import base_handler
import cache
import config
import kmlify
import maproot
import model

from google.appengine.api import urlfetch
from google.appengine.ext import ndb  # just for GeoPt


XML_CONTENT_TTL = 30  # seconds to keep fetched XML content in cache
CROWD_REPORT_ANSWERS_TTL = 10  # seconds to keep survey answers in cache
GOOGLE_SPREADSHEET_CSV_URL = (
    'https://docs.google.com/spreadsheet/pub?key=$key&output=csv')
DEGREES = 3.14159265358979/180


def RoundGeoPt(point):
  return '%.4f,%.4f' % (point.lat, point.lon)  # 10-m resolution


class Feature(object):
  """A feature (map item) from a source data layer."""

  def __init__(self, name, description_html, location):
    self.name = name
    self.description_html = description_html
    self.location = location  # should be an ndb.GeoPt
    self.distance = None
    self.answers = []

  def __cmp__(self, other):
    return cmp((self.distance, self.name), (other.distance, other.name))

  distance_km = property(lambda self: self.distance and self.distance/1000.0)
  distance_mi = property(lambda self: self.distance and self.distance/1609.344)


def EarthDistance(a, b):
  """Great circle distance in metres between two points on the Earth."""
  lat1, lon1 = a.lat*DEGREES, a.lon*DEGREES
  lat2, lon2 = b.lat*DEGREES, b.lon*DEGREES
  dlon = lon2 - lon1

  atan2, cos, sin, sqrt = math.atan2, math.cos, math.sin, math.sqrt
  y = sqrt(pow(cos(lat2)*sin(dlon), 2) +
           pow(cos(lat1)*sin(lat2) - sin(lat1)*cos(lat2)*cos(dlon), 2))
  x = sin(lat1)*sin(lat2) + cos(lat1)*cos(lat2)*cos(dlon)
  return 6378000*atan2(y, x)


def GetText(element):
  return (element is not None) and element.text or ''


def GetFeaturesFromXml(xml_content):
  """Extracts a list of Feature objects from KML, GeoRSS, or Atom content."""
  root = kmlify.ParseXml(xml_content)
  for element in root.getiterator():
    element.tag = element.tag.split('}')[-1]  # remove XML namespaces
  features = []
  for item in (root.findall('.//Placemark') +
               root.findall('.//entry') + root.findall('.//item')):
    lat = lon = ''
    try:
      if item.find('.//coordinates') is not None:
        lon, lat = GetText(item.find('.//coordinates')).split(',')[:2]
      if item.find('.//point') is not None:
        lat, lon = GetText(item.find('.//point')).split()[:2]
      location = ndb.GeoPt(float(lat), float(lon))
    except ValueError:
      continue
    texts = {child.tag: GetText(child) for child in item.getchildren()}
    features.append(Feature(texts.get('title') or texts.get('name'),
                            texts.get('description') or texts.get('content') or
                            texts.get('summary'), location))
  return features


def GetKmlUrl(root_url, layer):
  """Forms the URL that gets the KML for a given KML-powered layer."""
  layer_type = layer.get('type')
  if layer_type not in [maproot.LayerType.KML,
                        maproot.LayerType.GEORSS,
                        maproot.LayerType.GOOGLE_SPREADSHEET,
                        maproot.LayerType.GEOJSON,
                        maproot.LayerType.CSV]:
    return None

  source = (layer.get('source', {}).values() or [{}])[0]
  url = source.get('url')
  if layer_type in [maproot.LayerType.KML, maproot.LayerType.GEORSS]:
    return url or None

  if layer_type == maproot.LayerType.GOOGLE_SPREADSHEET:
    match = re.search(r'spreadsheet/.*[?&]key=(\w+)', url)
    url = match and GOOGLE_SPREADSHEET_CSV_URL.replace('$key', match.group(1))

  # See http://goto.google.com/kmlify for details on kmlify's query params.
  if url:
    params = [('url', url)]
    if layer_type == maproot.LayerType.GEOJSON:
      params += [('type', 'geojson')]
    else:
      lat, lon = source.get('latitude_field'), source.get('longitude_field')
      if not (lat and lon):
        return None
      params += [('type', 'csv'),
                 ('loc', lat == lon and lat or lat + ',' + lon),
                 ('icon', source.get('icon_url_template')),
                 ('color', source.get('color_template')),
                 ('hotspot', source.get('hotspot_template'))]
    params += [('name', source.get('title_template')),
               ('desc', source.get('description_template')),
               ('cond', source.get('condition0')),
               ('cond', source.get('condition1')),
               ('cond', source.get('condition2'))]
    return (root_url + '/.kmlify?' +
            urllib.urlencode([(k, v) for k, v in params if v]))


def GetTopic(root, topic_id):
  return {topic['id']: topic for topic in root['topics']}.get(topic_id)


def GetLayer(root, layer_id):
  return {layer['id']: layer for layer in root['layers']}.get(layer_id)


def GetFeatures(map_root, topic_id, request):
  """Gets a list of the Feature objects for a given topic."""
  topic = GetTopic(map_root, topic_id) or {}
  features = []
  for layer_id in topic.get('layer_ids', []):
    url = GetKmlUrl(request.root_url, GetLayer(map_root, layer_id) or {})
    if url:
      try:
        content = cache.Get(['card', url],
                            lambda: kmlify.FetchData(url, request.host),
                            XML_CONTENT_TTL)
        features += GetFeaturesFromXml(content)
      except (SyntaxError, urlfetch.DownloadError):
        pass
  return features


def GetLatestAnswers(map_id, topic_id, location, radius):
  """Gets the latest CrowdReport answers for the given topic and location."""
  full_topic_id = map_id + '.' + topic_id
  aids_by_qid = {}
  for report in model.CrowdReport.GetByLocation(
      location, {full_topic_id: radius}, 100, hidden=False):
    for answer_id in report.answer_ids:
      tid, qid, aid = answer_id.rsplit('.', 2)
      if tid == full_topic_id:
        # GetByLocation returns reports in reverse updated order, so we keep
        # just the first answer that we see for each question.
        aids_by_qid[qid] = aids_by_qid.get(qid, aid)
  return aids_by_qid


def GetLegibleTextColor(background_color):
  """Decides whether text should be black or white over a given color."""
  rgb = background_color.strip('#')
  if len(rgb) == 3:
    rgb = rgb[0]*2 + rgb[1]*2 + rgb[2]*2
  red, green, blue = int(rgb[0:2], 16), int(rgb[2:4], 16), int(rgb[4:6], 16)
  luminance = red * 0.299 + green * 0.587 + blue * 0.114
  return luminance > 128 and '#000' or '#fff'


def SetAnswersOnFeatures(features, map_root, topic_id):
  """Populates the 'answers' lists for all the given Feature objects."""
  map_id = map_root.get('id') or ''
  topic = GetTopic(map_root, topic_id) or {}
  radius = topic.get('cluster_radius', 100)
  answers_by_question = {
      question['id']: {answer['id']: answer for answer in question['answers']}
      for question in topic.get('questions', [])}
  for answers in answers_by_question.values():
    for answer in answers.values():
      answer['text_color'] = GetLegibleTextColor(answer['color'])
  if topic.get('crowd_enabled') and answers_by_question:
    for f in features:
      aids_by_qid = cache.Get(
          ['answers', map_id, topic_id, RoundGeoPt(f.location), radius],
          lambda: GetLatestAnswers(map_id, topic_id, f.location, radius),
          CROWD_REPORT_ANSWERS_TTL)
      f.answers = [answers_by_question.get(qid, {}).get(aid)
                   for qid, aid in aids_by_qid.items()]


def SetDistanceOnFeatures(features, center):
  for f in features:
    f.distance = EarthDistance(center, f.location)


def FilterFeatures(features, radius, max_count):
  features.sort()
  features[:] = [f for f in features if f.distance < radius][:max_count]


def RemoveParamsFromUrl(url, *params):
  """Removes specified query parameters from a given URL."""
  base, query = (url.split('?') + [''])[:2]
  pairs = cgi.parse_qsl(query)
  query = urllib.urlencode([(k, v) for k, v in pairs if k not in params])
  # Returned URL always ends in ? or a query parameter, so that it's always
  # safe to add a parameter by appending '&name=value'.
  return base + '?' + query


class CardBase(base_handler.BaseHandler):
  """Card rendering code common to all the card handlers below."""
  embeddable = True
  error_template = 'card-error.html'

  def GetForMap(self, map_root, topic_id):
    topic = GetTopic(map_root, topic_id)
    if not topic:
      raise base_handler.Error(404, 'No such topic.')
    lat_lon = str(self.request.get('ll', ''))
    max_count = int(self.request.get('n', 5))  # number of results to show
    radius = float(self.request.get('r', 100000))  # radius, metres
    unit = str(self.request.get('unit', 'km'))
    try:
      lat, lon = lat_lon.split(',')
      center = ndb.GeoPt(float(lat), float(lon))
    except ValueError:
      center = None

    try:
      features = GetFeatures(map_root, topic_id, self.request)
      if center:
        SetDistanceOnFeatures(features, center)
      FilterFeatures(features, radius, max_count)
      SetAnswersOnFeatures(features, map_root, topic_id)
      lang = base_handler.SelectLanguageForRequest(self.request, map_root)
      self.response.out.write(self.RenderTemplate('card.html', {
          'title': topic.get('title', ''),
          'features': features,
          'unit': unit,
          'location': center and RoundGeoPt(center),
          'lang': lang,
          'url_no_unit': RemoveParamsFromUrl(self.request.url, 'unit'),
          'config_json': json.dumps({
              'url_no_ll': RemoveParamsFromUrl(self.request.url, 'll'),
              'size_callback': self.request.get('cb', '')
          })
      }))

    except Exception, e:  # pylint:disable=broad-except
      logging.exception(e)


class CardByIdAndTopic(CardBase):
  """Produces a card given a map ID and topic ID."""
  # TODO(kpy): Show error messages in a friendly and readable way in a card.

  def Get(self, map_id, topic_id, user=None):
    map_object = model.Map.Get(map_id)
    if not map_object:
      raise base_handler.Error(404, 'No such map.')
    self.GetForMap(json.loads(map_object.GetCurrentJson()), topic_id)


class CardByLabelAndTopic(CardBase):
  """Produces a card given a published map label and topic ID."""

  def Get(self, label, topic_id, user=None, domain=None):
    domain = domain or config.Get('primary_domain') or ''
    entry = model.CatalogEntry.Get(domain, label)
    if not entry:
      raise base_handler.Error(404, 'No such map.')
    self.GetForMap(json.loads(entry.maproot_json), topic_id)


class CardByLabel(CardBase):
  """Redirects to the first topic for the specified map."""

  def Get(self, label, user=None, domain=None):
    domain = domain or config.Get('primary_domain') or ''
    entry = model.CatalogEntry.Get(domain, label)
    if not entry:
      raise base_handler.Error(404, 'No such map.')
    topics = json.loads(entry.maproot_json).get('topics', [])
    if not topics:
      raise base_handler.Error(404, 'Map has no topics.')
    self.redirect('%s/%s' % (label, str(topics[0]['id'])))
