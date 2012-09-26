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

"""Tests for index.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import os

# Allow relative imports within the app.  # pylint: disable=W0403
import index
import model
import test_utils

from google.appengine.ext import testbed


class IndexTest(test_utils.BaseTest):
  """Tests for the crisismap.Index request handler."""

  def setUp(self):
    test_utils.BaseTest.setUp(self)
    self.testbed = testbed.Testbed()
    self.testbed.activate()
    root = os.path.dirname(__file__) or '.'
    self.testbed.init_datastore_v3_stub(require_indexes=True, root_path=root)
    self.testbed.init_memcache_stub()

  def testGetDestinationWithCrisisParam(self):
    """Tests GetDestination with old-style id= and crisis= parameters."""
    request = test_utils.SetupRequest('http://foo/crisismap?id=abc&layers=def')
    self.assertEquals('http://foo/crisismap/abc?layers=def',
                      index.GetDestination(request))

    request = test_utils.SetupRequest(
        'http://foo/crisismap?crisis=abc&layers=def')
    self.assertEquals('http://foo/crisismap/abc?layers=def',
                      index.GetDestination(request))

  def testGetDestinationDefault(self):
    """Tests GetDestination with no label parameter."""
    request = test_utils.SetupRequest('http://foo/crisismap?layers=abc')
    self.assertEquals('http://foo/crisismap/empty?layers=abc',
                      index.GetDestination(request))

    model.Config.Set('default_label', 'qwerty')
    request = test_utils.SetupRequest('http://foo/crisismap?layers=abc')
    self.assertEquals('http://foo/crisismap/qwerty?layers=abc',
                      index.GetDestination(request))


if __name__ == '__main__':
  test_utils.main()
