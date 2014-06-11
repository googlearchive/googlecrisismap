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


# Config settings are written offline, so users never expect to see immediate
# effects.  The 300-ms ULL is intended to beat the time it takes to manually
# load an affected a page after changing a config setting in the console.
CACHE = cache.Cache('config', 600, 0.3)


class Config(db.Model):
  """A configuration setting.

  Each configuration setting has a string key and a value that can be anything
  representable in JSON (string, number, boolean, None, or arbitrarily nested
  lists or dictionaries thereof).  The value is stored internally using JSON.
  """
  value_json = db.TextProperty()  # the value, serialized to JSON


def Get(key, default=None, stale_ok=True):
  """Fetches the configuration value for a given key.

  Args:
    key: A string, the name of the configuration item to get.
    default: An optional default value to return.
    stale_ok: Optional; if False, get the latest value from the datastore.
        Default is True: the returned value may be up to 1 second stale.
  Returns:
    The configuration value, or the specified default value if not found.
  """

  def GetFromDatastore():
    config = Config.get_by_key_name(key)
    return config and json.loads(config.value_json)
  value = CACHE.Get(key, GetFromDatastore) if stale_ok else GetFromDatastore()
  if value is None:
    return default
  return value


def GetAll():
  """Returns a dictionary containing all the configuration values."""
  results = {c.key().name(): json.loads(c.value_json) for c in Config.all()}
  for key, value in results.items():
    CACHE.Set(key, value)
  return results


def Set(key, value):
  """Sets a configuration value.

  Args:
    key: A string, the name of the configuration item to get.
    value: Any Python data structure that can be serialized to JSON.
  """
  Config(key_name=key, value_json=json.dumps(value)).put()
  CACHE.Set(key, value)


def Delete(key):
  """Deletes a configuration value."""
  Config(key_name=key).delete()
  CACHE.Delete(key)


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
    """Transactionally ensures the key is written exactly once."""
    value = Get(key, stale_ok=False)
    if not value:
      value = binascii.b2a_hex(os.urandom(16))
      Set(key, value)
    return value

  value = Get(key)
  if not value:
    value = PutGeneratedKey()
  return str(value)  # avoid Unicode; it's just hex digits
