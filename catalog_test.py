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

"""Tests for catalog.py."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import model
import perms
import test_utils


class CatalogTest(test_utils.BaseTest):
  """Tests for the catalog.py request handler."""

  def setUp(self):
    super(CatalogTest, self).setUp()
    self.map_object = test_utils.CreateMap('{"title": "test map"}')
    self.map_id = self.map_object.id
    perms.Grant('publisher', perms.Role.CATALOG_EDITOR, 'xyz.com')

  def testGet(self):
    """Tests the Catalog GET handler."""
    with test_utils.RootLogin():
      model.CatalogEntry.Create('xyz.com', 'label', self.map_object)
    with test_utils.Login('publisher'):
      response = self.DoGet('/xyz.com/.catalog')
      self.assertTrue('test map' in response.body, response.body)
      self.assertTrue('/root/xyz.com/label' in response.body, response.body)

  def testPost(self):
    """Tests the Catalog POST handler."""
    with test_utils.RootLogin():
      model.CatalogEntry.Create('xyz.com', 'label1', self.map_object)
      model.CatalogEntry.Create('xyz.com', 'label2', self.map_object)
    # Catalog entries are not listed in the Map Picker by default.
    self.assertFalse(model.CatalogEntry.Get('xyz.com', 'label1').is_listed)
    self.assertFalse(model.CatalogEntry.Get('xyz.com', 'label2').is_listed)
    with test_utils.Login('publisher'):
      self.DoPost('/xyz.com/.catalog', 'label1=True&xsrf_token=XSRF')
      self.assertTrue(model.CatalogEntry.Get('xyz.com', 'label1').is_listed)
      self.assertFalse(model.CatalogEntry.Get('xyz.com', 'label2').is_listed)

if __name__ == '__main__':
  test_utils.main()
