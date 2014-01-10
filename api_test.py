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

"""Tests for api.py."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import json

import base_handler
import model
import test_utils


class MapByIdTest(test_utils.BaseTest):
  """Tests for the MapById API."""

  def setUp(self):
    super(MapByIdTest, self).setUp()
    self.map = test_utils.CreateMap(
        owners=['owner'], editors=['editor'], viewers=['viewer'])

  def testGetMap(self):
    """Fetches a map through the API."""
    json_dict = {'json': True, 'stuff': [0, 1]}
    maproot_json = json.dumps(json_dict)
    with test_utils.Login('editor'):
      self.map.PutNewVersion(maproot_json)
    with test_utils.Login('viewer'):
      response = self.DoGet('/.api/maps/%s' % self.map.id)
    self.assertEquals({'json': json_dict}, json.loads(response.body))

  def testGetInvalidMap(self):
    """Attempts to fetch a map that doesn't exist."""
    self.DoGet('/.api/maps/xyz', 404)

  def testPostMap(self):
    """Posts a new version of a map."""
    maproot_json = '{"stuff": [0, 1]}'
    with test_utils.Login('editor'):
      self.DoPost('/.api/maps/' + self.map.id,
                  'json=' + maproot_json + '&xsrf_token=XSRF')
    # Now we refetch the map because the object changed underneath us.
    with test_utils.Login('viewer'):
      # Verify that the edited content was saved properly.
      map_object = model.Map.Get(self.map.id)
      self.assertEquals(maproot_json, map_object.GetCurrentJson())


class PublishedMapsTest(test_utils.BaseTest):
  """Tests for the PublishedMaps API."""

  def testPublishedMaps(self):
    map1 = {'title': 'Map 1',
            'layers': [{'id': 12, 'type': 'KML',
                        'source': {'kml': {'url': 'x.com/a.kml'}}},
                       {'id': 15, 'type': 'GEORSS',
                        'source': {'georss': {'url': 'y.com/b.xml'}}}]}
    map2 = {'title': 'Map 2',
            'layers': [{'id': 13, 'type': 'KML',
                        'source': {'kml': {'url': 'a.com/y.kml'}}},
                       {'id': 17, 'type': 'GEORSS',
                        'source': {'georss': {'url': 'b.com/x.xml'}}}]}
    draft = {'title': 'Map 2',
             'layers': [{'id': 13, 'type': 'KML',
                         'source': {'kml': {'url': 'a.com/y.kml'}}},
                        {'id': 17, 'type': 'GEORSS',
                         'source': {'georss': {'url': 'b.com/x.xml'}}}]}

    # Create and publish two maps
    with test_utils.RootLogin():
      m1 = test_utils.CreateMap(json.dumps(map1))
      model.CatalogEntry.Create('xyz.com', 'label1', m1)
      m2 = test_utils.CreateMap(json.dumps(map2))
      model.CatalogEntry.Create('xyz.com', 'label2', m2)
      # Create a draft; should not be returned by api.Maps
      test_utils.CreateMap(json.dumps(draft))

    response = self.DoGet('/.api/maps')
    self.assertEquals([{'url': '/root/xyz.com/label2', 'maproot': map2},
                       {'url': '/root/xyz.com/label1', 'maproot': map1}],
                      json.loads(response.body))


class CrowdReportsTest(test_utils.BaseTest):
  """Tests for the CrowdReports API."""

  def setUp(self):
    test_utils.BaseTest.setUp(self)
    self.default_time_secs = 1234567890.0
    self.SetTime(self.default_time_secs)
    self.maxDiff = None

  def tearDown(self):
    test_utils.BaseTest.tearDown(self)

  def testLoggedInSingleReportWithNoLatLng(self):
    with test_utils.EnvContext(USER_ID='123456789',
                               USER_EMAIL='alice@alpha.test',
                               USER_ORGANIZATION='alpha.test'):
      self.DoPost('/.api/reports',
                  'topic_ids=foo,bar&answer_ids=foo.1.1,bar.1.1&text=report1'
                  '&xsrf_token=XSRF')  # XSRF check is stubbed in test_utils

    response = self.DoGet('/.api/reports?topic_ids=foo')

    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    self.assertDictEqual(
        {u'answer_ids': [u'foo.1.1', u'bar.1.1'],
         u'author': u'http://app.com/root/.users/1',
         u'author_email': u'alice@alpha.test',
         u'effective': self.default_time_secs,
         u'location': [model.NOWHERE.lat, model.NOWHERE.lon],
         u'published': self.default_time_secs,
         u'topic_ids': [u'foo', u'bar'],
         u'text': u'report1',
         u'updated': self.default_time_secs},
        reports[0])


  def testAnonymousMultipleReportsWithLatLng(self):
    report1_time = self.default_time_secs
    self.DoPost(
        '/.api/reports',
        'topic_ids=bar&answer_ids=bar.1.1&text=report1&ll=37.1,-74.2')

    report2_time = 1234567981.0
    self.SetTime(report2_time)
    self.DoPost(
        '/.api/reports',
        'topic_ids=foo&answer_ids=foo.1.2&text=report2&ll=37.1,-74.2001')

    response = self.DoGet(
        '/.api/reports?ll=37.10001,-74.2&topic_ids=foo,bar&radii=100,100')

    reports = json.loads(response.body)
    self.assertEquals(2, len(reports))
    self.assertDictEqual(
        {u'answer_ids': [u'foo.1.2'],
         u'author': u'http://app.com/root/.users/anonymous.%s' %
                    test_utils.DEFAULT_RANDOM_ID,
         u'author_email': None,
         u'effective': report2_time,
         u'location': [37.1, -74.2001],
         u'published': report2_time,
         u'topic_ids': [u'foo'],
         u'text': u'report2',
         u'updated': report2_time},
        reports[0])
    self.assertDictEqual(
        {u'answer_ids': [u'bar.1.1'],
         u'author': u'http://app.com/root/.users/anonymous.%s' %
                    test_utils.DEFAULT_RANDOM_ID,
         u'author_email': None,
         u'effective': report1_time,
         u'location': [37.1, -74.2],
         u'published': report1_time,
         u'topic_ids': [u'bar'],
         u'text': u'report1',
         u'updated': report1_time},
        reports[1])

    # topic excludes report_2
    response = self.DoGet(
        '/.api/reports?ll=37.10001,-74.2&topic_ids=bar&radii=100')
    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    self.assertEquals('report1', reports[0]['text'])

    # radius excludes report_2
    response = self.DoGet(
        '/.api/reports?ll=37.1,-74.2&topic_ids=foo,bar&radii=1,1')
    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    self.assertEquals('report1', reports[0]['text'])

    # count = 1
    response = self.DoGet(
        '/.api/reports?ll=37.10001,-74.2&topic_ids=foo,bar&radii=100,100'
        '&count=1')
    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    self.assertEquals('report2', reports[0]['text'])

    # max_updated excludes most recent report2
    response = self.DoGet(
        '/.api/reports?ll=37.10001,-74.2&topic_ids=foo,bar&radii=100,100'
        '&count=2&max_updated=1234567980')
    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    self.assertEquals('report1', reports[0]['text'])

    # no topic matches
    response = self.DoGet(
        '/.api/reports?ll=37.10001,-74.2&topic_ids=blah&radii=1000000')
    reports = json.loads(response.body)
    self.assertEquals([], reports)

if __name__ == '__main__':
  test_utils.main()
