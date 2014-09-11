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
import time

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
    # Make sure the result of make_value is not used, since there is a local
    # cache and memcache value
    self.assertEquals(5, c.Get('x', lambda: 3))
    self.assertEquals(5, c.Get('x', lambda: 3))

    c.Delete('x')
    # Make sure the result of make_value is used now, since there is nothing
    # in the cache
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
    self.SetTime(15)
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

  def testCreate_highRateLimit(self):
    """Tests that high make_rate_limit doesn't result in 0 wait b/w locks."""
    c = cache.Cache('test', 60, 30, get_timeout=3, make_rate_limit=50)

    self.SetTime(0)
    self.StubTimeSleep()
    c.Set('x', 3)

    self.SetTime(61)  # TTL exceeded
    self.assertEquals(7, c.Get('x', lambda: 7))  # make_value result

    # Verify that we can do make_value again. This is checking that
    # 1/make_rate_limit doesn't get rounded to 0 and thus making it impossible
    # to grab locks with this expiration time.
    self.SetTime(130)  # TTL exceeded
    self.assertEquals(9, c.Get('x', lambda: 9))  # make_value result

  def testGet_memcacheValueCold_successfulUpdate(self):
    """Test for TTC successful update.

    Verifies cached value is updated with make_value result when the key is
    past its cooling time.
    """
    c = cache.Cache('test', 60, 30, get_timeout=3, make_rate_limit=1)
    # ttc is ttl * 0.85 = 51s

    self.SetTime(0)
    self.StubTimeSleep()
    c.Set('x', 3)
    self.assertEquals(3, c.Get('x', lambda: 5))  # local cache value

    self.SetTime(53)  # TTC exceeded
    self.assertEquals(7, c.Get('x', lambda: 7))  # make_value result
    self.assertEquals(7, c.Get('x', lambda: 9))  # recently cached value
    self.assertEquals(53, time.time())  # verify sleep() wasn't called

    self.SetTime(61)
    # Old TTL exceeded, but we already refreshed the value and its expiration
    self.assertEquals(7, c.Get('x', lambda: 11))  # recently cached value
    self.assertEquals(61, time.time())

  def testGet_memcacheValueCold_makeValueFails(self):
    """Verifies a stale value is returned when make_value fails on rewarming."""
    c = cache.Cache('test', 60, 30, get_timeout=3, make_rate_limit=1)
    # ttc is ttl * 0.85 = 51s
    counters = {'make_value_counter': 0}
    def RaisingMakeValue():
      counters['make_value_counter'] += 1
      raise ValueError('make_value error')

    self.SetTime(0)
    self.StubTimeSleep()
    c.Set('x', 3)
    self.assertEquals(3, c.Get('x', lambda: 5))  # local cache value
    self.assertEquals(0, counters['make_value_counter'])

    self.SetTime(53)  # TTC exceeded
    self.assertEquals(3, c.Get('x', RaisingMakeValue))  # stale value
    self.assertEquals(1, counters['make_value_counter'])
    self.assertEquals(53, time.time())   # verify sleep() wasn't called

  def testGet_memcacheValueCold_makeValueLock(self):
    """Verifies that 'get' serves a stale value when rewarming fails."""
    c = cache.Cache('test', 60, 30, get_timeout=4, make_rate_limit=0.018)
    # ttc is ttl * 0.85 = 51s
    counters = {'make_value_counter': 0}
    def MakeValueSevenWithCounter():
      counters['make_value_counter'] += 1
      return 7

    self.SetTime(0)
    self.StubTimeSleep()
    c.Set('x', 3)
    self.assertEquals(3, c.Get('x', MakeValueSevenWithCounter))  # local cache
    self.assertEquals(0, counters['make_value_counter'])

    self.SetTime(52)
    # TTC exceeded, TTL isn't, grab the lock till time = 107 (~55s b/w requests)
    self.assertEquals(7, c.Get('x', MakeValueSevenWithCounter))
    self.assertEquals(1, counters['make_value_counter'])
    self.assertEquals(52, time.time())   # verify sleep() wasn't called

    self.SetTime(104)
    # New TTC exceeded, TTL isn't, lock is not available (held till time ~= 107)
    self.assertEquals(7, c.Get('x', lambda: 9))  # stale value
    self.assertEquals(104, time.time())

    self.SetTime(108)
    # New TTC exceeded, TTL isn't, lock is available
    self.assertEquals(9, c.Get('x', lambda: 9))  # make_value
    self.assertEquals(108, time.time())

  def testGet_noMemcacheValue_makeValueFails(self):
    """Test for expired memcache entry where make_value fails.

    Verifies an error is raised right away when memcache has no value for
    the key and make_value fails.
    """
    c = cache.Cache('test', 60, 30, get_timeout=3, make_rate_limit=1)
    counters = {'make_value_counter': 0}
    def RaisingMakeValue():
      counters['make_value_counter'] += 1
      raise ValueError('make_value error')

    self.SetTime(0)
    self.StubTimeSleep()
    c.Set('x', 3)
    self.assertEquals(3, c.Get('x', RaisingMakeValue))  # local cache value
    self.assertEquals(0, counters['make_value_counter'])

    self.SetTime(61)  # TTL exceeded
    self.assertRaises(ValueError, c.Get, 'x', RaisingMakeValue)
    self.assertEquals(1, counters['make_value_counter'])
    self.assertEquals(61, time.time())   # verify sleep() wasn't called

  def testGet_noMemcacheValue_makeValueLock(self):
    """Test for expired memcache entry where the lock for make_value is taken.

    Verifies there are a few retries when the key is not in memcache and
    make_value's lock can't be acquired on first try.
    """
    c = cache.Cache('test', 60, 30, get_timeout=5, make_rate_limit=0.014)
    # ttc is ttl * 0.85 = 51s
    counters = {'make_value_counter': 0}
    def MakeValueSevenWithCounter():
      counters['make_value_counter'] += 1
      return 7

    self.SetTime(0)
    self.StubTimeSleep()
    c.Set('x', 3)
    self.assertEquals(3, c.Get('x', lambda: 5))  # local cache value
    self.assertEquals(0, counters['make_value_counter'])

    self.SetTime(61)
    # TTL exceeded, acquire make_value lock with expiration at time ~= 132
    # (~71s b/w requests)
    self.assertEquals(7, c.Get('x', MakeValueSevenWithCounter))
    self.assertEquals(1, counters['make_value_counter'])
    self.assertEquals(61, time.time())   # verify sleep() wasn't called

    self.SetTime(62)
    # TTL has been refreshed to 121, so no calls to make_value expected here
    self.assertEquals(7, c.Get('x', lambda: 9))  # local cache
    self.assertEquals(62, time.time())

    self.SetTime(129)
    # TTL exceeded, make_value lock can't be acquired on the first try, so
    # 'Get' should wait for 0.05ms (RETRY_INTERVAL),
    # retry a few times and at time = 133s successfully acquire the lock
    self.assertEquals(9, c.Get('x', lambda: 9))
    self.assertEquals(133, int(time.time()))

  def testGet_noMemcacheValue_noMakeValue(self):
    """Test for expired memcache entry 'Get' with no make_value argument."""
    c = cache.Cache('test', 60, 30, get_timeout=3, make_rate_limit=70)

    counters = {'memcache_get_counter': 0}
    def GetFromMemcacheWithCounter():
      counters['memcache_get_counter'] += 1
      return None
    self.mox.stubs.Set(memcache, 'get',
                       lambda key_json: GetFromMemcacheWithCounter())

    self.SetTime(0)
    self.StubTimeSleep()
    c.Set('x', 3)
    self.assertEquals(3, c.Get('x'))  # local cache value
    self.assertEquals(0, time.time())   # verify sleep() wasn't called
    self.assertEquals(0, counters['memcache_get_counter'])

    self.SetTime(61)
    # TTL exceeded
    self.assertEquals(None, c.Get('x'))
    self.assertEquals(61, time.time())
    self.assertEquals(1, counters['memcache_get_counter'])

if __name__ == '__main__':
  test_utils.main()
