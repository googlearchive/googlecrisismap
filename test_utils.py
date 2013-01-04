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

"""Utilites common to multiple tests."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import datetime
import os
import unittest
import urlparse

import webob

import base_handler
import mox

from google.appengine.api import users
from google.appengine.ext import testbed
import webapp2


def SetupRequest(url, post_data=None):
  """Sets up a webapp2.Request object for testing."""
  handler = base_handler.BaseHandler()
  return SetupHandler(url, handler, post_data).request


def SetUser(email, user_id=None, is_admin=False):
  """Sets the current user for testing."""
  os.environ['USER_EMAIL'] = email
  os.environ['USER_ID'] = user_id or str(hash(email) % (1 << 64))
  os.environ['USER_IS_ADMIN'] = is_admin and '1' or '0'
  return users.User(email=email)


def BecomeAdmin(email='admin@google.com', user_id=None):
  """Sets the current user to an admin user for testing."""
  return SetUser(email, user_id, True)


def ClearUser():
  """Clean up the environment variables touched by SetUser."""
  os.environ.pop('USER_EMAIL', None)
  os.environ.pop('USER_ID', None)
  os.environ['USER_IS_ADMIN'] = '0'


def SetupHandler(url, handler, post_data=None):
  """Sets up a RequestHandler object for testing."""
  request = webapp2.Request(webob.Request.blank(url).environ)
  response = webapp2.Response()
  if post_data is not None:
    request.method = 'POST'
    request.body = post_data
    request.headers['Content-Type'] = 'application/x-www-form-urlencoded'
  handler.initialize(request, response)
  return handler


class MyDateTime(datetime.datetime):
  """Helper class for monkey patching datetime.datetime.utcnow.

  The reason to use subclassing, rather than direct simple monkey patching,
  is that built-in methods cannot be patched that way in Python.
  """
  default_datetime = datetime.datetime(2012, 4, 17, 20, 30, 40)

  @classmethod
  def utcnow(cls):  # pylint: disable=C6409
    return MyDateTime.default_datetime


class BaseTest(unittest.TestCase):
  """Base Tests for appengine classes."""

  def setUp(self):
    self.testbed = testbed.Testbed()
    self.testbed.activate()
    root = os.path.dirname(__file__) or '.'
    self.testbed.init_datastore_v3_stub(require_indexes=True, root_path=root)
    self.testbed.init_memcache_stub()
    self.testbed.init_user_stub()
    self.testbed.init_taskqueue_stub(root_path=root)
    self.mox = mox.Mox()

  # pylint: disable-msg=C6409
  def tearDown(self):
    self.mox.UnsetStubs()
    self.testbed.deactivate()
    ClearUser()

  def assertUrlsEqual(self, expected, actual):
    """Tests that URLs are equal, without caring about query arg order."""
    e_scheme, e_netloc, e_path, e_query, e_frag = urlparse.urlsplit(expected)
    a_scheme, a_netloc, a_path, a_query, a_frag = urlparse.urlsplit(actual)
    self.assertEquals(e_scheme, a_scheme,
                      'different scheme %s != %s' % (expected, actual))
    self.assertEquals(e_netloc, a_netloc,
                      'different netloc %s != %s' % (expected, actual))
    self.assertEquals(e_path, a_path,
                      'different path %s != %s' % (expected, actual))
    self.assertEquals(e_frag, a_frag,
                      'different fragment %s != %s' % (expected, actual))
    self.assertEquals(sorted(urlparse.parse_qsl(e_query)),
                      sorted(urlparse.parse_qsl(a_query)),
                      'different query %s != %s' % (expected, actual))


def main():
  unittest.main()
