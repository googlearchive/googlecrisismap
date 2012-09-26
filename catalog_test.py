#!/usr/bin/python2.5
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

"""Tests for catalog.py."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

# Allow relative imports within the app.  # pylint: disable=W0403
import catalog
import model
import test_utils


class CatalogTest(test_utils.BaseTest):
  """Tests for the catalog.py request handler."""

  def setUp(self):
    super(CatalogTest, self).setUp()
    test_utils.BecomeAdmin()
    self.map_object = model.Map.Create('{"title": "test map"}')
    self.map_id = self.map_object.id

  def testGet(self):
    """Tests the Catalog GET handler."""
    model.CatalogEntry.Create('foo.com', 'label', self.map_object)
    handler = test_utils.SetupHandler('/crisismap/a/foo.com', catalog.Catalog())
    handler.get('foo.com')
    result = handler.response.out.getvalue()
    self.assertTrue('test map' in result, 'result: %s' % result)
    self.assertTrue('/crisismap/a/foo.com/label' in result, result)

  def testPost(self):
    """Tests the Catalog POST handler."""
    model.CatalogEntry.Create('foo.com', 'label1', self.map_object)
    model.CatalogEntry.Create('foo.com', 'label2', self.map_object)
    # Catalog entries are not listed in the Map Picker by default.
    self.assertFalse(model.CatalogEntry.Get('foo.com', 'label1').is_listed)
    self.assertFalse(model.CatalogEntry.Get('foo.com', 'label2').is_listed)
    handler = test_utils.SetupHandler('/crisismap/a/foo.com', catalog.Catalog(),
                                      'label1=True')
    handler.post('foo.com')
    self.assertTrue(model.CatalogEntry.Get('foo.com', 'label1').is_listed)
    self.assertFalse(model.CatalogEntry.Get('foo.com', 'label2').is_listed)

if __name__ == '__main__':
  test_utils.main()
