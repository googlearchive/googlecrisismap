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

"""Tests for api.py."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import simplejson as json

# Allow relative imports within the app.  # pylint: disable=W0403
import api
import model
import test_utils


class ApiTest(test_utils.BaseTest):
  """Tests for api class."""

  def setUp(self):
    super(ApiTest, self).setUp()
    test_utils.BecomeAdmin()
    self.map = model.Map.Create('{}', owners=['owner@gmail.com'],
                                editors=['editor@gmail.com'],
                                viewers=['viewer@gmail.com'])

  # pylint: disable-msg=C6409
  def testApiGet(self):
    """Fetches a map through the API."""
    json_dict = {'json': True, 'stuff': [0, 1]}
    maproot_json = json.dumps(json_dict)
    self.map.PutNewVersion(maproot_json)
    handler = test_utils.SetupHandler('/api/%s' % self.map.id, api.Api())
    handler.get(self.map.id)
    result_dict = json.loads(handler.response.out.getvalue())
    expect_dict = {'json': json_dict}
    self.assertEquals(expect_dict, result_dict)

  def testBadApiGet(self):
    """Attempts to fetch a map that doesn't exist."""
    nonexistent_id = 'xxx' + self.map.id
    handler = test_utils.SetupHandler('/api/%s' % nonexistent_id, api.Api())
    handler.get(nonexistent_id)
    self.assertEquals(404, handler.response.status)

  def testApiPost(self):
    """Posts a new version of a map."""
    json_dict = {'json': True, 'stuff': [0, 1]}
    maproot_json = json.dumps(json_dict)
    handler = test_utils.SetupHandler('/api/%s' % self.map.id, api.Api(),
                                      'json=%s' % maproot_json)
    handler.post(self.map.id)
    # response 201 indicates Location was set.
    self.assertEquals(201, handler.response.status)
    # Now we refetch the map because the object changed underneath us.
    map_object = model.Map.Get(self.map.id)
    # verify that the pieces were saved properly
    self.assertEquals(maproot_json, map_object.GetCurrentJson())

if __name__ == '__main__':
  test_utils.main()
