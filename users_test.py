#!/usr/bin/python
# Copyright 2013 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Tests for users.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import os

import test_utils
import users


class EnvContext(object):
  """A context manager that temporarily sets some environment variables."""

  def __init__(self, **kwargs):
    self.new = kwargs

  def __enter__(self):
    self.old = dict((key, os.environ.get(key, '')) for key in self.new)
    os.environ.update(self.new)

  def __exit__(self, etype, evalue, etb):
    os.environ.update(self.old)


class UsersTest(test_utils.BaseTest):
  """Tests for the users module."""
  # These tests don't use non-numeric uids like other tests, because their
  # purpose is to realistically test the underlying login mechanism.

  def testIsDeveloper(self):
    with EnvContext(SERVER_SOFTWARE='Google App Engine/1.7.6'):
      self.assertFalse(users.IsDeveloper())
      with EnvContext(USER_IS_ADMIN='1'):
        self.assertTrue(users.IsDeveloper())
    with EnvContext(SERVER_SOFTWARE='Development/1.0'):
      self.assertTrue(users.IsDeveloper())

  def testGetCurrent_NormalLogin(self):
    # Try an effective user determined by the Google Account login.
    with EnvContext(USER_ID='123456789', USER_EMAIL='alice@alpha.test',
                    USER_ORGANIZATION='alpha.test'):
      user = users.GetCurrent()  # should allocate the first uid, '1'
      self.assertEquals('1', user.id)
      user = users.Get('1')
      self.assertEquals('alpha.test', user.ga_domain)
      self.assertEquals('alice@alpha.test', user.email)

  def testGetCurrent_GoogleAccountMapping(self):
    with EnvContext(USER_ID='123456789', USER_EMAIL='alice@alpha.test'):
      user = users.GetCurrent()  # should allocate the first uid, '1'
      self.assertEquals('1', user.id)
    with EnvContext(USER_ID='666666', USER_EMAIL='bob@beta.test'):
      user = users.GetCurrent()  # should allocate the next uid, '2'
      self.assertEquals('2', user.id)
    with EnvContext(USER_ID='123456789', USER_EMAIL='charlie@gamma.test'):
      user = users.GetCurrent()  # should match by USER_ID
      self.assertEquals('1', user.id)

  def testGetCurrent_UpdateEmailAndDomain(self):
    with EnvContext(USER_ID='123456789', USER_EMAIL='alice@alpha.test',
                    USER_ORGANIZATION='alpha.test'):
      users.GetCurrent()  # should allocate the first uid, '1'
      user = users.Get('1')
      self.assertEquals('alpha.test', user.ga_domain)
      self.assertEquals('alice@alpha.test', user.email)
    with EnvContext(USER_ID='123456789', USER_EMAIL='bob@beta.test',
                    USER_ORGANIZATION='beta.test'):
      users.GetCurrent()  # should update the existing UserModel
      user = users.Get('1')
      self.assertEquals('beta.test', user.ga_domain)
      self.assertEquals('bob@beta.test', user.email)

  def testGetCurrent_ImpersonationNotAllowed(self):
    # Verify that the crisismap_login cookie doesn't work for ordinary users.
    with EnvContext(SERVER_SOFTWARE='Google App Engine/1.7.6',
                    USER_ID='123456789', USER_EMAIL='alice@alpha.test',
                    USER_ORGANIZATION='alpha.test',
                    HTTP_COOKIE='crisismap_login=t1000:sky.net:arnold@sky.net'):
      user = users.GetCurrent()
      self.assertEquals('1', user.id)  # cookie should be ignored
      self.assertEquals('alpha.test', user.ga_domain)
      self.assertEquals('alice@alpha.test', user.email)

  def testGetCurrent_ImpersonationInProd(self):
    # Verify that the crisismap_login cookie works for admins in prod.
    with EnvContext(SERVER_SOFTWARE='Google App Engine/1.7.6',
                    USER_ID='123456789', USER_EMAIL='alice@alpha.test',
                    USER_ORGANIZATION='alpha.test', USER_IS_ADMIN='1',
                    HTTP_COOKIE='crisismap_login=t1000:sky.net:arnold@sky.net'):
      user = users.GetCurrent()
      self.assertEquals('t1000', user.id)  # cookie should be used
      self.assertEquals('sky.net', user.ga_domain)
      self.assertEquals('arnold@sky.net', user.email)

  def testGetCurrent_ImpersonationInDev(self):
    # Verify that the crisismap_login cookie works in development.
    with EnvContext(SERVER_SOFTWARE='Development/1.0',
                    USER_ID='123456789', USER_EMAIL='alice@alpha.test',
                    USER_ORGANIZATION='alpha.test',
                    HTTP_COOKIE='crisismap_login=t1000:sky.net:arnold@sky.net'):
      user = users.GetCurrent()
      self.assertEquals('t1000', user.id)  # cookie should be used
      self.assertEquals('sky.net', user.ga_domain)
      self.assertEquals('arnold@sky.net', user.email)

  def testGetAll(self):
    users._UserModel(id='one', ga_domain='xyz.com', email='one@xyz.com').put()
    users._UserModel(id='two', ga_domain='abc.com', email='two@abc.com').put()
    [user1, user2] = sorted(users.GetAll(), key=lambda u: u.id)
    self.assertEquals(('one', 'xyz.com', 'one@xyz.com'),
                      (user1.id, user1.ga_domain, user1.email))
    self.assertEquals(('two', 'abc.com', 'two@abc.com'),
                      (user2.id, user2.ga_domain, user2.email))

  def testGetForEmail_NonexistentGoogleAccounts(self):
    self.mox.stubs.Set(users, '_EmailToGaeUserId', {}.get)
    # Normal e-mail addresses should allocate uids sequentially.
    self.assertEquals('1', users.GetForEmail('tuv@gmail.com').id)
    self.assertEquals('2', users.GetForEmail('alice@example.com').id)
    # For an e-mail address we've seen before, we should get the matching User.
    self.assertEquals('1', users.GetForEmail('tuv@gmail.com').id)
    # User entities should have been stored as a side effect.
    self.assertEquals('tuv@gmail.com', users.Get('1').email)
    self.assertEquals('alice@example.com', users.Get('2').email)

  def testGetForEmail_TestAccounts(self):
    self.mox.stubs.Set(users, '_EmailToGaeUserId', {}.get)
    # Accounts under ".test" should get their uids from the e-mail address.
    self.assertEquals('test1', users.GetForEmail('test1@alpha.test').id)
    self.assertEquals('agablaga', users.GetForEmail('agablaga@beta.test').id)
    # User entities should have been stored as a side effect.
    self.assertEquals('test1@alpha.test', users.Get('test1').email)
    self.assertEquals('agablaga@beta.test', users.Get('agablaga').email)

  def testGetCurrent_AfterGetForEmailWithNonexistentGoogleAccount(self):
    self.mox.stubs.Set(users, '_EmailToGaeUserId', {}.get)
    # Introduce a previously unseen e-mail address.
    self.assertEquals('1', users.GetForEmail('tuv@gmail.com').id)
    # A sign-in with that e-mail address should associate the Google Account.
    with EnvContext(USER_ID='123456789', USER_EMAIL='tuv@gmail.com'):
      self.assertEquals('1', users.GetCurrent().id)
    # Subsequent sign-ins with the same Google Account ID should also hook up.
    with EnvContext(USER_ID='123456789', USER_EMAIL='blah@gmail.com'):
      self.assertEquals('1', users.GetCurrent().id)

  def testGetCurrent_AfterGetForEmailWithExistingGoogleAccount(self):
    self.mox.stubs.Set(users, '_EmailToGaeUserId', {
        'funkyspeller@gmail.com': '123456789',
        'Funky.Speller@gmail.com': '123456789'
    }.get)
    # Introduce an e-mail address that's new to us but has a Google Account.
    # GetForEmail should associate the address with the Google Account.
    self.assertEquals('1', users.GetForEmail('funkyspeller@gmail.com').id)
    # A sign-in with that Google Account ID should get the same UserModel,
    # even if the e-mail address is different.
    with EnvContext(USER_ID='123456789', USER_EMAIL='random@random.test'):
      self.assertEquals('1', users.GetCurrent().id)
    # Any other e-mail address associated with the same Google Account should
    # yield the same UserModel.
    self.assertEquals('1', users.GetForEmail('Funky.Speller@gmail.com').id)

  def testSetWelcomeMessageDismissed(self):
    users._UserModel(id='1', ga_domain='xyz.com', email='1@xyz.com').put()
    self.assertEquals(False, users.Get('1').welcome_message_dismissed)
    users.SetWelcomeMessageDismissed('1', True)
    self.assertEquals(True, users.Get('1').welcome_message_dismissed)

  def testSetMarketingConsent(self):
    users._UserModel(id='1', ga_domain='xyz.com', email='1@xyz.com').put()
    self.assertEquals(False, users.Get('1').marketing_consent_answered)
    self.assertEquals(False, users.Get('1').marketing_consent)
    users.SetMarketingConsent('1', False)
    self.assertEquals(True, users.Get('1').marketing_consent_answered)
    self.assertEquals(False, users.Get('1').marketing_consent)
    users.SetMarketingConsent('1', True)
    self.assertEquals(True, users.Get('1').marketing_consent_answered)
    self.assertEquals(True, users.Get('1').marketing_consent)

  def testGetLoginUrl(self):
    # We just test dev mode; in production this forwards to create_login_url.
    self.assertEquals('/root/.login?redirect=abc', users.GetLoginUrl('abc'))

  def testGetLogoutUrl(self):
    # We just test dev mode; in production this forwards to create_logout_url.
    self.assertEquals('/root/.login?logout=1&redirect=abc',
                      users.GetLogoutUrl('abc'))


if __name__ == '__main__':
  test_utils.main()
