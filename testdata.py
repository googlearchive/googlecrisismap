#!/usr/bin/python
# Copyright 2014 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Sets up test data for functional testing."""

__author__ = 'shakusa@google.com (Steve Hakusa)'

import json

import base_handler
import config
import maps
import model
import utils
import webapp2


class TestData(base_handler.BaseHandler):
  """Sets up test data (helpful for functional tests)."""

  def get(self):  # pylint: disable=g-bad-name
    """This endpoint is only for setting up data for system tests."""
    _CheckIsDevServer()

    # For system tests, we pretend the app runs under "/crisismap".
    config.Set('root_path', '/crisismap')

    # Because there is no user logged in during system testing, we can't use
    # the usual access-controlled API (Map, CatalogEntry); we have to use
    # admin-level APIs (Config, MapModel, CatalogEntryModel, etc.) below.

    # Allow testing of behaviour controlled by flags in the ClientConfig.
    maps.ClientConfig.Create(
        'google-test',
        allowed_referer_domains=['google.com'],
        urlshortener_api_url=('http://' + self.request.host +
                              '/testbackend?service=urlshortener'),
        hide_footer=True,
        hide_share_button=False,
        hide_my_location_button=True,
        allow_embed_map_callback=True).put()

    # Allow tests of the tabbed UI.
    maps.ClientConfig.Create('google-test-tab',
                             allowed_referer_domains=['google.com'],
                             use_tab_panel=True).put()

    # Add the godzilla test map to the datastore with map ID '1'.
    self.PutTestMap('1', 'godzilla.json')

    # Add the test_maproot test map to the datastore with map ID '2'
    self.PutTestMap('2', 'test_maproot.json')

    # Add the gas_stations (with crowd reports) test map with map ID '3'.
    self.PutTestMap('3', 'gas_stations.json')


    # Add sharks test map with map ID '10'.
    sharks_maproot = _GetSharksMaproot(self.request.host)
    self.PutTestMapJson('10', sharks_maproot, json.dumps(sharks_maproot))

    # Add catalog entries for some of the test maps
    config.Set('primary_domain', 'gmail.com')
    model.CatalogEntryModel.Put(
        'test1', 'gmail.com', 'godzilla', model.Map.Get('1'), is_listed=True)
    model.CatalogEntryModel.Put(
        'test1', 'gmail.com', 'gas-stations', model.Map.Get('3'),
        is_listed=True)
    model.CatalogEntryModel.Put(
        'test1', 'gmail.com', 'sharks', model.Map.Get('10'), is_listed=True)
    model.CatalogEntry.FlushCaches('gmail.com')

    self.response.out.write('Test data written.')

  def PutTestMap(self, map_id, file_name):
    """Stores a test map from a given file into the datastore."""
    maproot_json = utils.ReadStaticFile(file_name)
    self.PutTestMapJson(map_id, json.loads(maproot_json), maproot_json)

  def PutTestMapJson(self, map_id, map_root, maproot_json, owner='test1',
                     domain='gmail.test'):
    """Stores a test map from a given maproot in the datastore."""
    map_object = model.Map(model.MapModel(
        key_name=map_id, owners=[owner], editors=[], viewers=[], domain=domain,
        domains=[domain], domain_role=None, world_readable=True))
    new_version = model.MapVersionModel(
        parent=map_object.model, maproot_json=maproot_json)
    # Update the MapModel from fields in the MapRoot JSON.
    map_object.model.title = map_root.get('title', '')
    map_object.model.description = map_root.get('description', '')
    map_object.model.current_version = new_version.put()

    map_object.model.put()


# Function for creating a maproot dictionary for a Sharks map that points at
# a KML file served locally by testbackend handler. This is to avoid any
# external requests in tests.
def _GetSharksMaproot(host):
  """Creates a maproot dictionary for a Sharks map with KML layer.

  Layer KML file is served locally by testbackend handler. This is to avoid any
  external web requests in tests.

  Args:
    host: CrisisMap host name with port
  Returns:
    Maproot dictionary
  """
  return {
      'id': 'id2015030311642',
      'title': 'Sharks tests',
      'layers': [{
          'title': 'Sharks',
          'source': {
              'kml': {
                  'url': ('http://%s/testbackend?service=file'
                          '&filename=sharks.kml' % host)
              }
          },
          'type': 'KML',
          'id': 'layer0'

      }],
      'topics': [{
          'title': 'Sharks',
          'id': 'sharks-topic',
          'layer_ids': ['layer0'],

      }]
  }


def _CheckIsDevServer():
  if not utils.IsDevelopmentServer():
    raise base_handler.Error(500, 'testbackend is only accessible in DEV')


app = webapp2.WSGIApplication([('.*', TestData)])
