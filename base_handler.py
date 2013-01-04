#!/usr/bin/python2.5
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

# App Engine requires that this come first.  # pylint: disable-msg=C6203,C6204
from google.appengine.dist import use_library
use_library('django', '1.2')
# We can't enforce order for the rest of the imports; no matter where we insert
# "pylint: enable=...", pylint still complains. :(

import os
from django.utils import translation
import model
try:
  import languages
except ImportError:
  languages = model.Struct(ALL_LANGUAGES=['en'])

from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template


def NormalizeLang(lang):
  return lang.lower().replace('-', '_')

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
  translation.activate(lang)
  return lang


class Error(Exception):
  """General error that carries a message with it."""
  pass


class BaseHandler(webapp.RequestHandler):
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

  # initialize() is part of RequestHandler.  # pylint: disable=C6409
  def initialize(self, request, response):
    super(BaseHandler, self).initialize(request, response)
    self.request.lang = ActivateLanguage(
        request.get('hl'), request.headers.get('accept-language'))

  # handle_exception() is part of RequestHandler.  # pylint: disable=C6409
  def handle_exception(self, exception, debug_mode):
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
      super(BaseHandler, self).handle_exception(exception, debug_mode)
