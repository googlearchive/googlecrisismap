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

"""Tests for prefs.py."""

__author__ = 'romano@google.com (Raquel Romano)'

import profiles
import test_utils


class PrefsTest(test_utils.BaseTest):
  """Tests the prefs.py handler."""

  def setUp(self):
    super(PrefsTest, self).setUp()
    test_utils.SetUser('random@gmail.com')

  def testGet(self):
    """Tests the Prefs GET handler."""
    result = self.DoGet('/.prefs').body
    self.assertTrue('Preference' in result, result)

  def testPost(self):
    """Tests the Prefs POST handler."""
    self.assertEquals(None,
                      profiles.Profile.Get('random@gmail.com'))
    self.DoPost('/.prefs', 'marketing_consent=True')
    self.assertTrue(profiles.Profile.Get('random@gmail.com').marketing_consent)
    self.assertTrue(profiles.Profile.Get('random@gmail.com').
                    marketing_consent_answered)
    self.DoPost('/.prefs', '')
    self.assertFalse(profiles.Profile.Get('random@gmail.com').marketing_consent)
    self.assertTrue(profiles.Profile.Get('random@gmail.com').
                    marketing_consent_answered)


if __name__ == '__main__':
  test_utils.main()
