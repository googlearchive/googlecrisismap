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

"""Tests for diff.py."""

__author__ = 'joeysilva@google.com (Joey Silva)'

import difflib
import json

import diff
import model
import mox
import test_utils


class DiffTest(test_utils.BaseTest):
  """Tests for Diff class."""

  def setUp(self):
    super(DiffTest, self).setUp()

  def testDiff(self):
    """Test that a map's versions are diffed against new maproot JSON."""
    saved_map = {'id': 'random_id_1', 'a': 'b', 'c': 'd'}
    new_map = {'id': 'random_id_1', 'a': 'b', 'x': 'y'}
    catalog_map = {'id': 'random_id_1', 'x': 'y', 'c': 'd'}

    # Create a saved map and a catalog entry to diff against.
    with test_utils.RootLogin():
      map_object = model.Map.Create(catalog_map, 'xyz.com', owners=['owner'])
      model.CatalogEntry.Create('xyz.com', 'Published', map_object)
      map_object.PutNewVersion(saved_map)

    # Exercise the diff endpoint.
    saved_diff = 'saved diff'
    catalog_diff = 'catalog diff'
    html_diff = self.mox.CreateMock(difflib.HtmlDiff)
    self.mox.StubOutWithMock(difflib, 'HtmlDiff')
    difflib.HtmlDiff(wrapcolumn=mox.IgnoreArg()).AndReturn(html_diff)
    html_diff.make_file(diff.ToNormalizedJson(saved_map).splitlines(),
                        diff.ToNormalizedJson(new_map).splitlines(),
                        fromdesc='Saved', todesc='Current',
                        context=mox.IgnoreArg()).AndReturn(saved_diff)
    html_diff.make_file(diff.ToNormalizedJson(catalog_map).splitlines(),
                        diff.ToNormalizedJson(new_map).splitlines(),
                        fromdesc='xyz.com/Published', todesc='Current',
                        context=mox.IgnoreArg()).AndReturn(catalog_diff)

    self.mox.ReplayAll()
    with test_utils.Login('owner'):
      self.DoPost('/.diff/' + map_object.id,
                  {'new_json': json.dumps(new_map), 'xsrf_token': 'XSRF'})


if __name__ == '__main__':
  test_utils.main()
