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

import webapp2
import webob

import config
import domains
import test_utils


class IndexTest(test_utils.BaseTest):
  """Tests for the Index request handler."""

  def testRedirectWithCrisisParam(self):
    """Tests GetDestination with old-style id= and crisis= parameters."""
    self.assertEquals(
        'http://app.com/root/abc?layers=def',
        self.DoGet('/?id=abc&layers=def', 302).headers['Location'])
    self.assertEquals(
        'http://app.com/root/abc?layers=def',
        self.DoGet('/?crisis=abc&layers=def', 302).headers['Location'])

  def testRedirectDefault(self):
    """Tests GetDestination with no label parameter."""
    self.assertEquals('http://app.com/root/empty',
                      self.DoGet('', 302).headers['Location'])

    self.assertEquals('http://app.com/root/empty?layers=x',
                      self.DoGet('/?layers=x', 302).headers['Location'])

    with test_utils.RootLogin():
      domain = domains.Domain.Get(None)
      domain.default_label = 'qwerty'
      domain.Put()
    self.assertEquals('http://app.com/root/qwerty?layers=x',
                      self.DoGet('/?layers=x', 302).headers['Location'])

    with test_utils.RootLogin():
      domain = domains.Domain.Create('foo.org')
      domain.default_label = 'fancy-label'
      domain.Put()
    response = self.DoGet('/foo.org/?layers=x', 302)
    self.assertEquals('http://app.com/root/foo.org/fancy-label?layers=x',
                      response.headers['Location'])


if __name__ == '__main__':
  test_utils.main()
