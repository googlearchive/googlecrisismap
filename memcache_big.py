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

"""Wrap memcache to support caching things bigger than 1mb.

This module wraps appengine memcache get/set/add/delete methods to do chunking.
It pickles the value, and if it's longer than _CHUNK_SIZE_BYTES splits it into
chunks of that size. It then sets the first key with a _CacheEntry header and
the rest with keys that indicate their position. The remaining keys have an
additional random component so that it is very very unlikely that you'll replace
the previous entry and run into a race condition where you get half of the old
value and half of the new value.
"""



import logging
import pickle
import random

from google.appengine.api import memcache


_CHUNK_SIZE_BYTES = 980 * 1000  # 20,000 below memcache limit, needed for header
_MAX_VALUE_SIZE = 16 * 1000 * 1000  # If you're above this, use something else.
_WARN_VALUE_SIZE = _CHUNK_SIZE_BYTES  # Using multiple chunks should be rare
_NAMESPACE = 'mcb'


class _CacheEntry(object):
  """Stored for cache entries larger than 1mb, used to find remaining chunks."""

  def __init__(self, value, num_chunks, rand):
    self.value = value
    self.num_chunks = num_chunks
    self.rand = rand

  def __repr__(self):
    return '_CacheEntry(%s, %s, %s)' % (self.value, self.num_chunks, self.rand)


def _key(key, i, rand):
  return key if i == 0 else '%s-%s:%s' % (i, rand, key)


def _keys(key, num, rand):
  return [_key(key, i, rand) for i in range(0, num)]


def get(key):
  """Like memcache.get but supports values > 1mb."""
  value = memcache.get(key, namespace=_NAMESPACE)
  if not value:
    return None
  if isinstance(value, _CacheEntry):  # more chunks to follow
    remain_keys = _keys(key, value.num_chunks, value.rand)
    remain_keys.pop(0)  # We already have the first part so don't need it again.
    remain = memcache.get_multi(remain_keys, namespace=_NAMESPACE)
    if 1 + len(remain) < value.num_chunks:
      # One or more of the remaining ones missed, treat as a full cache miss.
      return None
    value = ''.join([value.value] + [remain[k] for k in remain_keys])
  try:
    return pickle.loads(value)
  except Exception:  # pylint:disable=broad-except
    logging.exception('Failed to unpickle value for key: %s, pickled len: %s',
                      key, len(value))
    return None


def delete(key):
  """Like memcache.delete but supports values > 1mb."""
  # Only delete the first. The rest will get cleaned up implicitly
  return memcache.delete(key, namespace=_NAMESPACE)


def set(key, value, time=0):  # pylint:disable=redefined-builtin
  """Like memcache.set but supports values > 1mb."""
  chunks = _chunks(key, value)
  not_set = memcache.set_multi(chunks, time=time, namespace=_NAMESPACE)
  return not not_set  # ie True if the list is empty.


def add(key, value, time=0):
  """Like memcache.add but supports values > 1mb."""
  chunks = _chunks(key, value)
  not_added = memcache.add_multi(chunks, time=time, namespace=_NAMESPACE)
  return key not in not_added


def flush_all():
  """Deletes everything in memcache."""
  return memcache.flush_all()


def _chunks(key, value):
  """Return a k,v pairing of chunks."""
  value = pickle.dumps(value)
  if len(value) < _CHUNK_SIZE_BYTES:
    return {key: value}

  if len(value) > _MAX_VALUE_SIZE:
    raise ValueError('Value may not be more than %d bytes in length; '
                     'received %d bytes for key: %s' %
                     (_MAX_VALUE_SIZE, len(value), key))
  if len(value) > _WARN_VALUE_SIZE:
    logging.warn('Huge value cached, consider splitting it or storing it '
                 'elsewhere; received %d bytes for key: %s',
                 len(value), key)

  rand = random.getrandbits(30)
  chunks = [value[i:i + _CHUNK_SIZE_BYTES]
            for i in xrange(0, len(value), _CHUNK_SIZE_BYTES)]
  chunks[0] = _CacheEntry(chunks[0], len(chunks), rand)
  keys = _keys(key, len(chunks), rand)
  return dict(zip(keys, chunks))
