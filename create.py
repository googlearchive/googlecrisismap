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

import base_handler
import model


class Create(base_handler.BaseHandler):
  """Handler that creates a new map."""

  def post(self, domain):  # pylint: disable=g-bad-name
    domain = self.request.get('domain', domain)
    if not domain:
      raise base_handler.Error(400, 'No domain specified.')
    domain_role = model.GetInitialDomainRole(domain)
    map_object = model.Map.Create(
        '{"title": "Untitled map"}', domain, domain_role=domain_role)
    self.redirect('.maps/%s' % map_object.id)


# The domain can come from the URL path or the 'domain' query parameter.
app = webapp2.WSGIApplication([(r'.*/([\w.-]+\.\w+)/.create', Create),
                               (r'.*/().create', Create)])
