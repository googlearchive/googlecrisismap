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

"""Puts metadata retrieval tasks into AppEngine push queue."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import json
import logging

import webapp2

import base_handler
import maproot
import model

from google.appengine.api import taskqueue

SUPPORTED_LAYER_TYPES = [maproot.LayerType.KML, maproot.LayerType.GEORSS]


# TODO(cimamoglu): At some point in the future, this request handler will
# time out for listing all the maps. It should be adapted to task queue
# infrastructure. Details at cr/32997607 comments by kpy@.
def ScheduleTasks():
  """Puts layers into a task queue to be processed by MetadataRetriever.

  Only layers with a valid address and supported type are queued.
  """
  # This dictionary is used to ensure that duplicate addresses are not queued.
  addresses = {}

  maproots = [m.GetCurrent().maproot_json for m in model.Map.GetAll()
              if m.world_readable
             ] + [entry.maproot_json for entry in model.CatalogEntry.GetAll()]
  for maproot_json in maproots:
    for layer in maproot.GetAllLayers(json.loads(maproot_json)):
      # Ensure that the layer type is supported.
      layer_type = layer.get('type', '')
      if layer_type not in SUPPORTED_LAYER_TYPES:
        logging.info('Skipping %r; type %r not supported', layer, layer_type)
        continue

      # Ensure that the layer has a valid address.
      address = maproot.GetSourceAddress(layer)
      if not address:
        logging.error('Skipping %r: no valid address', layer)
        continue

      # Make sure the same address isn't put into the task queue twice.
      if address not in addresses:
        addresses[address] = True
        taskqueue.add(url='/crisismap/metadata_retriever', method='POST',
                      queue_name='metadata',
                      params={'type': layer_type, 'address': address})


class MetadataScheduler(base_handler.BaseHandler):
  """Puts metadata retrieval tasks into AppEngine task queue."""

  def get(self):  # pylint: disable=g-bad-name
    """Schedules metadata retrieval tasks."""
    model.DoAsAdmin(ScheduleTasks)  # need admin access to scan all maps


app = webapp2.WSGIApplication([(r'.*', MetadataScheduler)])
