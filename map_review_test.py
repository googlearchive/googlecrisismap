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

import urllib

import map_review
import model
import perms
import test_utils


class MapReviewTest(test_utils.BaseTest):
  """Tests for single-map pages served by maps.py."""

  def setUp(self):
    super(MapReviewTest, self).setUp()
    map_root = {
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
                'type': 'CHOICE',
                'answers': [
                    {'id': 'y', 'title': 'Yes', 'label': '[space]'},
                    {'id': 'n', 'title': 'No', 'label': '[no space]'}]
            }, {
                'id': 'q2',
                'text': 'Are overnight stays allowed?',
                'type': 'CHOICE',
                'answers': [
                    {'id': 'y', 'title': 'Yes', 'label': '[overnight]'},
                    {'id': 'n', 'title': 'No', 'label': '[day only]'}]
            }, {
                'id': 'q3',
                'text': 'How many beds are open?',
                'title': 'Beds',
                'type': 'NUMBER'
            }, {
                'id': 'q4',
                'text': 'What is the phone number?',
                'title': 'Phone',
                'type': 'STRING'
            }]
        }, {
            'id': 'water',
            'title': 'Water',
            'layer_ids': ['2'],
            'crowd_enabled': True,
            'cluster_radius': 123,
            'questions': [{
                'id': 'q5',
                'text': 'Is there water?',
                'type': 'CHOICE',
                'answers': [
                    {'id': 'y', 'title': 'Yes', 'label': '[water]'},
                    {'id': 'n', 'title': 'No', 'label': '[no water]'}]
            }]
        }, {
            'id': 'flooding',
            'title': 'Flooding',
            'layer_ids': ['3', '4'],
            'crowd_enabled': True,
            'cluster_radius': 987,
        }]
    }
    self.map_object = test_utils.CreateMap(map_root, reviewers=['reviewer'])
    self.map_id = self.map_object.id
    self.topic1_id = '%s.shelter' % self.map_id
    self.q1_id = '%s.shelter.q1' % self.map_id
    self.q2_id = '%s.shelter.q2' % self.map_id
    self.q3_id = '%s.shelter.q3' % self.map_id
    self.q4_id = '%s.shelter.q4' % self.map_id
    self.SetTime(1300000000)
    self.cr1 = test_utils.NewCrowdReport(text='26 beds here',
                                         topic_ids=[self.topic1_id],
                                         answers={self.q1_id: 'y',
                                                  self.q3_id: 26,
                                                  self.q4_id: '555-1234'})
    self.topic2_id = '%s.water' % self.map_id
    self.q5_id = '%s.water.q5' % self.map_id
    self.SetTime(1300000001)
    self.cr2 = test_utils.NewCrowdReport(author='http://foo.com/abc',
                                         text='bottled water here </script>',
                                         topic_ids=[self.topic2_id],
                                         answers={self.q5_id: 'n'})

  def testGet(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review' % self.map_id)
    self.assertTrue('>shelter<' in response.body)
    self.assertTrue('>water<' in response.body)
    self.assertTrue('>flooding<' in response.body)
    self.assertTrue(self.cr1.id in response.body)
    self.assertTrue(self.cr2.id in response.body)
    self.assertTrue('[space]' in response.body)
    self.assertTrue('[no water]' in response.body)
    self.assertTrue('Beds: 26' in response.body)
    self.assertTrue('Phone: 555-1234' in response.body)
    self.assertTrue('bottled water here &lt;/script&gt;' in response.body)
    self.assertTrue('name="accept"' in response.body)
    self.assertTrue(map_review._ICON_URL_TEMPLATE % 'aaa' in response.body)

  def testGetFromDomainReviewer(self):
    perms.Grant('domainreviewer', perms.Role.DOMAIN_REVIEWER, 'xyz.com')
    with test_utils.DomainLogin('domainreviewer', 'xyz.com'):
      self.DoGet('/.maps/%s/review' % self.map_id)

  def testGetPublishedMap(self):
    model.CatalogEntryModel(key_name='xyz.com:zz', domain='xyz.com',
                            label='zz', title='Map 1', map_id=self.map_id).put()
    with test_utils.Login('reviewer'):
      self.DoGet('/xyz.com/zz/review')

  def testGetWithSearch(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?query=beds' % self.map_id)
    self.assertTrue(self.cr1.id in response.body)
    self.assertFalse(self.cr2.id in response.body)

  def testGetWithComplexSearch(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?query=%s' % (
          self.map_id, urllib.quote('here author:"http://foo.com/abc"')))
    self.assertFalse(self.cr1.id in response.body)
    self.assertTrue(self.cr2.id in response.body)

  def testGetWithTopic(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?topic=shelter' % self.map_id)
    self.assertTrue(self.cr1.id in response.body)
    self.assertFalse(self.cr2.id in response.body)

  def testGetWithAuthor(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?author=http://foo.com/abc' %
                            self.map_id)
    self.assertFalse(self.cr1.id in response.body)
    self.assertTrue(self.cr2.id in response.body)

  def testGetWithReportId(self):
    cr_id = self.cr1.id
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?id=%s' % (self.map_id, cr_id))
    self.assertTrue(self.cr1.id in response.body)
    self.assertFalse(self.cr2.id in response.body)

  def testGetWithCount(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?count=1' % self.map_id)
    self.assertFalse(self.cr1.id in response.body)
    self.assertTrue(self.cr2.id in response.body)

  def testGetWithSkip(self):
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?skip=1' % self.map_id)
    self.assertTrue(self.cr1.id in response.body)
    self.assertFalse(self.cr2.id in response.body)

  def testGetWithHidden(self):
    model.CrowdVote.Put(self.cr1.id, 'voter1', 'ANONYMOUS_DOWN')
    model.CrowdVote.Put(self.cr1.id, 'voter2', 'ANONYMOUS_DOWN')
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review' % self.map_id)
      self.assertTrue(self.cr1.id in response.body)
      self.assertTrue(self.cr2.id in response.body)

    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?hidden=true' % self.map_id)
      self.assertTrue(self.cr1.id in response.body)
      self.assertFalse(self.cr2.id in response.body)

  def testGetWithReviewed(self):
    model.CrowdReport.MarkAsReviewed(self.cr1.id)
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review' % self.map_id)
      self.assertFalse(self.cr1.id in response.body)
      self.assertTrue(self.cr2.id in response.body)

    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review?reviewed=true' % self.map_id)
      self.assertTrue(self.cr1.id in response.body)
      self.assertTrue(self.cr2.id in response.body)

  def testPostMarkAsReviewed(self):
    with test_utils.Login('reviewer'):
      self.DoPost('/.maps/%s/review' % self.map_id,
                  'xsrf_token=XSRF&accept=%s&accept=%s' % (self.cr1.id,
                                                           self.cr2.id))
      self.assertTrue(model.CrowdReport.Get(self.cr1.id).reviewed)
      self.assertTrue(model.CrowdReport.Get(self.cr2.id).reviewed)

    # Both reports get marked as reviewed and should not show up by default
    # on the review page
    with test_utils.Login('reviewer'):
      response = self.DoGet('/.maps/%s/review' % self.map_id)
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
                  'xsrf_token=XSRF&upvote=%s&downvote=%s' % (self.cr1.id,
                                                             self.cr2.id))
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
