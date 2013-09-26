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

"""Tests for publish.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import model
import perms
import test_utils


class PublishTest(test_utils.BaseTest):
  """Tests for the publish.py request handler."""

  def setUp(self):
    super(PublishTest, self).setUp()
    perms.Grant('owner', perms.Role.CATALOG_EDITOR, 'xyz.com')
    self.map_object = test_utils.CreateMap(owners=['owner'])
    self.map_id = self.map_object.id

  def testPost(self):
    """Tests the Publish handler."""
    with test_utils.Login('owner'):
      self.DoPost('/xyz.com/.publish',
                  'label=abc&map=%s&xsrf_token=XSRF' % self.map_id)
    entry = model.CatalogEntry.Get('xyz.com', 'abc')
    self.assertEquals(self.map_id, entry.map_id)
    self.assertFalse(entry.is_listed)

  def testRepublish(self):
    """Verifies that the is_listed status of an existing entry is preserved."""
    with test_utils.Login('owner'):
      # Publish an entry and make it listed.
      model.CatalogEntry.Create(
          'xyz.com', 'abc', self.map_object, is_listed=True)

      # Republish with a new map version.
      self.map_object.PutNewVersion('{"title": "new version"}')
      self.DoPost('/xyz.com/.publish',
                  'label=abc&map=%s&xsrf_token=XSRF' % self.map_id)

    # Confirm that the entry is still listed and points at the new version.
    entry = model.CatalogEntry.Get('xyz.com', 'abc')
    self.assertTrue(entry.is_listed)
    self.assertEquals('{"title": "new version"}', entry.maproot_json)

  def testInvalidLabels(self):
    """Tests to makes sure invalid labels don't get published."""
    with test_utils.Login('owner'):
      for label in ['', '!', 'f#oo', '?a', 'qwerty!', '9 3']:
        self.DoPost('/xyz.com/.publish',
                    'label=%s&map=%s&xsrf_token=XSRF' % (label, self.map_id),
                    400)

  def testValidLabels(self):
    """Tests to makes sure valid labels do get published."""
    with test_utils.Login('owner'):
      for label in ['a', 'B', '2', 'a2', 'q-w_e-r_t-y', '93']:
        self.DoPost('/xyz.com/.publish',
                    'label=%s&map=%s&xsrf_token=XSRF' % (label, self.map_id))
        entry = model.CatalogEntry.Get('xyz.com', label)
        self.assertEquals(self.map_id, entry.map_id)
        self.assertFalse(entry.is_listed)

  def testRemove(self):
    """Tests removal of a catalog entry."""
    with test_utils.RootLogin():
      model.CatalogEntry.Create('xyz.com', 'abc', self.map_object)
    self.assertNotEqual(None, model.CatalogEntry.Get('xyz.com', 'abc'))
    with test_utils.Login('owner'):
      self.DoPost('/xyz.com/.publish', 'label=abc&remove=1&xsrf_token=XSRF')
    self.assertEquals(None, model.CatalogEntry.Get('xyz.com', 'abc'))

if __name__ == '__main__':
  test_utils.main()
