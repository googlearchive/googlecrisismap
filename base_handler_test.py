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

"""Tests for base_handler.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import app
import base_handler
import config
import model
import test_utils
import webapp2


class TestHandler(base_handler.BaseHandler):
  """A basic handler used to test the BaseHandler class."""

  def Get(self):
    self.response.out.write('test')


class BaseHandlerTest(test_utils.BaseTest):
  """Tests for base_handler.py."""

  def testSelectLanguage(self):
    """Tests the selection of the UI language."""
    self.assertEquals('en', base_handler.SelectLanguage(None, None))

    # "ja" is a supported language.
    self.assertEquals('ja', base_handler.SelectLanguage('ja', None))
    self.assertEquals('ja', base_handler.SelectLanguage(None, 'ja'))

    # "zz" is not a supported language.
    self.assertEquals('en', base_handler.SelectLanguage('zz', None))

    # "in" is a deprecated code for Indonesian; the proper code is "id".
    self.assertEquals('id', base_handler.SelectLanguage('in', None))

    # The first parameter takes precedence over the second.
    self.assertEquals('tr', base_handler.SelectLanguage('tr', 'th'))

    # Can handle variable number of args, and chooses the first valid one.
    self.assertEquals('de', base_handler.SelectLanguage(
        'xoxo', None, 'de', 'fr'))

    # Each argument can actually be a comma-separated list of codes.
    self.assertEquals('de', base_handler.SelectLanguage(
        'xoxo,oxox', None, 'yoyo,oyoy,de', 'fr'))

  def testJsonXssVulnerability(self):
    """Verifies that ToHtmlSafeJson is safe against XSS."""
    self.assertFalse('</script>' in base_handler.ToHtmlSafeJson('x</script>y'))
    self.assertFalse('<' in base_handler.ToHtmlSafeJson('x<y'))
    self.assertFalse('>' in base_handler.ToHtmlSafeJson('x>y'))
    self.assertFalse('&' in base_handler.ToHtmlSafeJson('x&y'))

  def testSanitizeCallback(self):
    """Verifies that SanitizeCallback protects against XSS."""
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '.')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, 'abc"')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, "abc'")
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, 'abc;')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '<b>')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '1')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, '1abc')
    self.assertRaises(base_handler.Error, base_handler.SanitizeCallback, 'x.2')
    self.assertEquals('abc', base_handler.SanitizeCallback('abc'))
    self.assertEquals('_def', base_handler.SanitizeCallback('_def'))
    self.assertEquals('FooBar3', base_handler.SanitizeCallback('FooBar3'))
    self.assertEquals('x.y', base_handler.SanitizeCallback('x.y'))
    self.assertEquals('x.y._z', base_handler.SanitizeCallback('x.y._z'))

  def testGetAuthForRequest(self):
    """Verifies that self.auth is set properly according to API key."""
    key = model.Authorization.Create(source='xyz').id

    # No API key
    request = test_utils.SetupRequest('/foo')
    self.assertEquals(None, base_handler.GetAuthForRequest(request))

    # HTTP request with an API key should be disallowed
    request = test_utils.SetupRequest('/foo?key=' + key)
    self.assertRaises(
        base_handler.ApiError, base_handler.GetAuthForRequest, request)

    # HTTPS request with an unrecognized API key
    request = test_utils.SetupRequest('/foo?key=abc')
    request.scheme = 'https'
    self.assertRaises(
        base_handler.ApiError, base_handler.GetAuthForRequest, request)

    # HTTPS request with a valid API key
    request = test_utils.SetupRequest('/foo?key=' + key)
    request.scheme = 'https'
    auth = base_handler.GetAuthForRequest(request)
    self.assertEquals('xyz', auth.source)

    # Disabled API key
    model.Authorization.SetEnabled(key, False)
    self.assertRaises(
        base_handler.ApiError, base_handler.GetAuthForRequest, request)

    # Re-enabled API key
    model.Authorization.SetEnabled(key, True)
    auth = base_handler.GetAuthForRequest(request)
    self.assertEquals('xyz', auth.source)

  def RunTestHandler(self, method, path, status, **headers):
    route = app.RootPathRoute([app.Route('/test', TestHandler)])
    test_app = webapp2.WSGIApplication([route])
    request = test_utils.SetupRequest(path)
    request.method = method
    request.headers.update(headers)
    response = webapp2.Response()
    test_app.app.router.dispatch(request, response)
    self.assertEquals(status, response.status_int)
    return request, response

  def testHandleRequest(self):
    """Exercises the HandleRequest method by simulating a simple request."""
    request, response = self.RunTestHandler('GET', '/test', 200)
    self.assertEquals('test', response.body)

    self.assertEquals('en', request.lang)
    self.assertEquals(test_utils.ROOT_PATH, request.root_path)
    self.assertEquals(test_utils.ROOT_URL, request.root_url)

  def testLoginAccessList(self):
    """Ensures that the login_access_list config setting is enforced."""
    config.Set('login_access_list', ['1@gmail.test', '2@gmail.test'])

    _, response = self.RunTestHandler('GET', '/test', 302)
    self.assertRegexpMatches(response.headers['Location'], r'/\.login')

    with test_utils.Login('1'):
      _, response = self.RunTestHandler('GET', '/test', 200)
      self.assertEquals('test', response.body)

    with test_utils.Login('7'):
      _, response = self.RunTestHandler('GET', '/test', 403)
      self.assertTrue("you don't have permission" in response.body)


if __name__ == '__main__':
  test_utils.main()
