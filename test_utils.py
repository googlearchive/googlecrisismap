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
import urllib
import urlparse

import webapp2
import webob

import base_handler
import config
import domains
import logs
import model
import mox
import perms
import users

from google.appengine.api import taskqueue
from google.appengine.ext import testbed

# mox.IgnoreArg() is such a horrible way to spell "I don't care".
mox.ANY = mox.IgnoreArg()

# For tests, assume the app resides under this URL.
ROOT_URL = 'http://app.com/root'
ROOT_PATH = urlparse.urlsplit(ROOT_URL).path
DEFAULT_DOMAIN = 'xyz.com'


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


class LoginContext(object):
  """A context manager that sets and restores the user login for testing."""

  def __init__(self, uid, ga_domain, email):
    self.login_info = uid, ga_domain, email
    self.user = users.User(id=uid, ga_domain=ga_domain, email=email)

  def __enter__(self):
    self.original = users._GetLoginInfo
    users._GetLoginInfo = lambda: self.login_info
    return self.user

  def __exit__(self, etype, evalue, etb):
    users._GetLoginInfo = self.original


def Login(uid):
  """Context manager: signs in a non-Google-Apps user."""
  return LoginContext(uid, '', uid + '@gmail.test')


def DomainLogin(uid, domain):
  """Context manager: signs in a Google Apps user."""
  return LoginContext(uid, domain, uid + '@' + domain)


def RootLogin():
  """Context manager: signs in as user 'root', which always has ADMIN access."""
  return LoginContext(perms.ROOT.id, '', 'root@gmail.test')


def SetupUser(context):
  """Ensures that the User for a login context exists in the datastore."""
  with context:
    return users.GetCurrent()  # implicitly updates the datastore


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
               'now': staticmethod(lambda: now),
               # The line below makes utcfromtimestamp return datetime.datetime
               # instances instead of test_utils.datetime.datetime instances.
               'utcfromtimestamp': datetime.datetime.utcfromtimestamp})


def CreateMap(maproot_json='{"title": "Foo"}', domain=DEFAULT_DOMAIN, **kwargs):
  with RootLogin():
    return model.Map.Create(maproot_json, domain, **kwargs)


class BaseTest(unittest.TestCase):
  """Base Tests for appengine classes."""

  def setUp(self):
    self.mox = mox.Mox()
    self.testbed = testbed.Testbed()
    self.testbed.activate()
    root = os.path.dirname(__file__) or '.'
    self.testbed.init_datastore_v3_stub(require_indexes=True, root_path=root)
    self.testbed.init_memcache_stub()
    self.testbed.init_taskqueue_stub(root_path=root)
    self.testbed.init_urlfetch_stub()
    self.testbed.init_user_stub()
    self.original_datetime = datetime.datetime
    os.environ.pop('USER_EMAIL', None)
    os.environ.pop('USER_ID', None)
    os.environ.pop('USER_IS_ADMIN', None)
    os.environ.pop('USER_ORGANIZATION', None)
    config.Set('root_path', ROOT_PATH)
    config.Set('default_domain', DEFAULT_DOMAIN)
    domains.Domain.Create(DEFAULT_DOMAIN)
    self.mox.stubs.Set(
        base_handler, 'GenerateXsrfToken', lambda uid, timestamp=None: 'XSRF')
    self.mox.stubs.Set(
        base_handler, 'ValidateXsrfToken', lambda uid, token: token == 'XSRF')

  def tearDown(self):
    self.mox.UnsetStubs()
    self.testbed.deactivate()

  def DoGet(self, path, status=None):
    """Dispatches a GET request according to the routes in app.py.

    Args:
      path: The part of the URL path after (not including) the root URL.
      status: If given, expect that the GET will give this HTTP status code.
          Otherwise, expect that the GET will give a non-error code (200-399).

    Returns:
      The HTTP response from the handler as a webapp2.Response object.
    """
    response = DispatchRequest(SetupRequest(path))
    if status:
      self.assertEquals(status, response.status_int)
    else:
      self.assertGreaterEqual(response.status_int, 200)
      self.assertLess(response.status_int, 400)
    return response

  def DoPost(self, path, data, status=None):
    """Dispatches a POST request according to the routes in app.py.

    Args:
      path: The part of the URL path after (not including) the root URL.
      data: The POST data as a string, dictionary, or list of pairs.
      status: If given, expect that the POST will return this HTTP status code.
          Otherwise, expect that the POST will return a non-error code (< 400).

    Returns:
      The HTTP response from the handler as a webapp2.Response object.
    """
    request = SetupRequest(path)
    request.method = 'POST'
    if isinstance(data, dict):
      request.body = urllib.urlencode(data)
    else:
      request.body = str(data)
    request.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    response = DispatchRequest(request)
    if status:
      self.assertEquals(status, response.status_int)
    else:
      self.assertLess(response.status_int, 400)
    return response

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
      return self.DoPost(path, self.GetTaskBody(task))
    return self.DoGet(path)

  def SetForTest(self, parent, child_name, new_child):
    """Sets an attribute of an object, just for the duration of the test."""
    self.mox.stubs.Set(parent, child_name, new_child)

  def SetTime(self, timestamp):
    """Sets a fake value for the current time, for the duration of the test."""
    self.SetForTest(time, 'time', lambda: timestamp)
    now = self.original_datetime.utcfromtimestamp(timestamp)
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

  def MockRecordEvent(self, event, **kwargs):
    self.logs.append(dict(event=event, **kwargs))

  def CaptureLog(self):
    self.mox.stubs.Set(logs, 'RecordEvent', self.MockRecordEvent)
    self.logs = []

  def assertLog(self, event, **kwargs):
    expected_items = dict(event=event, **kwargs).items()
    matches = [log_dict for log_dict in self.logs
               if set(log_dict.items()).issuperset(expected_items)]
    self.assertTrue(matches, 'No matching logs found.')
    self.assertEqual(1, len(matches), 'Multiple matching logs found.')
    return matches[0]


def main():
  unittest.main()
