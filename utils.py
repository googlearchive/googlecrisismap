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

from google.appengine.api import users


class Struct(object):
  """A simple bag of attributes."""

  def __init__(self, **kwargs):
    self.__dict__.update(kwargs)

  def __iter__(self):
    return iter(self.__dict__)


def NormalizeEmail(email):
  """Normalizes an e-mail address for storage or comparison."""
  username, domain = email.split('@')
  return username.lower().replace('.', '') + '@' + domain.lower()


def GetUserDomain(user):
  """Gets the e-mail domain of the given user."""
  return user and user.email().split('@')[-1]


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
