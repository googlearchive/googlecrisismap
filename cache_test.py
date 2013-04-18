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

"""Unit tests for cache.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import cache
import test_utils


class CacheTests(test_utils.BaseTest):
  """Tests the memcache utility routines."""

  def testToCacheKey(self):
    """Tests that cache keys are properly serialized and escaped."""
    self.assertEquals('foo', cache.ToCacheKey(['foo']))
    self.assertEquals('foo,bar', cache.ToCacheKey(['foo', 'bar']))
    self.assertEquals('foo\\,,bar', cache.ToCacheKey(['foo,', 'bar']))
    self.assertEquals('f\\\\\\\\oo\\,\\,,\\\\b\\,ar',
                      cache.ToCacheKey(['f\\\\oo,,', '\\b,ar']))


if __name__ == '__main__':
  test_utils.main()
