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
import os

import webapp2

import cache
import config
import maps
import model
import users


def ReadFile(filename):
  """Gets the contents of a file from either the app or static directory."""
  directory = os.path.dirname(__file__)
  try:
    return open(os.path.join(directory, filename)).read()
  except IOError:
    try:
      return open(os.path.join(directory, 'static', filename)).read()
    except IOError:
      return open(os.path.join(directory, 'resource', filename)).read()


class TestData(webapp2.RequestHandler):
  """Sets up test data (helpful for functional tests)."""

  def get(self):  # pylint: disable=g-bad-name
    """This endpoint is only for setting up data for system tests."""
    if not users.IsDeveloper():
      self.response.out.write('Not authorized.')
      return

    # For system tests, we pretend the app runs under "/crisismap".
    config.Set('root_path', '/crisismap')

    # Because there is no user logged in during system testing, we can't use
    # the usual access-controlled API (Map, CatalogEntry); we have to use
    # admin-level APIs (Config, MapModel, CatalogEntryModel, etc.) below.

    # Allow testing of behaviour controlled by flags in the ClientConfig.
    maps.ClientConfig.Create('google-test',
                             allowed_referer_domains=['google.com'],
                             hide_footer=True,
                             hide_share_button=True,
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

    # Add a catalog entry with label 'godzilla' pointing at our test map.
    config.Set('primary_domain', 'gmail.com')
    if not model.CatalogEntry.Get('gmail.com', 'godzilla'):
      model.CatalogEntryModel.Put(
          'test1', 'gmail.com', 'godzilla', model.Map.Get('1'), is_listed=True)
      cache.Delete([model.CatalogEntry, 'gmail.com', 'listed'])

    self.response.out.write('Test data written.')

  def PutTestMap(self, map_id, file_name, owner='test1', domain='gmail.test'):
    """Stores a test map in the datastore."""
    json_data = ReadFile(file_name)
    map_object = model.Map(model.MapModel(
        key_name=map_id, owners=[owner], editors=[], viewers=[], domain=domain,
        domains=[domain], domain_role=None, world_readable=True))
    map_root = json.loads(json_data)  # validate the JSON first
    new_version = model.MapVersionModel(
        parent=map_object.model, maproot_json=json_data)
    # Update the MapModel from fields in the MapRoot JSON.
    map_object.model.title = map_root.get('title', '')
    map_object.model.description = map_root.get('description', '')
    map_object.model.current_version = new_version.put()
    map_object.model.put()

app = webapp2.WSGIApplication([('.*', TestData)])
