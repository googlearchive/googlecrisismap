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
    handler = test_utils.SetupHandler(
        'http://foo/crisismap?id=abc&layers=def', index.Index())
    handler.get()
    self.assertEquals('http://foo/crisismap/abc?layers=def',
                      handler.response.headers['Location'])

    handler = test_utils.SetupHandler(
        'http://foo/crisismap?crisis=abc&layers=def', index.Index())
    handler.get()
    self.assertEquals('http://foo/crisismap/abc?layers=def',
                      handler.response.headers['Location'])

  def testGetDestinationDefault(self):
    """Tests GetDestination with no label parameter."""
    handler = test_utils.SetupHandler(
        'http://foo/crisismap?layers=abc', index.Index())
    handler.get()
    self.assertEquals('http://foo/crisismap/empty?layers=abc',
                      handler.response.headers['Location'])

    model.Config.Set('default_label', 'qwerty')
    handler = test_utils.SetupHandler(
        'http://foo/crisismap?layers=abc', index.Index())
    handler.get()
    self.assertEquals('http://foo/crisismap/qwerty?layers=abc',
                      handler.response.headers['Location'])


if __name__ == '__main__':
  test_utils.main()
