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

"""An application cache that uses only local RAM."""



import copy
import threading
import time

SWEEP_INTERVAL_SECONDS = 60


class _CacheEntry(object):
  """Entry to be stored in LocalCache."""

  def __init__(self, value, expiry):
    """Cache Entry."""
    self._value = copy.deepcopy(value)
    self._expiry = expiry

  @property
  def value(self):
    return copy.deepcopy(self._value)

  @property
  def expiry(self):
    return self._expiry


class LocalCache(object):
  """A simple RAM cache that is similar to cache.py's Cache.

  This is the backing store for cache.py's local cache, but can be used
  directly as well. It isn't quite a drop-in replacement for cache.py, but is
  close. Unlike cache.py:
  - it is single tier and doesn't use memcache to share values between processes
  - it doesn't take a namespace because the values are stored in the LocalCache
    object instead of in the global memcache. If you need another namespace
    just create another LocalCache.
  - it doesn't have ull as that doesn't make sense in the local context.
  - it doesn't support rate limiting or cache refreshing, as anything you'd want
    to do that for, you should probably just use cache.py/memcache.
  - it doesn't support make_value for Get, though that wouldn't be too hard to
    implement when it's needed.
  - it doesn't support Add. If you need Add you're probably trying to build a
    lock and are better off using a real python threading.Lock.
  """

  def __init__(self, ttl=0):
    """Constructor for LocalCache.

    Args:
      ttl: How long values should stay in cache. Default (0) is don't expire.
    """
    self._cache = {}  # key => _CacheEntry
    self._ttl = ttl
    self._sweep_lock = threading.Lock()  # lock held while sweeping _cache
    self._next_sweep_time = 0

  def Clear(self):
    """Clear the state of this cache. For use in tests only."""
    self._cache.clear()

  def _Sweep(self):
    """Walk through all cache entries and delete any that are expired."""
    now = time.time()
    next_sweep_time_snapshot = self._next_sweep_time
    if now >= next_sweep_time_snapshot and self._sweep_lock.acquire(False):
      # Only one thread can advance next_sweep_time; that thread does the sweep.
      try:
        if self._next_sweep_time == next_sweep_time_snapshot:
          # This thread got the lock first; proceed to sweep the cache.
          self._next_sweep_time = now + SWEEP_INTERVAL_SECONDS
          for key_json, entry in self._cache.items():
            if 0 < entry.expiry < now:
              # Use pop() instead of del because the item can be concurrently
              # removed by Cache.Delete(), which doesn't hold _sweep_lock.
              self._cache.pop(key_json, None)
      finally:
        self._sweep_lock.release()

  def Get(self, key):
    """Get the value referenced by key. Returns None if it doesn't exist."""
    v = self._cache.get(key)
    if v and (v.expiry == 0 or time.time() < v.expiry):
      return v.value
    return None

  def Set(self, key, value, ttl=None, expiry=None):
    """Set the key/value pair with the specified expiry.

    The ttl and expiry are mutually exclusive. If you use neither, the cache
    level ttl will be used. A ttl or expiry of 0 means don't expire.

    Args:
      key: The cache key.
      value: The value to store in the cache.  Must be picklable.
      ttl: How long to keep this value, relative time in seconds.
      expiry: When to expiry this value, absolute timestamp in seconds.
    Returns:
      True if it was stored, False otherwise.
    Raises:
      ValueError: ttl and expiry are mutually exclusive. ttl should be < 1 year.
    """
    if ttl and expiry:
      raise ValueError('Received ttl and expiry. Please only use one.')
    if ttl > 365*86400:
      raise ValueError('ttl > 1 year is likely intended as an expiry, not ttl.')
    now = time.time()
    if expiry is None:
      if ttl is None:
        ttl = self._ttl
      expiry = ttl + now if ttl > 0 else 0
    if expiry == 0 or now < expiry:
      self._cache[key] = _CacheEntry(value, expiry)
      self._Sweep()
      return True
    return False

  def Delete(self, key):
    """Delete the entry referenced by key, if it exists."""
    self._cache.pop(key, None)

  def Add(self, key, value, expiry):  # pylint:disable=unused-argument
    # pylint: disable=g-doc-args
    """Would atomically add an element to the cache if it was implemented.

    Implementing this correctly without locks seems hard or even impossible.
    It would be easy to use self._cache.setdefault, but that ignores the case of
    an expired entry. Both threads might try to remove the old entry but one can
    succeed to remove the old and add the new just in time for the second thread
    to remove the new and also think it successfully added a new entry. You
    therefore need to hold the sweep_lock to do this correctly. You could argue
    that this is correct and the value was just expired early, but that makes it
    less useful as a lock, which is the usual use of Add. Arguably Set should
    also use the lock, but that seems less important and then adds extra
    overhead. I'm leaving it NotImplemented until it's needed to avoid the
    complexity of locks. Given that this is local anyway it's probably better
    to just use a real python threading.Lock.
    """
    raise NotImplementedError
