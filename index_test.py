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

import config
import test_utils


class IndexTest(test_utils.BaseTest):
  """Tests for the crisismap.Index request handler."""

  def testRedirectWithCrisisParam(self):
    """Tests GetDestination with old-style id= and crisis= parameters."""
    self.assertEquals(
        'http://app.com/root/abc?layers=def',
        self.DoGet('/?id=abc&layers=def', status=302).headers['Location'])
    self.assertEquals(
        'http://app.com/root/abc?layers=def',
        self.DoGet('/?crisis=abc&layers=def', status=302).headers['Location'])

  def testRedirectDefault(self):
    """Tests GetDestination with no label parameter."""
    self.assertEquals('http://app.com/root/empty',
                      self.DoGet('', status=302).headers['Location'])

    self.assertEquals('http://app.com/root/empty?layers=x',
                      self.DoGet('/?layers=x', status=302).headers['Location'])

    config.Set('default_label', 'qwerty')
    self.assertEquals('http://app.com/root/qwerty?layers=x',
                      self.DoGet('/?layers=x', status=302).headers['Location'])


if __name__ == '__main__':
  test_utils.main()
