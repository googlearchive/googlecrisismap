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

"""Handler for the list of published maps for a given domain."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import base_handler
import model


class Catalog(base_handler.BaseHandler):
  """Handler for the list of published maps for a given domain."""

  def Get(self, domain, user):  # pylint: disable=unused-argument
    """Displays the list of catalog entries."""
    self.response.out.write(self.RenderTemplate('catalog.html', {
        'domain': domain,
        'entries': model.CatalogEntry.GetAll(domain)
    }))

  def Post(self, domain, user):  # pylint: disable=unused-argument
    """Changes the visibility of catalog entries in Map Picker."""
    for entry in model.CatalogEntry.GetAll(domain):
      # Only checked checkboxes' values are sent from the client.
      value = bool(self.request.get(entry.label))
      if bool(entry.is_listed) != value:
        entry.is_listed = value
        entry.Put()
    self.redirect('.catalog')
