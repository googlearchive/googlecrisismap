#!/usr/bin/python
# Copyright 2013 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""User accounts and preferences.

All access to user information should go through this module's API.
google.appengine.api.users should not be used anywhere outside this file.
"""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import datetime
import os
import urllib

import config
import utils

from google.appengine.api import users as gae_users
from google.appengine.ext import ndb


class _GoogleAccount(ndb.Model):
  """A mapping from a Google Account to a UserModel entity.

  This entity's .key.id() is the user_id() of a google.appengine.api.users.User.
  """

  # uid is the .key.id() of the _UserModel corresponding to this Google Account.
  uid = ndb.StringProperty()

  @classmethod
  def _get_kind(cls):  # pylint: disable=g-bad-name
    return 'GoogleAccount'  # so we can name the Python class with an underscore


class _UserModel(ndb.Model):
  """Private entity for storing user profiles.

  This entity's key.id() is exposed as the .id attribute on User; see the User
  class below for its definition.
  """

  # The time this UserModel was first created.
  created = ndb.DateTimeProperty()

  # True if this user has ever signed in.
  active = ndb.BooleanProperty(default=False)

  # The last seen Google Account domain for the user (i.e. USER_ORGANIZATION).
  # See https://developers.google.com/appengine/articles/auth for details.
  # Note that this is not a simple function of the e-mail address -- it can be
  # present or not present for various e-mail addresses with the same domain.
  ga_domain = ndb.StringProperty(default='')

  # The last known e-mail address for the user.  This can change over time.
  email = ndb.StringProperty(default='')

  # True if the user has given consent to receive marketing e-mail.
  marketing_consent = ndb.BooleanProperty(default=False)

  # True if the user has submitted an answer to the marketing consent question.
  marketing_consent_answered = ndb.BooleanProperty(default=False)

  # True if the user has selected "Don't show again" for the welcome message.
  welcome_message_dismissed = ndb.BooleanProperty(default=False)

  @classmethod
  def _get_kind(cls):  # pylint: disable=g-bad-name
    return 'UserModel'  # so we can name the Python class with an underscore


class User(utils.Struct):
  """Public class for user profiles.

  For all real users (i.e. with Google Accounts), the .id attribute is the
  string decimal representation of a sequentially chosen positive integer.
  For other accounts used in testing and development, the .id can be any string
  containing a non-digit.  By convention, a variable named 'user' usually holds
  a User object, and a variable named 'uid' holds the .id of a User object.
  """

  def __repr__(self):
    return 'User(id=%r, ga_domain=%r, email=%r)' % (
        self.id, self.ga_domain, self.email)

  # This is not an old-style class.  # pylint: disable=property-on-old-class
  email_username = property(lambda self: self.email.split('@')[0])
  email_domain = property(lambda self: self.email.split('@')[-1])
  # pylint: enable=property-on-old-class


def _GetModel(uid):
  """Gets a _UserModel entity by uid, or raises KeyError."""
  model = _UserModel.get_by_id(uid)
  if not model:
    raise KeyError('No UserModel exists with ID %r' % uid)
  return model


def _IsDevelopmentServer():
  """Returns True if the app is running in development."""
  server = os.environ.get('SERVER_SOFTWARE', '')
  return 'Development' in server or 'testutil' in server


@ndb.transactional
def _GenerateNextUid():
  """Generates a sequentially increasing string uid, starting with '1'."""

  class Counter(ndb.Model):
    last_used = ndb.IntegerProperty()

  counter = Counter.get_by_id('uid') or Counter(id='uid', last_used=0)
  counter.last_used += 1
  counter.put()
  return str(counter.last_used)


def _EmailToGaeUserId(email):
  """Gets the Google Account user IDs for the given e-mail addresses."""
  # Different address strings can map to the same ID (e.g. 'foobar@gmail.com'
  # and 'Foo.Bar@gmail.com'), so it's best to ask App Engine to do this mapping.

  # Stupidly, App Engine has no simple API for doing this; the only way to
  # achieve this conversion is to store a User property and fetch it back.
  class DummyUser(ndb.Model):
    user = ndb.UserProperty()

  # The UserProperty's user_id() is magically populated when it is written to
  # the datastore.  We have to turn off caching to get it, though; with caching,
  # get() just returns the original in-memory entity, which has no user_id().
  key = DummyUser(user=gae_users.User(email)).put(use_cache=False)
  gae_user_id = key.get(use_cache=False).user.user_id()
  key.delete()
  return gae_user_id


def _GetLoginInfo():
  """Gets the effective uid, GA domain, and e-mail address of the current user.

  The effective user is normally determined by the Google Account login state.
  Note that uid is an application-local user ID, not the Google Account ID.
  If the app is running in development or accessed by an App Engine app admin,
  the crisismap_login cookie can be used to impersonate any login.

  Returns:
    Three strings (uid, ga_domain, email), or ('', '', '') if not signed in.
  """
  # os.environ is safe to read on a multithreaded server, as it's thread-local
  # in the Python 2.7 runtime (see http://goo.gl/VmGRa, http://goo.gl/wwcNN, or
  # the implementation at google/appengine/runtime/request_environment.py).
  header = os.environ.get('HTTP_COOKIE', '')
  if header and IsDeveloper():
    # The crisismap_login cookie translates directly to a UserModel, with
    # no GoogleAccount mapping involved.
    cookies = dict(pair.strip().split('=', 1) for pair in header.split(';'))
    login_parts = cookies.get('crisismap_login', '').split(':')
    if len(login_parts) == 3:
      return tuple(login_parts)  # valid cookie format is "uid:ga_domain:email"

  gae_user = gae_users.get_current_user()  # a google.appengine.api.users.User
  if gae_user and gae_user.user_id():
    ga_domain, email = os.environ.get('USER_ORGANIZATION', ''), gae_user.email()
    # If user has signed in before, we have a mapping to an existing UserModel.
    ga = _GoogleAccount.get_by_id(gae_user.user_id())
    if ga:
      return ga.uid, ga_domain, email
    else:
      # This user has never signed in before *and* GetForEmail() has never been
      # called with an e-mail address that was, at the time, associated with
      # this Google Account.  Associate this Google Account with the UserModel
      # that has a matching e-mail address, or make a new UserModel.
      model = _UserModel.query(_UserModel.email == email).get()
      # NOTE(kpy): The above might miss a UserModel that should be associated
      # with this user: if the UserModel was created by calling GetForEmail()
      # with an e-mail address that Google Accounts considers the same, but
      # differs (e.g. in capitalization) from the Google Account's canonical
      # address, the .email property won't match.  If we really want to handle
      # this, we could try _EmailToGaeUserId on all the inactive UserModels.
      uid = model and model.key.id() or _GenerateNextUid()
      _GoogleAccount(id=gae_user.user_id(), uid=uid).put()
      return uid, ga_domain, email
  return '', '', ''


def IsDeveloper():
  """Returns True if running in development or the user is an app admin."""
  return _IsDevelopmentServer() or gae_users.is_current_user_admin()


def Get(uid):
  """Returns the User object for a given uid."""
  return User.FromModel(_GetModel(uid))


def GetCurrent():
  """Returns the User object for the effective signed-in user, or None."""
  uid, ga_domain, email = _GetLoginInfo()
  if uid:
    # The GA domain and e-mail address associated with an account can change;
    # update or create the UserModel entity as needed.
    model = (_UserModel.get_by_id(uid) or
             _UserModel(id=uid, created=datetime.datetime.utcnow()))
    if (model.active, model.ga_domain, model.email) != (True, ga_domain, email):
      model.active, model.ga_domain, model.email = True, ga_domain, email
      model.put()
    return User.FromModel(model)


def GetAll():
  """Yields all the User objects."""
  current = GetCurrent()
  if current:
    # If this is the user's first login, we may have only just stored the
    # UserModel, so it might not be indexed yet; ensure that it's included.
    yield current
  for model in _UserModel.query():
    if not current or model.key.id() != current.id:
      yield User.FromModel(model)


def GetForEmail(email):
  """Gets (or if needed, creates) the User object for a given e-mail address."""
  # First see if the e-mail address is associated with a known Google Account
  # for which we have a corresponding UserModel.
  gae_user_id = _EmailToGaeUserId(email)
  if gae_user_id:
    ga = _GoogleAccount.get_by_id(gae_user_id)
    if ga:
      return Get(ga.uid)

  # Otherwise, look for a UserModel with the given e-mail address.
  model = _UserModel.query(_UserModel.email == email).get()
  if not model:
    # The ".test" TLD is reserved for testing.  For our test accounts, we make
    # the uid match the part of the address before '@' to simplify testing.
    if email[0] not in '0123456789' and email.endswith('.test'):
      uid = email.split('@')[0]  # guaranteed non-numeric
    else:
      uid = _GenerateNextUid()
    # We have the uid and the e-mail address for this user, but not ga_domain.
    # Initially assume no ga_domain; when the user logs in, the ga_domain
    # property will be updated by GetCurrent().
    model = _UserModel(id=uid, email=email, created=datetime.datetime.utcnow())
    model.put()

  # If we discovered a Google Account, associate it with the UserModel.
  if gae_user_id:
    _GoogleAccount(id=gae_user_id, uid=model.key.id()).put()
  return User.FromModel(model)


def SetWelcomeMessageDismissed(uid, value):
  """Sets the welcome_message_dismissed flag for a given user."""
  model = _GetModel(uid)
  model.welcome_message_dismissed = bool(value)
  model.put()


def SetMarketingConsent(uid, value):
  """Sets the marketing_consent flag for a given user."""
  model = _GetModel(uid)
  model.marketing_consent = bool(value)
  model.marketing_consent_answered = True
  model.put()


def GetLoginUrl(url):
  """Gets a URL that accepts a sign-in and then proceeds to the given URL."""
  if _IsDevelopmentServer():
    root_path = config.Get('root_path') or ''
    return root_path + '/.login?redirect=' + urllib.quote(url)
  return gae_users.create_login_url(url)


def GetLogoutUrl(url):
  """Gets a URL that signs the user out and then proceeds to the given URL."""
  if _IsDevelopmentServer():
    root_path = config.Get('root_path') or ''
    return root_path + '/.login?logout=1&redirect=' + urllib.quote(url)
  return gae_users.create_logout_url(url)
