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

import time

from google.appengine.api import users


class Struct(object):
  """A simple bag of attributes."""

  def __init__(self, **kwargs):
    self.__dict__.update(kwargs)

  def __iter__(self):
    return iter(self.__dict__)


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
    return Struct(
        id=model.key().id(),
        name=model.key().name(),
        key=model.key(),
        **dict((name, prop.get_value_for_datastore(model))
               for (name, prop) in model.properties().iteritems()))


def ResultIterator(query):
  """Returns a generator that yields Struct objects."""
  for result in query:
    yield StructFromModel(result)


def NormalizeEmail(email):
  """Normalizes an e-mail address for storage or comparison."""
  username, domain = email.split('@')
  return username.lower().replace('.', '') + '@' + domain.lower()


def GetUserDomain(user):
  """Gets the e-mail domain of the given user."""
  return user and user.email().split('@')[-1]


def GetCurrentUserId():
  """Gets the user's numeric ID, or None if no user is signed in."""
  user = users.get_current_user()
  return user and user.user_id()


def GetCurrentUserEmail():
  """Gets the user's normalized address, or '' if no user is signed in."""
  user = users.get_current_user()
  return user and NormalizeEmail(user.email()) or ''


def GetCurrentUserDomain():
  """Gets the domain part (after '@') of the current user's e-mail address.

  Returns:
    The user's e-mail domain, or '' if no user is signed in.
  """
  return GetCurrentUserEmail().split('@')[-1]


def GetCurrentUser():
  """Gets the current user's User object.  Use this, not users.get_current_user.

  Returns:
    A google.appengine.api.users.User object with a normalized e-mail address,
    or None if no user is signed in.  Always use this function instead of
    users.get_current_user, which can return a User object whose e-mail address
    contains capital letters or periods, and thus won't compare consistently.
  """
  email = GetCurrentUserEmail()
  return email and users.User(email) or None


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
