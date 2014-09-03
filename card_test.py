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

"""Tests for card.py."""

import datetime
import json

import card
import config
import kmlify
import model
import test_utils
import utils

from google.appengine.api import urlfetch
from google.appengine.ext import ndb  # just for GeoPt

KML_DATA = '''<?xml version="1.0" encoding="UTF-8" ?>
<kml xmlns="http://earth.google.com/kml/2.2">
  <Document>
    <name>Two cities</name>
    <Placemark>
      <name>Helsinki</name>
      <description>description1</description>
      <Point><coordinates>25,60</coordinates></Point>
    </Placemark>
    <Placemark>
      <Point><coordinates>-83,40,1</coordinates></Point>
      <description>&#x64;escription&lt;2&gt;two</description>
      <name>Columbus</name>
    </Placemark>
  </Document>
</kml>
'''

GEORSS_DATA = '''
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    xmlns="http://purl.org/rss/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:georss="http://www.georss.org/georss">
  <channel xmlns="http://schemas.google.com/georss"
      xmlns:georss="http://schemas.google.com/georss">
    <item>
      <title>Helsinki</title>
      <summary>description1</summary>
      <georss:point>60 25</georss:point>
    </item>
    <item>
      <georss:point> 40 -83 1 </georss:point>
      <summary>&#x64;escription&lt;2&gt;two</summary>
      <title>Columbus</title>
    </item>
  </channel>
</rdf:RDF>
'''

ATOM_DATA = '''
<feed xmlns="http://www.w3.org/2005/Atom"
    xmlns:georss="http://www.georss.org/georss">
  <title>Two cities</title>
  <entry>
    <title>Helsinki</title>
    <summary>description1</summary>
    <georss:point>60 25</georss:point>
  </entry>
  <entry>
    <georss:point> 40 -83 1 </georss:point>
    <content>&#x64;escription&lt;2&gt;two</content>
    <title>Columbus</title>
  </entry>
</feed>
'''

GOOGLE_PLACES_SEARCH_JSON = {
    'status': 'OK',
    'html_attributions': [],
    'results': [{
        'place_id': 'placeId1',
        'vicinity': 'description1',
        'geometry': {
            'location': {
                'lat': 60,
                'lng': 25
            }
        },
        'name': 'Helsinki'
    }, {
        'place_id': 'placeId2',
        'vicinity': 'description<2>two',
        'geometry': {
            'location': {
                'lat': 40,
                'lng': -83
            }
        },
        'name': 'Columbus'
    }]
}

GOOGLE_PLACES_SEARCH_JSON_STR = json.dumps(GOOGLE_PLACES_SEARCH_JSON)

PLACES_FEATURES = [
    card.Feature('Helsinki', None, ndb.GeoPt(60, 25), 'layer4',
                 gplace_id='placeId1', layer_type='GOOGLE_PLACES'),
    card.Feature('Columbus', None, ndb.GeoPt(40, -83), 'layer4',
                 gplace_id='placeId2', layer_type='GOOGLE_PLACES')
]

FEATURE_FIELDS = [
    ('Helsinki', 'description1', ndb.GeoPt(60, 25)),
    ('Columbus', 'description<2>two', ndb.GeoPt(40, -83))
]

ROOT_URL = 'http://app.com/root'

MAP_ROOT = {
    'id': 'm1',
    'topics': [{
        'id': 't1',
        'title': 'Topic 1',
        'layer_ids': ['layer1', 'layer3'],  # select just some layers
        'crowd_enabled': True,
        'questions': [{
            'id': 'q1',
            'title': 'Foo',
            'type': 'CHOICE',
            'choices': [
                {'id': 'a1', 'color': '#0f0', 'label': 'Green'},
                {'id': 'a2', 'color': '#f00', 'label': 'Red'}
            ]
        }, {
            'id': 'q2',
            'title': 'Qux',
            'type': 'NUMBER'
        }]
    }, {
        'id': 't2',
        'title': 'Topic 2',
        'layer_ids': ['layer2'],
        'crowd_enabled': True,
        'questions': [{
            'id': 'q1',
            'title': 'Bar',
            'type': 'CHOICE',
            'answers': [
                {'id': 'a1', 'color': '#0f0'},
                {'id': 'a2', 'color': '#f00'}]
            }]
    }, {
        'id': 't3',
        'title': 'Topic 3',
        'layer_ids': ['layer4'],
        'crowd_enabled': True,
        'questions': [{
            'id': 'q1',
            'title': 'Pharmacies with foo',
            'type': 'CHOICE',
            'answers': [
                {'id': 'a1', 'color': '#0f0'},
                {'id': 'a2', 'color': '#f00'}]
            }]
    }],
    'layers': [{
        'id': 'layer1',
        'type': 'KML',
        'source': {'kml': {'url': 'http://example.com/one.kml'}}
    }, {
        'id': 'layer2',
        'type': 'KML',
        'source': {'kml': {'url': 'http://example.com/two.kml'}}
    }, {
        'id': 'layer3',
        'type': 'KML',
        'source': {'kml': {'url': 'http://example.com/three.kml'}}
    }, {
        'id': 'layer4',
        'type': 'GOOGLE_PLACES',
        'source': {'google_places': {'types': 'pharmacy'}}
    }]
}


class CardTest(test_utils.BaseTest):
  """Tests for functions in card.py."""

  def setUp(self):
    super(CardTest, self).setUp()
    self.request = test_utils.SetupRequest('/.card/foo')

  def testRoundGeoPt(self):
    self.assertEquals('1.2323,-4.5657',
                      card.RoundGeoPt(ndb.GeoPt(1.232323, -4.565656)))

  def testFeature(self):
    f1 = card.Feature('1', 'one', ndb.GeoPt(1, 2))
    f2 = card.Feature('2', 'two', ndb.GeoPt(3, 4))
    f3 = card.Feature('3', 'three', ndb.GeoPt(5, 6))
    f1.distance = 1000
    f2.distance = 2000
    f3.distance = 1500
    self.assertEquals([f1, f3, f2], sorted([f1, f2, f3]))
    self.assertEquals(1.0, f1.distance_km)
    self.assertEquals(1000/1609.344, f1.distance_mi)

  def testEarthDistance(self):
    def Distance(lat1, lon1, lat2, lon2):
      return card.EarthDistance(ndb.GeoPt(lat1, lon1), ndb.GeoPt(lat2, lon2))

    self.assertEquals(0, Distance(5, 5, 5, 5))
    self.assertTrue(abs(Distance(0, 0, 90, 0) - 10018538) < 1)
    self.assertTrue(abs(Distance(0, 0, 0, 90) - 10018538) < 1)
    self.assertTrue(abs(Distance(45, 0, 45, 90) - 6679025) < 1)

  def testInvalidContent(self):
    self.assertEquals([], card.GetFeaturesFromXml('xyz'))

  def testGetFeaturesFromKml(self):
    feature_fields = [(f.name, f.description_html, f.location)
                      for f in card.GetFeaturesFromXml(KML_DATA)]
    self.assertEquals(FEATURE_FIELDS, feature_fields)

  def testGetFeaturesFromGeoRss(self):
    feature_fields = [(f.name, f.description_html, f.location)
                      for f in card.GetFeaturesFromXml(GEORSS_DATA)]
    self.assertEquals(FEATURE_FIELDS, feature_fields)

  def testGetFeaturesFromAtom(self):
    feature_fields = [(f.name, f.description_html, f.location)
                      for f in card.GetFeaturesFromXml(ATOM_DATA)]
    self.assertEquals(FEATURE_FIELDS, feature_fields)

  def testGetKmlUrl(self):
    self.assertEquals('http://example.com/foo.kml', card.GetKmlUrl(ROOT_URL, {
        'type': 'KML',
        'source': {
            'kml': {
                'url': 'http://example.com/foo.kml'
            }
        }
    }))
    self.assertEquals('http://example.com/foo.rss', card.GetKmlUrl(ROOT_URL, {
        'type': 'GEORSS',
        'source': {
            'georss': {
                'url': 'http://example.com/foo.rss'
            }
        }
    }))
    self.AssertEqualsUrlWithUnorderedParams((
        'http://app.com/root/.kmlify'
        '?url=http://example.com/data.csv'
        '&type=csv'
        '&loc=latitude,longitude'
        '&icon=http://example.com/icon.png'
        '&color=123456'
        '&hotspot=tl'
        '&name=title'
        '&desc=description'
        '&cond=a<3'
        '&cond=b>4'
        '&cond=c=5'
    ), card.GetKmlUrl(ROOT_URL, {
        'type': 'CSV',
        'source': {
            'csv': {
                'url': 'http://example.com/data.csv',
                'latitude_field': 'latitude',
                'longitude_field': 'longitude',
                'icon_url_template': 'http://example.com/icon.png',
                'color_template': '123456',
                'hotspot_template': 'tl',
                'title_template': 'title',
                'description_template': 'description',
                'condition0': 'a<3',
                'condition1': 'b>4',
                'condition2': 'c=5'
            }
        }
    }))
    self.AssertEqualsUrlWithUnorderedParams((
        'http://app.com/root/.kmlify'
        '?url=https://docs.google.com/spreadsheet/pub?key=xyz%26output=csv'
        '&type=csv'
        '&loc=location'
        '&icon=http://example.com/icon.png'
        '&color=123456'
        '&hotspot=tl'
        '&name=title'
        '&desc=description'
        '&cond=a<3'
        '&cond=b>4'
        '&cond=c=5'
    ), card.GetKmlUrl(ROOT_URL, {
        'type': 'GOOGLE_SPREADSHEET',
        'source': {
            'google_spreadsheet': {
                'url': 'https://docs.google.com/spreadsheet/ccc'
                       '?key=xyz&foo=bar#gid=0',
                'latitude_field': 'location',
                'longitude_field': 'location',
                'icon_url_template': 'http://example.com/icon.png',
                'color_template': '123456',
                'hotspot_template': 'tl',
                'title_template': 'title',
                'description_template': 'description',
                'condition0': 'a<3',
                'condition1': 'b>4',
                'condition2': 'c=5'
            }
        }
    }))
    self.AssertEqualsUrlWithUnorderedParams((
        'http://app.com/root/.kmlify'
        '?url=http://example.com/geodata.json'
        '&type=geojson'
        '&name=title'
        '&desc=description'
        '&cond=a<3'
        '&cond=b>4'
        '&cond=c=5'
    ), card.GetKmlUrl(ROOT_URL, {
        'type': 'GEOJSON',
        'source': {
            'geojson': {
                'url': 'http://example.com/geodata.json',
                'title_template': 'title',
                'description_template': 'description',
                'condition0': 'a<3',
                'condition1': 'b>4',
                'condition2': 'c=5'
            }
        }
    }))

  def testGetFeaturesFromPlacesLayer(self):
    self.AssertGetFeaturesFromPlacesLayer(GOOGLE_PLACES_SEARCH_JSON_STR,
                                          PLACES_FEATURES)

    # Try the same request again and make sure the result comes from cache
    # (i.e. there are no calls to the urlfetch)
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    self.mox.ReplayAll()
    self.assertEquals(
        PLACES_FEATURES,
        card.GetFeaturesFromPlacesLayer(MAP_ROOT.get('layers')[3],
                                        ndb.GeoPt(20, 50)))

  def testGetFeaturesFromPlacesLayer_WithBadResponseStatus(self):
    self.AssertGetFeaturesFromPlacesLayer(
        '{"status": "REQUEST_DENIED", "results": []}',
        [])

  def testGetFeaturesFromPlacesLayer_WithZeroResults(self):
    self.AssertGetFeaturesFromPlacesLayer(
        '{"status": "ZERO_RESULTS", "results": []}',
        [])

  def AssertGetFeaturesFromPlacesLayer(self,
                                       api_response_content,
                                       expected_results):
    """Verifies GetFeaturesFromPlacesLayer with given input and output.

    Prepares a mock for urlfetch to return given api_response_content on a call
    to the Places API. Verifies that GetJsonFromGooglePlacesApi returns
    expected_results given the urlfetch mock setup.

    Args:
      api_response_content: Content that urlfetch should return
      expected_results: an array of Places results that
          GetJsonFromGooglePlacesApi should return
    """
    config.Set('google_api_server_key', 'someFakeApiKey')

    # Simulate a successful fetch from Places API by setting up a fake
    # for urlfetch
    url = ('https://maps.googleapis.com/maps/api/place/nearbysearch/json?'
           'location=20.0%2C50.0'
           '&rankby=distance'
           '&types=pharmacy'
           '&key=someFakeApiKey')
    url_responses = {url: utils.Struct(content=api_response_content)}
    self.mox.stubs.Set(
        urlfetch, 'fetch', lambda url, **kwargs: url_responses[url])

    # Get Features based on Google Places API results for the layer
    self.assertEquals(
        expected_results,
        card.GetFeaturesFromPlacesLayer(MAP_ROOT.get('layers')[3],
                                        ndb.GeoPt(20, 50)))
    self.mox.UnsetStubs()

  def testSetDetailsOnFilteredFeatures(self):
    config.Set('google_api_server_key', 'someFakeApiKey')

    # Simulate a successful fetch from Places API by setting up a fake urlfetch
    url_responses = {}
    helsinki_attrs = ['Listing by <a href="fakeurl1.com">FakeSite1</a>']
    api_response_content = json.dumps({
        'status': 'OK',
        'html_attributions': helsinki_attrs,
        'result': {
            'formatted_address': 'Street1',
            'formatted_phone_number': '111-111-1111'
        }
    })
    url = card.PLACES_API_DETAILS_URL + 'placeid=placeId1&key=someFakeApiKey'
    url_responses[url] = utils.Struct(content=api_response_content)
    columbus_attrs = ['Listing by <a href="fakeurl2.com">FakeSite2</a>']
    api_response_content = json.dumps({
        'status': 'OK',
        'html_attributions': columbus_attrs,
        'result': {
            'formatted_address': 'Street2',
            'formatted_phone_number': '222-222-2222'
        }
    })
    url = card.PLACES_API_DETAILS_URL + 'placeid=placeId2&key=someFakeApiKey'
    url_responses[url] = utils.Struct(content=api_response_content)
    self.mox.stubs.Set(
        urlfetch, 'fetch', lambda url, **kwargs: url_responses[url])

    exp_features = [
        ('Helsinki', '<div>Street1</div><div>111-111-1111</div>',
         helsinki_attrs),
        ('Columbus', '<div>Street2</div><div>222-222-2222</div>',
         columbus_attrs)
    ]
    features = PLACES_FEATURES[:]
    card.SetDetailsOnFilteredFeatures(features)
    self.assertEquals(exp_features,
                      [(f.name, f.description_html, f.html_attrs)
                       for f in features])

  def testGetFeatures(self):
    # Try getting features for a topic with two layers.
    self.SetForTest(kmlify, 'FetchData', lambda url, host: 'data from ' + url)
    self.SetForTest(card, 'GetFeaturesFromXml',
                    lambda data, layer: ['parsed ' + data + ' for ' + layer])
    self.assertEquals(
        ['parsed data from http://example.com/one.kml for layer1',
         'parsed data from http://example.com/three.kml for layer3'],
        card.GetFeatures(MAP_ROOT, 't1', self.request, ndb.GeoPt(20, 50)))

  def testGetFeaturesWithFailedFetches(self):
    # Even if some fetches fail, we should get features from the others.
    def FetchButSometimesFail(url, unused_host):
      if 'one.kml' in url:
        raise urlfetch.DownloadError
      return 'data from ' + url
    self.SetForTest(kmlify, 'FetchData', FetchButSometimesFail)
    self.SetForTest(card, 'GetFeaturesFromXml',
                    lambda data, layer: ['parsed ' + data])
    self.assertEquals(['parsed data from http://example.com/three.kml'],
                      card.GetFeatures(MAP_ROOT, 't1', self.request,
                                       ndb.GeoPt(20, 50)))

  def testGetFeaturesWithFailedParsing(self):
    # Even if some files don't parse, we should get features from the others.
    def ParseButSometimesFail(data, layer):
      if not layer:
        return
      if 'three.kml' in data:
        raise SyntaxError
      return ['parsed ' + data]
    self.SetForTest(kmlify, 'FetchData', lambda url, host: 'data from ' + url)
    self.SetForTest(card, 'GetFeaturesFromXml', ParseButSometimesFail)
    self.assertEquals(['parsed data from http://example.com/one.kml'],
                      card.GetFeatures(MAP_ROOT, 't1', self.request,
                                       ndb.GeoPt(20, 50)))

  def testGetFeaturesWithInvalidTopicId(self):
    # GetFeatures should accept a nonexistent topic without raising exceptions.
    self.assertEquals([], card.GetFeatures(MAP_ROOT, 'xyz', self.request,
                                           ndb.GeoPt(20, 50)))

  def testGetLatestAnswers(self):
    now = datetime.datetime.utcnow()
    seconds = lambda s: datetime.timedelta(seconds=s)
    reports = [
        model.CrowdReport(answers_json='{"m1.t1.q1": "a1", "m1.t1.q2": "a2"}',
                          effective=now),
        # Older answer to m1.t1.q2 should be superceded by recent answer
        model.CrowdReport(answers_json='{"m1.t1.q2": "a3", "m1.t1.q3": "a3"}',
                          effective=now - seconds(1)),
        # Answers for irrelevant maps or topics should be ignored
        model.CrowdReport(answers_json='{"m1.t2.q4": "a4", "m2.t1.q5": "a5"}',
                          effective=now - seconds(2))
    ]
    self.SetForTest(model.CrowdReport, 'GetByLocation',
                    staticmethod(lambda *args, **kwargs: reports))
    self.assertEquals(({'q1': 'a1', 'q2': 'a2', 'q3': 'a3'}, now),
                      card.GetLatestAnswers('m1', 't1', 'location', 100))

  def testGetLegibleTextColor(self):
    # Black on a light background; white on a dark background
    self.assertEquals('#000', card.GetLegibleTextColor('#999'))
    self.assertEquals('#fff', card.GetLegibleTextColor('#777'))

    # Medium green is lighter than medium red.
    self.assertEquals('#000', card.GetLegibleTextColor('#0f0'))
    self.assertEquals('#fff', card.GetLegibleTextColor('#ff0000'))

  def testSetAnswersOnFeatures(self):
    features = [card.Feature('title1', 'description1', ndb.GeoPt(1, 1)),
                card.Feature('title2', 'description2', ndb.GeoPt(2, 2))]
    now = datetime.datetime.utcnow()
    def FakeGetLatestAnswers(unused_1, unused_2, location, unused_3):
      return ({'q1': 'a1' if location.lat < 1.5 else 'a2',
               'q2': None if location.lat < 1.5 else 3}, now)
    self.SetForTest(card, 'GetLatestAnswers', FakeGetLatestAnswers)
    card.SetAnswersOnFeatures(features, MAP_ROOT, 'm1@1', 't1', ['q1', 'q2'])
    self.assertEquals('Green', features[0].answer_text)
    self.assertEquals('#0f0', features[0].status_color)
    self.assertEquals('Red, Qux: 3', features[1].answer_text)
    self.assertEquals('#f00', features[1].status_color)

  def testSetDistanceOnFeatures(self):
    features = [card.Feature('title1', 'description1', ndb.GeoPt(1, 1)),
                card.Feature('title2', 'description2', ndb.GeoPt(2, 2))]
    card.SetDistanceOnFeatures(features, ndb.GeoPt(1, 1))
    self.assertEquals(0, features[0].distance)
    self.assertTrue(abs(features[1].distance - 157398) < 1)

  def testFilterFeatures(self):
    all_features = [card.Feature('name3', 'desc3', ndb.GeoPt(3, 3)),
                    card.Feature('name2', 'desc2', ndb.GeoPt(2, 2)),
                    card.Feature('name1', 'desc1', ndb.GeoPt(1, 1))]
    all_features[0].distance = 3
    all_features[1].distance = 2
    all_features[2].distance = 1

    # Not limited; should give all three features
    features = all_features[:]
    card.FilterFeatures(features, 100, 100)
    self.assertEquals(['name1', 'name2', 'name3'], [f.name for f in features])

    # Limit by radius
    features = all_features[:]
    card.FilterFeatures(features, 2.5, 100)
    self.assertEquals(['name1', 'name2'], [f.name for f in features])

    # Limit by count
    features = all_features[:]
    card.FilterFeatures(features, 100, 1)
    self.assertEquals(['name1'], [f.name for f in features])

  def testGetGeoJson(self):
    features = [card.Feature('title1', 'description1', ndb.GeoPt(20, -40)),
                card.Feature('title2', 'description2', ndb.GeoPt(30, -50))]
    card.SetDistanceOnFeatures(features, ndb.GeoPt(20, -40))
    geojson = card.GetGeoJson(features, include_descriptions=True)
    self.assertEquals('FeatureCollection', geojson['type'])
    self.assertEquals(2, len(geojson['features']))
    self.assertEquals({'geometry': {'coordinates': [-40.0, 20.0],
                                    'type': 'Point'},
                       'properties': {'answer_text': '',
                                      'answer_time': '',
                                      'answer_source': '',
                                      'status_color': None,
                                      'description_html': 'description1',
                                      'distance': 0.0,
                                      'distance_km': 0.0,
                                      'distance_mi': 0.0,
                                      'layer_id': None,
                                      'name': 'title1'},
                       'type': 'Feature'},
                      geojson['features'][0])


class CardHandlerTest(test_utils.BaseTest):
  """Tests for request handlers in card.py."""

  def setUp(self):
    super(CardHandlerTest, self).setUp()
    map_object = test_utils.CreateMap(MAP_ROOT)
    self.map_id = map_object.id
    with test_utils.RootLogin():
      model.CatalogEntry.Create('xyz.com', 'foo', map_object)

  def testGetCardByIdAndTopic(self):
    self.SetForTest(kmlify, 'FetchData', lambda url, host: KML_DATA)
    with test_utils.RootLogin():
      response = self.DoGet('/.card/%s.t1' % self.map_id)
    self.assertTrue('Topic 1' in response.body)
    self.assertTrue('Helsinki' in response.body)
    self.assertTrue('Columbus' in response.body)

  def testGetCardByLabelAndTopic(self):
    self.SetForTest(kmlify, 'FetchData', lambda url, host: KML_DATA)
    response = self.DoGet('/xyz.com/.card/foo/t1')
    self.assertTrue('Topic 1' in response.body)
    self.assertTrue('Helsinki' in response.body)
    self.assertTrue('Columbus' in response.body)
    # Verify there are no descriptions, since show_desc param isn't set
    # in the request
    self.assertFalse('description' in response.body)

  def testGetCardByLabelAndTopicWithDescriptionsEnabled(self):
    self.SetForTest(kmlify, 'FetchData', lambda url, host: KML_DATA)
    # Enable descriptions with show_desc=1 param in the request
    response = self.DoGet('/xyz.com/.card/foo/t1?show_desc=1')
    self.assertTrue('Topic 1' in response.body)
    self.assertTrue('Helsinki' in response.body)
    self.assertTrue('Columbus' in response.body)
    # Verify descriptions show up (with all the html tags removed)
    self.assertTrue('description1' in response.body)
    self.assertTrue('description<2>two' in response.body)

  def testGetCardByLabelAndTopicWithDescriptionsXss(self):
    kml_data_with_xss = '''<?xml version="1.0" encoding="UTF-8" ?>
        <kml xmlns="http://earth.google.com/kml/2.2">
          <Document>
            <name>Cities</name>
            <Placemark>
              <name>Paris</name>
              <description><![CDATA[
                <b>description1</b>-<div>addr</div><script>EvilScript</script>
              ]]></description>
              <Point><coordinates>25,60</coordinates></Point>
            </Placemark>
          </Document>
        </kml>
        '''
    self.SetForTest(kmlify, 'FetchData', lambda url, host: kml_data_with_xss)
    # Enable descriptions with show_desc=1 param in the request
    response = self.DoGet('/xyz.com/.card/foo/t1?show_desc=1')
    self.assertTrue('Paris' in response.body)
    # Verify <script> doesn't show up in the description, but <b> stays
    self.assertTrue('<b>description1</b>-addr' in response.body)
    self.assertFalse('<script>EvilScript</script>' in response.body)

  def testPostByLabelAndTopic(self):
    self.SetForTest(kmlify, 'FetchData', lambda url, host: KML_DATA)
    response = self.DoPost('/xyz.com/.card/foo/t1', 'll=60,25&n=1&r=100')
    self.assertTrue('Topic 1' in response.body)
    self.assertTrue('Helsinki' in response.body)
    self.assertFalse('Columbus' in response.body)

  def testGetCardByTopic(self):
    response = self.DoGet('/xyz.com/.card/foo')
    self.assertEquals('foo/t1', response.headers['Location'])

  def testPlacesMenu(self):
    self.SetForTest(kmlify, 'FetchData', lambda url, host: KML_DATA)
    response = self.DoGet('/xyz.com/.card/foo/t2?places=' + json.dumps(
        [{'id': 'x', 'name': 'Place Foo'}, {'id': 'y', 'name': 'Place Bar'}]))
    self.assertTrue('Place Foo' in response.body)
    self.assertTrue('Place Bar' in response.body)

  def testGetJsonByLabelAndTopic(self):
    self.SetForTest(kmlify, 'FetchData', lambda url, host: KML_DATA)
    response = self.DoGet('/xyz.com/.card/foo/t2?output=json')
    geojson = json.loads(response.body)
    self.assertEquals('FeatureCollection', geojson['type'])
    features = geojson['features']
    self.assertEquals(2, len(features))

  def testRenderFooter(self):
    self.assertEquals('a b', card.RenderFooter(['a', 'b']))
    self.assertEquals('a&lt;b&amp;', card.RenderFooter(['a<b&']))
    self.assertEquals(
        'x <a href="http://example.com/" target="_blank">y</a>',
        card.RenderFooter(['x', ['http://example.com/', 'y']]))
    self.assertFalse(
        'javascript' in card.RenderFooter(['x', ['javascript:alert(1)', 'y']]))
    self.assertEquals(
        'a b Listing by <a href="google.com">Google</a>',
        card.RenderFooter(['a', 'b'],
                          ['Listing by <a href="google.com">Google</a>']))

if __name__ == '__main__':
  test_utils.main()
