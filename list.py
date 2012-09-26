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

"""Handler for the user's list of maps."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

# App Engine requires that this come first.  # pylint: disable-msg=C6203,C6204
from google.appengine.dist import use_library
use_library('django', '1.2')

from base_handler import BaseHandler
# Enforce order for the rest of the imports.  enable-msg has to come just after
# the first import, or pylint will complain.  # pylint: enable-msg=C6203,C6204
import model
from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


class List(BaseHandler):
  """Handler for the user's list of maps."""

  # "get" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def get(self):
    # Attach to each Map a 'catalog_entries' attribute containing the
    # CatalogEntry entities that link to it.
    entries = model.CatalogEntry.GetAll()
    maps = list(model.Map.GetViewable())
    published = {}
    for entry in entries:
      published.setdefault(entry.map_id, []).append(entry)
    for map in maps:
      map.catalog_entries = published.get(map.id, [])

    self.response.out.write(self.RenderTemplate('list.html', {
        'maps': maps,
        'publishing_domains': model.GetCatalogDomains(),
        'user_domain': model.GetUserDomain(users.get_current_user())
    }))


def main():
  run_wsgi_app(webapp.WSGIApplication([(r'.*', List)]))

if __name__ == '__main__':
  main()
