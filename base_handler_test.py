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

"""Tests for base_handler.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

# Allow relative imports within the app.  # pylint: disable=W0403
import base_handler
import test_utils


class BaseHandlerTest(test_utils.BaseTest):
  """Tests for base_handler.py."""

  def testActivateLanguage(self):
    """Tests the selection of the UI language."""
    self.mox.StubOutWithMock(base_handler.translation, 'activate')
    base_handler.translation.activate('en')
    self.mox.ReplayAll()
    self.assertEquals('en', base_handler.ActivateLanguage(None, None))
    self.mox.VerifyAll()
    self.mox.ResetAll()

    # "ja" is a supported language.
    base_handler.translation.activate('ja')
    self.mox.ReplayAll()
    self.assertEquals('ja', base_handler.ActivateLanguage('ja', None))
    self.mox.VerifyAll()
    self.mox.ResetAll()

    base_handler.translation.activate('ja')
    self.mox.ReplayAll()
    self.assertEquals('ja', base_handler.ActivateLanguage(None, 'ja'))
    self.mox.VerifyAll()
    self.mox.ResetAll()

    # "zz" is not a supported language.
    base_handler.translation.activate('en')
    self.mox.ReplayAll()
    self.assertEquals('en', base_handler.ActivateLanguage('zz', None))
    self.mox.VerifyAll()
    self.mox.ResetAll()

    # The hl parameter takes precedence over the Accept-Language header.
    base_handler.translation.activate('tr')
    self.mox.ReplayAll()
    self.assertEquals('tr', base_handler.ActivateLanguage('tr', 'th'))
    self.mox.VerifyAll()
    self.mox.ResetAll()

if __name__ == '__main__':
  test_utils.main()
