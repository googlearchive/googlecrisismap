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
import redirect
import test_utils

from google.appengine.ext import testbed


class RedirectTest(test_utils.BaseTest):
  """Tests for the Redirect request handler."""

  def setUp(self):
    test_utils.BaseTest.setUp(self)
    self.testbed = testbed.Testbed()
    self.testbed.activate()
    root = os.path.dirname(__file__) or '.'
    self.testbed.init_datastore_v3_stub(require_indexes=True, root_path=root)

  def testGet(self):
    """Tests a simple redirection."""
    redirect.Redirection(key_name='foo', url='http://example.com/').put()
    handler = test_utils.SetupHandler(
        'http://google.org/crisismap/redirect/foo', redirect.Redirect())
    handler.get('foo')
    self.assertEquals(302, handler.response.status)
    self.assertEquals('http://example.com/',
                      handler.response.headers['Location'])

  def testGetNonexistentRedirection(self):
    """Tests a nonexistent redirection target."""
    handler = redirect.Redirect()
    handler = test_utils.SetupHandler(
        'http://google.org/crisismap/redirect/xyz', redirect.Redirect())
    handler.get('xyz')
    self.assertEquals(302, handler.response.status)
    self.assertEquals('http://google.org/',
                      handler.response.headers['Location'])


if __name__ == '__main__':
  test_utils.main()
