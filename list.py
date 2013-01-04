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

"""Handler for the user's list of maps."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

# base_handler must come first. pylint:disable=g-bad-import-order
from base_handler import BaseHandler
import webapp2
import model
from google.appengine.api import users


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
    for map_ in maps:
      map_.catalog_entries = published.get(map_.id, [])

    self.response.out.write(self.RenderTemplate('list.html', {
        'maps': maps,
        'publishing_domains': model.GetCatalogDomains(),
        'user_domain': model.GetUserDomain(users.get_current_user())
    }))


app = webapp2.WSGIApplication([(r'.*', List)])
