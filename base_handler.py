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

import os

import webapp2

import model
# pylint: disable=g-import-not-at-top
try:
  import languages
except ImportError:
  languages = model.Struct(ALL_LANGUAGES=['en'])

from google.appengine.api import users
from google.appengine.ext.webapp import template

# A mapping from deprecated ISO language codes to valid ones.
LANGUAGE_SYNONYMS = {'he': 'iw', 'in': 'id', 'mo': 'ro', 'jw': 'jv', 'ji': 'yi'}


def NormalizeLang(lang):
  lang = lang.lower()
  return LANGUAGE_SYNONYMS.get(lang, lang).replace('-', '_')

DEFAULT_LANGUAGE = 'en'
ALL_LANGUAGES = map(NormalizeLang, languages.ALL_LANGUAGES)


def SelectSupportedLanguage(language_codes):
  """Selects a supported language based on a list of preferred languages.

  Checks through the user-supplied list of languages, and picks the first
  one that we support. If none are supported, returns the default language.

  Args:
    language_codes: A string, a comma-separated list of BCP 47 language codes.

  Returns:
    The BCP 47 language code of a supported UI language.
  """
  for lang in map(NormalizeLang, language_codes.split(',')):
    if lang in ALL_LANGUAGES:
      return lang
    first = lang.split('_')[0]
    if first in ALL_LANGUAGES:
      return first
  return DEFAULT_LANGUAGE


def ActivateLanguage(hl_param=None, accept_lang=None):
  """Determines the UI language to use.

  This function takes as input the hl query parameter and the Accept-Language
  header, decides what language the UI should be rendered in, and activates
  Django translations for that language.

  Args:
    hl_param: A string or None (the hl query parameter).
    accept_lang: A string or None (the value of the Accept-Language header).

  Returns:
    A language code indicating the UI language to use.
  """
  if hl_param:
    lang = SelectSupportedLanguage(hl_param)
  elif accept_lang:
    lang = SelectSupportedLanguage(accept_lang)
  else:
    lang = DEFAULT_LANGUAGE
  return lang


class Error(Exception):
  """General error that carries a message with it."""
  pass


class BaseHandler(webapp2.RequestHandler):
  """Base class for operations that could through an AuthorizationError."""

  @staticmethod
  def RenderTemplate(template_name, context=None):
    """Renders a template from the templates/ directory.

    Args:
      template_name: A string, the filename of the template to render.
      context: An optional dictionary of template variables.
    Returns:
      A string, the rendered template.
    """
    path = os.path.join(os.path.dirname(__file__), 'templates', template_name)
    return template.render(path, context or {})

  def initialize(self, request, response):  # pylint: disable=g-bad-name
    # webapp2 __init__ calls initialize automatically - we call it again
    # ourselves.
    if request is None:
      return
    super(BaseHandler, self).initialize(request, response)
    self.request.lang = ActivateLanguage(
        request.get('hl'), request.headers.get('accept-language'))

  def handle_exception(self, exception, debug):  # pylint: disable=g-bad-name
    """Render a basic error template on failure to access protected content."""
    self.response.set_status(403, message=exception.message)
    if isinstance(exception, model.AuthorizationError):
      self.response.out.write(self.RenderTemplate('unauthorized.html', {
          'exception': exception,
          'login_url': users.create_login_url(self.request.url)
      }))
    elif isinstance(exception, Error):
      self.response.out.write(self.RenderTemplate('error.html', {
          'exception': exception
      }))
    else:
      super(BaseHandler, self).handle_exception(exception, debug)
