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
    self.map = test_utils.CreateMap(
        owners=['owner'], editors=['editor'], viewers=['viewer'])

  def testGetMap(self):
    """Fetches a map through the API."""
    json_dict = {'json': True, 'stuff': [0, 1]}
    maproot_json = json.dumps(json_dict)
    with test_utils.Login('editor'):
      self.map.PutNewVersion(maproot_json)
    with test_utils.Login('viewer'):
      response = self.DoGet('/.api/maps/%s' % self.map.id)
    self.assertEquals({'json': json_dict}, json.loads(response.body))

  def testGetInvalidMap(self):
    """Attempts to fetch a map that doesn't exist."""
    self.DoGet('/.api/maps/xyz', 404)

  def testPostMap(self):
    """Posts a new version of a map."""
    maproot_json = '{"stuff": [0, 1]}'
    with test_utils.Login('editor'):
      self.DoPost('/.api/maps/' + self.map.id,
                  'json=' + maproot_json + '&xsrf_token=XSRF')
    # Now we refetch the map because the object changed underneath us.
    with test_utils.Login('viewer'):
      # Verify that the edited content was saved properly.
      map_object = model.Map.Get(self.map.id)
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

    # Create and publish two maps
    with test_utils.RootLogin():
      m1 = test_utils.CreateMap(json.dumps(map1))
      model.CatalogEntry.Create('xyz.com', 'label1', m1)
      m2 = test_utils.CreateMap(json.dumps(map2))
      model.CatalogEntry.Create('xyz.com', 'label2', m2)
      # Create a draft; should not be returned by api.Maps
      test_utils.CreateMap(json.dumps(draft))

    response = self.DoGet('/.api/maps')
    self.assertEquals([{'url': '/root/xyz.com/label2', 'maproot': map2},
                       {'url': '/root/xyz.com/label1', 'maproot': map1}],
                      json.loads(response.body))


if __name__ == '__main__':
  test_utils.main()
