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
import random

import cache
import domains
import logs
import perms
import users
import utils

from google.appengine.ext import db

# A datetime value to represent null (the datastore cannot query on None).
NEVER = datetime.datetime.utcfromtimestamp(0)


class MapVersionModel(db.Model):
  """A particular version of the JSON content of a Map.

  NOTE: This class is private to this module; outside code should use the Map
  class to create or access versions.

  If this entity is constructed properly, its parent entity will be a MapModel.
  """

  # The JSON string representing the map content, in MapRoot format.
  maproot_json = db.TextProperty()

  # Fields below are metadata for those with edit access, not for public
  # display.  No updated field is needed; these objects are immutable.
  created = db.DateTimeProperty()
  creator_uid = db.StringProperty()
  creator = db.UserProperty()  # DEPRECATED


class MapModel(db.Model):
  """A single map object and its associated metadata; parent of its versions.

  NOTE: This class is private to this module; outside code should use the Map
  class to create or access maps.

  The key_name is a unique ID.  The latest version is what's shown to viewers.
  """

  # Title for the current version.  Cached from the current version for display.
  # Plain text.
  title = db.StringProperty()

  # HTML description of the map.  Cached from current version for display.
  description = db.TextProperty()

  # Metadata for auditing and debugging purposes.
  created = db.DateTimeProperty()
  creator_uid = db.StringProperty()
  creator = db.UserProperty()  # DEPRECATED
  updated = db.DateTimeProperty()
  updater_uid = db.StringProperty()
  last_updated = db.DateTimeProperty()  # DEPRECATED
  last_updater = db.UserProperty()  # DEPRECATED

  # To mark a map as deleted, set this to anything other than NEVER; the map
  # won't be returned by Map.Get* methods, though it remains in the datastore.
  deleted = db.DateTimeProperty(default=NEVER)
  deleter_uid = db.StringProperty()
  deleter = db.UserProperty()  # DEPRECATED

  # To mark a map as blocked, set this to anything other than NEVER; then only
  # the first owner can view or edit the map, and the map cannot be published.
  blocked = db.DateTimeProperty(default=NEVER)
  blocker_uid = db.StringProperty()
  blocker = db.UserProperty()  # DEPRECATED

  # User IDs of users who can set the flags and permission lists on this object.
  owners = db.StringListProperty()

  # User IDs of users who can edit this map.
  editors = db.StringListProperty()

  # User IDs of users who can view the current version of this map.
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
  created = db.DateTimeProperty()
  creator_uid = db.StringProperty()
  creator = db.UserProperty()  # DEPRECATED
  updated = db.DateTimeProperty()
  updater_uid = db.StringProperty()
  last_updated = db.DateTimeProperty()  # DEPRECATED
  last_updater = db.UserProperty()  # DEPRECATED

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
    query = CatalogEntryModel.all().order('-updated')
    if domain:
      query = query.filter('domain =', domain)
    return query

  @staticmethod
  def GetListed(domain=None):
    """Yields all the listed CatalogEntryModels in reverse update order."""
    return CatalogEntryModel.GetAll(domain).filter('is_listed =', True)

  @staticmethod
  def Put(uid, domain, label, map_object, is_listed=False):
    """Stores a CatalogEntryModel pointing at the map's current version."""
    if ':' in domain:
      raise ValueError('Invalid domain %r' % domain)
    now = datetime.datetime.utcnow()
    entity = CatalogEntryModel.Get(domain, label)
    if not entity:
      entity = CatalogEntryModel(key_name=domain + ':' + label,
                                 domain=domain, label=label,
                                 created=now, creator_uid=uid)
    entity.updated = now
    entity.updater_uid = uid
    entity.title = map_object.title
    entity.map_id = map_object.id
    entity.map_version = map_object.GetCurrent().key
    entity.is_listed = is_listed
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

  # TODO(kpy): First argument should be a user.
  @staticmethod
  def Create(domain_name, label, map_object, is_listed=False):
    """Stores a new CatalogEntry with version set to the map's current version.

    If a CatalogEntry already exists with the same label, and the user is
    allowed to overwrite it, it is overwritten.

    Args:
      domain_name: The domain in which to create the CatalogEntry.
      label: The publication label to use for this map.
      map_object: The Map object whose current version to use.
      is_listed: If True, show this entry in the map picker menu.
    Returns:
      The new CatalogEntry object.
    Raises:
      ValueError: If the domain string is invalid.
    """
    domain_name = str(domain_name)  # accommodate Unicode strings
    domain = domains.Domain.Get(domain_name)
    if not domain:
      raise ValueError('Unknown domain %r' % domain_name)
    perms.AssertAccess(perms.Role.CATALOG_EDITOR, domain_name)
    perms.AssertAccess(perms.Role.MAP_VIEWER, map_object)
    perms.AssertPublishable(map_object)
    # If catalog is sticky, only a creator or domain admin may update an entry.
    if (domain.has_sticky_catalog_entries and
        not perms.CheckAccess(perms.Role.DOMAIN_ADMIN, domain_name)):
      entry = CatalogEntryModel.Get(domain_name, label)
      if entry:
        perms.AssertCatalogEntryOwner(entry)
    entry = CatalogEntryModel.Put(
        users.GetCurrent().id, domain_name, label, map_object, is_listed)
    logs.RecordEvent(logs.Event.MAP_PUBLISHED, domain_name=domain_name,
                     map_id=map_object.id,
                     map_version_key=entry.map_version.key().name(),
                     catalog_entry_key=domain_name + ':' + label,
                     uid=users.GetCurrent().id)

    # We use '*' in the cache key for the list that includes all domains.
    cache.Delete([CatalogEntry, '*', 'all'])
    cache.Delete([CatalogEntry, '*', 'listed'])
    cache.Delete([CatalogEntry, domain_name, 'all'])
    cache.Delete([CatalogEntry, domain_name, 'listed'])
    return CatalogEntry(entry)

  @staticmethod
  def Delete(domain_name, label, user=None):
    """Deletes an existing CatalogEntry.

    Args:
      domain_name: The domain to which the CatalogEntry belongs.
      label: The publication label.
      user: (optional) the user initiating the delete, or None for
        the current user.

    Raises:
      ValueError: if there's no CatalogEntry with the given domain and label.
    """
    if not user:
      user = users.GetCurrent()
    domain_name = str(domain_name)  # accommodate Unicode strings
    domain = domains.Domain.Get(domain_name)
    if not domain:
      raise ValueError('Unknown domain %r' % domain_name)
    entry = CatalogEntryModel.Get(domain_name, label)
    if not entry:
      raise ValueError('No CatalogEntry %r in domain %r' % (label, domain_name))
    perms.AssertAccess(perms.Role.CATALOG_EDITOR, domain_name)
    # If catalog is sticky, only a creator or domain admin may delete an entry.
    if (domain.has_sticky_catalog_entries and
        not perms.CheckAccess(perms.Role.DOMAIN_ADMIN, domain_name)):
      perms.AssertCatalogEntryOwner(entry)

    # Grab all the log information before we delete the entry
    map_id, version_key = entry.map_id, entry.map_version.key().name()
    entry_key = entry.key().name()
    entry.delete()
    logs.RecordEvent(logs.Event.MAP_UNPUBLISHED, domain_name=domain_name,
                     map_id=map_id, map_version_key=version_key,
                     catalog_entry_key=entry_key, uid=user.id)
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

  id = property(lambda self: self.model.key().name())

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
            'created', 'creator_uid', 'updated', 'updater_uid']:
    locals()[x] = property(lambda self, x=x: getattr(self.model, x))

  # Handy access to the user profiles associated with user IDs.
  creator = property(lambda self: users.Get(self.creator_uid))
  updater = property(lambda self: users.Get(self.updater_uid))

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
    domain_name = str(self.domain)  # accommodate Unicode strings
    perms.AssertAccess(perms.Role.CATALOG_EDITOR, domain_name)
    # If catalog is sticky, only a creator or domain admin may update an entry.
    domain = domains.Domain.Get(domain_name)
    if not domain:
      raise ValueError('Unknown domain %r' % domain_name)
    # TODO(kpy): We could use a perms function for this catalog entry check.
    if (domain.has_sticky_catalog_entries and
        not perms.CheckAccess(perms.Role.DOMAIN_ADMIN, domain_name)):
      perms.AssertCatalogEntryOwner(self.model)

    self.model.updater_uid = users.GetCurrent().id
    self.model.updated = datetime.datetime.utcnow()
    self.model.put()
    logs.RecordEvent(logs.Event.MAP_PUBLISHED, domain_name=domain_name,
                     map_id=self.map_id,
                     map_version_key=self.GetMapVersionKey().name(),
                     catalog_entry_key=self.id,
                     uid=users.GetCurrent().id)

    # We use '*' in the cache key for the list that includes all domains.
    cache.Delete([CatalogEntry, '*', 'all'])
    cache.Delete([CatalogEntry, '*', 'listed'])
    cache.Delete([CatalogEntry, domain_name, 'all'])
    cache.Delete([CatalogEntry, domain_name, 'listed'])
    cache.Delete([CatalogEntry, domain_name, self.label, 'json'])


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
  for x in ['created', 'creator_uid', 'updated', 'updater_uid',
            'blocked', 'blocker_uid', 'deleted', 'deleter_uid',
            'title', 'description', 'current_version', 'world_readable',
            'owners', 'editors', 'viewers', 'domains', 'domain_role']:
    locals()[x] = property(lambda self, x=x: getattr(self.model, x))

  # Handy access to the user profiles associated with user IDs.
  creator = property(lambda self: users.Get(self.creator_uid))
  updater = property(lambda self: users.Get(self.updater_uid))
  blocker = property(lambda self: users.Get(self.blocker_uid))
  deleter = property(lambda self: users.Get(self.deleter_uid))

  # Handy Boolean access to the blocked or deleted status.
  is_blocked = property(lambda self: self.blocked != NEVER)
  is_deleted = property(lambda self: self.deleted != NEVER)

  @staticmethod
  def get(key):  # lowercase to match db.Model.get  # pylint: disable=g-bad-name
    return Map(MapModel.get(key))

  @staticmethod
  def _GetAll(domain=None):
    """NO ACCESS CHECK.  Yields all non-deleted maps; can filter by domain."""
    query = MapModel.all().order('-updated').filter('deleted =', NEVER)
    if domain:
      query = query.filter('domains =', domain)
    return (Map(model) for model in query)

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
      # TODO(kpy): Take user as an argument instead of calling GetCurrent.
      owners = [users.GetCurrent().id]
    if editors is None:
      editors = []
    if viewers is None:
      viewers = []
    if domain.initial_domain_role:
      domain_subjects = set(perms.GetSubjectsForTarget(domain.name).keys())
      if domain.initial_domain_role == perms.Role.MAP_OWNER:
        owners = list(set(owners) | domain_subjects)
      elif domain.initial_domain_role == perms.Role.MAP_EDITOR:
        editors = list(set(editors) | domain_subjects)
      elif domain.initial_domain_role == perms.Role.MAP_VIEWER:
        viewers = list(set(viewers) | domain_subjects)

    # urlsafe_b64encode encodes 12 random bytes as exactly 16 characters,
    # which can include digits, letters, hyphens, and underscores.  Because
    # the length is a multiple of 4, it won't have trailing "=" signs.
    map_object = Map(MapModel(
        key_name=base64.urlsafe_b64encode(
            ''.join(chr(random.randrange(256)) for i in xrange(12))),
        created=datetime.datetime.utcnow(), creator_uid=users.GetCurrent().id,
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
    now = datetime.datetime.utcnow()
    uid = users.GetCurrent().id

    new_version = MapVersionModel(parent=self.model, maproot_json=maproot_json,
                                  created=now, creator_uid=uid)
    # Update the MapModel from fields in the MapRoot JSON.
    self.model.title = maproot.get('title', '')
    self.model.description = maproot.get('description', '')
    self.model.updated = now
    self.model.updater_uid = uid

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
    self.model.deleter_uid = users.GetCurrent().id
    CatalogEntry.DeleteByMapId(self.id)
    self.model.put()
    logs.RecordEvent(logs.Event.MAP_DELETED, map_id=self.id,
                     uid=self.model.deleter_uid)
    cache.Delete([Map, self.id, 'json'])

  def Undelete(self):
    """Unmarks a map as deleted."""
    self.AssertAccess(perms.Role.ADMIN)
    self.model.deleted = NEVER
    self.model.deleter_uid = None
    self.model.put()
    logs.RecordEvent(logs.Event.MAP_UNDELETED, map_id=self.id,
                     uid=users.GetCurrent().id)
    cache.Delete([Map, self.id, 'json'])

  def SetBlocked(self, block):
    """Sets whether a map is blocked (private to one user and unpublishable)."""
    perms.AssertAccess(perms.Role.ADMIN)
    if block:
      self.model.blocked = datetime.datetime.utcnow()
      self.model.blocker_uid = users.GetCurrent().id
      CatalogEntry.DeleteByMapId(self.id)
      logs.RecordEvent(logs.Event.MAP_BLOCKED, map_id=self.id,
                       uid=self.model.blocker_uid)
    else:
      self.model.blocked = NEVER
      self.model.blocker_uid = None
      logs.RecordEvent(logs.Event.MAP_UNBLOCKED, map_id=self.id,
                       uid=users.GetCurrent().id)
    self.model.put()
    cache.Delete([Map, self.id, 'json'])

  def Wipe(self):
    """Permanently destroys a map."""
    self.AssertAccess(perms.Role.ADMIN)
    CatalogEntry.DeleteByMapId(self.id)
    map_id, domain_name = self.id, self.domains[0]
    db.delete([self.model] + list(MapVersionModel.all().ancestor(self.model)))
    logs.RecordEvent(logs.Event.MAP_WIPED, domain_name=domain_name,
                     map_id=map_id, uid=users.GetCurrent().id)

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

  def RevokePermission(self, role, uid):
    """Revokes user permissions for the map."""
    self.AssertAccess(perms.Role.MAP_OWNER)
    # Does nothing if the user does not have the role to begin with or if
    # the role is not editor, viewer, or owner.
    if role == perms.Role.MAP_VIEWER and uid in self.model.viewers:
      self.model.viewers.remove(uid)
    elif role == perms.Role.MAP_EDITOR and uid in self.model.editors:
      self.model.editors.remove(uid)
    elif role == perms.Role.MAP_OWNER and uid in self.model.owners:
      self.model.owners.remove(uid)
    self.model.put()

  def ChangePermissionLevel(self, role, uid):
    """Changes the user's level of permission."""
    # When a user's permission is changed to viewer, editor, or owner,
    # their former permission level is revoked.
    # Does nothing if role is not in permissions.
    self.AssertAccess(perms.Role.MAP_OWNER)
    permissions = [
        perms.Role.MAP_VIEWER, perms.Role.MAP_EDITOR, perms.Role.MAP_OWNER]
    if role not in permissions:
      return
    elif role == perms.Role.MAP_VIEWER and uid not in self.model.viewers:
      self.model.viewers.append(uid)
    elif role == perms.Role.MAP_EDITOR and uid not in self.model.editors:
      self.model.editors.append(uid)
    elif role == perms.Role.MAP_OWNER and uid not in self.model.owners:
      self.model.owners.append(uid)

    # Take away the other permissions
    for permission in permissions:
      if permission != role:
        self.RevokePermission(permission, uid)
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
