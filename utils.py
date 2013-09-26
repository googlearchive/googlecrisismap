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

"""Utilities used throughout crisismap."""

from HTMLParser import HTMLParseError
from HTMLParser import HTMLParser
import re
import time


class Struct(object):
  """A simple bag of attributes."""

  def __init__(self, **kwargs):
    self.__dict__.update(kwargs)

  def __iter__(self):
    return iter(self.__dict__)

  def __setattr__(self, name, value):
    raise TypeError('%r has read-only attributes' % self)

  @classmethod
  def FromModel(cls, model):
    """Populates a new Struct from an ndb.Model (doesn't take a db.Model)."""
    # ._properties is actually a public API; it's just named with "_" in order
    # to avoid collision with property names (see http://goo.gl/xAcU4).
    properties = model._properties  # pylint: disable=protected-access
    return cls(id=model.key.id(),
               **dict((name, getattr(model, name)) for name in properties))


def StructFromModel(model):
  """Copies the properties of the given db.Model into a Struct.

    Note that we use Property.get_value_for_datastore to prevent fetching
    of referenced objects into the Struct.  The other effect of using
    get_value_for_datastore is that all date/time methods return
    datetime.datetime values.

  Args:
    model: A db.Model entity, or None.

  Returns:
    A Struct containing the properties of the given db.Model, with additional
    'key', 'name', and 'id' properties for the entity's key(), key().name(),
    and key().id().  Returns None if 'model' is None.
  """
  if model:
    return Struct(key=model.key(), id=model.key().id(), name=model.key().name(),
                  **dict((name, prop.get_value_for_datastore(model))
                         for (name, prop) in model.properties().iteritems()))


def ResultIterator(query):
  """Returns a generator that yields Struct objects."""
  for result in query:
    yield StructFromModel(result)


def SetAndTest(set_func, test_func, sleep_delta=0.05, num_tries=20):
  """Calls set_func, then waits until test_func passes before returning.

  Sometimes we need to be able to see changes to the datastore immediately
  and are willing to accept a small latency for that.  This function calls
  set_func (which presumably makes a small change to the datastore), then
  calls test_func in a while not test_func(): sleep() loop until either
  test_func passes or the maximum number of tries has been reached.

  Args:
    set_func: a function that sets some state in an AppEngine Entity
    test_func: a function that returns true when the change made by set_func
      is now visible
    sleep_delta: (defaults to 0.05) the number of seconds to sleep between
      calls to test_func, or None to not sleep.
    num_tries: (defaults to 20) the number of times to try test_func before
      giving up

  Returns:
    True if test_func eventually returned true; False otherwise.
  """
  set_func()
  for _ in range(num_tries):
    if test_func():
      return True
    if sleep_delta:
      time.sleep(sleep_delta)
  return False


def IsValidEmail(email):
  return re.match(r'^[^@]+@([\w-]+\.)+[\w-]+$', email)


class HtmlStripper(HTMLParser):
  """Helper class for StripHtmlTags."""

  def __init__(self):
    HTMLParser.__init__(self)
    self.reset()
    self.fed = []

  def handle_data(self, d):
    self.fed.append(d)

  def handle_entityref(self, name):
    self.fed.append('&%s;' % name)

  def handle_charref(self, name):
    self.fed.append('&#%s;' % name)

  def GetData(self):
    return ''.join(self.fed)


def StripHtmlTags(value):
  """Returns the given HTML with all tags stripped."""
  s = HtmlStripper()
  try:
    s.feed(value)
    s.close()
  except HTMLParseError:
    return value
  else:
    return s.GetData()
