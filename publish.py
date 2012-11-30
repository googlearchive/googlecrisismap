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

"""Endpoint for creating or updating a CatalogEntry."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

# App Engine requires that this come first.  # pylint: disable-msg=C6203,C6204
from google.appengine.dist import use_library
use_library('django', '1.2')

import re

from base_handler import BaseHandler
# Enforce order for the rest of the imports.  enable-msg has to come just after
# the first import, or pylint will complain.  # pylint: enable-msg=C6203,C6204
import base_handler
import model

from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


class Publish(BaseHandler):
  """Handler for creating or updating a CatalogEntry."""

  # "post" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def post(self):
    """Adds or updates a catalog entry."""
    domain = self.request.get('domain')
    label = self.request.get('label').strip()
    map_id = self.request.get('map_id')
    map_object = model.Map.Get(map_id)
    if re.match(r'^[\w\-]+$', label):  # Valid if alphanumeric, -, _
      # Preserve the "is_listed" flag if the CatalogEntry already exists.
      entry = (model.CatalogEntry.Get(domain, label) or
               model.CatalogEntry.Create(domain, label, map_object))
      entry.SetMapVersion(map_object)
      entry.Put()
      self.redirect('/crisismap/maps')
    else:
      raise base_handler.Error(
          'The label of the map must contain only alphanumeric characters,'
          ' "-", "_", and must not be empty.')


def main():
  run_wsgi_app(webapp.WSGIApplication([(r'.*', Publish)]))


if __name__ == '__main__':
  main()
