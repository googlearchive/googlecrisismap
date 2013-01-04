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

"""Handler that creates a new map."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import webapp2
from base_handler import BaseHandler
import model

from google.appengine.api import users


class Create(BaseHandler):
  """Handler that creates a new map."""

  # "get" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def post(self):
    domain = model.GetUserDomain(users.get_current_user())
    domain_role = model.GetInitialDomainRole(domain)
    map_object = model.Map.Create(
        '{"title": "Untitled map"}', domains=[domain], domain_role=domain_role)
    self.redirect('/crisismap/maps/%s' % map_object.id)


app = webapp2.WSGIApplication([('.*', Create)])
