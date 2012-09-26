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

"""Handler that creates a new map."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

# App Engine requires that this come first.  # pylint: disable-msg=C6203,C6204
from google.appengine.dist import use_library
use_library('django', '1.2')

import model
from base_handler import BaseHandler

from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


class Create(BaseHandler):
  """Handler that creates a new map."""

  # "get" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def post(self):
    map_object = model.Map.Create(
        '{"title": "Untitled map"}',
        domains=[model.GetUserDomain(users.get_current_user())],
        domain_role=model.ROLES.MAP_EDITOR)
    self.redirect('/crisismap/maps/%s' % map_object.id)


def main():
  run_wsgi_app(webapp.WSGIApplication([('.*', Create)]))

if __name__ == '__main__':
  main()
