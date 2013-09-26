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

import model
import test_utils


class ApiTest(test_utils.BaseTest):
  """Tests for api class."""

  def setUp(self):
    super(ApiTest, self).setUp()
    test_utils.BecomeAdmin()
    self.map = model.Map.Create('{}', 'xyz.com',
                                owners=['owner@gmail.com'],
                                editors=['editor@gmail.com'],
                                viewers=['viewer@gmail.com'])

  def testGetMap(self):
    """Fetches a map through the API."""
    json_dict = {'json': True, 'stuff': [0, 1]}
    maproot_json = json.dumps(json_dict)
    self.map.PutNewVersion(maproot_json)
    response = self.DoGet('/.api/maps/%s' % self.map.id)
    self.assertEquals({'json': json_dict}, json.loads(response.body))

  def testGetInvalidMap(self):
    """Attempts to fetch a map that doesn't exist."""
    self.DoGet('/.api/maps/xyz', status=404)

  def testPostMap(self):
    """Posts a new version of a map."""
    maproot_json = '{"stuff": [0, 1]}'
    self.DoPost('/.api/maps/' + self.map.id, 'json=' + maproot_json)
    # Now we refetch the map because the object changed underneath us.
    map_object = model.Map.Get(self.map.id)
    # verify that the pieces were saved properly
    self.assertEquals(maproot_json, map_object.GetCurrentJson())

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

    test_utils.BecomeAdmin()
    # Create and publish two maps
    model.CatalogEntry.Create('google.com', 'Map1', model.Map.Create(
        json.dumps(map1), 'xyz.com'))
    model.CatalogEntry.Create('google.com', 'Map2', model.Map.Create(
        json.dumps(map2), 'xyz.com'))
    # Create a draft; should not be returned by api.Maps
    model.Map.Create(json.dumps(draft), 'xyz.com')

    test_utils.ClearUser()
    response = self.DoGet('/.api/maps')
    self.assertEquals([{'url': '/root/google.com/Map2', 'maproot': map2},
                       {'url': '/root/google.com/Map1', 'maproot': map1}],
                      json.loads(response.body))


if __name__ == '__main__':
  test_utils.main()
