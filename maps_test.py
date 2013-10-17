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
import domains
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
                       'custom_head_html': '',
                       'panel_side': 'right',
                       'panel_float': False,
                       'enable_editing': True,
                       'enable_osm_map_type': False,
                       'enable_osm_map_type_editing': False,
                       'minimal_map_controls': False,
                       'hide_panel_header': False,
                       'enable_layer_filter': False,
                       'google_api_key': '',
                       'use_tab_panel': False,
                       'use_details_tab': False},
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

  def testGetMapPickerItems(self):
    """Tests GetMapPickerItems()."""
    with test_utils.RootLogin():
      model.CatalogEntryModel(key_name='foo.com:m1', domain='foo.com',
                              label='m1', title='Map 1', is_listed=True).put()
      model.CatalogEntryModel(key_name='primary.com:m2', domain='primary.com',
                              label='m2', title='Map 2', is_listed=True).put()

    self.assertEquals([{'title': 'Map 1', 'url': '/root/foo.com/m1'}],
                      maps.GetMapPickerItems('foo.com', '/root'))
    self.assertEquals([{'title': 'Map 2', 'url': '/root/m2'}],
                      maps.GetMapPickerItems('primary.com', '/root'))

  def testClientConfigOverride(self):
    """Verifies that query parameters can override client config settings."""
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

  def testMapRegion(self):
    """Verifies that the 'region' property affects the Maps API URL."""
    with test_utils.RootLogin():
      domains.Domain.Create('x.com')
      m1 = model.Map.Create('{"title": "no region"}', 'x.com')
      m2 = model.Map.Create('{"title": "has region", "region": "in"}', 'x.com')

      cm_config = maps.GetConfig(test_utils.SetupRequest('/.maps/' + m1.id), m1)
      self.assertTrue('region=' not in cm_config['maps_api_url'])
      cm_config = maps.GetConfig(test_utils.SetupRequest('/.maps/' + m2.id), m2)
      self.assertTrue('region=in' in cm_config['maps_api_url'])

  def testMapIdInConfig_DraftMap(self):
    """Verifies the map ID is added to the map_root always."""
    with test_utils.RootLogin():
      my_map = test_utils.CreateMap()
      cfg = maps.GetConfig(test_utils.SetupRequest('/.maps/' + my_map.id),
                           my_map)
    self.assertEqual(my_map.id, cfg['map_root']['id'])

  def testMapIdInConfig_PublishedMap(self):
    with test_utils.RootLogin():
      my_map = test_utils.CreateMap()
      my_entry = model.CatalogEntry.Create(
          test_utils.DEFAULT_DOMAIN, 'label', my_map)
      cfg = maps.GetConfig(
          test_utils.SetupRequest('/a/%s/label' % test_utils.DEFAULT_DOMAIN),
          catalog_entry=my_entry)
    self.assertEqual(my_map.id, cfg['map_root']['id'])

  def testToPlainText(self):
    self.assertEquals('', maps.ToPlainText(None))
    self.assertEquals('', maps.ToPlainText(''))
    # Converts block tags to ' / ' and collapses ' / / ' to ' / '.
    self.assertEquals(' / paragraph with a / break', maps.ToPlainText(
        '<p>paragraph with a <br/> break</p>'))
    self.assertEquals('multiple / paragraph breaks', maps.ToPlainText(
        'multiple   <p>  <p> &nbsp;<p>   paragraph breaks'))
    # Strips out all other HTML tags.
    self.assertEquals(' / p in a ul with a span', maps.ToPlainText(
        '<ul><p>p in a ul with a <span>span</span></p><ul>'))
    # Preserves entity and charrefs.
    self.assertEquals('&amp;&#123;&#xf8;', maps.ToPlainText(
        '&amp;&#123;&#xf8;'))


class MapListTest(test_utils.BaseTest):
  """Tests for the map listing pages served by maps.py."""

  def testGet(self):
    """Tests the map listing page."""
    with test_utils.RootLogin():
      domains.Domain.Create('cows.net')
      domains.Domain.Create('dogs.org')
      m1 = model.Map.Create('{"title": "Moo"}', 'cows.net', viewers=['viewer'])
      m2 = model.Map.Create('{"title": "Arf"}', 'dogs.org', viewers=['viewer'])

    with test_utils.Login('viewer'):
      result = self.DoGet('/.maps').body
      self.assertTrue('Moo' in result, result)
      self.assertTrue('.maps/' + m1.id in result, result)
      self.assertTrue('Arf' in result, result)
      self.assertTrue('.maps/' + m2.id in result, result)

      result = self.DoGet('/dogs.org/.maps').body
      self.assertTrue('Moo' not in result, result)
      self.assertTrue('.maps/' + m1.id not in result, result)
      self.assertTrue('Arf' in result, result)
      self.assertTrue('.maps/' + m2.id in result, result)


if __name__ == '__main__':
  test_utils.main()
