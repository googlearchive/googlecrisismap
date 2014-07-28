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
import contextlib
import cookielib
import datetime
import os
import rfc822
import StringIO
import time
import unittest
import urllib
import urllib2
import urlparse

import base_handler
import cache
import config
import domains
import logs
import model
import mox
import perms
import users
import utils

import webapp2
import webob

from google.appengine.api import apiproxy_stub_map
from google.appengine.api import datastore_types
from google.appengine.api import taskqueue
from google.appengine.api.memcache import memcache_stub
from google.appengine.ext import testbed

# mox.IgnoreArg() is such a horrible way to spell "I don't care".
mox.ANY = mox.IgnoreArg()

# For tests, assume the app resides under this URL.
ROOT_URL = 'http://app.com/root'
ROOT_PATH = urlparse.urlsplit(ROOT_URL).path

PRIMARY_DOMAIN = 'xyz.com'


def DispatchRequest(request, cookie_jar=None):
  """Selects a handler for the request according to app.app and executes it."""
  response = webapp2.Response()
  # Can't import app at the top of this file because testbed isn't ready yet.
  import app  # pylint: disable=g-import-not-at-top
  app.app.router.dispatch(request, response)
  if cookie_jar is not None and 'set-cookie' in response.headers:
    # Cobble up a urllib2.Request and response for the CookieJar to examine.
    f = StringIO.StringIO('Set-Cookie: ' + response.headers['set-cookie'])
    cookie_jar.extract_cookies(urllib2.addinfourl(f, rfc822.Message(f), ''),
                               urllib2.Request(request.url))
  return response


def SetupRequest(path, lang='en', cookie_jar=None):
  """Sets up a webapp2.Request object for testing."""
  request = webapp2.Request(webob.Request.blank(ROOT_URL + path).environ)
  request.root_url = ROOT_URL
  request.root_path = ROOT_PATH
  request.lang = lang
  if cookie_jar is not None:
    # Cobble up a urllib2.Request for the CookieJar to put cookies in.
    req = urllib2.Request(request.url)
    cookie_jar.add_cookie_header(req)
    request.headers['Cookie'] = req.get_header('Cookie')
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


class EnvContext(object):
  """A context manager that temporarily sets some environment variables."""

  def __init__(self, **kwargs):
    self.new = kwargs

  def __enter__(self):
    self.old = dict((key, os.environ.get(key, '')) for key in self.new)
    os.environ.update(self.new)

  def __exit__(self, etype, evalue, etb):
    os.environ.update(self.old)


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


class DatetimeSupertype(type):
  """Metaclass used for constructing a fake class to replace datetime.datetime.

  Yes.  Python is so dynamic you can override the behaviour of isinstance().
  Any class S constructed using this metaclass will pretend to be a supertype
  of datetime.datetime, i.e. isinstance(d, S) will return True when d is an
  instance of datetime.datetime.
  """
  original_datetime = datetime.datetime

  def __instancecheck__(cls, instance):
    return isinstance(instance, cls.original_datetime)


def DatetimeTypeWithFakeNow(now):
  """Makes a replacement for datetime.datetime with a fixed value for now()."""
  # datetime.datetime is a built-in type, so we can't reassign its 'utcnow'
  # member; we have to subclass datetime.datetime instead.  However, we also
  # need isinstance(datetime.datetime.utcnow(), datetime.datetime) to remain
  # True, so we use the DatetimeSupertype metaclass above.  Also, App Engine
  # randomly uses both utcnow() and now(), so we have to patch both. :/
  return DatetimeSupertype('datetime.datetime', (datetime.datetime,),
                           {'utcnow': staticmethod(lambda: now),
                            'now': staticmethod(lambda: now)})


def CreateMap(map_root=None, domain=PRIMARY_DOMAIN, **kwargs):
  with RootLogin():
    return model.Map.Create(map_root or {}, domain, **kwargs)


def NewCrowdReport(source='http://source.com/',
                   author='http://google.org/crisismap/.users/anonymous/12345',
                   text='Crowd report text',
                   topic_ids=None, answers=None, location=None, map_id=None):
  effective = datetime.datetime.utcnow()
  return model.CrowdReport.Create(
      source, author, effective, text, topic_ids or [], answers or {},
      location, map_id=map_id)


class BaseTest(unittest.TestCase):
  """Base Tests for appengine classes."""

  def setUp(self):
    self.mox = mox.Mox()
    self.testbed = testbed.Testbed()
    self.testbed.activate()
    root = os.path.dirname(__file__) or '.'
    self.testbed.init_datastore_v3_stub(require_indexes=True, root_path=root)
    self.testbed.init_taskqueue_stub(root_path=root)

    # Register memcache stub with a custom gettime function, so we can control
    # time in memcache through self.SetTime(..)
    # pylint: disable=unnecessary-lambda
    apiproxy_stub_map.apiproxy.RegisterStub(
        'memcache',
        memcache_stub.MemcacheServiceStub(lambda: time.time()))
    # pylint: enable=unnecessary-lambda

    self.testbed.init_urlfetch_stub()
    self.testbed.init_user_stub()
    self.testbed.init_search_stub()
    self.original_datetime = datetime.datetime
    os.environ.pop('USER_EMAIL', None)
    os.environ.pop('USER_ID', None)
    os.environ.pop('USER_IS_ADMIN', None)
    os.environ.pop('USER_ORGANIZATION', None)
    config.Set('root_path', ROOT_PATH)
    config.Set('primary_domain', PRIMARY_DOMAIN)
    domains.Domain.Put(PRIMARY_DOMAIN)
    self.mox.stubs.Set(
        base_handler, 'GenerateXsrfToken', lambda uid, timestamp=None: 'XSRF')
    self.mox.stubs.Set(
        base_handler, 'ValidateXsrfToken', lambda uid, token: token == 'XSRF')
    self.id_counter = 0
    self.mox.stubs.Set(utils, 'MakeRandomId', self.MakePredictableId)
    self.cookie_jar = None

  def tearDown(self):
    self.mox.UnsetStubs()
    self.testbed.deactivate()
    cache.Reset()

  def MakePredictableId(self):
    """A replacement for MakeRandomId() that gives predictable IDs in tests."""
    self.id_counter += 1
    return 'random_id_%d' % self.id_counter

  def NewCookieJar(self):
    """Makes a context manager that sets up a cookie jar for DoGet/DoPost."""
    def SetCookieJar():
      original_cookie_jar = self.cookie_jar
      self.cookie_jar = cookielib.CookieJar()
      try:
        yield self.cookie_jar
      finally:
        self.cookie_jar = original_cookie_jar
    return contextlib.contextmanager(SetCookieJar)()

  def DoGet(self, path, status=None, https=False):
    """Dispatches a GET request according to the routes in app.py.

    Args:
      path: The part of the URL path after (not including) the root URL.
      status: If given, expect that the GET will give this HTTP status code.
          Otherwise, expect that the GET will give a non-error code (200-399).
      https: If True, simulate an HTTPS request.

    Returns:
      The HTTP response from the handler as a webapp2.Response object.
    """
    request = SetupRequest(path, cookie_jar=self.cookie_jar)
    request.scheme = https and 'https' or 'http'
    response = DispatchRequest(request, cookie_jar=self.cookie_jar)
    if status:
      self.assertEquals(status, response.status_int)
    else:
      self.assertGreaterEqual(response.status_int, 200)
      self.assertLess(response.status_int, 400)
    return response

  def DoPost(self, path, data, status=None,
             content_type='application/x-www-form-urlencoded', https=False):
    """Dispatches a POST request according to the routes in app.py.

    Args:
      path: The part of the URL path after (not including) the root URL.
      data: The POST data as a string, dictionary, or list of pairs.
      status: If given, expect that the POST will return this HTTP status code.
          Otherwise, expect that the POST will return a non-error code (< 400).
      content_type: Optional.  The content type of the data.
      https: If True, simulate an HTTPS request.

    Returns:
      The HTTP response from the handler as a webapp2.Response object.
    """
    request = SetupRequest(path, cookie_jar=self.cookie_jar)
    request.scheme = https and 'https' or 'http'
    request.method = 'POST'
    if isinstance(data, dict):
      request.body = urllib.urlencode(data)
    else:
      request.body = str(data)
    request.headers['Content-Type'] = content_type
    response = DispatchRequest(request, cookie_jar=self.cookie_jar)
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
    self.SetForTest(datetime, 'datetime', DatetimeTypeWithFakeNow(now))
    # Fix up datastore_types.py to accept instances of the fake datetime type.
    validators = datastore_types._VALIDATE_PROPERTY_VALUES.copy()
    validators[datetime.datetime] = validators[self.original_datetime]
    self.SetForTest(datastore_types, '_VALIDATE_PROPERTY_VALUES', validators)

    # Task.__determine_eta_posix uses the original time.time as a default
    # argument value, so we have to monkey-patch it to make it use our fake.
    determine_eta_posix = taskqueue.Task._Task__determine_eta_posix

    def FakeDetermineEtaPosix(eta=None, countdown=None, current_time=time.time):
      return determine_eta_posix(eta, countdown, current_time)
    self.SetForTest(taskqueue.Task, '_Task__determine_eta_posix',
                    staticmethod(FakeDetermineEtaPosix))
    return now

  def AssertBetween(self, low, high, actual):
    """Checks that a value is within a desired range."""
    self.assertGreaterEqual(actual, low)
    self.assertLessEqual(actual, high)

  def AssertEqualsUrlWithUnorderedParams(self, expected, actual):
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

  def AssertLog(self, event, **kwargs):
    expected_items = dict(event=event, **kwargs).items()
    matches = [log_dict for log_dict in self.logs
               if set(log_dict.items()).issuperset(expected_items)]
    self.assertTrue(matches, 'No matching logs found.')
    self.assertEqual(1, len(matches), 'Multiple matching logs found.')
    return matches[0]

  def AssertAttrs(self, obj, **kwargs):
    self.assertEqual(kwargs, {name: getattr(obj, name) for name in kwargs})


def main():
  unittest.main()
