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

"""Handler for deleting a map and its related entities."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import webapp2
from base_handler import BaseHandler
import model


class Delete(BaseHandler):
  """Handler for deleting a map and its related entities."""

  # "post" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def post(self):
    map_id = self.request.get('map_id')
    self.DeleteMap(map_id)
    self.redirect('/crisismap/maps')

  def DeleteMap(self, map_id):
    # This method is not transactional because cross-entity group transactions
    # are limited and slow. Besides, if the method fail and some catalog
    # entries are not successfully deleted, the user can see this and try to
    # delete the map once again.
    entries = model.CatalogEntry.GetByMapId(map_id)
    for entry in entries:
      entry.Delete(entry.domain, entry.label)
    map_object = model.Map.Get(map_id)
    map_object.Delete()


app = webapp2.WSGIApplication([(r'.*', Delete)])
