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

"""Tests for maproot.py."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import maproot
import test_utils


class MaprootTest(test_utils.BaseTest):
  def testGetAllLayers(self):
    # Not a complete or valid MapRoot structure but is enough for testing
    # relevant parts.
    maproot_object = {'layers': [
        {'type': 'KML'},
        {'type': 'FOLDER',
         'sublayers': [
             {'type': 'FOLDER',
              'sublayers': [
                  {'type': 'GEORSS'},
                  {'type': 'MAP_DATA'}
                  ]},
             {'type': 'FUSION'}]
        },
        {'type': 'TILE'},
        {'type': 'FOLDER'}]}
    expected = ['FUSION', 'GEORSS', 'KML', 'MAP_DATA', 'TILE']
    self.assertEquals(expected, sorted(
        [x['type'] for x in maproot.GetAllLayers(maproot_object)]))
    self.assertEquals([], maproot.GetAllLayers({'nolayers': {'type': 'KML'}}))

  def testGetSourceAddress(self):
    self.assertEquals('abc', maproot.GetSourceAddress(
        {'source': {'georss': {'url': 'abc'}}}
    ))
    self.assertEquals('xyz', maproot.GetSourceAddress(
        {'source': {'kml': {'url': 'xyz'}}}
    ))
    self.assertEquals(None, maproot.GetSourceAddress(
        {'source': {'google_map_data': 'ab'}}
    ))
    self.assertEquals(None, maproot.GetSourceAddress(
        {'src': {'google_map_data': {'url': 'x'}}}
    ))

if __name__ == '__main__':
  test_utils.main()
