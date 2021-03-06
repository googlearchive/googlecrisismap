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

import base64
import calendar
import datetime
from HTMLParser import HTMLParseError
from HTMLParser import HTMLParser
import os
import random
import re
import time


# Regions in the world that use miles (as opposed to kilometers) for measuring
# distance. List is compiled based on http://en.wikipedia.org/wiki/Mile
COUNTRIES_USING_MILES = [
    'AS',  # American Samoa
    'BS',  # Bahamas
    'BZ',  # Belize
    'DM',  # Dominica
    'FK',  # Falkland Islands
    'GD',  # Grenada
    'GU',  # Guam
    'KN',  # St. Kitts & Nevis
    'KY',  # Cayman Islands
    'LC',  # St. Lucia
    'LR',  # Liberia
    'MM',  # Myanmar
    'MP',  # The N. Mariana Islands
    'SH',  # St. Helena
    'TC',  # the Turks & Caicos Islands
    'UK',  # United Kingdom
    'US',  # United States
    'VC',  # St. Vincent & The Grenadines
    'VG',  # British Virgin Islands,
    'VI',  # the U.S. Virgin Islands
    'WS',  # Samoa
]


def GetDistanceUnitsForCountry(country_code):
  """Returns distance unit used by a given region.

  Args:
    country_code: two letter country code in all capitals (ISO standard)
  Returns:
     'mi' for regions using miles, 'km' for all others
  """
  return 'mi' if country_code in COUNTRIES_USING_MILES else 'km'


def IsDevelopmentServer():
  """Returns True if the app is running in development."""
  server = os.environ.get('SERVER_SOFTWARE', '')
  return 'Development' in server or 'testutil' in server


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

    def GetValue(name):
      # Work around a bug in ndb: repeated properties sometimes return lists
      # of _BaseValue objects; copying the list fixes up these objects.  See:
      # https://code.google.com/p/appengine-ndb-experiment/issues/detail?id=208
      value = getattr(model, name, None)
      if type(value) is list:
        value = value[:]
      return value

    # ._properties is actually a public API; it's just named with "_" in order
    # to avoid collision with property names (see http://goo.gl/xAcU4).
    # We pass None as 3rd arg to getattr to tolerate entities in the datastore
    # with extra properties that aren't defined in the Python model class.
    if model:
      props = model._properties  # pylint: disable=protected-access
      return cls(id=model.key.id(), key=model.key,
                 **{name: GetValue(name) for name in props})


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

  def __init__(self, tag_sub=None, tag_whitelist=None):
    HTMLParser.__init__(self)
    self.reset()
    self.fed = []
    self.tag_sub = tag_sub or ''
    self.tag_whitelist = tag_whitelist or []

  def handle_starttag(self, tag, attrs):
    if tag in self.tag_whitelist:
      # Preserve opening tags that are in the whitelist, drop attrs
      self.fed.append('<%s>' % tag)

  def handle_endtag(self, tag):
    if tag in self.tag_whitelist:
      # Preserve closing tags that are in the whitelist
      self.fed.append('</%s>' % tag)

  def handle_data(self, d):
    self.fed.append(d)

  def handle_entityref(self, name):
    self.fed.append('&%s;' % name)

  def handle_charref(self, name):
    self.fed.append('&#%s;' % name)

  def GetData(self):
    return self.tag_sub.join(self.fed)


def StripHtmlTags(value, tag_sub=None, tag_whitelist=None):
  """Returns the given HTML with tags stripped (minus those in tag_whitelist).

  Example usage:
  StripHtmlTags('<b onclick="xss()">Shelter</b> 120 E Street<br>' +
                    '<script>SomeHack</script>',
                ['b', 'br'], ' ')
  returns
  '<b>Shelter</b> 120 E Street<br> SomeHack'

  Note that all attributes on whitelisted tags are removed, even though tags
  themselves are returned in the result string.

  Args:
    value: String to process
    tag_sub: String to replace tags with (by default uses an empty string)
    tag_whitelist: A list of strings that specify which html tags should not
        be stripped (e.g. ['b', 'u', 'br'])

  Returns:
    Original string with all html tags stripped besides those in tag_whitelist
  """
  s = HtmlStripper(tag_sub, tag_whitelist)
  try:
    s.feed(value)
    s.close()
  except HTMLParseError:
    return value
  else:
    return s.GetData()


def UtcToTimestamp(dt):
  """Converts a UTC datetime object to a scalar POSIX timestamp."""
  return calendar.timegm(dt.utctimetuple()) + dt.microsecond / 1e6


def TimestampToUtc(timestamp):
  """Converts a scalar POSIX timestamp to a UTC datetime object."""
  return datetime.datetime.utcfromtimestamp(timestamp)


def MakeRandomId():
  """Generates a random identifier made of 12 URL-safe characters."""
  # urlsafe_b64encode encodes 12 random bytes as exactly 16 characters,
  # which can include digits, letters, hyphens, and underscores.  Because
  # the length is a multiple of 4, it won't have trailing "=" signs.
  return base64.urlsafe_b64encode(
      ''.join(chr(random.randrange(256)) for i in xrange(12)))


def ShortAge(dt):
  """Returns a short string describing a relative time in the past.

  Args:
    dt: A datetime.
  Returns:
    A short string like "5d" (5 days) or "32m" (32 minutes).
  """
  # TODO(kpy): This is English-specific and needs localization.
  seconds = time.time() - UtcToTimestamp(dt)
  minutes = int(seconds / 60 + 0.5)
  hours = int(seconds / 3600 + 0.5)
  days = int(seconds / 86400 + 0.5)
  if seconds < 60:
    return 'just now'
  if minutes < 100:
    return '%dm ago' % minutes
  if hours < 48:
    return '%dh ago' % hours
  return '%dd ago' % days


def ReadStaticFile(filename):
  """Gets the contents of a file from either the app or static directory."""
  directory = os.path.dirname(__file__)
  try:
    return open(os.path.join(directory, filename)).read()
  except IOError:
    try:
      return open(os.path.join(directory, 'static', filename)).read()
    except IOError:
      return open(os.path.join(directory, 'resource', filename)).read()
