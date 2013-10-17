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

"""Storage for configuration settings."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import binascii
import json
import os

import cache

from google.appengine.ext import db


class Config(db.Model):
  """A configuration setting.

  Each configuration setting has a string key and a value that can be anything
  representable in JSON (string, number, boolean, None, or arbitrarily nested
  lists or dictionaries thereof).  The value is stored internally using JSON.
  """
  value_json = db.TextProperty()  # the value, serialized to JSON


def Get(key, default=None):
  """Fetches the configuration value for a given key.

  Args:
    key: A string, the name of the configuration item to get.
    default: An optional default value to return.

  Returns:
    The configuration value, or the specified default value if not found.
  """

  def Fetcher():
    config = Config.get_by_key_name(key)
    if config:
      return json.loads(config.value_json)
    return default
  return cache.Get([Config, key], Fetcher)


def GetAll():
  """Returns a dictionary containing all the configuration values."""
  results = {}
  for config in Config.all():
    value = json.loads(config.value_json)
    cache.Set([Config, config.key().name], value)
    results[config.key().name()] = value
  return results


def Set(key, value):
  """Sets a configuration value.

  Args:
    key: A string, the name of the configuration item to get.
    value: Any Python data structure that can be serialized to JSON.
  """
  config = Config(key_name=key, value_json=json.dumps(value))
  config.put()
  cache.Delete([Config, key])


def Delete(key):
  """Deletes a configuration value."""
  Config(key_name=key).delete()
  cache.Delete([Config, key])


def GetGeneratedKey(key):
  """Gets a string of 32 hex digits that is randomly generated on first use.

  The first time this is called, it generates a random string and stores it in
  a configuration item with the given key; thereafter, the stored string is
  returned.  The result is suitable for use as a cryptographic key (e.g.
  HMAC key or encryption key): it is generated at runtime, doesn't exist in
  the source code, and is unique to the application instance.

  Args:
    key: A string, the name of the configuration item to use.

  Returns:
    A string of 32 hex digits.
  """

  @db.transactional
  def PutGeneratedKey():
    if not Get(key):
      Set(key, binascii.b2a_hex(os.urandom(16)))

  value = Get(key)
  while not value:
    PutGeneratedKey()
    value = Get(key)
    # The retry here handles the rare case in which memcache.get returns None
    # even after memcache.add.  Strange, but we've seen it happen occasionally.
    # TODO(kpy): Consider factoring out this retry loop if we need it elsewhere.
  return str(value)  # avoid Unicode; it's just hex digits
