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

"""Tests for map_review.py."""

__author__ = 'shakusa@google.com (Steve Hakusa)'

import json
import urllib

import map_review
import model
import perms
import test_utils


class MapReviewTest(test_utils.BaseTest):
  """Tests for single-map pages served by maps.py."""

  def setUp(self):
    super(MapReviewTest, self).setUp()
    maproot_json = json.dumps({
        'id': 'map1',
        'title': 'Map 1',
        'layers': [
            {'id': '1', 'title': 'Emergency shelters', 'type': 'KML'}
        ],
        'topics': [{
            'id': 'shelter',
            'title': 'Shelter',
            'layer_ids': ['1'],
            'crowd_enabled': True,
            'cluster_radius': 456,
            'questions': [{
                'id': 'q1',
                'text': 'Is there space available?<br>',
                'answers': [
                    {'id': 'y', 'title': 'Yes', 'label': 'space'},
                    {'id': 'n', 'title': 'No', 'label': 'no space'}]
            }, {
                'id': 'q2',
                'text': 'Are overnight stays allowed?',
                'answers': [
                    {'id': 'y', 'title': 'Yes', 'label': 'overnight'},
                    {'id': 'n', 'title': 'No', 'label': 'day only'}]
            }]
        }, {
            'id': 'water',
            'title': 'Water',
            'layer_ids': ['2'],
            'crowd_enabled': True,
            'cluster_radius': 123,
            'questions': [{
                'id': 'q1',
                'text': 'Is there water?',
                'answers': [
                    {'id': 'y', 'title': 'Yes', 'label': 'water'},
                    {'id': 'n', 'title': 'No', 'label': 'no water'}]
            }]
        }]
    })
    self.map_object = test_utils.CreateMap(maproot_json, reviewers=['reviewer'])
    self.map_id = self.map_object.id
    self.topic1_id = self.map_id + '.shelter'
    self.answer1_id = self.topic1_id + '.q1.y'
    self.SetTime(1300000000)
    self.cr1 = test_utils.NewCrowdReport(text='26 beds here',
                                         topic_ids=[self.topic1_id],
                                         answer_ids=[self.answer1_id])
    self.topic2_id = self.map_id + '.water'
    self.answer2_id = self.topic2_id + '.q1.n'
    self.SetTime(1300000001)
    self.cr2 = test_utils.NewCrowdReport(author='http://foo.com/abc',
                                         text=('bottled water here </script>'),
                                         topic_ids=[self.topic2_id],
                                         answer_ids=[self.answer2_id])

  def testGet(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review')
    self.assertTrue('>shelter<' in response.body)
    self.assertTrue('>water<' in response.body)
    self.assertTrue(self.cr1.id in response.body)
    self.assertTrue(self.cr2.id in response.body)
    self.assertTrue('Is there space available?&lt;br&gt; Yes' in response.body)
    self.assertTrue('Is there water? No' in response.body)
    self.assertTrue('bottled water here &lt;/script&gt;' in response.body)
    self.assertTrue('name="accept"' in response.body)
    self.assertTrue(map_review.ICON_URL_TEMPLATE % 'aaa' in response.body)

  def testGetFromDomainReviewer(self):
    perms.Grant('domainreviewer', perms.Role.DOMAIN_REVIEWER, 'xyz.com')
    with test_utils.DomainLogin('domainreviewer', 'xyz.com'):
      self.DoGet('/.maps/' + self.map_id + '/review')

  def testGetPublishedMap(self):
    model.CatalogEntryModel(key_name='xyz.com:zz', domain='xyz.com',
                            label='zz', title='Map 1', map_id=self.map_id).put()
    with test_utils.Login('reviewer'):
      self.DoGet('/xyz.com/zz/review')

  def testGetWithSearch(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review?query=beds')
    self.assertTrue(self.cr1.id in response.body)
    self.assertFalse(self.cr2.id in response.body)

  def testGetWithComplexSearch(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet(
          '/.maps/' + self.map_id +
          '/review?query=' + urllib.quote('here author:"http://foo.com/abc"'))
    self.assertFalse(self.cr1.id in response.body)
    self.assertTrue(self.cr2.id in response.body)

  def testGetWithTopic(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review?topic=shelter')
    self.assertTrue(self.cr1.id in response.body)
    self.assertFalse(self.cr2.id in response.body)

  def testGetWithAuthor(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id +
                            '/review?author=http://foo.com/abc')
    self.assertFalse(self.cr1.id in response.body)
    self.assertTrue(self.cr2.id in response.body)

  def testGetWithReportId(self):
    cr_id = self.cr1.id
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review?id=' + cr_id)
    self.assertTrue(self.cr1.id in response.body)
    self.assertFalse(self.cr2.id in response.body)

  def testGetWithCount(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review?count=1')
    self.assertFalse(self.cr1.id in response.body)
    self.assertTrue(self.cr2.id in response.body)

  def testGetWithSkip(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review?skip=1')
    self.assertTrue(self.cr1.id in response.body)
    self.assertFalse(self.cr2.id in response.body)

  def testGetWithHidden(self):
    model.CrowdVote.Put(self.cr1.id, 'voter1', 'ANONYMOUS_DOWN')
    model.CrowdVote.Put(self.cr1.id, 'voter2', 'ANONYMOUS_DOWN')
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review')
      self.assertTrue(self.cr1.id in response.body)
      self.assertTrue(self.cr2.id in response.body)

    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review?hidden=true')
      self.assertTrue(self.cr1.id in response.body)
      self.assertFalse(self.cr2.id in response.body)

  def testGetWithReviewed(self):
    model.CrowdReport.MarkAsReviewed(self.cr1.id)
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review')
      self.assertFalse(self.cr1.id in response.body)
      self.assertTrue(self.cr2.id in response.body)

    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review?reviewed=true')
      self.assertTrue(self.cr1.id in response.body)
      self.assertTrue(self.cr2.id in response.body)

  def testPostMarkAsReviewed(self):
    with test_utils.Login('reviewer'):
      self.DoPost('/.maps/' + self.map_id + '/review',
                  'accept=' + self.cr1.id +
                  '&accept=' + self.cr2.id +
                  '&xsrf_token=XSRF')
      self.assertTrue(model.CrowdReport.Get(self.cr1.id).reviewed)
      self.assertTrue(model.CrowdReport.Get(self.cr2.id).reviewed)

    # Both reports get marked as reviewed and should not show up by default
    # on the review page
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/' + self.map_id + '/review')
      self.assertFalse(self.cr1.id in response.body)
      self.assertFalse(self.cr2.id in response.body)

  def testPostUpvoteDownvoteFromPublishedMap(self):
    model.CatalogEntryModel(key_name='xyz.com:zz', domain='xyz.com',
                            label='zz', title='Map 1', map_id=self.map_id).put()

    model.CrowdVote.Put(self.cr1.id, 'voter1', 'ANONYMOUS_DOWN')
    model.CrowdVote.Put(self.cr1.id, 'voter2', 'ANONYMOUS_DOWN')
    self.assertTrue(model.CrowdReport.Get(self.cr1.id).hidden)

    with test_utils.Login('reviewer'):
      self.DoPost('/xyz.com/zz/review',
                  'upvote=' + self.cr1.id +
                  '&downvote=' + self.cr2.id +
                  '&xsrf_token=XSRF')
      self.assertFalse(model.CrowdReport.Get(self.cr1.id).hidden)
      self.assertTrue(model.CrowdReport.Get(self.cr2.id).hidden)

    # Both reports get marked as reviewed and should not show up by default
    # on the review page
    with test_utils.Login('reviewer'):
      response = self.DoGet('/xyz.com/zz/review')
      self.assertFalse(self.cr1.id in response.body)
      self.assertFalse(self.cr2.id in response.body)


if __name__ == '__main__':
  test_utils.main()
