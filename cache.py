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

"""Routines for getting and storing data in memcache.

To help us avoid inadvertent collisions between cache keys, these routines all
support compound keys: you supply a list of strings as the key, which lets you
hierarchically partition the key space (just like a path in a filesystem).

The default cache lifetime is intended to be long enough to significantly
reduce load during periods of high traffic (100+ QPS), and short enough to
avoid major inconsistencies in user-facing behaviour.
"""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

from google.appengine.api import memcache

DEFAULT_TTL_SECONDS = 10  # default lifetime for entries in memcache


def ToCacheKey(path):
  """Convert a list of items to a string suitable as a cache key.

  Args:
    path: A list; elements can be strings, objects with a __name__, or anything
    that can be converted to a string with str().

  Returns:
    A string serialization of the key.  The items of the list are joined with
    commas; commas and backslashes within items are escaped with backslashes.
    For non-string items, the item's __name__ is used if present, or the item
    is converted to a string with str().
  """
  return ','.join(str(getattr(item, '__name__', item) or '')
                  .replace('\\', '\\\\').replace(',', '\\,')
                  for item in path)


def Get(path, make_value=None, ttl_seconds=DEFAULT_TTL_SECONDS):
  """Gets a value from memcache, using make_value() if needed to fill the cache.

  Args:
    path: A list of items (see ToCacheKey).
    make_value: An optional function to generate the value if it's not cached.
    ttl_seconds: An integer number of seconds to keep the value in the cache.

  Returns:
    The cached item, or the freshly made value if it wasn't already cached.
  """
  key = ToCacheKey(path)
  value = memcache.get(key)
  if make_value and not value:
    value = make_value()
    memcache.set(key, value, time=ttl_seconds)
  return value


def Set(path, value, ttl_seconds=DEFAULT_TTL_SECONDS):
  """Sets an entry in memcache.

  Args:
    path: A list of items (see ToCacheKey).
    value: The value to store in the cache.
    ttl_seconds: An integer number of seconds to keep the value in the cache.
  """
  memcache.set(ToCacheKey(path), value, time=ttl_seconds)


def Add(path, value, ttl_seconds=DEFAULT_TTL_SECONDS):
  """Atomically adds an entry to memcache only if it does not already exist.

  Args:
    path: A list of items (see ToCacheKey).
    value: The value to store in the cache.
    ttl_seconds: An integer number of seconds to keep the value in the cache.

  Returns:
    True if no entry for this path previously existed.
  """
  return memcache.add(ToCacheKey(path), value, time=ttl_seconds)


def Delete(path):
  """Deletes an entry from memcache.

  Args:
    path: A list of items (see ToCacheKey).
  """
  memcache.delete(ToCacheKey(path))
