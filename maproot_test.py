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
    self.assertEquals('GEORSS:abc', maproot.GetSourceAddress(
        {'type': 'GEORSS', 'source': {'georss': {'url': 'abc'}}}
    ))
    self.assertEquals('KML:xyz', maproot.GetSourceAddress(
        {'type': 'KML', 'source': {'kml': {'url': 'xyz'}}}
    ))
    self.assertEquals('WMS:tuv', maproot.GetSourceAddress(
        {'type': 'WMS',
         'source': {'wms': {'url': 'tuv'}}}
    ))
    self.assertEquals(None, maproot.GetSourceAddress(
        {'type': 'GOOGLE_MAP_DATA', 'source': {'google_map_data': 'ab'}}
    ))
    self.assertEquals(None, maproot.GetSourceAddress(
        {'type': 'GOOGLE_TRAFFIC'}
    ))

if __name__ == '__main__':
  test_utils.main()
