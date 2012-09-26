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

"""Puts metadata retrieval tasks into AppEngine push queue."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import logging
import simplejson as json

from base_handler import BaseHandler
# Enforce order for the rest of the imports.  enable-msg has to come just after
# the first import, or pylint will complain.  # pylint: enable=C6203,C6204
import maproot
import model

from google.appengine.api import taskqueue
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


class MetadataScheduler(BaseHandler):
  """Puts metadata retrieval tasks into AppEngine task queue."""

  # "get" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def get(self):
    """HTTP GET request handler to schedule metadata updates retrieval tasks.

    Layers of all world-readable maps are put into a AppEngine task queue to be
    processed by Retriever. Only layers with valid address and supported type
    are put into the task queue.
    """
    # TODO(cimamoglu): At some point in the future, this request handler will
    # time out for listing all the maps. It should be adapted to task queue
    # infrastructure. Details at cr/32997607 comments by kpy@.
    # This dictionary ensures same addresses are not put as different tasks.
    addresses = {}
    maproots = [m.GetCurrent().maproot_json
                for m in model.Map.GetAll() if m.world_readable]
    maproots += [entry.maproot_json
                 for entry in model.CatalogEntry.GetListed()]
    for maproot_json in maproots:
      json_object = json.loads(maproot_json)
      layers = maproot.GetAllLayers(json_object)
      for layer in layers:
        # Make sure the MapRoot has a type field.
        if 'type' not in layer:
          logging.error('Layer does not have a type!: %r', layer)
          continue
        layer_type = layer['type']

        address = maproot.GetSourceAddress(layer)
        # Make sure the same address isn't put into the task queue twice.
        if address in addresses:
          continue
        else:
          addresses[address] = True

        # Make sure the layer has a supported type.
        SUPPORTED_LAYER_TYPES = (maproot.LAYER_TYPE.KML,
                                 maproot.LAYER_TYPE.GEORSS)
        if layer_type not in SUPPORTED_LAYER_TYPES:
          continue

        # Make sure the layer has valid address.
        if not address:
          logging.error('Layer does not have a valid address: %r', layer)
          continue
        taskqueue.add(url='/crisismap/metadata_retriever', method='POST',
                      queue_name='metadata-queue',
                      params={'address': address, 'type': layer_type})


def main():
  run_wsgi_app(webapp.WSGIApplication([(r'.*', MetadataScheduler)]))


if __name__ == '__main__':
  main()
