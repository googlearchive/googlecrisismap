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

"""Tests for create.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

# Allow relative imports within the app.  # pylint: disable=W0403
import create
import model
import test_utils


class CreateTest(test_utils.BaseTest):
  """Tests for create.py."""

  # pylint: disable-msg=C6409
  def testCreate(self):
    test_utils.SetUser('foo@google.com')
    model.SetGlobalRoles('google.com', [model.ROLES.MAP_CREATOR])
    handler = test_utils.SetupHandler('/create', create.Create(), '')
    handler.post()
    location = handler.response.headers['Location']
    map_object = model.Map.Get(location.split('/')[-1])
    self.assertTrue(map_object is not None)
    self.assertTrue('Untitled' in map_object.GetCurrentJson())

  # pylint: disable-msg=C6409
  def testCreateWithoutPermission(self):
    test_utils.SetUser('foo@google.com')
    handler = test_utils.SetupHandler('/create', create.Create())
    self.assertRaises(model.AuthorizationError, handler.post)


if __name__ == '__main__':
  test_utils.main()
