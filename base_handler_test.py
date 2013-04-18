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

  def testActivateLanguage(self):
    """Tests the selection of the UI language."""
    self.assertEquals('en', base_handler.ActivateLanguage(None, None))

    # "ja" is a supported language.
    self.assertEquals('ja', base_handler.ActivateLanguage('ja', None))
    self.assertEquals('ja', base_handler.ActivateLanguage(None, 'ja'))

    # "zz" is not a supported language.
    self.assertEquals('en', base_handler.ActivateLanguage('zz', None))

    # "in" is a deprecated code for Indonesian; the proper code is "id".
    self.assertEquals('id', base_handler.ActivateLanguage('in', None))

    # The hl parameter takes precedence over the Accept-Language header.
    self.assertEquals('tr', base_handler.ActivateLanguage('tr', 'th'))

  def testJsonXssVulnerability(self):
    """Verifies that ToHtmlSafeJson is safe against XSS."""
    self.assertFalse('</script>' in base_handler.ToHtmlSafeJson('x</script>y'))
    self.assertFalse('<' in base_handler.ToHtmlSafeJson('x<y'))
    self.assertFalse('>' in base_handler.ToHtmlSafeJson('x>y'))
    self.assertFalse('&' in base_handler.ToHtmlSafeJson('x&y'))


if __name__ == '__main__':
  test_utils.main()
