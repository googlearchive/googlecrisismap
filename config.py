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

import json

import cache

from google.appengine.ext import db


class Config(db.Model):
  """A configuration setting.

  Each configuration setting has a string key and a value that can be anything
  representable in JSON (string, number, boolean, None, or arbitrarily nested
  lists or dictionaries thereof).  The value is stored internally using JSON.
  """
  value_json = db.TextProperty()  # the value, serialized to JSON


def Get(key):
  """Fetches the configuration value for a given key.

  Args:
    key: A string, the name of the configuration item to get.

  Returns:
    The configuration value, or None if not found.
  """

  def Fetcher():
    config = Config.get_by_key_name(key)
    if config:
      return json.loads(config.value_json)
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
