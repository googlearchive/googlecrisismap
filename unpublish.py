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

"""Endpoint for deletion of a CatalogEntry."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import webapp2

import base_handler
import model


class Unpublish(base_handler.BaseHandler):
  """Handler for deletion of a CatalogEntry."""

  def post(self):  # pylint: disable=g-bad-name
    domain = self.request.get('domain')
    label = self.request.get('label')
    model.CatalogEntry.Delete(domain, label)
    self.redirect('/crisismap/maps')

app = webapp2.WSGIApplication([(r'.*', Unpublish)])
