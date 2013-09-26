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

import redirect
import test_utils


class RedirectTest(test_utils.BaseTest):
  """Tests for the Redirect request handler."""

  def testGet(self):
    """Tests a simple redirection."""
    redirect.Redirection(key_name='foo', url='http://elsewhere.com/').put()
    self.assertEquals(
        'http://elsewhere.com/',
        self.DoGet('/.redirect/foo', 302).headers['Location'])

  def testGetNonexistentRedirection(self):
    """Tests a nonexistent redirection target."""
    self.assertEquals(
        'http://app.com/',
        self.DoGet('/.redirect/xyz', 302).headers['Location'])

if __name__ == '__main__':
  test_utils.main()
