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

"""A base class providing common functionality for request handlers."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import hmac
import httplib
import inspect
import json
import logging
import os
import re
import time

import webapp2

import config
import domains
import perms
import users
import utils
# pylint: disable=g-import-not-at-top
try:
  import languages
except ImportError:
  languages = utils.Struct(ALL_LANGUAGES=['en'])

from google.appengine.ext.webapp import template

# A mapping from deprecated ISO language codes to valid ones.
CANONICAL_LANGS = {'he': 'iw', 'in': 'id', 'mo': 'ro', 'jw': 'jv', 'ji': 'yi'}


def NormalizeLang(lang):
  """Normalizes a language code to conventional BCP 47 form, e.g. "en-CA"."""
  language, region = (lang.strip().replace('_', '-').split('-') + [''])[:2]
  language, region = language.lower(), region.upper()
  return CANONICAL_LANGS.get(language, language) + (region and '-' + region)

DEFAULT_LANGUAGE = 'en'
ALL_LANGUAGES = map(NormalizeLang, languages.ALL_LANGUAGES)


def SelectSupportedLanguage(language_codes):
  """Selects a supported language based on a list of preferred languages.

  Checks through the user-supplied list of languages, and picks the first
  one that we support. If none are supported, returns None.

  Args:
    language_codes: A string, a comma-separated list of BCP 47 language codes.

  Returns:
    The BCP 47 language code of a supported UI language or None.
  """
  for lang in map(NormalizeLang, language_codes.split(',')):
    if lang in ALL_LANGUAGES:
      return lang
    first = lang.split('-')[0]
    if first in ALL_LANGUAGES:
      return first
  return None


def SelectLanguage(*langs):
  """Determines the UI language to use.

  This function expects a variable-length parameter list, each of which is
  either a language code or a comma-separated list of language codes.
  After flattening the list, this returns the first valid language encountered,
  so the caller should supply the language parameters in order of decreasing
  priority.

  Args:
    *langs: A variable length list of language codes, or comma-separated lists
            of language codes (some or all may be None).

  Returns:
    A language code indicating the UI language to use. Defaults to
    DEFAULT_LANGUAGE if all parameters are invalid codes or None.
  """
  for lang in langs:
    if lang:
      supported_lang = SelectSupportedLanguage(lang)
      if supported_lang:
        return supported_lang
  # All arguments were None or invalid.
  return DEFAULT_LANGUAGE


def ToHtmlSafeJson(data, **kwargs):
  """Serializes a JSON data structure to JSON that is safe for use in HTML."""
  return json.dumps(data, **kwargs).replace(
      '&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e')


def GenerateXsrfToken(uid, timestamp=None):
  """Generates a timestamped XSRF-prevention token scoped to the given uid."""
  timestamp = str(timestamp or int(time.time()))
  hmac_key = config.GetGeneratedKey('xsrf_key')
  return timestamp + ':' + hmac.new(hmac_key, timestamp + ':' + uid).hexdigest()


def ValidateXsrfToken(uid, token):
  """Returns True if an XSRF token is valid for uid and at most 4 hours old."""
  timestamp = token.split(':')[0]
  return (timestamp and time.time() < int(timestamp) + 4*3600 and
          token == GenerateXsrfToken(uid, timestamp))


def SanitizeCallback(callback):
  """Checks and returns a safe JSONP callback name, or raises an error.

  Args:
    callback: A JavaScript callback function name.

  Returns:
    The callback name, only if it is a valid JavaScript identifier optionally
    preceded by other identifiers with dots (e.g. "object1.child2.name3").

  Raises:
    Error: If the callback name was invalid.
  """
  if re.match(r'^([a-zA-Z_]\w*\.)*[a-zA-Z_]\w*$', callback):
    return callback
  raise Error(httplib.BAD_REQUEST, 'Invalid callback name.')


class Error(Exception):
  """An error that carries an HTTP status and a message to show the user."""

  def __init__(self, status, message):
    Exception.__init__(self, message)
    self.status = status


class BaseHandler(webapp2.RequestHandler):
  """Base class for request handlers.

  Subclasses should define methods named 'Get' and/or 'Post'.
    - If the method has a required (or optional) argument named 'domain', then
      a domain is required (or permitted) in the path or in a 'domain' query
      parameter (see main.OptionalDomainRoute), and the domain will be passed
      in as that argument.
    - If the method has a required (or optional) argument named 'user', then
      user sign-in is required (or optional) for that handler, and the User
      object will be passed in as that argument.
    - Other arguments to the method should appear in <angle_brackets> in the
      corresponding route's path pattern (see the routing table in main.py).
  """

  # These are used in RenderTemplate, so ensure they always exist.
  xsrf_token = ''
  xsrf_tag = ''

  def HandleRequest(self, **kwargs):
    """A wrapper around the Get or Post method defined in the handler class."""
    try:
      method = getattr(self, self.request.method.capitalize(), None)
      if not method:
        raise Error(405, '%s method not allowed.' % self.request.method)
      root_path = config.Get('root_path') or ''
      user = users.GetCurrent()

      # Require/allow domain name and user sign-in based on whether the method
      # takes arguments named 'domain' and 'user'.
      args, _, _, defaults = inspect.getargspec(method)
      required_args = args[:len(args) - len(defaults or [])]
      if 'domain' in kwargs and 'domain' not in args:
        raise Error(404, 'Not found.')
      if 'domain' in required_args and 'domain' not in kwargs:
        raise Error(400, 'Domain not specified.')
      if 'user' in args:
        kwargs['user'] = user
      if 'user' in required_args and not user:
        return self.redirect(users.GetLoginUrl(self.request.url))

      # Prepare an XSRF token if the user is signed in.
      if user:
        self.xsrf_token = GenerateXsrfToken(user.id)
        self.xsrf_tag = ('<input type="hidden" name="xsrf_token" value="%s">' %
                         self.xsrf_token)

      # Require a valid XSRF token for all authenticated POST requests.
      if user and method.__name__ == 'Post':
        xsrf_token = self.request.get('xsrf_token', '')
        if not ValidateXsrfToken(user.id, xsrf_token):
          logging.warn('Bad xsrf_token %r for uid %r', xsrf_token, user.id)
          # The window might have been idle for a day; go somewhere reasonable.
          return self.redirect(root_path + '/.maps')

      # Fill in some useful request variables.
      self.request.lang = SelectLanguage(
          self.request.get('hl'), self.request.headers.get('accept-language'))
      self.request.root_path = root_path

      # Call the handler, making nice pages for errors derived from Error.
      method(**kwargs)

    except perms.AuthorizationError as exception:
      self.response.set_status(403, message=exception.message)
      self.response.out.write(self.RenderTemplate('unauthorized.html', {
          'exception': exception,
          'login_url': users.GetLoginUrl(self.request.url)
      }))
    except perms.NotPublishableError as exception:
      self.response.set_status(403, message=exception.message)
      self.response.out.write(self.RenderTemplate('error.html', {
          'exception': exception
      }))
    except perms.NotCatalogEntryOwnerError as exception:
      # TODO(kpy): Either add a template for this type of error, or use an
      # error representation that can be handled by one common error template.
      self.response.set_status(403, message=exception.message)
      self.response.out.write(self.RenderTemplate('error.html', {
          'exception': utils.Struct(
              message='That publication label is owned '
              'by someone else; you can\'t replace or delete it.')
      }))
    except Error as exception:
      self.response.set_status(exception.status, message=exception.message)
      self.response.out.write(self.RenderTemplate('error.html', {
          'exception': exception
      }))

  get = HandleRequest
  post = HandleRequest

  def RenderTemplate(self, template_name, context):
    """Renders a template from the templates/ directory.

    Args:
      template_name: A string, the filename of the template to render.
      context: An optional dictionary of template variables.  A few variables
          are automatically added to this context:
            - {{root}} is the root_path of the app
            - {{user}} is the signed-in user
            - {{login_url}} is a URL to a sign-in page
            - {{logout_url}} is a URL that signs the user out
            - {{navbar}} contains variables used by the navigation sidebar
    Returns:
      A string, the rendered template.
    """
    path = os.path.join(os.path.dirname(__file__), 'templates', template_name)
    root = config.Get('root_path') or ''
    user = users.GetCurrent()
    context = dict(context, root=root, user=user, xsrf_tag=self.xsrf_tag,
                   login_url=users.GetLoginUrl(self.request.url),
                   logout_url=users.GetLogoutUrl(root + '/.maps'),
                   navbar=self._GetNavbarContext(user))
    return template.render(path, context)

  def WriteJson(self, data):
    """Writes out a JSON or JSONP serialization of the given data."""
    callback = self.request.get('callback', '')
    output = ToHtmlSafeJson(data)
    if callback:  # emit a JavaScript expression with a callback function
      self.response.headers['Content-Type'] = 'application/javascript'
      self.response.out.write(SanitizeCallback(callback) + '(' + output + ')')
    else:  # just emit the JSON literal
      self.response.headers['Content-Type'] = 'application/json'
      self.response.out.write(output)

  def _GetNavbarContext(self, user):
    get_domains = lambda role: sorted(perms.GetAccessibleDomains(user, role))
    return user and {
        'admin_domains': get_domains(perms.Role.DOMAIN_ADMIN),
        'catalog_domains': get_domains(perms.Role.CATALOG_EDITOR),
        'creator_domains': get_domains(perms.Role.MAP_CREATOR),
        'domain_exists': domains.Domain.Get(user.email_domain),
        'is_admin': perms.CheckAccess(perms.Role.ADMIN)
    } or {}
