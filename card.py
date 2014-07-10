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
import datetime
import json
import logging
import math
import re
import urllib
import urlparse

import base_handler
import cache
import config
import kmlify
import maproot
import model
import utils

from google.appengine.api import urlfetch
from google.appengine.ext import ndb  # just for GeoPt

# Fetched strings of XML content, keyed by URL.
XML_CACHE = cache.Cache('card.xml', 300)

# Lists of Feature objects, keyed by [map_id, map_version_id, topic_id,
# geolocation_rounded_to_10m, radius, max_count].
FEATURE_LIST_CACHE = cache.Cache('card.feature_list', 60)

# Pairs ({qid: answer}, {qid: effective_time_of_last_answer}), keyed by
# [map_id, map_version_id, topic_id, geolocation_rounded_to_10m, radius].
ANSWER_CACHE = cache.Cache('card.answers', 15)

MAX_ANSWER_AGE = datetime.timedelta(days=7)  # ignore answers older than 7 days
GOOGLE_SPREADSHEET_CSV_URL = (
    'https://docs.google.com/spreadsheet/pub?key=$key&output=csv')
DEGREES = 3.14159265358979/180
DEFAULT_STATUS_COLOR = '#eee'


def RoundGeoPt(point):
  return '%.4f,%.4f' % (point.lat, point.lon)  # 10-m resolution


class Feature(object):
  """A feature (map item) from a source data layer."""

  def __init__(self, name, description_html, location, layer_id=None):
    self.name = name
    self.description_html = description_html
    self.layer_id = layer_id
    self.location = location  # should be an ndb.GeoPt
    self.distance = None
    self.status_color = None
    self.answer_text = ''
    self.answer_time = ''

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


def GetFeaturesFromXml(xml_content, layer_id=None):
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
                            texts.get('summary'), location, layer_id))
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
        content = XML_CACHE.Get(
            url, lambda: kmlify.FetchData(url, request.host))
        features += GetFeaturesFromXml(content, layer_id)
      except (SyntaxError, urlfetch.DownloadError):
        pass
  return features


def SetDistanceOnFeatures(features, center):
  for f in features:
    f.distance = EarthDistance(center, f.location)


def FilterFeatures(features, radius, max_count):
  # TODO(kpy): A top-k selection algorithm could be faster than O(n log n)
  # sort.  It seems likely to me that the gain would be small enough that it's
  # not worth the code complexity, but it wouldn't hurt to check my hunch.
  features.sort()  # sorts by distance; see Feature.__cmp__
  features[:] = [f for f in features[:max_count] if f.distance < radius]


def GetFilteredFeatures(map_root, map_version_id, topic_id, request,
                        center, radius, max_count):
  """Gets a list of the Feature objects for a topic within the given circle."""
  def GetFromDatastore():
    features = GetFeatures(map_root, topic_id, request)
    if center:
      SetDistanceOnFeatures(features, center)
    FilterFeatures(features, radius, max_count)
    return features

  return FEATURE_LIST_CACHE.Get(
      [map_root['id'], map_version_id, topic_id,
       center and RoundGeoPt(center), radius, max_count], GetFromDatastore)


def GetLatestAnswers(map_id, topic_id, location, radius):
  """Gets the latest CrowdReport answers for the given topic and location."""
  full_topic_id = map_id + '.' + topic_id
  answers = {}
  answer_times = {}
  now = datetime.datetime.utcnow()
  # Assume that all the most recently effective still-relevant answers are
  # contained among the 100 most recently updated CrowdReport entities.
  for report in model.CrowdReport.GetByLocation(
      location, {full_topic_id: radius}, 100, hidden=False):
    if now - report.effective < MAX_ANSWER_AGE:
      for question_id, answer in report.answers.items():
        tid, qid = question_id.rsplit('.', 1)
        if tid == full_topic_id:
          if answer or answer == 0:  # non-empty answer
            if qid not in answer_times or report.effective > answer_times[qid]:
              answers[qid] = answer
              answer_times[qid] = report.effective
  return answers, max(answer_times.values() or [None])


def GetLegibleTextColor(background_color):
  """Decides whether text should be black or white over a given color."""
  rgb = background_color.strip('#')
  if len(rgb) == 3:
    rgb = rgb[0]*2 + rgb[1]*2 + rgb[2]*2
  red, green, blue = int(rgb[0:2], 16), int(rgb[2:4], 16), int(rgb[4:6], 16)
  luminance = red * 0.299 + green * 0.587 + blue * 0.114
  return luminance > 128 and '#000' or '#fff'


def SetAnswersOnFeatures(features, map_root, map_version_id, topic_id, qids):
  """Populates 'status_color' and 'jnswer_text' on the given Feature objects."""
  map_id = map_root.get('id') or ''
  topic = GetTopic(map_root, topic_id) or {}
  radius = topic.get('cluster_radius', 100)

  questions_by_id = {q['id']: q for q in topic.get('questions', [])}
  choices_by_id = {(q['id'], c['id']): c
                   for q in topic.get('questions', [])
                   for c in q.get('choices', [])}

  if topic.get('crowd_enabled') and qids:
    for f in features:
      answers, answer_time = ANSWER_CACHE.Get(
          [map_version_id, topic_id, RoundGeoPt(f.location), radius],
          lambda: GetLatestAnswers(map_id, topic_id, f.location, radius))
      answer_texts = []
      for i, qid in enumerate(qids):
        question, answer = questions_by_id.get(qid, {}), answers.get(qid)
        if question.get('type') == 'CHOICE':
          choice = choices_by_id.get((qid, answer)) or {}
          if choice:
            answer_texts.append(
                choice.get('label', '') or
                question.get('title', '') + ': ' + choice.get('title', ''))
          if i == 0:
            f.status_color = choice.get('color') or DEFAULT_STATUS_COLOR
        elif answer or answer == 0:
          answer_texts.append(question.get('title', '') + ': ' + str(answer))
      if answer_texts:
        f.answer_text = ', '.join(answer_texts)
        f.answer_time = utils.ShortAge(answer_time)


def RemoveParamsFromUrl(url, *params):
  """Removes specified query parameters from a given URL."""
  base, query = (url.split('?') + [''])[:2]
  pairs = cgi.parse_qsl(query)
  query = urllib.urlencode([(k, v) for k, v in pairs if k not in params])
  # Returned URL always ends in ? or a query parameter, so that it's always
  # safe to add a parameter by appending '&name=value'.
  return base + '?' + query


def GetGeoJson(features):
  """Converts a list of Feature instances to a GeoJSON object."""
  return {'type': 'FeatureCollection', 'features': [{
      'type': 'Feature',
      'geometry': {
          'type': 'Point',
          'coordinates': [f.location.lon, f.location.lat]
      },
      'properties': {
          'name': f.name,
          'description_html': kmlify.HtmlEscape(f.description_html),
          'distance': f.distance,
          'distance_mi': f.distance_mi,
          'distance_km': f.distance_km,
          'layer_id': f.layer_id,
          'status_color': f.status_color,
          'answer_text': f.answer_text,
          'answer_time': f.answer_time
      }
  } for f in features]}


def RenderFooter(items):
  """Renders the card footer as HTML.

  Args:
    items: A sequence of items, where each item is (a) a string or (b) a pair
        [url, text] to be rendered as a hyperlink that opens in a new window.
  Returns:
    A Unicode string of safe HTML containing only text and <a> tags.
  """
  results = []
  for item in items:
    if isinstance(item, (str, unicode)):
      results.append(kmlify.HtmlEscape(item))
    elif len(item) == 2:
      url, text = item
      scheme, _, _, _, _ = urlparse.urlsplit(url)
      if scheme in ['http', 'https']:  # accept only safe schemes
        results.append('<a href="%s" target="_blank">%s</a>' % (
            kmlify.HtmlEscape(url), kmlify.HtmlEscape(text)))
  return ''.join(results)


class CardBase(base_handler.BaseHandler):
  """Card rendering code common to all the card handlers below.

  For all these card handlers, the map and topic are determined from the
  URL path (the map is specified by ID or label, and the topic ID is either
  explicit in the path or assumed to be the first existing topic for the map).
  Use these query parameters to customize the resulting card:
    - n: Maximum number of items to show.
    - ll: Geolocation of the center point to search near (in lat,lon format).
    - r: Search radius in metres.
    - output: If 'json', response is returned as GeoJSON; otherwise,
      it is rendered as HTML.
    - unit: Distance unit to show (either 'km' or 'mi').
    - qids: Comma-separated IDs of questions within the topic.  Short text
          descriptions of the most recently crowd-reported answers to these
          questions are shown with each item.  The first question in qids is
          treated specially: if it is a CHOICE question, its answer will also
          be displayed as a coloured status dot.
    - places: A specification of the list of possible locations for which the
          card has content, specified as a JSON array of objects, each with
          the following keys: "id", "name", and "ll". Example:
            [{"id":"place1", "name":"Centerville", "ll":[10.0,-120.0]},
             {"id": "place2", "name":"Springfield", "ll":[10.5,-120.5"]}]
    - place: A place ID, expected to be one of the "ids" of the provided
          '?places' array. If the given place ID is invalid, a default place
          is used (the first place in the ?places array). If a valid '?ll' is
          provided, the '?place' parameter is ignored.
    - footer: Text and links for the footer, specified as a JSON array where
          each element is either a plain text string or a two-element array
          [url, text], which is rendered as a link.
  """
  embeddable = True
  error_template = 'card-error.html'

  def GetForMap(self, map_root, map_version_id, topic_id, map_label=None):
    """Renders the card for a particular map and topic.

    Args:
      map_root: The MapRoot dictionary for the map.
      map_version_id: The version ID of the MapVersionModel (for a cache key).
      topic_id: The topic ID.
      map_label: The label of the published map (for analytics).
    """
    topic = GetTopic(map_root, topic_id)
    if not topic:
      raise base_handler.Error(404, 'No such topic.')
    output = str(self.request.get('output', ''))
    lat_lon = str(self.request.get('ll', ''))
    max_count = int(self.request.get('n', 5))  # number of results to show
    radius = float(self.request.get('r', 100000))  # radius, metres
    unit = str(self.request.get('unit', 'km'))
    qids = self.request.get('qids').replace(',', ' ').split()
    places_json = self.request.get('places') or '[]'
    place_id = str(self.request.get('place', ''))
    footer_json = self.request.get('footer') or '[]'
    location_unavailable = self.request.get('location_unavailable')
    lang = base_handler.SelectLanguageForRequest(self.request, map_root)

    try:
      places = json.loads(places_json)
    except ValueError:
      logging.error('Could not parse ?places= parameter')
    try:
      footer = json.loads(footer_json)
    except ValueError:
      logging.error('Could not parse ?footer= parameter')

    # If '?ll' parameter is supplied, find nearby results.
    center = None
    if lat_lon:
      try:
        lat, lon = lat_lon.split(',')
        center = ndb.GeoPt(float(lat), float(lon))
      except ValueError:
        logging.error('Could not extract center for ?ll parameter')

    # If neither '?ll' nor '?place' parameters are given, or if ?place
    # value is invalid, use a default place.
    place = None
    if not center:
      place = {p['id']: p for p in places}.get(place_id, places and places[0])

    # If '?place' parameter is supplied, use it as the center of the
    # point-radius query.
    if not center and place:
      try:
        lat, lon = place['ll']
        center = ndb.GeoPt(lat, lon)
      except (KeyError, TypeError, ValueError):
        logging.error('Could not extract center for ?place=%s', place_id)

    try:
      features = GetFilteredFeatures(
          map_root, map_version_id, topic_id, self.request,
          center, radius, max_count)
      SetAnswersOnFeatures(features, map_root, map_version_id, topic_id, qids)
      geojson = GetGeoJson(features)
      if output == 'json':
        self.WriteJson(geojson)
      else:
        self.response.out.write(self.RenderTemplate('card.html', {
            'features': geojson['features'],
            'title': topic.get('title', ''),
            'unit': unit,
            'lang': lang,
            'url_no_unit': RemoveParamsFromUrl(self.request.url, 'unit'),
            'place': place,
            'config_json': json.dumps({
                'url_no_loc': RemoveParamsFromUrl(
                    self.request.url, 'll', 'place'),
                'place': place,
                'location_unavailable': bool(location_unavailable),
                'map_id': map_root.get('id', ''),
                'topic_id': topic_id,
                'map_label': map_label or '',
                'topic_title': topic.get('title', '')
            }),
            'places_json': json.dumps(places),
            'footer_html': RenderFooter(footer)
        }))

    except Exception, e:  # pylint:disable=broad-except
      logging.exception(e)


class CardByIdAndTopic(CardBase):
  """Produces a card given a map ID and topic ID."""

  def Get(self, map_id, topic_id, user=None, domain=None):
    m = model.Map.Get(map_id)
    if not m:
      raise base_handler.Error(404, 'No such map.')
    self.GetForMap(m.map_root, m.current_version_id, topic_id)


class CardByLabelAndTopic(CardBase):
  """Produces a card given a published map label and topic ID."""

  def Get(self, label, topic_id, user=None, domain=None):
    domain = domain or config.Get('primary_domain') or ''
    entry = model.CatalogEntry.Get(domain, label)
    if not entry:
      raise base_handler.Error(404, 'No such map.')
    self.GetForMap(entry.map_root, entry.map_version_id, topic_id, label)

  def Post(self, label, topic_id, user=None, domain=None):
    self.Get(label, topic_id, user, domain)


class CardByLabel(CardBase):
  """Redirects to the first topic for the specified map."""

  def Get(self, label, user=None, domain=None):
    domain = domain or config.Get('primary_domain') or ''
    entry = model.CatalogEntry.Get(domain, label)
    if not entry:
      raise base_handler.Error(404, 'No such map.')
    topics = entry.map_root.get('topics', [])
    if not topics:
      raise base_handler.Error(404, 'Map has no topics.')
    self.redirect('%s/%s' % (label, str(topics[0]['id'])))
