#!/usr/bin/python
# Copyright 2014 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Tests for protect.py."""

import cgi
import json

import config
import protect
import test_utils
import utils

from google.appengine.api import urlfetch


class ProtectTest(test_utils.BaseTest):
  """Tests for protect.py."""

  def testAdler32(self):
    self.assertEquals(38600999, protect.Adler32('abc'))
    # A value that's positive when unsigned, but would be negative if signed
    self.assertEquals(2424703776, protect.Adler32('abcdefghijklmnopqrstuvwxyz'))

  def testSign(self):
    params = {'a': 'b', 'c': 'd', 'e': 'f'}
    self.assertEquals('123:208798514', protect.Sign(params, '123', ['a', 'c']))
    # Result should be independent of order.
    self.assertEquals('123:208798514', protect.Sign(params, '123', ['c', 'a']))
    # Result should depend only on the specified keys.
    params['e'] = 'xxx'
    self.assertEquals('123:208798514', protect.Sign(params, '123', ['a', 'c']))

  def testVerify(self):
    self.SetTime(1234567890)
    params = {'a': 'b', 'c': 'd', 'e': 'f'}
    keys = ['a', 'c', 'e']
    timestamp = '1234567890000'
    timestamp, checksum = protect.Sign(params, timestamp, keys).split(':')

    # Signature with no timestamp.
    params['signature'] = 'x:' + checksum
    self.assertFalse(protect.Verify(params, keys))

    # Valid signature.
    params['signature'] = timestamp + ':' + checksum
    self.assertTrue(protect.Verify(params, keys))

    # Signature with an incorrect checksum.
    params['signature'] = timestamp + ':' + checksum + '0'
    self.assertFalse(protect.Verify(params, keys))

    # Signature with a stale timestamp.
    self.SetTime(1234567890 + 31)
    self.assertFalse(protect.Verify(params, keys))


if __name__ == '__main__':
  test_utils.main()
