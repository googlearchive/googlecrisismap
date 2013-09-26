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

import base64
import datetime
import os
import time
import unittest
import urlparse

import webapp2
import webob

import config
import model
import mox

from google.appengine.api import taskqueue
from google.appengine.api import users
from google.appengine.ext import testbed

# mox.IgnoreArg() is such a horrible way to spell "I don't care".
mox.ANY = mox.IgnoreArg()

# For tests, assume the app resides under this URL.
ROOT_URL = 'http://app.com/root'
ROOT_PATH = urlparse.urlsplit(ROOT_URL).path


def DoGet(path):
  """Dispatches a GET request according to the routes in app.py.

  Args:
    path: The part of the URL path after (not including) the root URL.

  Returns:
    The HTTP response from the handler as a webapp2.Response object.
  """
  return DispatchRequest(SetupRequest(path))


def DoPost(path, data):
  """Dispatches a POST request according to the routes in app.py.

  Args:
    path: The part of the URL path after (not including) the root URL.
    data: The POST data as a string.

  Returns:
    The HTTP response from the handler as a webapp2.Response object.
  """
  request = SetupRequest(path)
  request.method = 'POST'
  request.body = data
  request.headers['Content-Type'] = 'application/x-www-form-urlencoded'
  return DispatchRequest(request)


def DispatchRequest(request):
  response = webapp2.Response()
  # Can't import app at the top of this file because testbed isn't ready yet.
  import app  # pylint: disable=g-import-not-at-top
  app.app.router.dispatch(request, response)
  return response


def SetupRequest(path, lang='en'):
  """Sets up a webapp2.Request object for testing."""
  request = webapp2.Request(webob.Request.blank(ROOT_URL + path).environ)
  request.root_path = ROOT_PATH
  request.lang = lang
  return request


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


def DatetimeWithUtcnow(now):
  """Creates a replacement for datetime.datetime with a stub for utcnow()."""
  # datetime.datetime is a built-in type, so we can't reassign its 'utcnow'
  # member; we have to subclass datetime.datetime instead.  The App Engine
  # SDK randomly uses both utcnow() and now(), so we have to patch both. :/
  return type('datetime.datetime', (datetime.datetime,),
              {'utcnow': staticmethod(lambda: now),
               'now': staticmethod(lambda: now)})


def CreateMapAsAdmin(**kwargs):
  BecomeAdmin()
  map_object = model.Map.Create(
      '{"description": "description", "title": "title"}', 'xyz.com', **kwargs)
  return map_object, map_object.GetCurrent().id


def TestRedirect(self, uri):
  # Passing Unicode to redirect() is fatal in production; make it so in tests.
  if type(uri) != str:
    raise TypeError('redirect() must be called with an 8-bit string')
  original_redirect(self, uri)

original_redirect = webapp2.RequestHandler.redirect


class BaseTest(unittest.TestCase):
  """Base Tests for appengine classes."""

  def setUp(self):
    self.mox = mox.Mox()
    self.testbed = testbed.Testbed()
    self.testbed.activate()
    root = os.path.dirname(__file__) or '.'
    self.testbed.init_datastore_v3_stub(require_indexes=True, root_path=root)
    self.testbed.init_memcache_stub()
    self.testbed.init_urlfetch_stub()
    self.testbed.init_user_stub()
    self.testbed.init_taskqueue_stub(root_path=root)
    config.Set('root_path', ROOT_PATH)

    self.mox.stubs.Set(webapp2.RequestHandler, 'redirect', TestRedirect)

  def tearDown(self):
    self.mox.UnsetStubs()
    self.testbed.deactivate()
    ClearUser()

  def PopTasks(self, queue_name):
    """Removes all the tasks from a given queue, returning a list of dicts."""
    stub = self.testbed.get_stub('taskqueue')
    tasks = stub.GetTasks(queue_name)
    stub.FlushQueue(queue_name)
    return tasks

  def GetTaskBody(self, task):
    """Gets the content of the POST data for a task as a string."""
    return base64.b64decode(task['body'])

  def GetTaskParams(self, task):
    """Gets the POST parameters for a task as a list of (key, value) pairs."""
    return urlparse.parse_qsl(self.GetTaskBody(task))

  def ExecuteTask(self, task):
    """Executes a task from popTasks, using a given handler."""
    self.assertEquals(ROOT_PATH, task['url'][:len(ROOT_PATH)])
    path = task['url'][len(ROOT_PATH):]
    if task['method'] == 'POST':
      return DoPost(path, self.GetTaskBody(task))
    return DoGet(path)

  def SetForTest(self, parent, child_name, new_child):
    """Sets an attribute of an object, just for the duration of the test."""
    self.mox.stubs.Set(parent, child_name, new_child)

  def SetTime(self, timestamp):
    """Sets a fake value for the current time, for the duration of the test."""
    self.SetForTest(time, 'time', lambda: timestamp)
    now = datetime.datetime.utcfromtimestamp(timestamp)
    self.SetForTest(datetime, 'datetime', DatetimeWithUtcnow(now))

    # Task.__determine_eta_posix uses the original time.time as a default
    # argument value, so we have to monkey-patch it to make it use our fake.
    determine_eta_posix = taskqueue.Task._Task__determine_eta_posix

    def FakeDetermineEtaPosix(eta=None, countdown=None, current_time=time.time):
      return determine_eta_posix(eta, countdown, current_time)
    self.SetForTest(taskqueue.Task, '_Task__determine_eta_posix',
                    staticmethod(FakeDetermineEtaPosix))
    return now

  def assertBetween(self, low, high, actual):
    """Checks that a value is within a desired range."""
    self.assertGreaterEqual(actual, low)
    self.assertLessEqual(actual, high)

  def assertEqualsUrlWithUnorderedParams(self, expected, actual):
    """Checks for an expected URL, ignoring the order of query params."""
    e_scheme, e_host, e_path, e_query, e_frag = urlparse.urlsplit(expected)
    a_scheme, a_host, a_path, a_query, a_frag = urlparse.urlsplit(actual)
    self.assertEquals(
        (e_scheme, e_host, e_path, sorted(urlparse.parse_qsl(e_query)), e_frag),
        (a_scheme, a_host, a_path, sorted(urlparse.parse_qsl(a_query)), a_frag))


def main():
  unittest.main()
