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

"""An HTTP API for fetching and saving map definitions."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import json

import base_handler
import model


class MapById(base_handler.BaseHandler):
  """An HTTP API for fetching and saving map definitions."""

  def Get(self, map_id, domain=''):  # pylint: disable=unused-argument
    """Returns the MapRoot JSON for the specified map."""
    map_object = model.Map.Get(map_id)
    if map_object:
      self.WriteJson({
          'json': json.loads(map_object.GetCurrentJson() or 'null')
      })
    else:
      self.error(404)
      self.response.out.write('Map %s not found' % map_id)

  def Post(self, map_id, domain=''):  # pylint: disable=unused-argument
    """Stores a new version of the MapRoot JSON for the specified map."""
    map_object = model.Map.Get(map_id)
    if map_object:
      map_object.PutNewVersion(self.request.get('json'))
      self.response.set_status(201)
    else:
      self.error(404)
      self.response.out.write('Map %s not found' % map_id)


class PublishedMaps(base_handler.BaseHandler):
  """Handler for fetching the JSON of all published maps."""

  def Get(self, domain=''):  # pylint: disable=unused-argument
    root = self.request.root_path
    self.WriteJson([{'url': root + '/%s/%s' % (entry.domain, entry.label),
                     'maproot': json.loads(entry.maproot_json)}
                    for entry in model.CatalogEntry.GetAll()])
