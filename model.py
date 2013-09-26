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

"""Data model and related access permissions."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import base64
import datetime
import json
import os
import random

import cache
import domains
import perms
import utils

from google.appengine.ext import db

# A datetime value to represent null (the datastore cannot query on None).
NEVER = datetime.datetime.utcfromtimestamp(0)


def DoAsAdmin(function, *args, **kwargs):
  """Executes a function with admin privileges for the duration of the call."""
  original_info = {
      'USER_IS_ADMIN': os.environ.get('USER_IS_ADMIN', '0'),
      'USER_EMAIL': os.environ.get('USER_EMAIL', ''),
      'USER_ID': os.environ.get('USER_ID', '')
  }
  try:
    os.environ.update({
        'USER_IS_ADMIN': '1',
        'USER_EMAIL': 'root@google.com',
        'USER_ID': '0'
    })
    return function(*args, **kwargs)
  finally:
    os.environ.update(original_info)


class MapVersionModel(db.Model):
  """A particular version of the JSON content of a Map.

  NOTE: This class is private to this module; outside code should use the Map
  class to create or access versions.

  If this entity is constructed properly, its parent entity will be a MapModel.
  """

  # The JSON string representing the map content, in MapRoot format.
  maproot_json = db.TextProperty()

  # Fields below are metadata for those with edit access, not for public
  # display.  No last_updated field is needed; these objects are immutable.
  creator = db.UserProperty(auto_current_user_add=True)
  created = db.DateTimeProperty(auto_now_add=True)


class MapModel(db.Model):
  """A single map object and its associated metadata; parent of its versions.

  NOTE: This class is private to this module; outside code should use the Map
  class to create or access maps.

  The key_name is a unique map name chosen by the creator.  The latest version
  of the map is what's shown to viewers.
  """

  # Title for the current version.  Cached from the current version for display.
  # Plain text.
  title = db.StringProperty()

  # HTML description of the map.  Cached from current version for display.
  description = db.TextProperty()

  # Metadata for auditing and debugging purposes.
  created = db.DateTimeProperty(auto_now_add=True)
  creator = db.UserProperty(auto_current_user_add=True)
  last_updated = db.DateTimeProperty(auto_now=True)
  last_updater = db.UserProperty(auto_current_user=True)

  # To mark a map as deleted, set this to anything other than NEVER; the map
  # won't be returned by Map.Get* methods, though it remains in the datastore.
  deleted = db.DateTimeProperty(default=NEVER)
  deleter = db.UserProperty()

  # To mark a map as blocked, set this to anything other than NEVER; then only
  # the first owner can view or edit the map, and the map cannot be published.
  blocked = db.DateTimeProperty(default=NEVER)
  blocker = db.UserProperty()

  # List of users who can set the flags and permission lists on this object.
  owners = db.StringListProperty()

  # List of individual users who can edit this map.
  editors = db.StringListProperty()

  # List of individual users who can view the current version of this map.
  viewers = db.StringListProperty()

  # List of domains that this map belongs to.
  # TODO(kpy): Replace this with a single required StringProperty.
  # CAUTION: for not google domains this is potentially problematic,
  # since there may not be a google apps domain that corresponds to the
  # gaia ids (and hence no management).
  domains = db.StringListProperty()

  # Default role for users in one of the domains listed in the domains property.
  # domain_role can be set to admin, but we won't honor it.
  domain_role = db.StringProperty(choices=list(perms.Role))

  # World-readable maps can be viewed by anyone.
  world_readable = db.BooleanProperty(default=False)

  # Cache of the most recent MapVersion.
  current_version = db.ReferenceProperty(reference_class=MapVersionModel)


class CatalogEntryModel(db.Model):
  """A mapping from a (publisher domain, publication label) pair to a map.

  NOTE: This class is private to this module; outside code should use the
  CatalogEntry class to create or access catalog entries.

  The existence of a CatalogEntryModel with key_name "<domain>:<label>" causes
  the map to be available at the URL .../crisismap/a/<domain>/<label>.
  The catalog entry is like a snapshot; it points at a single MapVersionModel,
  so changes to the Map (i.e. new versions of the Map content) don't appear at
  .../crisismap/foo until the catalog entry is repointed at the new version.

  Each domain has a menu of maps (an instance of cm.MapPicker) that is shown
  on all the published map pages for that domain.  The menu shows a subset of
  the catalog entries in that domain, as selected by the is_listed flag.
  """

  # The domain and label (these are redundant with the key_name of the entity,
  # but broken out as separate properties so queries can filter on them).
  domain = db.StringProperty()
  label = db.StringProperty()

  # Metadata about the catalog entry itself.
  creator = db.UserProperty(auto_current_user_add=True)
  created = db.DateTimeProperty(auto_now_add=True)
  last_updated = db.DateTimeProperty(auto_now=True)
  last_updater = db.UserProperty(auto_current_user=True)

  # The displayed title (in the crisis picker).  Set from the map_object.
  title = db.StringProperty()

  # The publisher name to display in the footer and below the map
  # title, in view-mode only.
  publisher_name = db.StringProperty()

  # The key_name of the map_version's parent MapModel (this is redundant with
  # map_version, but broken out as a property so queries can filter on it).
  map_id = db.StringProperty()

  # Reference to the map version published by this catalog entry.
  map_version = db.ReferenceProperty(MapVersionModel)

  # If true, this entry is shown in its domain's cm.MapPicker menu.
  is_listed = db.BooleanProperty(default=False)

  @staticmethod
  def Get(domain, label):
    return CatalogEntryModel.get_by_key_name(domain + ':' + label)

  @staticmethod
  def GetAll(domain=None):
    """Yields all CatalogEntryModels in reverse update order."""
    query = CatalogEntryModel.all().order('-last_updated')
    if domain:
      query = query.filter('domain =', domain)
    return query

  @staticmethod
  def GetListed(domain=None):
    """Yields all the listed CatalogEntryModels in reverse update order."""
    return CatalogEntryModel.GetAll(domain).filter('is_listed =', True)

  @staticmethod
  def Create(domain, label, map_object, is_listed=False):
    """Stores a CatalogEntryModel pointing at the map's current version."""
    entity = CatalogEntryModel(key_name=domain + ':' + label, domain=domain,
                               label=label, title=map_object.title,
                               map_id=map_object.id,
                               map_version=map_object.GetCurrent().key,
                               is_listed=is_listed)
    entity.put()
    return entity


class CatalogEntry(object):
  """An access control wrapper around the CatalogEntryModel entity.

  All access from outside this module should go through CatalogEntry (never
  CatalogEntryModel).  Entries should always be created via CatalogEntry.Create.

  The MapRoot JSON content of a CatalogEntry is always considered publicly
  readable, independent of the permission settings on the Map object.
  """

  def __init__(self, catalog_entry_model):
    """Constructor not to be called directly.  Use Create instead."""
    self.model = catalog_entry_model

  @staticmethod
  def Get(domain, label):
    """Returns the CatalogEntry for a domain and label if it exists, or None."""
    # We reserve the label 'empty' in all domains for a catalog entry pointing
    # at the empty map.  Handy for development.
    if label == 'empty':
      return EmptyCatalogEntry(domain)

    # No access control; all catalog entries are publicly visible.
    model = CatalogEntryModel.Get(domain, label)
    return model and CatalogEntry(model)

  @staticmethod
  def GetAll(domain=None):
    """Gets all entries, possibly filtered by domain."""
    # No access control; all catalog entries are publicly visible.
    # We use '*' in the cache key for the list that includes all domains.
    return cache.Get(
        [CatalogEntry, domain or '*', 'all'],
        lambda: map(CatalogEntry, CatalogEntryModel.GetAll(domain)))

  @staticmethod
  def GetListed(domain=None):
    """Gets all entries marked listed, possibly filtered by domain."""
    # No access control; all catalog entries are publicly visible.
    # We use '*' in the cache key for the list that includes all domains.
    return cache.Get(
        [CatalogEntry, domain or '*', 'listed'],
        lambda: map(CatalogEntry, CatalogEntryModel.GetListed(domain)))

  @staticmethod
  def GetByMapId(map_id):
    """Returns all entries that point at a particular map."""
    return [CatalogEntry(model)
            for model in CatalogEntryModel.GetAll().filter('map_id =', map_id)]

  @staticmethod
  def Create(domain, label, map_object, is_listed=False):
    """Stores a new CatalogEntry with version set to the map's current version.

    If a CatalogEntry already exists with the same label, it is overwritten.

    Args:
      domain: The domain in which to create the CatalogEntry.
      label: The publication label to use for this map.
      map_object: The Map object whose current version to use.
      is_listed: If True, show this entry in the map picker menu.
    Returns:
      The new CatalogEntry object.
    Raises:
      ValueError: If the domain string is invalid.
    """
    domain = str(domain)  # accommodate Unicode strings
    if ':' in domain:
      raise ValueError('Invalid domain %r' % domain)
    perms.AssertAccess(perms.Role.CATALOG_EDITOR, domain)
    perms.AssertAccess(perms.Role.MAP_VIEWER, map_object)
    perms.AssertPublishable(map_object)
    model = CatalogEntryModel.Create(domain, label, map_object, is_listed)

    # We use '*' in the cache key for the list that includes all domains.
    cache.Delete([CatalogEntry, '*', 'all'])
    cache.Delete([CatalogEntry, '*', 'listed'])
    cache.Delete([CatalogEntry, domain, 'all'])
    cache.Delete([CatalogEntry, domain, 'listed'])
    return CatalogEntry(model)

  @staticmethod
  def Delete(domain_name, label):
    """Deletes an existing CatalogEntry.

    Args:
      domain_name: The domain to which the CatalogEntry belongs.
      label: The publication label.

    Raises:
      ValueError: if there's no CatalogEntry with the given domain and label.
    """
    domain_name = str(domain_name)  # accommodate Unicode strings
    domain = domains.Domain.Get(domain_name)
    entry = CatalogEntryModel.Get(domain_name, label)
    if not entry:
      raise ValueError('No CatalogEntry %r in domain %r' % (label, domain_name))
    if not domain:
      raise ValueError('Unknown domain %r' % domain_name)
    perms.AssertAccess(perms.Role.CATALOG_EDITOR, domain_name)
    if domain.has_sticky_catalog_entries:
      # When catalog entries are sticky, only the label creator or a
      # domain admin may delete a label
      email = utils.GetCurrentUserEmail()
      if email != utils.NormalizeEmail(entry.creator.email()):
        perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain_name)
    entry.delete()
    # We use '*' in the cache key for the list that includes all domains.
    cache.Delete([CatalogEntry, '*', 'all'])
    cache.Delete([CatalogEntry, '*', 'listed'])
    cache.Delete([CatalogEntry, domain_name, 'all'])
    cache.Delete([CatalogEntry, domain_name, 'listed'])

  # TODO(kpy): Make Delete and DeleteByMapId both take a user argument, and
  # reuse Delete here by calling it with an admin user.
  @staticmethod
  def DeleteByMapId(map_id):
    """NO ACCESS CHECK.  Deletes every CatalogEntry pointing at a given map."""
    for entry in CatalogEntry.GetByMapId(map_id):
      domain, label = str(entry.domain), entry.label
      entry = CatalogEntryModel.Get(domain, label)
      entry.delete()
      # We use '*' in the cache key for the list that includes all domains.
      cache.Delete([CatalogEntry, '*', 'all'])
      cache.Delete([CatalogEntry, '*', 'listed'])
      cache.Delete([CatalogEntry, domain, 'all'])
      cache.Delete([CatalogEntry, domain, 'listed'])

  is_listed = property(
      lambda self: self.model.is_listed,
      lambda self, value: setattr(self.model, 'is_listed', value))

  # The datastore key of this catalog entry's MapVersionModel.
  def GetMapVersionKey(self):
    return CatalogEntryModel.map_version.get_value_for_datastore(self.model)
  map_version_key = property(GetMapVersionKey)

  # maproot_json gets the (possibly cached) MapRoot JSON for this entry.
  def GetMaprootJson(self):
    return cache.Get([CatalogEntry, self.domain, self.label, 'json'],
                     lambda: self.model.map_version.maproot_json)
  maproot_json = property(GetMaprootJson)

  # Make the other properties of the CatalogEntryModel visible on CatalogEntry.
  for x in ['domain', 'label', 'map_id', 'title', 'publisher_name',
            'creator', 'created', 'last_updated', 'last_updater']:
    locals()[x] = property(lambda self, x=x: getattr(self.model, x))

  def SetMapVersion(self, map_object):
    """Points this entry at the specified MapVersionModel."""
    self.model.map_id = map_object.id
    self.model.map_version = map_object.GetCurrent().key
    self.model.title = map_object.title

  def SetPublisherName(self, publisher_name):
    """Sets the publisher name to be displayed in the map viewer."""
    self.model.publisher_name = publisher_name

  def Put(self):
    """Saves any modifications to the datastore."""
    domain = str(self.domain)  # accommodate Unicode strings
    perms.AssertAccess(perms.Role.CATALOG_EDITOR, domain)
    self.model.put()
    # We use '*' in the cache key for the list that includes all domains.
    cache.Delete([CatalogEntry, '*', 'all'])
    cache.Delete([CatalogEntry, '*', 'listed'])
    cache.Delete([CatalogEntry, domain, 'all'])
    cache.Delete([CatalogEntry, domain, 'listed'])
    cache.Delete([CatalogEntry, domain, self.label, 'json'])


class Map(object):
  """An access control wrapper around the MapModel entity.

  All access from outside this module should go through Map (never MapModel).
  Maps should always be created with Map.Create, which ensures that every map
  has at least one version.
  """

  # NOTE(kpy): Every public static method or public impure method should
  # call self.AssertAccess(...) first!

  NAMESPACE = 'Map'  # cache namespace

  def __init__(self, map_model):
    """Constructor not to be called directly."""
    self.model = map_model

  def __eq__(self, other):
    return isinstance(other, Map) and self.model.key() == other.model.key()

  def __hash__(self):
    return hash(self.model)

  # The datastore key for this map's MapModel entity.
  key = property(lambda self: self.model.key())

  # The datastore key for this map's latest MapVersionModel.
  current_version_key = property(
      lambda self: MapModel.current_version.get_value_for_datastore(self.model))

  # Map IDs are in base64, so they are safely convertible from Unicode to ASCII.
  id = property(lambda self: str(self.model.key().name()))

  # Make the other properties of the underlying MapModel readable on the Map.
  for x in ['creator', 'created', 'last_updated', 'last_updater',
            'blocked', 'blocker', 'deleted', 'deleter',
            'title', 'description', 'current_version', 'world_readable',
            'owners', 'editors', 'viewers', 'domains', 'domain_role']:
    locals()[x] = property(lambda self, x=x: getattr(self.model, x))

  # Handy Boolean access to the blocked or deleted status.
  is_deleted = property(lambda self: self.deleted != NEVER)
  is_blocked = property(lambda self: self.blocked != NEVER)

  @staticmethod
  def get(key):  # lowercase to match db.Model.get  # pylint: disable=g-bad-name
    return Map(MapModel.get(key))

  @staticmethod
  def _GetAll(domain=None):
    """NO ACCESS CHECK.  Yields all non-deleted maps; can filter by domain."""
    query = MapModel.all().filter('deleted =', NEVER)
    if domain:
      query = query.filter('domains =', domain)
    for model in query.order('-last_updated'):
      yield Map(model)

  @staticmethod
  def GetAll(domain=None):
    """Yields all non-deleted maps, possibly filtered by domain."""
    perms.AssertAccess(perms.Role.ADMIN)
    return Map._GetAll(domain)

  @staticmethod
  def GetViewable(user, domain=None):
    """Yields all maps visible to the user, possibly filtered by domain."""
    # TODO(lschumacher): This probably won't scale to a large number of maps.
    # Also, we should only project the fields we want.
    # Share the AccessPolicy object to avoid fetching access lists repeatedly.
    policy = perms.AccessPolicy()
    for m in Map._GetAll(domain):
      if m.CheckAccess(perms.Role.MAP_VIEWER, user, policy=policy):
        yield m

  @staticmethod
  def Get(key_name):
    """Gets a Map by its map ID (key_name), or returns None if none exists."""
    # We reserve the special ID '0' for an empty map.  Handy for development.
    if key_name == '0':
      return EmptyMap()
    model = MapModel.get_by_key_name(key_name)
    if model and model.deleted == NEVER:
      map_object = Map(model)
      map_object.AssertAccess(perms.Role.MAP_VIEWER)
      return map_object

  @staticmethod
  def GetDeleted(key_name):
    """Gets a deleted Map by its ID.  Returns None if no map or not deleted."""
    perms.AssertAccess(perms.Role.ADMIN)
    model = MapModel.get_by_key_name(key_name)
    return model and model.deleted != NEVER and Map(model)

  @staticmethod
  def Create(maproot_json, domain, owners=None, editors=None, viewers=None,
             world_readable=False):
    """Stores a new map with the given properties and MapRoot JSON content."""
    # maproot_json must be syntactically valid JSON, but otherwise any JSON
    # object is allowed; we don't check for MapRoot validity here.

    # TODO(rew): Change the domain argument to take a domains.Domain instead
    # of a string
    domain_obj = domains.Domain.Get(domain)
    if not domain_obj:
      raise domains.UnknownDomainError(domain)
    domain = domain_obj
    perms.AssertAccess(perms.Role.MAP_CREATOR, domain.name)
    if owners is None:
      # TODO(kpy): Take user as an argument instead of calling GetCurrentUser.
      owners = [utils.GetCurrentUserEmail()]
    if editors is None:
      editors = []
    if viewers is None:
      viewers = []
    if domain.initial_domain_role != domains.NO_ROLE:
      map_creators = [p.subject for p
                      in perms.Query(None, perms.Role.MAP_CREATOR, domain.name)]
      if domain.initial_domain_role == perms.Role.MAP_OWNER:
        owners = list(set(owners + map_creators))
      elif domain.initial_domain_role == perms.Role.MAP_EDITOR:
        editors = list(set(editors + map_creators))
      else:
        viewers = list(set(viewers + map_creators))

    # urlsafe_b64encode encodes 12 random bytes as exactly 16 characters,
    # which can include digits, letters, hyphens, and underscores.  Because
    # the length is a multiple of 4, it won't have trailing "=" signs.
    map_object = Map(MapModel(
        key_name=base64.urlsafe_b64encode(
            ''.join(chr(random.randrange(256)) for i in xrange(12))),
        owners=owners, editors=editors, viewers=viewers, domains=[domain.name],
        domain_role=domain.initial_domain_role, world_readable=world_readable))
    map_object.PutNewVersion(maproot_json)  # also puts the MapModel
    return map_object

  @staticmethod
  def _GetVersionByKey(key):
    """NO ACCESS CHECK.  Returns a map version by its datastore entity key."""
    return utils.StructFromModel(MapVersionModel.get(key))

  def PutNewVersion(self, maproot_json):
    """Stores a new MapVersionModel object for this Map and returns its ID."""
    self.AssertAccess(perms.Role.MAP_EDITOR)
    maproot = json.loads(maproot_json)  # validate the JSON first

    new_version = MapVersionModel(parent=self.model, maproot_json=maproot_json)
    # Update the MapModel from fields in the MapRoot JSON.
    self.model.title = maproot.get('title', '')
    self.model.description = maproot.get('description', '')

    def PutModels():
      self.model.current_version = new_version.put()
      self.model.put()
    db.run_in_transaction(PutModels)
    cache.Delete([Map, self.id, 'json'])
    return new_version.key().id()

  def GetCurrent(self):
    """Gets this map's latest version.

    Returns:
      A utils.Struct with the properties of this map's current version, along
      with a property 'id' containing the version's ID; or None if the current
      version has not been set.  (Version IDs are not necessarily in creation
      order, and are unique within a particular Map but not across all Maps.)
    """
    self.AssertAccess(perms.Role.MAP_VIEWER)
    return self.current_version and utils.StructFromModel(self.current_version)

  def Delete(self):
    """Marks a map as deleted (so it won't be returned by Get or GetAll)."""
    self.AssertAccess(perms.Role.MAP_OWNER)
    self.model.deleted = datetime.datetime.utcnow()
    self.model.deleter = utils.GetCurrentUser()
    CatalogEntry.DeleteByMapId(self.id)
    self.model.put()
    cache.Delete([Map, self.id, 'json'])

  def Undelete(self):
    """Unmarks a map as deleted."""
    self.AssertAccess(perms.Role.ADMIN)
    self.model.deleted = NEVER
    self.model.deleter = None
    self.model.put()
    cache.Delete([Map, self.id, 'json'])

  def SetBlocked(self, block):
    """Sets whether a map is blocked (private to one user and unpublishable)."""
    perms.AssertAccess(perms.Role.ADMIN)
    if block:
      self.model.blocked = datetime.datetime.utcnow()
      self.model.blocker = utils.GetCurrentUser()
      CatalogEntry.DeleteByMapId(self.id)
    else:
      self.model.blocked = NEVER
      self.model.blocker = None
    self.model.put()
    cache.Delete([Map, self.id, 'json'])

  def Wipe(self):
    """Permanently destroys a map."""
    self.AssertAccess(perms.Role.ADMIN)
    CatalogEntry.DeleteByMapId(self.id)
    db.delete([self.model] + list(MapVersionModel.all().ancestor(self.model)))

  def GetCurrentJson(self):
    """Gets the current JSON for public viewing only."""
    self.AssertAccess(perms.Role.MAP_VIEWER)
    return cache.Get([Map, self.id, 'json'],
                     lambda: getattr(self.GetCurrent(), 'maproot_json', None))

  def GetVersions(self):
    """Yields all versions of this map in order from newest to oldest."""
    self.AssertAccess(perms.Role.MAP_EDITOR)
    query = MapVersionModel.all().ancestor(self.model).order('-created')
    return utils.ResultIterator(query)

  def GetVersion(self, version_id):
    """Returns a specific version of this map."""
    self.AssertAccess(perms.Role.MAP_EDITOR)
    version = MapVersionModel.get_by_id(version_id, parent=self.model.key())
    return utils.StructFromModel(version)

  def SetWorldReadable(self, world_readable):
    """Sets whether the map is world-readable."""
    self.AssertAccess(perms.Role.MAP_OWNER)
    self.model.world_readable = world_readable
    self.model.put()

  def RevokePermission(self, role, user):
    """Revokes user permissions for the map."""
    self.AssertAccess(perms.Role.MAP_OWNER)
    email = str(user.email())  # The lists need basic strings.
    # Does nothing if the user does not have the role to begin with or if
    # the role is not editor, viewer, or owner.
    if role == perms.Role.MAP_VIEWER and email in self.model.viewers:
      self.model.viewers.remove(email)
    elif role == perms.Role.MAP_EDITOR and email in self.model.editors:
      self.model.editors.remove(email)
    elif role == perms.Role.MAP_OWNER and email in self.model.owners:
      self.model.owners.remove(email)
    self.model.put()

  def ChangePermissionLevel(self, role, user):
    """Changes the user's level of permission."""
    # When a user's permission is changed to viewer, editor, or owner,
    # their former permission level is revoked.
    # Does nothing if role is not in permissions.
    self.AssertAccess(perms.Role.MAP_OWNER)
    email = str(user.email())  # The lists need basic strings.
    permissions = [
        perms.Role.MAP_VIEWER, perms.Role.MAP_EDITOR, perms.Role.MAP_OWNER]
    if role not in permissions:
      return
    elif role == perms.Role.MAP_VIEWER and email not in self.model.viewers:
      self.model.viewers.append(email)
    elif role == perms.Role.MAP_EDITOR and email not in self.model.editors:
      self.model.editors.append(email)
    elif role == perms.Role.MAP_OWNER and email not in self.model.owners:
      self.model.owners.append(email)

    # Take away the other permissions
    for permission in permissions:
      if permission != role:
        self.RevokePermission(permission, user)
    self.model.put()

  def CheckAccess(self, role, user=None, policy=None):
    """Checks whether a user has the specified access role for this map."""
    return perms.CheckAccess(role, self, user, policy=policy)

  def AssertAccess(self, role, user=None, policy=None):
    """Requires a user to have the specified access role for this map."""
    perms.AssertAccess(role, self, user, policy=policy)


class EmptyMap(Map):
  """An empty stand-in for a Map object (handy for development)."""

  # To ensure that the app has something to display, we return this special
  # empty map object as the map with ID '0'.
  TITLE = 'Empty map'
  DESCRIPTION = 'This is an empty map for testing.'
  JSON = '{"title": "%s", "description": "%s"}' % (TITLE, DESCRIPTION)

  def __init__(self):
    Map.__init__(self, MapModel(
        key_name='0', owners=[], editors=[], viewers=[], domains=['gmail.com'],
        world_readable=True, title=self.TITLE, description=self.DESCRIPTION))

  def GetCurrent(self):
    key = db.Key.from_path('MapModel', '0', 'MapVersionModel', 1)
    return utils.Struct(id=1, key=key, maproot_json=self.JSON)

  def GetVersions(self):
    return [self.GetCurrent()]

  def GetVersion(self, version_id):
    if version_id == 1:
      return self.GetCurrent()

  def ReadOnlyError(self, *unused_args, **unused_kwargs):
    raise TypeError('EmptyMap is read-only')

  SetWorldReadable = ReadOnlyError
  PutNewVersion = ReadOnlyError
  Delete = ReadOnlyError
  RevokePermission = ReadOnlyError
  ChangePermissionLevel = ReadOnlyError


class EmptyCatalogEntry(CatalogEntry):
  """An empty stand-in for a CatalogEntry object (handy for development)."""

  # To ensure that the app has something to display, we return this special
  # catalog entry as the entry with label 'empty' in all domains.
  def __init__(self, domain):
    CatalogEntry.__init__(self, CatalogEntryModel(
        domain=domain, label='empty', title=EmptyMap.TITLE, map_id='0'))

  maproot_json = property(lambda self: EmptyMap.JSON)

  def ReadOnlyError(self, *unused_args, **unused_kwargs):
    raise TypeError('EmptyCatalogEntry is read-only')

  SetMapVersion = ReadOnlyError
  Put = ReadOnlyError
