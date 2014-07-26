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

"""An application cache that uses both local RAM and memcache.

See cache.Cache() for detailed usage instructions.

To avoid key collisions, don't use memcache directly; use this module.
(If you must use memcache, use keys produced by calling Cache.KeyToJson.)
"""
# TODO(user):
# - consider tracking size of queue
# TODO(kpy):
# - define a simpler GetOnlyCache() that has only a Get() method and no ULL
# - define a CounterCache() that supports Incr() and Decr()

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import json
import pickle
import threading
import time

from google.appengine.api import memcache

LOCAL_CACHE = {}  # key => (expiration, value_pickle)
SWEEP_LOCK = threading.Lock()  # lock held while sweeping LOCAL_CACHE
SWEEP_INTERVAL_SECONDS = 60

next_sweep_time = 0


def Reset():
  """Reset the state of this module.  For use in tests only."""
  global next_sweep_time
  LOCAL_CACHE.clear()
  next_sweep_time = 0


def _SetLocalCache(key_json, expiration, value_pickle):
  """Sets an item in the local RAM cache; also sweeps the cache if it's due."""
  now = time.time()
  if expiration > now:
    LOCAL_CACHE[key_json] = (expiration, value_pickle)
    # SWEEP_LOCK is not held here, so the item can be prematurely deleted by a
    # concurrent sweep.  That's okay: this affects efficiency, not correctness,
    # and not having to lock on every write is probably a bigger win.

  global next_sweep_time
  if now >= next_sweep_time:
    # Only one thread can advance next_sweep_time; that thread does the sweep.
    next_sweep_time_snapshot = next_sweep_time
    with SWEEP_LOCK:
      if next_sweep_time == next_sweep_time_snapshot:
        # This thread got the lock first; proceed to sweep the cache.
        next_sweep_time = now + SWEEP_INTERVAL_SECONDS
        for key_json, (expiration, unused_value_pickle) in LOCAL_CACHE.items():
          if expiration < now:
            # Use pop() instead of del because the item can be concurrently
            # removed by Cache.Delete(), which doesn't hold SWEEP_LOCK.
            LOCAL_CACHE.pop(key_json, None)


class Cache(object):
  """A two-level cache (local RAM and memcache).

  To use this class, first create a named instance (clients that use the
  same name will access the same shared cache):

      >>> c = cache.Cache('foo', 60)  # 60-second TTL

  Then set and get values in it:

      >>> c.Get('x')  # returns None
      >>> c.Set('x', 5)
      >>> c.Get('x')
      5

  Get() invokes its second argument if the item is not found in the cache.
  It can be used to get and update a value in a single call:

      >>> c.Set('x', 5)
      >>> c.Get('x', lambda: [time.sleep(3), 1])  # returns immediately
      5
      >>> c.Delete('x')
      >>> c.Get('x', lambda: [time.sleep(3), 1])  # takes 3 seconds
      [None, 1]

  Any JSON structure can be a key; any picklable object can be a value:

      >>> c.Set({1: 2, 3: 4}, 5 + 6j)
      >>> c.Get({3: 4, 1: 2})
      (5+6j)

  Mutable values are safe to cache; mutating them won't affect the cache:

      >>> x = [2, 3, 4]
      >>> c.Set('x', x)
      >>> x.append(5)
      >>> x
      [2, 3, 4, 5]
      >>> c.Get('x')
      [2, 3, 4]
      >>> c.Get('x').append(7)
      >>> c.Get('x')
      [2, 3, 4]

  Cache instances have two parameters: TTL (time to live) and ULL (update
  latency limit).  The TTL controls when items expire; the ULL controls
  when updates to items become visible in all app instances.  You must
  specify a TTL; the ULL is optional and defaults to be the same as the
  TTL.  Setting the ULL to zero disables use of the local RAM cache.

  For example, cache.Cache('foo', 60, 5) configures a 60-second TTL and a
  5-second ULL.  After Set() is called on a particular key, that key will
  stay populated for 60 seconds.  Each app instance that calls Get() for
  that key will hit memcache for it, then cache it locally for 5 seconds
  (during which reads will be very fast), ensuring that memcache receives
  at most 0.2 QPS per app instance for that key.  The tradeoff is that
  Get() can give a stale value for up to 5 seconds after another app
  instance has updated a key with Set() or Delete().

  You can use a cache in two ways:

    - Promptly updated: if you're caching data that is maintained in your
      app (e.g. datastore values), then you can use Set() or Delete() to
      update the cache whenever the original data changes.  In this case,
      set the ULL to the maximum staleness you can stand.  Lowering it to
      0 ensures you always get fresh values, but increases memcache load.

    - Periodically updated: if you don't or can't reliably call Set() or
      Delete() whenever the original data changes (e.g. you're fetching
      the data from an external source), then set the TTL based on how
      often you want to consult the original source.  In this case,
      lowering the ULL is useful only if you want to perform visible
      updates sooner than the TTL expires.
  """
  # Values are pickled for caching to ensure immutability.  This has the side
  # benefit that None is cached as the string 'N.', which makes it easy to
  # distinguish a cached value of None from a cache miss.

  def __init__(self, name, ttl, ull=None):
    """A two-level cache (local RAM and memcache).

    Args:
      name: The cache name, a string.  Cache instances with different
          names access independent caches; instances with the same name
          access the same cache.  Caches are typically named after a
          module, e.g. 'foo.bar' for the cache of bars in module foo.
      ttl: Time to live (TTL), in seconds.  The TTL is the maximum time
          that items reside in the cache.  Items are guaranteed to
          expire by <time of last Set() call> + ttl, where "expired"
          means "Get() will call make_value or return None".
      ull: Update latency limit (ULL), in seconds.  This is the maximum
          latency of visibility of updates.  Updates are guaranteed to
          be visible in all app instances by <time of Set() or Delete()
          call> + ull, where "visible" means "Get() will return the new
          value".  Optional; defaults to the same value as ttl.  (This
          default is fine if all cache updates occur via Get(); if you
          use Set() or Delete(), you probably want ull to be smaller.)
    Raises:
      ValueError: ull > ttl is not allowed.
    """
    if ull > ttl:
      raise ValueError("Setting ull > ttl doesn't make sense")
    self.name = name
    self.ttl = ttl
    self.ull = ttl if ull is None else ull

  def KeyToJson(self, key):
    """Converts a cache key to a canonical fully qualified string."""
    return json.dumps([self.name, key], sort_keys=True)

  def Get(self, key, make_value=None):
    """Gets a key's value, using make_value() if it's not in the cache.

    Args:
      key: The cache key.  Can be any JSON-serializable value.
      make_value: An optional function to produce the value if it's not
          found in the cache.  The value must be picklable.
    Returns:
      The cached value, or the newly made value if it wasn't already
      cached, or None if make_value was not provided.
    """
    key_json = self.KeyToJson(key)
    now = time.time()

    # Look for the key in the local cache.
    expiration, value_pickle = LOCAL_CACHE.get(key_json, (0, None))
    if now < expiration:
      return pickle.loads(value_pickle)

    # Not found, so look for the key in memcache.
    expiration, value_pickle = memcache.get(key_json) or (0, None)

    # Not found, so generate the value and store it in memcache.
    if make_value and not value_pickle:
      expiration, value_pickle = now + self.ttl, pickle.dumps(make_value())
      memcache.set(key_json, (expiration, value_pickle), time=self.ttl)

    # Store the value in the local cache, then return it.
    if value_pickle:
      _SetLocalCache(key_json, min(now + self.ull, expiration), value_pickle)
      return pickle.loads(value_pickle)

  def Set(self, key, value):
    """Sets a key's value in the cache.

    Args:
      key: The cache key.  Can be any JSON-serializable value.
      value: The value to store in the cache.  Must be picklable.
    """
    key_json = self.KeyToJson(key)
    value_pickle = pickle.dumps(value)
    now = time.time()

    memcache.set(key_json, (now + self.ttl, value_pickle), time=self.ttl)
    _SetLocalCache(key_json, now + self.ull, value_pickle)

  def Add(self, key, value):
    """Atomically sets a key's value only if it's not already set.

    To ensure atomicity, this method always queries memcache directly.

    Args:
      key: The cache key.  Can be any JSON-serializable value.
      value: The value to store in the cache.  Must be picklable.
    Returns:
      True if this key was not previously set and was updated.
    """
    key_json = self.KeyToJson(key)
    value_pickle = pickle.dumps(value)
    now = time.time()
    return memcache.add(key_json, (now + self.ttl, value_pickle), time=self.ttl)

  def Delete(self, key):
    """Deletes a key from the cache.

    Args:
      key: The cache key.  Can be any JSON-serializable value.
    """
    key_json = self.KeyToJson(key)
    memcache.delete(key_json)
    LOCAL_CACHE.pop(key_json, None)
