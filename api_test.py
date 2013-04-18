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

import api
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

  def testMapsGet(self):
    """Fetches a map through the API."""
    json_dict = {'json': True, 'stuff': [0, 1]}
    maproot_json = json.dumps(json_dict)
    self.map.PutNewVersion(maproot_json)
    handler = test_utils.SetupHandler('/api/maps/%s' % self.map.id, api.Maps())
    handler.get(self.map.id)
    result_dict = json.loads(handler.response.body)
    expect_dict = {'json': json_dict}
    self.assertEquals(expect_dict, result_dict)

  def testBadMapsGet(self):
    """Attempts to fetch a map that doesn't exist."""
    nonexistent_id = 'xxx' + self.map.id
    handler = test_utils.SetupHandler('/api/maps/%s' % nonexistent_id,
                                      api.Maps())
    handler.get(nonexistent_id)
    self.assertEquals(404, handler.response.status_int)

  def testMapsPost(self):
    """Posts a new version of a map."""
    json_dict = {'json': True, 'stuff': [0, 1]}
    maproot_json = json.dumps(json_dict)
    handler = test_utils.SetupHandler('/api/maps/%s' % self.map.id, api.Maps(),
                                      'json=%s' % maproot_json)
    handler.post(self.map.id)
    # response 201 indicates Location was set.
    self.assertEquals(201, handler.response.status_int)
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
    handler = test_utils.SetupHandler('/api/maps', api.PublishedMaps())
    handler.get()
    maps = json.loads(handler.response.body)
    self.assertEquals([{'label': 'Map2', 'maproot': map2},
                       {'label': 'Map1', 'maproot': map1}], maps)


if __name__ == '__main__':
  test_utils.main()
