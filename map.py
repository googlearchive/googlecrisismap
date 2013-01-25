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

import base64
import hmac
import json
import logging
import os
import urllib
import urlparse

import webapp2

import base_handler
import jsonp
import maproot
import model

from google.appengine.api import memcache
from google.appengine.api import users
from google.appengine.ext import db

MAPS_API_BASE_URL = '//maps.google.com/maps/api/js'

# The default lifetime for cached layer address data in seconds.
DEFAULT_LAYER_ADDRESS_CACHE_SECONDS = 10 * 60


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


  # Whether to display minimal map controls (small zoom control, no
  # scale control, no pegman).
  minimal_map_controls = db.BooleanProperty(default=False)

  # Whether to hide the map title and description from the panel.
  hide_panel_header = db.BooleanProperty(default=False)

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


def GetMapMenuItems(domain=None):
  """Fetches the list of maps to show in the map picker menu for a given domain.

  Args:
    domain: A string, the domain whose catalog to fetch.

  Returns:
    A list of {'title': ..., 'url': ...} dictionaries describing menu items
    corresponding to the CatalogEntry entities for the specified domain.
  """
  menu_items = []

  # Add menu items for the CatalogEntry entities that are marked 'listed'.
  if domain:
    if domain == model.Config.Get('default_publisher_domain'):
      menu_items = [
          {'title': entry.title,
           'url': '/crisismap/%s' % entry.label}
          for entry in list(model.CatalogEntry.GetListedInDomain(domain))]
    else:
      menu_items = [
          {'title': entry.title,
           'url': '/crisismap/a/%s/%s' % (entry.domain, entry.label)}
          for entry in list(model.CatalogEntry.GetListedInDomain(domain))]

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


def CacheLayerAddresses(map_object=None, catalog_entry=None,
                        ttl_seconds=DEFAULT_LAYER_ADDRESS_CACHE_SECONDS):
  """Caches the addresses of layers of a particular map version.

  The address of a layer can be a URL or other kind of information (e.g. for
  Fusion Table).

  Args:
    map_object: The optional MapVersion object to display.
    catalog_entry: The optional CatalogEntry pointing at the map to display.
        The caller should specify either map_object or catalog_entry; if
        both are given, catalog_entry is ignored. If neither is given, then
        the function simply returns.
    ttl_seconds: An integer number of seconds to keep the value in the cache.

  Returns:
    If successful, the key of the map version in the cache. It is computed
    through HMAC-MD5 with a secret key, map ID and map version ID.
    Otherwise, None is returned.
  """
  if not map_object and not catalog_entry:
    logging.error('Layer address caching needs a Map or CatalogEntry!')
    return None
  map_id = map_version = json_object = None
  if catalog_entry:
    map_id = catalog_entry.map_id
    map_version = catalog_entry.map_version_id
    json_object = json.loads(catalog_entry.maproot_json)
  if map_object:
    map_id = map_object.id
    map_version = map_object.GetCurrent().id
    json_object = json.loads(map_object.GetCurrentJson())

  addresses = map(maproot.GetSourceAddress, maproot.GetAllLayers(json_object))
  addresses = sorted(address for address in addresses if address)
  hmac_key = str(model.Config.GetOrInsert(
      'layer_address_hmac_key', str(base64.urlsafe_b64encode(os.urandom(30)))))
  key = hmac.new(hmac_key, map_id + '.' + str(map_version)).hexdigest()
  return key if memcache.set(key, addresses, ttl_seconds) else None


def GetConfig(request, map_object=None, catalog_entry=None):
  """Gathers a dictionary of parameters to pass to the JavaScript code.

  This object is exported as JSON and becomes visible as "cm_config" to
  the crisismap.js library.

  Args:
    request: The webapp2 Request object.
    map_object: The optional Map object to display.
    catalog_entry: The optional CatalogEntry pointing at the map to display.
        The caller should specify either map_object or catalog_entry; if
        both are given, catalog_entry is ignored.

  Returns:
    A dictionary object containing the following keys:
      - ui_lang: The BCP 47 language code for the user interface.
      - user_email: The e-mail address of the currently user, if logged in.
      - login_url: URL to the account login page.
      - logout_url: URL to log the user out.
      - map_root: The map content to display, in MapRoot format.
      - map_id: The ID of the stored map from which map_root was loaded.
      - maproot_url: URL of a MapRoot file to fetch (for development only).
      - map_catalog: Dictionary of metadata for maps to list in the
          map picker dropdown menu.
      - maps_api_url: URL from which to load the Google Maps API.
      - save_url: A URL to which to POST data to save the edited map.
      - dev_mode: True if developer mode is enabled.
      - get_module_url: A function for mapping the baseUrl, module name pair to
          a url for the corresponding module.  Currently not set by crisismaps,
          but its needed for Cartewheel.
      - metadata_url: The URL for this map to make metadata requests. It
          contains the relevant memcache key as the token parameter.
  """
  dev_mode = request.get('dev') and AllowDeveloperMode()
  user = users.get_current_user()
  map_catalog = GetMapMenuItems(catalog_entry and catalog_entry.domain or
                                model.Config.Get('default_publisher_domain'))

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
      'user_email': user and user.email(),
      'login_url': users.create_login_url(request.url),
      'logout_url': users.create_logout_url(request.url),
      'map_catalog': map_catalog,
      'maps_api_url': maps_api_url
  }

  # If we have MapRoot data from the datastore, include it.
  if catalog_entry:
    config['map_root'] = json.loads(catalog_entry.maproot_json)
    config['map_id'] = catalog_entry.map_id
    config['label'] = catalog_entry.label
  elif map_object:
    config['map_root'] = json.loads(map_object.GetCurrentJson())
    config['map_id'] = map_object.id
    config['save_url'] = '/crisismap/api/maps/%s' % map_object.id
    config['share_url'] = '/crisismap/share/%s' % map_object.id
    config['enable_editing'] = map_object.CheckAccess(model.Role.MAP_EDITOR)
    config['draft_mode'] = True
  if map_object or catalog_entry:
    config['metadata_url'] = ('/crisismap/metadata?token=%s' %
                              CacheLayerAddresses(map_object, catalog_entry))

  # Add settings from the selected client config, if any.
  config.update(GetClientConfig(request.get('client'),
                                request.headers.get('referer'), dev_mode))

  if dev_mode:
    # In developer mode only, allow an arbitrary URL for MapRoot JSON.
    config['maproot_url'] = request.get('maproot_url', '')

    # To use a local copy of the Maps API, use dev=1&local_maps_api=1.
    if request.get('local_maps_api'):
      config['maps_api_url'] = '/crisismap/static/maps_api.js'

    # In developer mode only, allow query params to override the config.
    # Developers can also specify map_root directly as a query param.
    for name in ClientConfig.properties().keys() + ['map_root']:
      value = request.get(name)
      if value:
        config[name] = json.loads(value)

  return config


class MapByLabel(base_handler.BaseHandler):
  """Handler for displaying a published map by its domain and label."""

  def get(self, domain, label):  # pylint: disable=g-bad-name
    domain = domain or model.Config.Get('default_publisher_domain', '')
    config = GetConfig(
        self.request, None, model.CatalogEntry.Get(domain, label))
    config['label'] = label
    # Security note: cm_config_json is assumed to be safe JSON; all other
    # template variables must be escaped in the template.
    self.response.out.write(self.RenderTemplate('map.html', {
        'cm_config_json': jsonp.ToHtmlSafeJson(config),
        'ui_lang': self.request.lang,
        'maps_api_url': config['maps_api_url'],
        'hide_footer': config.get('hide_footer', False),
        'embedded': self.request.get('embedded', False)
    }))


class MapById(base_handler.BaseHandler):
  """Handler for displaying a map by its map ID."""

  def get(self, map_id):  # pylint: disable=g-bad-name
    map_object = model.Map.Get(map_id)
    if not map_object:
      self.error(404)
      self.response.out.write('Map %r not found.' % map_id)
    else:
      config = GetConfig(self.request, map_object)
      # Security note: cm_config_json is assumed to be safe JSON; all other
      # template variables must be escaped in the template.
      self.response.out.write(self.RenderTemplate('map.html', {
          'cm_config_json': jsonp.ToHtmlSafeJson(config),
          'ui_lang': self.request.lang,
          'maps_api_url': config['maps_api_url'],
          'hide_footer': config.get('hide_footer', False),
          'embedded': self.request.get('embedded', False)
      }))

app = webapp2.WSGIApplication([
    (r'/crisismap/()([\w-]+)', MapByLabel),  # default domain
    (r'/crisismap/a/([\w.-]+)/([\w-]+)', MapByLabel),  # specified domain
    (r'/crisismap/maps/([\w-]+)', MapById)
])
