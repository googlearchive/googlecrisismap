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

"""Unit tests for utils.py."""

import test_utils
import utils


class UtilsTests(test_utils.BaseTest):
  def testGetCurrentUserEmail(self):
    """Verifies that GetCurrentUserEmail normalizes e-mail addresses."""
    test_utils.ClearUser()
    self.assertEquals('', utils.GetCurrentUserEmail())
    test_utils.SetUser('Dr.Horrible@eXAMple.com')
    self.assertEquals('drhorrible@example.com', utils.GetCurrentUserEmail())

  def testGetCurrentUserDomain(self):
    """Verifies that GetCurrentUserDomain works."""
    test_utils.ClearUser()
    self.assertEquals('', utils.GetCurrentUserDomain())
    test_utils.SetUser('Dr.Horrible@eXAMple.com')
    self.assertEquals('example.com', utils.GetCurrentUserDomain())
