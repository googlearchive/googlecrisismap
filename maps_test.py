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

"""Tests for maps.py."""

__author__ = 'shakusa@google.com (Steve Hakusa)'

import config
import maps
import model
import test_utils


class MapTest(test_utils.BaseTest):
  """Tests for single-map pages served by maps.py."""

  def setUp(self):
    test_utils.BaseTest.setUp(self)
    config.Set('primary_domain', 'primary.com')

  def testGetClientConfig(self):
    """Confirms that GetClientConfig sets up the correct JS parameters."""

    analytics_id = 'US-foo'
    client_config = maps.ClientConfig.Create(
        'goog-test',
        allowed_referer_domains=['google.org', 'cr.appspot.com'],
        hide_footer=True,
        hide_share_button=True,
        hide_my_location_button=True,
        allow_embed_map_callback=True,
        show_login=True,
        analytics_id=analytics_id,
        enable_editing=True)
    client_config.put()

    self.assertEquals({'hide_share_button': True,
                       'hide_my_location_button': True,
                       'hide_footer': True,
                       'allow_embed_map_callback': True,
                       'show_login': True,
                       'hide_google_plus_button': False,
                       'hide_facebook_button': False,
                       'hide_twitter_button': False,
                       'analytics_id': analytics_id,
                       'panel_side': 'right',
                       'panel_float': False,
                       'enable_editing': True,
                       'enable_metadata_pipeline': False,
                       'enable_osm_map_type': False,
                       'enable_osm_map_type_editing': False,
                       'enable_wms_layer_editing': False,
                       'minimal_map_controls': False,
                       'hide_panel_header': False},
                      client_config.AsDict())

    config_dict = client_config.AsDict()

    # Try invalid referers.
    self.assertEquals({}, maps.GetClientConfig(None, None))
    self.assertEquals({}, maps.GetClientConfig('', ''))
    self.assertEquals({}, maps.GetClientConfig('goog-test', None))

    # Try referers that aren't allowed to use this config.
    self.assertEquals({}, maps.GetClientConfig(
        'goog-test', 'http://foo.appspot.com'))
    self.assertEquals({}, maps.GetClientConfig(
        'goog-test', 'http://fakegoogle.org'))
    # Try a nonexistent config.
    self.assertEquals({}, maps.GetClientConfig(
        'goog-test2', 'http://cr.appspot.com'))

    # Try referers that should be allowed to use this config.
    self.assertEquals(config_dict, maps.GetClientConfig(
        'goog-test', None, dev_mode=True))
    self.assertEquals(config_dict, maps.GetClientConfig(
        'goog-test', 'http://cr.appspot.com'))
    self.assertEquals(config_dict, maps.GetClientConfig(
        'goog-test', 'https://www.google.org'))

    # test that setting default overrides even without a referer domain.
    maps.ClientConfig.Create('default', enable_editing=True).put()
    self.assertTrue(maps.GetClientConfig(None, None)['enable_editing'])

  def testGetMapMenuItems(self):
    """Tests GetMapMenuItems()."""
    test_utils.BecomeAdmin()
    model.CatalogEntryModel(key_name='foo.com:m1', domain='foo.com',
                            label='m1', title='Map 1', is_listed=True).put()
    model.CatalogEntryModel(key_name='primary.com:m2', domain='primary.com',
                            label='m2', title='Map 2', is_listed=True).put()

    self.assertEquals([{'title': 'Map 1', 'url': '/root/foo.com/m1'}],
                      maps.GetMapMenuItems('foo.com', '/root'))
    self.assertEquals([{'title': 'Map 2', 'url': '/root/m2'}],
                      maps.GetMapMenuItems('primary.com', '/root'))

  def testClientConfigOverride(self):
    """Verifies that query parameters can override client config settings."""
    test_utils.BecomeAdmin()
    cm_config = maps.GetConfig(test_utils.SetupRequest('/?dev=1&show_login=1'))
    self.assertEquals(True, cm_config['show_login'])

  def testGetMapsApiClientId(self):
    """Tests the GetMapsApiClientId method."""
    self.assertEquals('google-crisis-response',
                      maps.GetMapsApiClientId('google.com'))
    self.assertEquals('google-crisis-response',
                      maps.GetMapsApiClientId('google.org'))
    self.assertEquals('google-crisis-response',
                      maps.GetMapsApiClientId('foo.google.com'))
    self.assertEquals('google-crisis-response',
                      maps.GetMapsApiClientId('foo.google.com:8000'))
    self.assertEquals('', maps.GetMapsApiClientId('localhost'))
    self.assertEquals('', maps.GetMapsApiClientId('localhost:8000'))
    self.assertEquals('', maps.GetMapsApiClientId('foo.appspot.com'))
    self.assertEquals('', maps.GetMapsApiClientId('foo.googleplex.com'))

  def testMapsApiUrlI18n(self):
    """Verifies that language and region are set correctly for the Maps API."""
    cm_config = maps.GetConfig(test_utils.SetupRequest('/'))
    self.assertTrue('language=en' in cm_config['maps_api_url'])
    self.assertFalse('region=' in cm_config['maps_api_url'])

    cm_config = maps.GetConfig(test_utils.SetupRequest('/?hl=ja', 'ja'))
    self.assertTrue('language=ja' in cm_config['maps_api_url'])
    self.assertFalse('region=' in cm_config['maps_api_url'])

    cm_config = maps.GetConfig(test_utils.SetupRequest('/?hl=th&gl=IN', 'th'))
    self.assertTrue('language=th' in cm_config['maps_api_url'])
    self.assertTrue('region=IN' in cm_config['maps_api_url'])


class MapListTest(test_utils.BaseTest):
  """Tests for the map listing pages served by maps.py."""

  def testGet(self):
    """Tests the map listing page."""
    test_utils.BecomeAdmin()
    m1 = model.Map.Create('{"title": "Moo"}', 'cows.net', viewers=['x@y.com'])
    m2 = model.Map.Create('{"title": "Arf"}', 'dogs.org', viewers=['x@y.com'])
    test_utils.SetUser('x@y.com')

    result = test_utils.DoGet('/.maps').body
    self.assertTrue('Moo' in result, result)
    self.assertTrue('.maps/' + m1.id in result, result)
    self.assertTrue('Arf' in result, result)
    self.assertTrue('.maps/' + m2.id in result, result)

    result = test_utils.DoGet('/dogs.org/.maps').body
    self.assertTrue('Moo' not in result, result)
    self.assertTrue('.maps/' + m1.id not in result, result)
    self.assertTrue('Arf' in result, result)
    self.assertTrue('.maps/' + m2.id in result, result)

if __name__ == '__main__':
  test_utils.main()
