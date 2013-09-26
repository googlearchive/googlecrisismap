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

"""Main handler for displaying maps."""

__author__ = 'giencke@google.com (Pete Giencke)'

import json
import os
import urllib
import urlparse

import base_handler
import cache
import metadata
import model
import perms
import utils

from google.appengine.api import users
from google.appengine.ext import db

MAPS_API_BASE_URL = '//maps.google.com/maps/api/js'


def AllowDeveloperMode():
  """Returns True if running in development or accessed internally."""
  return ('Development' in os.environ.get('SERVER_SOFTWARE', '') or
          os.environ.get('TRUSTED_IP_REQUEST') or
          users.is_current_user_admin())


class ClientConfig(db.Model):
  """Client configuration allowing customization of the UI.

  The term client is used in the sense of Maps API Premier client, not browser
  or user.  ClientConfigs will be allocated to particular partners allowing
  them the ability to change some aspects of the UI when embedding on their
  site.  Key name: client ID, as specified in the 'client' URL param.
  """
  # List of referers who are allowed to use this client config
  allowed_referer_domains = db.StringListProperty()

  # Whether or not to hide the footer in the UI
  hide_footer = db.BooleanProperty(default=False)

  # Whether or not to hide the share button in the UI
  hide_share_button = db.BooleanProperty(default=False)

  # Whether or not to hide the "My Location" button in the UI
  hide_my_location_button = db.BooleanProperty(default=False)

  # Allow a callback parameter so an embedding page can receive and control
  # the map
  allow_embed_map_callback = db.BooleanProperty(default=False)

  # Whether or not to show the login state and links to sign in and sign out
  show_login = db.BooleanProperty(default=False)

  # The web property ID to use for tracking with Google Analytics
  # If unspecified, the default Crisis Map Analytics ID is assigned downstream.
  analytics_id = db.StringProperty(default='')

  # Whether or not to activate the editing UI
  enable_editing = db.BooleanProperty(default=False)

  # Whether to enable metadata pipeline
  enable_metadata_pipeline = db.BooleanProperty(default=False)

  # Which side to show the layers panel on ('left' or 'right')
  panel_side = db.StringProperty(default='right')

  # Whether to float the panel over the map (instead of docking it to the side)
  panel_float = db.BooleanProperty(default=False)

  # Whether to hide the Google+ sharing button in the Share box
  hide_google_plus_button = db.BooleanProperty(default=False)

  # Whether to hide the Facebook Like button in the Share box
  hide_facebook_button = db.BooleanProperty(default=False)

  # Whether to hide the Twitter sharing button in the Share box
  hide_twitter_button = db.BooleanProperty(default=False)


  # Whether to allow adding WMS layers in the map editor
  enable_wms_layer_editing = db.BooleanProperty(default=False)

  # Whether to display minimal map controls (small zoom control, no
  # scale control, no pegman).
  minimal_map_controls = db.BooleanProperty(default=False)

  # Whether to hide the map title and description from the panel.
  hide_panel_header = db.BooleanProperty(default=False)

  # Whether to show OpenStreetMap as a base map option to all users.
  enable_osm_map_type = db.BooleanProperty(default=False)

  # Whether to allow OpenStreetMap as a base map option in the editor.
  enable_osm_map_type_editing = db.BooleanProperty(default=False)

  # Note: When adding future settings, the default value should reflect the
  # behavior prior to the introduction of the new setting.  To avoid confusion
  # with None, the default value for Boolean settings should always be False.

  @classmethod
  def Create(cls, client_id, **kwargs):
    """Creates a ClientConfig entity for a given client_id.

    Args:
      client_id: A string, to use as the key for the model.
      **kwargs: Values for the properties of the ClientConfig entity (see the
          class definition for the list of available properties).
    Returns:
      A new ClientConfig entity.
    """
    return cls(key_name=client_id, **kwargs)

  def AsDict(self):
    """Converts this entity to a dict suitable for sending to the UI as JSON."""
    return dict((k, getattr(self, k)) for k in self.properties()
                if k != 'allowed_referer_domains')


def GetClientConfig(client_id, referer, dev_mode=False):
  """Returns the specified config if the client is permitted to use it.

  If the client_id is empty or invalid, or the referer doesn't have permission
  to use it, the 'default' configuration is returned.

  Args:
    client_id: A string or None, the client parameter from the URL.
    referer: A string or None, the "Referer" header from the request.
    dev_mode: If True, permit any config regardless of the "Referer" value.
  Returns:
    A dictionary containing the properties of the active ClientConfig.
  """
  client_id = client_id or 'default'
  client_config = ClientConfig.get_by_key_name(client_id)
  if client_config is None:
    return {}

  if dev_mode or client_id == 'default':
    return client_config.AsDict()

  referer_host = urlparse.urlparse(referer or '').hostname
  if referer_host:
    for allowed_domain in client_config.allowed_referer_domains:
      # referer_host is valid if it ends with allowed_domain and
      # the preceding character does not exist or is a dot.
      if (referer_host == allowed_domain or
          referer_host.endswith('.' + allowed_domain)):
        return client_config.AsDict()

  return {}


def GetMapMenuItems(domain, root_path):
  """Fetches the list of maps to show in the map picker menu for a given domain.

  Args:
    domain: A string, the domain whose catalog to fetch.
    root_path: The relative path to the Crisis Map site root.

  Returns:
    A list of {'title': ..., 'url': ...} dictionaries describing menu items
    corresponding to the CatalogEntry entities for the specified domain.
  """
  menu_items = []

  # Add menu items for the CatalogEntry entities that are marked 'listed'.
  if domain:
    if domain == model.Config.Get('primary_domain', ''):
      menu_items = [
          {'title': entry.title, 'url': root_path + '/' + entry.label}
          for entry in list(model.CatalogEntry.GetListed(domain))]
    else:
      menu_items = [
          {'title': entry.title,
           'url': root_path + '/%s/%s' % (entry.domain, entry.label)}
          for entry in list(model.CatalogEntry.GetListed(domain))]

  # Return all the menu items sorted by title.
  return sorted(menu_items, key=lambda m: m['title'])


def GetMapsApiClientId(host_port):
  """Determines the Maps API client ID to use."""
  hostname = host_port.split(':')[0]
  # "&client=google-crisis-response" only works for Google domains.
  for domain in ['google.org', 'google.com']:
    if hostname == domain or hostname.endswith('.' + domain):
      return 'google-crisis-response'
  # On localhost, development servers, etc., don't set a client ID, as it would
  # cause Maps API to disable itself with an "unauthorized" error message.
  return ''


def GetConfig(request, map_object=None, catalog_entry=None):
  dev_mode = request.get('dev') and AllowDeveloperMode()
  map_catalog = GetMapMenuItems(
      catalog_entry and catalog_entry.domain or
      model.Config.Get('primary_domain'), request.root_path)

  # Construct the URL for the Maps JavaScript API.
  api_url_params = {
      'sensor': 'false',
      'libraries': 'places,search,visualization,weather',
      'client': GetMapsApiClientId(request.host),
      'language': request.lang
  }
  ui_region = request.get('gl')
  if ui_region:
    api_url_params['region'] = ui_region
  maps_api_url = MAPS_API_BASE_URL + '?' + urllib.urlencode(api_url_params)

  # Fill the config dictionary.
  config = {
      'ui_lang': request.lang,
      'dev_mode': dev_mode,
      'user_email': utils.GetCurrentUserEmail(),
      'login_url': users.create_login_url(request.url),
      'logout_url': users.create_logout_url(request.url),
      'map_catalog': map_catalog,
      'maps_api_url': maps_api_url,
      # Each endpoint that the JS client code uses gets an entry in config.
      'json_proxy_url': request.root_path + '/.jsonp',
      'wms_configure_url': request.root_path + '/.wms/configure',
      'wms_tiles_url': request.root_path + '/.wms/tiles'
  }

  # Add settings from the selected client config, if any.
  config.update(GetClientConfig(request.get('client'),
                                request.headers.get('referer'), dev_mode))

  # Add the MapRoot data and other map-specific information.
  if catalog_entry:  # published map
    config['map_root'] = json.loads(catalog_entry.maproot_json)
    config['map_id'] = catalog_entry.map_id
    config['label'] = catalog_entry.label
    key = catalog_entry.map_version_key
  elif map_object:  # draft map
    config['map_root'] = json.loads(map_object.GetCurrentJson())
    config['map_id'] = map_object.id
    config['diff_url'] = request.root_path + '/.diff/' + map_object.id
    config['save_url'] = request.root_path + '/.api/maps/' + map_object.id
    config['share_url'] = request.root_path + '/.share/' + map_object.id
    config['api_maps_url'] = request.root_path + '/.api/maps'
    config['legend_url'] = request.root_path + '/.legend'
    config['wms_query_url'] = request.root_path + '/.wms/query'
    config['enable_editing'] = map_object.CheckAccess(perms.Role.MAP_EDITOR)
    config['draft_mode'] = True
    key = map_object.current_version_key
  if map_object or catalog_entry:
    cache_key, sources = metadata.CacheSourceAddresses(key, config['map_root'])
    config['metadata'] = dict((s, cache.Get(['metadata', s])) for s in sources)
    config['metadata_url'] = request.root_path + '/.metadata?key=' + cache_key
    metadata.ActivateSources(sources)

  if dev_mode:
    # In developer mode only, allow an arbitrary URL for MapRoot JSON.
    config['maproot_url'] = request.get('maproot_url', '')

    # To use a local copy of the Maps API, use dev=1&local_maps_api=1.
    if request.get('local_maps_api'):
      config['maps_api_url'] = request.root_path + '/.static/maps_api.js'

    # In developer mode only, allow query params to override the config.
    # Developers can also specify map_root directly as a query param.
    for name in ClientConfig.properties().keys() + ['map_root']:
      value = request.get(name)
      if value:
        config[name] = json.loads(value)

  return config


class MapByLabel(base_handler.BaseHandler):
  """Handler for displaying a published map by its domain and label."""

  def Get(self, label, domain=None):  # pylint: disable=g-bad-name
    """Displays a published map by its domain and publication label."""
    domain = domain or model.Config.Get('primary_domain', '')
    entry = model.CatalogEntry.Get(domain, label)
    if not entry:
      # Fall back to the map list for users that go to /crisismap/maps.
      # TODO(kpy): Remove this when the UI has a way to get to the map list.
      if label == 'maps':
        return self.redirect('.maps')
      raise base_handler.Error(404, 'Label %s/%s not found.' % (domain, label))
    config = GetConfig(self.request, catalog_entry=entry)
    config['label'] = label
    # Security note: cm_config_json is assumed to be safe JSON; all other
    # template variables must be escaped in the template.
    self.response.out.write(self.RenderTemplate('map.html', {
        'cm_config_json': base_handler.ToHtmlSafeJson(config),
        'ui_lang': self.request.lang,
        'maps_api_url': config['maps_api_url'],
        'hide_footer': config.get('hide_footer', False),
        'embedded': self.request.get('embedded', False)
    }))


class MapById(base_handler.BaseHandler):
  """Handler for displaying a map by its map ID."""

  def Get(self, map_id, domain=None):  # pylint: disable=g-bad-name
    """Displays a map in draft mode by its map ID."""
    map_object = model.Map.Get(map_id)
    if not map_object:
      raise base_handler.Error(404, 'Map %r not found.' % map_id)

    # TODO(kpy): Migrate MapModel to a single 'domain' instead of 'domains'.
    # (As of 2013-02-21, all existing non-deleted maps have one domain.)
    if not map_object.domains:
      raise base_handler.Error(500, 'Map %r has no domain.' % map_id)
    map_domain = map_object.domains[0]

    if not domain or domain != map_domain:
      # The canonical URL for a map contains both the domain and the map ID.
      url = '../%s/.maps/%s' % (map_domain, map_id)
      if self.request.GET:  # preserve query params on redirect
        url += '?' + urllib.urlencode(self.request.GET.items())
      return self.redirect(url)

    config = GetConfig(self.request, map_object=map_object)
    # Security note: cm_config_json is assumed to be safe JSON; all other
    # template variables must be escaped in the template.
    self.response.out.write(self.RenderTemplate('map.html', {
        'cm_config_json': base_handler.ToHtmlSafeJson(config),
        'ui_lang': self.request.lang,
        'maps_api_url': config['maps_api_url'],
        'hide_footer': config.get('hide_footer', False),
        'embedded': self.request.get('embedded', False)
    }))


class MapList(base_handler.BaseHandler):
  """Handler for the user's list of maps."""

  def Get(self, user, domain=None):  # pylint: disable=g-bad-name
    """Produces the map listing page."""
    maps = list(model.Map.GetViewable(user, domain))
    creator_domains = perms.GetDomainsWithRole(perms.Role.MAP_CREATOR)
    catalog_domains = perms.GetDomainsWithRole(perms.Role.CATALOG_EDITOR)
    title = 'Maps for all domains'
    if domain:
      title = 'Maps for %s' % domain
      creator_domains = [domain]

    # Attach to each Map a 'catalog_entries' attribute with a list of the
    # CatalogEntry objects that link to that Map.
    published = {}
    for entry in model.CatalogEntry.GetAll():
      published.setdefault(entry.map_id, []).append(entry)
    for m in maps:
      m.catalog_entries = published.get(m.id, [])

    self.response.out.write(self.RenderTemplate('map_list.html', {
        'title': title,
        'maps': maps,
        'creator_domains': creator_domains,
        'catalog_domains': catalog_domains
    }))
