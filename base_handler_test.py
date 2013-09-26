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

"""Tests for base_handler.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import base_handler
import test_utils


class BaseHandlerTest(test_utils.BaseTest):
  """Tests for base_handler.py."""

  def testSelectLanguage(self):
    """Tests the selection of the UI language."""
    self.assertEquals('en', base_handler.SelectLanguage(None, None))

    # "ja" is a supported language.
    self.assertEquals('ja', base_handler.SelectLanguage('ja', None))
    self.assertEquals('ja', base_handler.SelectLanguage(None, 'ja'))

    # "zz" is not a supported language.
    self.assertEquals('en', base_handler.SelectLanguage('zz', None))

    # "in" is a deprecated code for Indonesian; the proper code is "id".
    self.assertEquals('id', base_handler.SelectLanguage('in', None))

    # The first parameter takes precedence over the second.
    self.assertEquals('tr', base_handler.SelectLanguage('tr', 'th'))

    # Can handle variable number of args, and chooses the first valid one.
    self.assertEquals('de', base_handler.SelectLanguage(
        'xoxo', None, 'de', 'fr'))

    # Each argument can actually be a comma-separated list of codes.
    self.assertEquals('de', base_handler.SelectLanguage(
        'xoxo,oxox', None, 'yoyo,oyoy,de', 'fr'))

  def testJsonXssVulnerability(self):
    """Verifies that ToHtmlSafeJson is safe against XSS."""
    self.assertFalse('</script>' in base_handler.ToHtmlSafeJson('x</script>y'))
    self.assertFalse('<' in base_handler.ToHtmlSafeJson('x<y'))
    self.assertFalse('>' in base_handler.ToHtmlSafeJson('x>y'))
    self.assertFalse('&' in base_handler.ToHtmlSafeJson('x&y'))

  def testSanitizeCallback(self):
    """Verifies that SanitizeCallback protects against XSS."""
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '.')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, 'abc"')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, "abc'")
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, 'abc;')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '<b>')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '1')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '1abc')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, 'x.2')
    self.assertEquals('abc', base_handler.SanitizeCallback('abc'))
    self.assertEquals('_def', base_handler.SanitizeCallback('_def'))
    self.assertEquals('FooBar3', base_handler.SanitizeCallback('FooBar3'))
    self.assertEquals('x.y', base_handler.SanitizeCallback('x.y'))
    self.assertEquals('x.y._z', base_handler.SanitizeCallback('x.y._z'))


if __name__ == '__main__':
  test_utils.main()
