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

import pickle

import cache
import test_utils

from google.appengine.api import memcache


class Point(object):
  """A simple class, used to test pickling of non-primitive values."""

  def __init__(self, x, y):
    self.x, self.y = x, y


class CacheTests(test_utils.BaseTest):
  """Tests for the Cache class."""

  def testSetGetDelete(self):
    """Exercises basic operations."""
    c = cache.Cache('test', 60)

    # Try a simple value.
    self.assertEquals(None, c.Get('x'))
    c.Set('x', 10)
    self.assertEquals(10, c.Get('x'))
    c.Delete('x')
    self.assertEquals(None, c.Get('x'))

    # Try non-primitive keys and values.
    c.Set(['x', {'y': 3, 'z': 2}], Point(6, 7))
    p = c.Get(['x', {'z': 2, 'y': 3}])
    self.assertEquals((6, 7), (p.x, p.y))

  def testMutableValue(self):
    """Verifies that mutations on cached values don't affect the cache."""
    c = cache.Cache('test', 60)

    # Mutate a value passed to Set().
    x = [2, 3, 4]
    c.Set('x', x)
    x.append(5)
    self.assertEquals([2, 3, 4, 5], x)
    self.assertEquals([2, 3, 4], c.Get('x'))  # cached value is unaffected

    # Mutate a value obtained from Get().
    x = c.Get('x')
    x.append(7)
    self.assertEquals([2, 3, 4, 7], x)
    self.assertEquals([2, 3, 4], c.Get('x'))  # cached value is unaffected

  def testGetWithMakeValue(self):
    """Exercises Get() with a make_value argument."""
    c = cache.Cache('test', 60)

    c.Set('x', 5)
    self.assertEquals(5, c.Get('x', lambda: 3))
    self.assertEquals(5, c.Get('x', lambda: 3))

    c.Delete('x')
    self.assertEquals(3, c.Get('x', lambda: 3))
    self.assertEquals(3, c.Get('x'))

  def testAdd(self):
    """Exercises Add()."""
    c = cache.Cache('test', 60)

    self.assertTrue(c.Add('x', 3))
    self.assertFalse(c.Add('x', 5))
    self.assertEquals(3, c.Get('x'))

  def testTtl(self):
    """Verifies expiry behavior."""
    c = cache.Cache('test', 60)

    self.SetTime(0)
    c.Set('x', 3)
    self.SetTime(59)
    self.assertEquals(3, c.Get('x'))  # pulls 3 into the local RAM cache
    self.SetTime(61)
    self.assertEquals(None, c.Get('x'))  # should expire in both caches

  def testUll(self):
    """Verifies update latency behavior."""
    c = cache.Cache('test1', 60, 30)

    self.SetTime(0)
    c.Set('x', 3)
    self.assertEquals(3, c.Get('x'))
    # Simulate a write into memcache by another app instance.
    memcache.set(c.KeyToJson('x'), (60, pickle.dumps(5)), time=60)
    self.assertEquals(3, c.Get('x'))  # update is shadowed by the local cache
    self.SetTime(29)
    self.assertEquals(3, c.Get('x'))
    self.SetTime(31)
    self.assertEquals(5, c.Get('x'))  # ULL exceeded, update now visible

    c = cache.Cache('test2', 60, 0)

    self.SetTime(0)
    c.Set('x', 3)
    self.assertEquals(3, c.Get('x'))
    # Simulate a write into memcache by another app instance.
    memcache.set(c.KeyToJson('x'), (60, pickle.dumps(5)), time=60)
    # The update should be immediately visible.
    self.assertEquals(5, c.Get('x'))

  def testSweep(self):
    """Verifies sweeping of the local cache."""
    cache.Reset()
    c = cache.Cache('test', 10)
    self.assertEquals(0, len(cache.LOCAL_CACHE))

    self.SetTime(0)
    c.Set('x', 3)
    c.Set('y', 4)
    self.assertEquals(2, len(cache.LOCAL_CACHE))  # 'x' and 'y' present

    self.SetTime(cache.SWEEP_INTERVAL_SECONDS + 1)
    c.Set('x', 3)  # should trigger a sweep
    self.assertEquals(1, len(cache.LOCAL_CACHE))  # 'y' should be gone

if __name__ == '__main__':
  test_utils.main()
