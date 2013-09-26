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


class Struct(object):
  """A simple bag of attributes."""

  def __init__(self, **kwargs):
    self.__dict__.update(kwargs)

  def __iter__(self):
    return iter(self.__dict__)


def GetUserDomain(user):
  """Extracts the domain part of a User object's email address.

  Args:
    user: A google.appengine.api.users.User object.

  Returns:
    A string, the part after the '@' in the user's e-mail address, or None.
  """
  return user and '@' in user.email() and user.email().split('@')[-1]
