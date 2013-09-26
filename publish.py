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

"""Endpoint for creating, updating, or deleting a CatalogEntry."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import re

import base_handler
import model


class Publish(base_handler.BaseHandler):
  """Handler for creating or updating a CatalogEntry."""

  def Post(self, domain, user):  # pylint: disable=unused-argument
    """Creates, updates, or removes a catalog entry."""
    label = self.request.get('label').strip()
    publisher_name = self.request.get('publisher_name').strip()
    if self.request.get('remove'):
      model.CatalogEntry.Delete(domain, label)
      self.redirect('.maps')
    else:
      if not re.match(r'^[\w-]+$', label):  # Valid if alphanumeric, -, _
        raise base_handler.Error(
            400, 'Valid labels may only contain letters, digits, "-", and "_".')
      map_object = model.Map.Get(self.request.get('map'))
      if not map_object:
        raise base_handler.Error(400, 'No such map.')

      # Preserve the "is_listed" flag if the CatalogEntry already exists.
      entry = (model.CatalogEntry.Get(domain, label) or
               model.CatalogEntry.Create(domain, label, map_object))
      entry.SetMapVersion(map_object)
      if publisher_name:
        entry.SetPublisherName(publisher_name)
      entry.Put()
      self.redirect('.maps')
