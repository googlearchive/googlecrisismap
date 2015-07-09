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

import config
import domains
import model
import perms
import users
import utils
import webapp2
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


def SelectLanguageForRequest(request, map_root=None):
  """Determines the UI language to use, based on a request and a MapRoot."""
  return SelectLanguage(request.get('hl'),
                        request.headers.get('accept-language'),
                        map_root.get('default_language'))


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


def GetAuthForRequest(request):
  """Gets the Authorization record to use for a request."""
  api_key = request.get('key')
  if not api_key:
    return None
  if request.scheme != 'https':
    raise ApiError(403, 'HTTPS is required when using an API key.')
  auth = model.Authorization.Get(api_key)
  if not (auth and auth.is_enabled):
    raise ApiError(403, 'Invalid API key.')
  return auth


class RedirectToUrl(Exception):
  """An exception that redirects to a given URL."""

  def __init__(self, url):
    Exception.__init__(self, url)
    self.url = str(url)


class Error(Exception):
  """An error that carries an HTTP status and a message to show the user."""

  def __init__(self, status, message):
    Exception.__init__(self, message)
    self.status = status


class ApiError(Error):
  """An error that carries an HTTP status and a message to emit as text."""
  pass


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

  # In derived classes, set this to allow the page to be rendered in a frame.
  embeddable = False

  # These are used in RenderTemplate, so ensure they always exist.
  xsrf_token = ''
  xsrf_tag = ''

  # The default template for rendering an error message includes the product
  # logo, sign-in links, and left navigation links.  Individual page handlers
  # can override this to suit their context.
  error_template = 'error.html'

  def GetCurrentUserUrl(self):
    """Gets a URL identifying the current user.

    If the user is logged in, the URL will contain the user ID.  Otherwise,
    we'll use a randomly generated cookie to make a semi-stable user URL.

    Returns:
      A URL (under this app's root URL) that identifies the current user.
    """
    user = users.GetCurrent()
    if user:
      return self.GetUrlForUser(user)
    return self.GetUrlForAnonymousUser()

  def GetUrlForAnonymousUser(self):
    """Gets a semi-stable user URL using a randomly-generated cookie."""
    user_token = self.request.cookies.get('CR_USER') or utils.MakeRandomId()
    self.response.set_cookie('CR_USER', user_token, max_age=14*24*3600)
    return self.request.root_url + '/.users/anonymous.' + user_token

  def GetUrlForUser(self, user):
    """Gets a URL identifying a particular User entity known to this app."""
    return self.request.root_url + '/.users/' + user.id

  def GetUserForUrl(self, url):
    """Gets the User entity identified by a URL, or None if there is none."""
    if url and url.startswith('http:') and '/' in url:
      url_dir, uid = url.rsplit('/', 1)
      if url_dir == self.request.root_url + '/.users':
        if not uid.startswith('anonymous.'):
          return users.Get(uid)

  def CheckAccess(self):
    """If login_access_list is set, accept only the specified logins."""
    login_access_list = config.Get('login_access_list')
    if login_access_list is not None:
      user = users.GetCurrent()
      if not user:
        raise RedirectToUrl(users.GetLoginUrl(self.request.url))
      if user.email not in login_access_list:
        raise perms.AuthorizationError(user, None, None)

  def HandleRequest(self, **kwargs):
    """A wrapper around the Get or Post method defined in the handler class."""
    try:
      method = getattr(self, self.request.method.capitalize(), None)
      root_path = config.Get('root_path') or ''
      user = users.GetCurrent()

      if not method:
        raise Error(405, '%s method not allowed.' % self.request.method)

      # Enforce login restrictions.
      self.CheckAccess()

      # Set self.auth according to the API key in the request, if specified.
      self.auth = GetAuthForRequest(self.request)

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
      if user and self.request.method == 'POST':
        xsrf_token = self.request.get('xsrf_token', '')
        if not ValidateXsrfToken(user.id, xsrf_token):
          logging.warn('Bad xsrf_token %r for uid %r', xsrf_token, user.id)
          # The window might have been idle for a day; go somewhere reasonable.
          return self.redirect(root_path + '/.maps')

      # Fill in some useful request variables.
      self.request.lang = SelectLanguage(
          self.request.get('hl'), self.request.headers.get('accept-language'))
      self.request.root_path = root_path
      self.request.root_url = self.request.host_url + root_path

      # To prevent clickjacking attacks, disable framing by default.
      if not self.embeddable:
        self.response.headers['X-Frame-Options'] = 'DENY'

      # Call the handler, making nice pages for errors derived from Error.
      method(**kwargs)

    except RedirectToUrl as exception:
      return self.redirect(exception.url)
    except perms.AuthorizationError as exception:
      logging.error('AuthorizationError: %s', exception)
      self.response.set_status(403, message=exception.message)
      self.response.out.write(self.RenderTemplate('unauthorized.html', {
          'exception': exception,
          'login_url': users.GetLoginUrl(self.request.url)
      }))
    except perms.NotPublishableError as exception:
      logging.error('NotPublishableError: %s', exception)
      self.response.set_status(403, message=exception.message)
      self.response.out.write(self.RenderTemplate(self.error_template, {
          'exception': exception
      }))
    except perms.NotCatalogEntryOwnerError as exception:
      logging.error('NotCatalogEntryOwnerError: %s', exception)
      # TODO(kpy): Either add a template for this type of error, or use an
      # error representation that can be handled by one common error template.
      self.response.set_status(403, message=exception.message)
      self.response.out.write(self.RenderTemplate(self.error_template, {
          'exception': utils.Struct(
              message='That publication label is owned '
              'by someone else; you can\'t replace or delete it.')
      }))
    except ApiError as exception:
      logging.error('ApiError: %s', exception)
      self.response.set_status(exception.status, message=exception.message)
      self.response.headers['Content-Type'] = 'text/plain'
      self.response.out.write(exception.message + '\n')
    except Error as exception:
      logging.error('Error:%s', exception)
      self.response.set_status(exception.status, message=exception.message)
      self.response.out.write(self.RenderTemplate(self.error_template, {
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

  def GetRequestJson(self):
    """Gets JSON content from the request body or the 'json' query param."""
    json_data = (self.request.content_type == 'application/json' and
                 self.request.body or self.request.get('json'))
    try:
      return json.loads(json_data or 'null')
    except ValueError:
      raise ApiError(400, 'Invalid JSON data.')

  def WriteJson(self, data):
    """Writes out a JSON or JSONP serialization of the given data."""
    callback = self.request.get('callback', '')
    output = ToHtmlSafeJson(data)

    # Protect against attacks related to browser content sniffing (which
    # can result in the browser trying to execute our response using a
    # vulnerable plugin such as Flash or PDF)
    self.response.headers.update({
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'attachment; filename="f.txt"',
    })

    if callback:  # emit a JavaScript expression with a callback function
      self.response.headers['Content-Type'] = (
          'application/javascript; charset=utf-8')

      # Prepend response with a JS comment to be sure the user-supplied callback
      # name is not the first thing the browser sees.  This further reduces the
      # risk of a content sniffing attack.
      self.response.out.write('//\n' + SanitizeCallback(callback) +
                              '(' + output + ')')
    else:  # just emit the JSON literal
      self.response.headers['Content-Type'] = 'application/json; charset=utf-8'
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
