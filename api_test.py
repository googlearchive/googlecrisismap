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
import config
import model
import protect
import test_utils


class MapByIdTest(test_utils.BaseTest):
  """Tests for the MapById API."""

  def setUp(self):
    super(MapByIdTest, self).setUp()
    self.map = test_utils.CreateMap(
        owners=['owner'], editors=['editor'], viewers=['viewer'])

  def testGetMap(self):
    """Fetches a map through the API."""
    map_root = {'id': self.map.id, 'json': True, 'stuff': [0, 1]}
    with test_utils.Login('editor'):
      self.map.PutNewVersion(map_root)
    with test_utils.Login('viewer'):
      response = self.DoGet('/.api/maps/%s' % self.map.id)
      self.assertEquals(map_root, json.loads(response.body))

    # Map should not be accessible to a not-signed-in user, or an outsider
    self.DoGet('/.api/maps/%s' % self.map.id, 403)
    with test_utils.Login('outsider'):
      self.DoGet('/.api/maps/%s' % self.map.id, 403)

    # Map should be accessible by a properly configured auth key.
    auth = model.Authorization.Create(
        map_read_permission=True, map_ids=[self.map.id])
    response = self.DoGet(
        '/.api/maps/%s?key=%s' % (self.map.id, auth.id), https=True)
    self.assertEquals(map_root, json.loads(response.body))

  def testGetInvalidMap(self):
    """Attempts to fetch a map that doesn't exist."""
    self.DoGet('/.api/maps/xyz', 404)

  def testPostMap(self):
    """Posts a new version of a map."""
    map_root = {'id': self.map.id, 'stuff': [0, 1]}
    with test_utils.Login('editor'):
      self.DoPost('/.api/maps/' + self.map.id,
                  {'json': json.dumps(map_root), 'xsrf_token': 'XSRF'})
    # Now we refetch the map because the object changed underneath us.
    with test_utils.Login('viewer'):
      # Verify that the edited content was saved properly.
      map_object = model.Map.Get(self.map.id)
      self.assertEquals(map_root, map_object.map_root)


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
      m1 = test_utils.CreateMap(map1)
      model.CatalogEntry.Create('xyz.com', 'label1', m1)
      m2 = test_utils.CreateMap(map2)
      model.CatalogEntry.Create('xyz.com', 'label2', m2)
      # Create a draft; should not be returned by api.Maps
      test_utils.CreateMap(draft)

    response = self.DoGet('/.api/maps')
    map1['id'] = m1.id  # storing the map should have set its 'id' property
    map2['id'] = m2.id  # storing the map should have set its 'id' property
    self.assertEquals([{'url': '/root/xyz.com/label2', 'map_root': map2},
                       {'url': '/root/xyz.com/label1', 'map_root': map1}],
                      json.loads(response.body))


class CrowdReportsTest(test_utils.BaseTest):
  """Tests for the CrowdReports API."""

  def setUp(self):
    test_utils.BaseTest.setUp(self)
    # Sigh.  The current time must be after 2011-01-01 for search to work; see
    # https://developers.google.com/appengine/docs/python/search/#other_document_properties
    self.default_time_secs = 1300000000
    self.SetTime(self.default_time_secs)
    self.maxDiff = None
    # testSignatureRequired checks that protection is enabled, but the details
    # of the protection mechanism are tested in protect_test.py, not here.
    self.SetForTest(protect, 'Verify', lambda request, keys: True)

  def tearDown(self):
    test_utils.BaseTest.tearDown(self)

  def testLoggedInSingleReportWithNoLatLng(self):
    with test_utils.EnvContext(USER_ID='123456789',
                               USER_EMAIL='alice@alpha.test',
                               USER_ORGANIZATION='alpha.test'):
      self.DoPost('/.api/reports', {
          'cm-topic-ids': 'foo,bar',
          'cm-answers-json': '{"foo.1.1": "1", "bar.1.1": "2"}',
          'cm-text': 'report1',
          'xsrf_token': 'XSRF'
      })  # XSRF check is stubbed in test_utils

    response = self.DoGet('/.api/reports?topic_ids=foo')

    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    id0 = reports[0].pop('id')
    self.assertTrue(id0.startswith('http://app.com/root/.reports/'))
    self.assertDictEqual(
        {u'answers': {'foo.1.1': '1', 'bar.1.1': '2'},
         u'source': u'http://app.com/root',
         u'author': u'http://app.com/root/.users/1',
         u'author_email': u'alice@alpha.test',
         u'effective': self.default_time_secs,
         u'location': [model.NOWHERE.lat, model.NOWHERE.lon],
         u'place_id': None,
         u'published': self.default_time_secs,
         u'topic_ids': [u'foo', u'bar'],
         u'text': u'report1',
         u'updated': self.default_time_secs,
         u'upvote_count': 0,
         u'downvote_count': 0},
        reports[0])

  def testSignatureRequired(self):
    """Ensure that the crowd report posting API is protected."""
    self.SetForTest(protect, 'Verify', lambda request, keys: False)
    self.DoPost('/.api/reports', {
        'cm-topic-ids': 'bar',
        'cm-answers-json': '{"bar.1.1": "1"}',
        'cm-text': 'report1',
        'cm-ll': '37.1,-74.2'
    }, 403)  # should be rejected by protect.Verify

  def testLoggedInSingleReportWithNoAnswers(self):
    with test_utils.EnvContext(USER_ID='123456789',
                               USER_EMAIL='alice@alpha.test',
                               USER_ORGANIZATION='alpha.test'):
      self.DoPost('/.api/reports', {
          'cm-topic-ids': 'foo,bar',
          'cm-answers-json': '',
          'cm-text': 'report1',
          'xsrf_token': 'XSRF'
      })  # XSRF check is stubbed in test_utils

    response = self.DoGet('/.api/reports?topic_ids=foo')

    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    id0 = reports[0].pop('id')
    self.assertTrue(id0.startswith('http://app.com/root/.reports/'))
    self.assertDictEqual(
        {u'answers': {},
         u'source': u'http://app.com/root',
         u'author': u'http://app.com/root/.users/1',
         u'author_email': u'alice@alpha.test',
         u'effective': self.default_time_secs,
         u'location': [model.NOWHERE.lat, model.NOWHERE.lon],
         u'place_id': None,
         u'published': self.default_time_secs,
         u'topic_ids': [u'foo', u'bar'],
         u'text': u'report1',
         u'updated': self.default_time_secs,
         u'upvote_count': 0,
         u'downvote_count': 0},
        reports[0])


  def testPostJson(self):
    owner_login = test_utils.Login('map_owner')
    map_object = test_utils.CreateMap(owners=['map_owner'])
    map_id = map_object.id
    topic_id = map_id + '.gas'

    key = model.Authorization.Create(
        crowd_report_write_permission=True, source='http://client.com/',
        author_prefix='tel:+1', map_ids=[map_id]).id
    fields = {
        'id': 'http://client.com/1',
        'source': 'http://client.com/',
        'author': 'tel:+15551234567',
        'map_id': map_id,
        'topic_ids': [topic_id],
        'answers': {topic_id + '.1': 'yes'},
        'location': [37, -75],
        'place_id': 'a.b.c',
        'text': 'Hello'
    }
    config.Set('crowd_report_spam_phrases', ['rabbits'])

    report_dicts = [
        dict(fields),  # all valid
        dict(fields, id='http://elsewhere.com/1'),  # ID not ok for source
        dict(fields, source='http://other.com/'),  # unauthorized source
        dict(fields, author='tel:+445551234567'),  # unauthorized author
        dict(fields, map_id='xyz'),  # unauthorized map_id
        dict(fields, topic_ids=3.7),  # topic_ids is not a list
        dict(fields, answers='what'),  # answers is not a dictionary
        dict(fields, text=[3, 4]),  # text is not a string
        dict(fields, place_id=9),  # place_id is not a string
        dict(fields, location='a'),  # location is not a list of two numbers
        dict(fields, text='Rabbits are bad!')  # contains spam phrase
    ]

    # Shouldn't be allowed without the key.
    self.DoPost('/.api/reports', json.dumps(report_dicts), 403,
                content_type='application/json', https=True)

    # Shouldn't be allowed over HTTP.
    self.DoPost('/.api/reports?key=' + key, json.dumps(report_dicts), 403,
                content_type='application/json', https=False)

    # Should post successfully over HTTPS with the key.
    response = self.DoPost('/.api/reports?key=' + key, json.dumps(report_dicts),
                           content_type='application/json', https=True)
    reports = json.loads(response.body)
    self.assertEquals(len(report_dicts), len(reports))
    self.assertEquals('Hello', reports[0]['text'])
    for report_dict, result in zip(report_dicts, reports)[1:]:
      self.assertTrue(
          'error' in result, 'Submitted %r expecting an error, '
          'but instead got %r' % (report_dict, result))

    # When not signed in, a search query should fetch nothing.
    response = self.DoGet('/.api/reports?ll=37,-75&topic_ids=1.gas&radii=100')
    reports = json.loads(response.body)
    self.assertEquals(0, len(reports))

    # When signed in with view access to the map, we should get the report.
    with owner_login:
      response = self.DoGet(
          '/.api/reports?ll=37,-75&topic_ids=%s&radii=100' % topic_id)
    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    expected = report_dicts[0]
    self.assertEquals(expected['source'], reports[0]['source'])
    self.assertEquals(expected['author'], reports[0]['author'])
    self.assertEquals(expected['text'], reports[0]['text'])
    self.assertEquals(expected['topic_ids'], reports[0]['topic_ids'])
    self.assertEquals(expected['answers'], reports[0]['answers'])
    self.assertEquals(expected['location'], reports[0]['location'])
    self.assertEquals(expected['place_id'], reports[0]['place_id'])

  def testAnonymousMultipleReportsWithLatLng(self):
    report1_time = self.default_time_secs
    self.DoPost('/.api/reports', {
        'cm-topic-ids': 'bar',
        'cm-answers-json': '{"foo.1.1": "1"}',
        'cm-text': 'report1',
        'cm-ll': '37.1,-74.2'
    })

    report2_time = report1_time + 1
    self.SetTime(report2_time)
    self.DoPost('/.api/reports', {
        'cm-topic-ids': 'foo',
        'cm-answers-json': '{"foo.1.1": "2"}',
        'cm-text': 'report2',
        'cm-ll': '37.1,-74.2001'
    })

    response = self.DoGet(
        '/.api/reports?ll=37.10001,-74.2&topic_ids=foo,bar&radii=100,100')

    reports = json.loads(response.body)
    self.assertEquals(2, len(reports))
    ids = [reports[0].pop('id'), reports[1].pop('id')]
    self.assertTrue(ids[0].startswith('http://app.com/root/.reports/'))
    self.assertTrue(ids[1].startswith('http://app.com/root/.reports/'))
    self.assertNotEqual(ids[0], ids[1])
    self.assertDictEqual(
        {u'answers': {'foo.1.1': '2'},
         u'source': u'http://app.com/root',
         u'author': u'http://app.com/root/.users/anonymous.random_id_2',
         u'author_email': None,
         u'effective': report2_time,
         u'location': [37.1, -74.2001],
         u'place_id': None,
         u'published': report2_time,
         u'topic_ids': [u'foo'],
         u'text': u'report2',
         u'updated': report2_time,
         u'upvote_count': 0,
         u'downvote_count': 0},
        reports[0])
    self.assertDictEqual(
        {u'answers': {'foo.1.1': '1'},
         u'source': u'http://app.com/root',
         u'author': u'http://app.com/root/.users/anonymous.random_id_1',
         u'author_email': None,
         u'effective': report1_time,
         u'location': [37.1, -74.2],
         u'place_id': None,
         u'published': report1_time,
         u'topic_ids': [u'bar'],
         u'text': u'report1',
         u'updated': report1_time,
         u'upvote_count': 0,
         u'downvote_count': 0},
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
        '&count=2&max_updated=%d' % report1_time)
    reports = json.loads(response.body)
    self.assertEquals(1, len(reports))
    self.assertEquals('report1', reports[0]['text'])

    # no topic matches
    response = self.DoGet(
        '/.api/reports?ll=37.10001,-74.2&topic_ids=blah&radii=1000000')
    reports = json.loads(response.body)
    self.assertEquals([], reports)

  def testSpammyReport(self):
    config.Set('crowd_report_spam_phrases', ['rabbits', 'fluffy cats'])
    self.DoPost('/.api/reports', {
        'cm-ll': '10,10',
        'cm-topic-ids': 'foo',
        'cm-text': 'no spam words'
    })

    # Verify case-insensitive match for a single word.
    self.DoPost('/.api/reports', {
        'cm-ll': '20,20',
        'cm-topic-ids': 'foo',
        'cm-text': 'i love Rabbits'
    }, status=403)

    # Verify case-insensitive match for a phrase.
    self.DoPost('/.api/reports', {
        'cm-ll': '10,10',
        'cm-topic-ids': 'foo',
        'cm-text': 'i love cats'  # okay
    })
    self.DoPost('/.api/reports', {
        'cm-ll': '20,20',
        'cm-topic-ids': 'foo',
        'cm-text': 'what FLUFFY  cats'  # matches a spam phrase
    }, status=403)

    # Confirm that none of the spammy reports were stored.
    response = self.DoGet('/.api/reports?ll=20,20&topic_ids=foo&radii=1000')
    self.assertEquals([], json.loads(response.body))

    # Confirm that the non-spammy reports were all stored.
    response = self.DoGet('/.api/reports?ll=10,10&topic_ids=foo&radii=1000')
    self.assertEquals(2, len(json.loads(response.body)))


class CrowdVotesTest(test_utils.BaseTest):
  """Tests for the crowd voting endpoint."""

  def setUp(self):
    test_utils.BaseTest.setUp(self)
    # testSignatureRequired checks that protection is enabled, but the details
    # of the protection mechanism are tested in protect_test.py, not here.
    self.SetForTest(protect, 'Verify', lambda request, keys: True)

  def testSignatureRequired(self):
    """Ensure that the crowd vote posting API is protected."""
    self.SetForTest(protect, 'Verify', lambda request, keys: False)
    self.DoPost('/.api/votes', {
        'cm-report-id': '1', 'cm-vote-code': 'u'
    }, 403)  # should be rejected by protect.Verify

  def testVote(self):
    with self.NewCookieJar():
      response = self.DoGet('/.api/votes?report_id=1')
      self.assertEquals(None, json.loads(response.body))

      response = self.DoPost(
          '/.api/votes', {'cm-report-id': '1', 'cm-vote-code': 'u'})
      response = self.DoGet('/.api/votes?report_id=1')
      self.assertEquals('u', json.loads(response.body))

      response = self.DoPost(
          '/.api/votes', {'cm-report-id': '1', 'cm-vote-code': 'd'})
      response = self.DoGet('/.api/votes?report_id=1')
      self.assertEquals('d', json.loads(response.body))

      response = self.DoPost(
          '/.api/votes', {'cm-report-id': '1', 'cm-vote-code': ''})
      response = self.DoGet('/.api/votes?report_id=1')
      self.assertEquals(None, json.loads(response.body))


if __name__ == '__main__':
  test_utils.main()
