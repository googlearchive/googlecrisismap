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

import time

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


class UtilsSetAndTestTests(test_utils.BaseTest):

  def setUp(self):
    super(UtilsSetAndTestTests, self).setUp()
    self.set_called = 0
    self.test_called = 0
    self.total_sleep_time = 0

  def MockSleep(self, seconds):
    self.total_sleep_time += seconds

  def MockSet(self):
    self.set_called += 1

  def MockTestTrue(self):
    self.test_called +=1
    return True

  def MockTestFalse(self):
    self.test_called += 1
    return False

  def testSetAndTest_testPasses(self):
    self.mox.stubs.Set(time, 'sleep', self.MockSleep)
    self.assertTrue(utils.SetAndTest(self.MockSet, self.MockTestTrue))
    self.assertEqual(1, self.set_called)
    self.assertEqual(1, self.test_called)

  def testSetAndTest_testFails(self):
    self.mox.stubs.Set(time, 'sleep', self.MockSleep)
    self.assertFalse(
        utils.SetAndTest(self.MockSet, self.MockTestFalse, num_tries=5))
    self.assertEqual(1, self.set_called)
    self.assertEqual(5, self.test_called)

  def testSetAndTest_DefaultSleepTime(self):
    # by default, total sleep time should be around 1 second
    self.mox.stubs.Set(time, 'sleep', self.MockSleep)
    self.assertFalse(
        utils.SetAndTest(self.MockSet, self.MockTestFalse))
    self.assertTrue(0.9 < self.total_sleep_time < 1.1)

  def testSetAndTest_noSleep(self):
    def RaisingSleep(unused_seconds):
      raise ValueError
    self.mox.stubs.Set(time, 'sleep', RaisingSleep)
    self.assertFalse(utils.SetAndTest(
        self.MockSet, self.MockTestFalse, num_tries=5, sleep_delta=0))


if __name__ == '__main__':
  test_utils.main()
