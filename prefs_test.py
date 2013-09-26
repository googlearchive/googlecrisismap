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

import test_utils
import users


class PrefsTest(test_utils.BaseTest):
  """Tests the prefs.py handler."""

  def testGet(self):
    """Tests the Prefs GET handler."""
    with test_utils.Login('test'):
      result = self.DoGet('/.prefs').body
      self.assertTrue('Preference' in result, result)

  def testPost(self):
    """Tests the Prefs POST handler."""
    with test_utils.Login('test'):
      # The first request of any kind should store the UserModel entity, but
      # requests should not affect the preference flags unless save_keys is set.
      self.DoPost('/.prefs', 'marketing_consent=on&xsrf_token=XSRF')
      self.assertFalse(users.Get('test').marketing_consent_answered)

      # save_keys indicates which keys to save, even if the POST data doesn't
      # contain a particular key's name because its checkbox is off.
      self.DoPost('/.prefs', 'save_keys=marketing_consent&xsrf_token=XSRF')
      self.assertFalse(users.Get('test').marketing_consent)
      self.assertTrue(users.Get('test').marketing_consent_answered)

      # With no save_keys, there should be no effect.
      self.DoPost('/.prefs', 'marketing_consent=on&xsrf_token=XSRF')
      self.assertFalse(users.Get('test').marketing_consent)
      self.assertTrue(users.Get('test').marketing_consent_answered)

      # With save_keys, this should turn marketing_consent on.
      self.DoPost('/.prefs', 'save_keys=marketing_consent'
                  '&marketing_consent=on&xsrf_token=XSRF')
      self.assertTrue(users.Get('test').marketing_consent)
      self.assertTrue(users.Get('test').marketing_consent_answered)


if __name__ == '__main__':
  test_utils.main()
