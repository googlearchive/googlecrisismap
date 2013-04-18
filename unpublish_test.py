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

"""Tests for unpublish.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import model
import test_utils
import unpublish


class UnpublishTest(test_utils.BaseTest):
  """Tests for the unpublish.py request handler."""

  def setUp(self):
    super(UnpublishTest, self).setUp()
    test_utils.BecomeAdmin()
    self.map_object = model.Map.Create('{"title": "test map"}', 'xyz.com')
    self.map_id = self.map_object.id

  def testPost(self):
    """Tests the Unpublish handler."""
    model.CatalogEntry.Create('foo.com', 'abc', self.map_object)
    self.assertNotEqual(None, model.CatalogEntry.Get('foo.com', 'abc'))
    handler = test_utils.SetupHandler(
        '/crisismap/unpublish', unpublish.Unpublish(),
        'domain=foo.com&label=abc')
    handler.post()
    self.assertEquals(None, model.CatalogEntry.Get('foo.com', 'abc'))

if __name__ == '__main__':
  test_utils.main()
