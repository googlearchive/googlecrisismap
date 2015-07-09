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
# - consider tracking size of local cache.
# TODO(kpy):
# - define a simpler GetOnlyCache() that has only a Get() method and no ULL
# - define a CounterCache() that supports Incr() and Decr()
# TODO(user):
# - Use a lock or condition variable to avoid multiple threads within one
#   instance polling memcache for the same key when no value exists in memcache.
__author__ = 'kpy@google.com (Ka-Ping Yee)'

import copy
import json
import logging
import random
import time

import local_cache
import memcache_big as memcache


# Value to add to cache keys to prevent collisions if/when the cache entry type
# changes. Otherwise, modifying the cache entry may break an app that uses an
# older version of this module.
CACHE_ENTRY_VERSION = 'v3'

LOCAL_CACHE = local_cache.LocalCache(0)  # key => CacheEntry

# Sleep time between failing to grab a make_value lock and checking key
# existence in the cache / retrying to get a lock again.
RETRY_INTERVAL_SEC = 0.05


class CacheEntry(object):
  """Entry to be stored in local cache and memcache.

  Return a CacheEntry from your make_value function to set a specific ttl.
  """

  def __init__(self, value, ttl, ttc=None, creation_time=None):
    """Cache Entry.

    Args:
      value: The value. Will be deep-copied by local_cache.
      ttl: How long this value is valid. After this time has passed this value
          MUST be ignored and regenerated.
      ttc: How long before we should check for a newer version from the origin.
          It increments by lock_timeout when a value is being refreshed.
      creation_time: Timestamp of value creation time, defaults to Now.
    """
    self._value = value
    self._creation_time = creation_time or time.time()
    self._ttl = ttl
    self.ttc = ttc  # Use the setter for value validation
    # IMPORTANT: If you change how this class functions, you must also update
    # CACHE_ENTRY_VERSION.

  @property
  def value(self):
    return self._value

  @property
  def ttl(self):
    return self._ttl

  @property
  def hard_expiry(self):
    return self._creation_time + self._ttl

  @property
  def refresh_time(self):
    return self._creation_time + self.ttc

  @refresh_time.setter
  def refresh_time(self, refresh):
    self.ttc = refresh - self._creation_time

  @property
  def ttc(self):
    return self._ttc or self._ttl

  @ttc.setter
  def ttc(self, t):
    self._ttc = min(t, self._ttl)

  def __repr__(self):
    return (
        'CacheEntry(%s, ttl=%s, ttc=%s, creation_time=%s)' %
        (self.value, self.ttl, self.ttc, self._creation_time))


def Reset():
  """Reset the state of this module.  For use in tests only."""
  LOCAL_CACHE.Clear()
  memcache.flush_all()


class Cache(object):
  """A two-level cache (local RAM and memcache).

  To use this class, first create a named instance (clients that use the
  same name will access the same shared cache):

      >>> c = cache.Cache('foo', 60)  # 60-second TTL
      >>> c = cache.Cache('foo', 60, 30, get_timeout=5)

  In the second case, key values will be stored in a local cache (timeX) and
  will serve from there till timeX + 30s, after which memcache value will be
  fetched and put into a local cache to expire after 30s (at timeX + 60s).
  Say, after timeX + 51s (51s, b/c ttc is ttl * 0.85) some other
  local cache will try to update its value using memcache. We'll issue a
  make_value call at that time. If that succeeds, we update memcache value,
  otherwise we continue serving a stale value until timeX + 60s. From then on,
  we'll retry make_value a few times until it succeeds or we exceed the
  get_timeout. In case of exceeding the timeout, 'Get' returns None.

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

  def __init__(self, name, ttl, ull=None, get_timeout=None, lock_timeout=1.1):
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
      get_timeout: Maximum time (in seconds) that the caller will wait to
          either pull a value from cache or start generating a value itself.
          There will be multiple attempts to grab the make_value lock
          during this time.
      lock_timeout: Time after which a make_value lock will expire. This is used
          to rate limit make_value invocations: after this timeout, another
          thread will be permitted to acquire a lock and invoke make_value
          again. Pass 0 to disable rate limiting and therefore all thundering
          herd protection. Values below 1 don't make sense because memcache
          rounds its ttls down to the whole second, meaning the lock won't catch
          for part of the second. This is ok though because the lock is per key
          and anything that needs to be cached for less than a second probably
          isn't worth caching through memcache.

    Raises:
      ValueError: ull > ttl is not allowed.
    """
    if ull > ttl:
      raise ValueError("Setting ull > ttl doesn't make sense")
    if lock_timeout < 0:
      raise ValueError("Value for lock_timeout can't be negative")
    if 0 < lock_timeout < 1:
      # memcache's ttls round down to the whole second, so if you have a 0.5s,
      # lock_timeout, and locks acquired in the first half of the second would
      # expire immediately and be worthless. A lock time of 1 or just over 1 has
      # a race condition between acquiring the lock and updating the
      # refresh_time where two threads could acquire the lock within a few ms of
      # each other on each side of the second boundary. To mitigate this, the
      # default lock_timeout is 1.1s.
      raise ValueError('Value for lock_timeout must be 0 or >= 1')
    if get_timeout and get_timeout <= 0:
      raise ValueError('Value for get_timeout should be positive')

    self.name = name
    self.ttl = ttl
    self.ull = ull
    self.lock_timeout = lock_timeout
    self.get_timeout = get_timeout or 10

  def KeyToJson(self, key):
    """Converts a cache key to a canonical fully qualified string."""
    return json.dumps([CACHE_ENTRY_VERSION, self.name, key], sort_keys=True)

  def Get(self, key, make_value=None):
    """Gets a key's value, using make_value() if it's not in the cache.

    If you don't supply a make_value function and do use a lock_timeout, you
    will get periodic premature cache misses where it's your responability to
    generate a new value and Set the value yourself. If you don't Set the value
    it will expire and other threads may have to wait or even serialize while
    polling memcache to generate the value.

    Args:
      key: The cache key.  Can be any JSON-serializable value.
      make_value: An optional function to produce the value if it's not
        found in the cache.  The value must be picklable. Alternatively you can
        return a CacheEntry with the value and ttl already set if you want a
        non-default ttl for just this value.
    Returns:
      The cached value, or the newly made value if it wasn't already
      cached, or None if make_value was not provided.
    Raises:
      RuntimeError: If there is a timeout on retries to make_value
    """
    key_json = self.KeyToJson(key)

    deadline = time.time() + self.get_timeout

    while True:
      now = time.time()

      # Look for the key in the local cache (handles its own expiry)
      entry = LOCAL_CACHE.Get(key_json)
      if entry:
        return entry.value

      # Key not found in the local cache, so look for the key in memcache
      entry = memcache.get(key_json)
      if entry and now < entry.refresh_time:
        # Found in memcache and still valid, save it locally
        self._SetLocalCache(key_json, entry)
        return entry.value

      # Entity either not in memcache or ready to be refreshed.
      if self._AcquireMakeLock(key_json, entry):
        # I got the lock (or none needed)!
        if make_value:
          # Generate and save a new value, returning the old value on failure.
          return self._Make(key, make_value, entry)
        else:
          # Return a cache miss so the caller can generate and set a value,
          # letting the other threads continue using the old value or waiting
          # for this one to generate the value.
          return None
      elif entry and now < entry.hard_expiry:
        # I'm not the chosen thread to refresh the value, but still have an old
        # value to use. Save it locally. It'll get refreshed/replaced soon, but
        # better to use a bit stale version than stampede on memcache.
        self._SetLocalCache(key_json, entry)
        return entry.value
      elif time.time() + RETRY_INTERVAL_SEC < deadline:
        # I don't have a valid entry to use, nor permission to generate one,
        # so spin and wait for one to arrive.
        time.sleep(RETRY_INTERVAL_SEC)
      else:
        raise RuntimeError('Timed out waiting for a value from cache or '
                           'the lock to generate my own: %s: %s' %
                           (self.name, key))

  def _Make(self, key, make_value, old_entry):
    """Try to generate a new value with make_value and set it in cache.

    This assumes you already have the lock.

    Args:
      key: Key that we're updating a value for
      make_value: A function to produce the value.
      old_entry: The current entry in memcache. Return this value if make_value
        fails and it's still valid.
    Returns:
      The newly generated value or an old version if it's still valid and there
      was an error.
    """
    try:
      result = make_value()
      self.Set(key, result)
      return result.value if isinstance(result, CacheEntry) else result
    except Exception:  # pylint:disable=broad-except
      if old_entry and time.time() < old_entry.hard_expiry:
        # There is a stale value we can return, so just log a warning
        logging.exception(
            'Error on make_value for key %s in %s. '
            'Falling back to the old value and ignoring the error.',
            self.KeyToJson(key), self.name)
        return old_entry.value
      else:
        logging.exception(
            'Error on make_value for key %s in %s. '
            'No stale data to fallback to, so re-raising.',
            self.KeyToJson(key), self.name)
        raise

  def _AcquireMakeLock(self, key_json, old_entry):
    """Tries to acquire a lock for make_value for a given key.

    Makes one attempt to acquire a lock for make_value of a given key. A lock
    in this case is a memcache entry with a lock name being a composite of
    lock identifier and the key. memcache.add guarantees that it
    succeeds only if the value is not currently set, so this works as a lock.

    Also push the refresh_time forward by the lock_timeout so other threads
    don't try so hard to acquire the lock.

    Args:
      key_json: key that we're acquiring a make_value lock on.
      old_entry: The old entry on which to update refresh_time.
    Returns:
      True if the lock was successfully acquired, false otherwise.
    """
    if self.lock_timeout == 0:
      # Skip acquiring a lock, none needed
      return True

    now = time.time()
    lock_key_json = 'cache.make_lock' + key_json
    lock_timeout = now + self.lock_timeout
    acquired = memcache.add(lock_key_json, lock_timeout, time=self.lock_timeout)

    if acquired and old_entry:
      # Push the refresh time forward so other threads don't try to acquire the
      # lock until it's expired.
      old_entry.refresh_time = lock_timeout
      self._SetLocalCache(key_json, old_entry)
      memcache.set(key_json, old_entry, time=old_entry.hard_expiry)

    return acquired

  def Set(self, key, value, ttl=None):
    """Sets a key's value in the cache.

    Args:
      key: The cache key.  Can be any JSON-serializable value.
      value: The value to store in the cache.  Must be picklable.
      ttl: How long this value should last. None means use the cache default.
    Returns:
      True if this key was set successfully.
    """
    return self._Set(memcache.set, key, value, ttl)

  def Add(self, key, value, ttl=None):
    """Atomically sets a key's value only if it's not already set.

    To ensure atomicity, this method always queries memcache directly.

    Args:
      key: The cache key.  Can be any JSON-serializable value.
      value: The value to store in the cache.  Must be picklable.
      ttl: How long this value should last. None means use the cache default.
    Returns:
      True if this key was not previously set and was updated.
    """
    return self._Set(memcache.add, key, value, ttl)

  def _Set(self, memcache_func, key, value, ttl):
    """Set/Add a key's value in the cache.

    Args:
      memcache_func: Either memcache.set or memcache.add
      key: The cache key.  Can be any JSON-serializable value.
      value: The value to store in the cache.  Must be picklable.
      ttl: How long this value should last. None means use the cache default.
    Returns:
      True if this key was set successfully.
    """
    key_json = self.KeyToJson(key)

    if isinstance(value, CacheEntry):
      entry = value
    else:
      # IMPORTANT: If you change the cache entry or how it functions, you must
      # also update CACHE_ENTRY_VERSION.
      entry = CacheEntry(value, ttl or self.ttl)

    # Pick a value for ttc less than tll, so that there is enough time
    # to attempt and rewarm the entities with make_value.
    if self.lock_timeout > 0 and entry._ttc is None:  # pylint:disable=protected-access
      entry.ttc = 0.8 * entry.ttl
    # else leave the default of ttc = ttl

    if memcache_func(key_json, entry, time=entry.hard_expiry):
      self._SetLocalCache(key_json, entry)
      return True
    if memcache_func == memcache.set:  # Don't log add as failure is common
      logging.warn('Failed to set a value in memcache: %s', key_json)
    return False

  def Delete(self, key):
    """Deletes a key from the cache.

    Args:
      key: The cache key.  Can be any JSON-serializable value.
    """
    key_json = self.KeyToJson(key)
    memcache.delete(key_json)
    LOCAL_CACHE.Delete(key_json)

  def _SetLocalCache(self, key_json, entry):
    """Set an item in the local cache."""
    if self.ull == 0:
      return

    ull = entry.ttl * 0.8 if self.ull is None else self.ull

    # Add some jitter to the ULL, so that different instances don't try
    # to update their local cache entries at the same time
    ull = random.uniform(0.7, 1.0) * ull

    expiry = time.time() + ull

    # To prevent a thundering herd on memcache at refresh_time, add some jitter
    # for the local expiry as you approach the refresh_time. If it's beyond
    # refresh_time, potentially check again early. Never exceed the hard expiry.
    expiry = random.uniform(
        min(expiry, entry.refresh_time),
        min(expiry, entry.hard_expiry))

    LOCAL_CACHE.Set(key_json, entry, expiry=expiry)
