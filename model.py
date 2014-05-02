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

import datetime
import json

import cache
import domains
import logs
import perms
import users
import utils

from google.appengine.api import search
from google.appengine.ext import db
from google.appengine.ext import ndb

# A datetime value to represent null (the datastore cannot query on None).
NEVER = datetime.datetime.utcfromtimestamp(0)

# A GeoPt value to represent null (the datastore cannot query on None).
NOWHERE = ndb.GeoPt(90, 90)


class MapVersionModel(db.Model):
  """A particular version of the JSON content of a Map.

  NOTE: This class is private to this module; outside code should use the Map
  class to create or access versions.

  If this entity is constructed properly, its parent entity will be a MapModel.
  """

  # The JSON string representing the map content, in MapRoot format.
  maproot_json = db.TextProperty()

  # Fields below are metadata for those with edit access, not for public
  # display.  No updated field is needed; these objects are immutable. Note
  # that it's possible that the creator_uid is historical - that is, it
  # represents a user whose account has been deleted - so any code that
  # tries to resolve it must be prepared for failure.
  created = db.DateTimeProperty()
  creator_uid = db.StringProperty()


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

  # Metadata for auditing and debugging purposes. Note that all uids could
  # be invalid; that happens when they represent a user whose account has been
  # deleted. Any code that tries to resolve them must be prepared for failure.
  created = db.DateTimeProperty()
  creator_uid = db.StringProperty()
  updated = db.DateTimeProperty()
  updater_uid = db.StringProperty()

  # To mark a map as deleted, set this to anything other than NEVER; the map
  # won't be returned by Map.Get* methods, though it remains in the datastore.
  deleted = db.DateTimeProperty(default=NEVER)
  deleter_uid = db.StringProperty()

  # To mark a map as blocked, set this to anything other than NEVER; then only
  # the first owner can view or edit the map, and the map cannot be published.
  blocked = db.DateTimeProperty(default=NEVER)
  blocker_uid = db.StringProperty()

  # User IDs of users who can set the flags and permission lists on this object.
  owners = db.StringListProperty()

  # User IDs of users who can edit this map.
  editors = db.StringListProperty()

  # User IDs of users who can review reports for this map.
  reviewers = db.StringListProperty()

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

  # Metadata about the catalog entry itself.  Note that all uids could
  # be invalid; that happens when they represent a user whose account has been
  # deleted. Any code that tries to resolve them must be prepared for failure.
  created = db.DateTimeProperty()
  creator_uid = db.StringProperty()
  updated = db.DateTimeProperty()
  updater_uid = db.StringProperty()

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
            'owners', 'editors', 'reviewers', 'viewers', 'domains',
            'domain_role']:
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
  def DeleteAllMapsWithNoOwner():
    """Deletes maps that have no owners. Returns a description of each map."""
    perms.AssertAccess(perms.Role.ADMIN)
    deleted_map_descs = []
    for m in Map.GetAll():
      if not m.owners:
        map_desc = 'Map "%s" (%s) created on %s by %s' % (
            m.title, m.description, m.created, m.creator_uid)
        deleted_map_descs.append(map_desc)
        m.Delete()
    return deleted_map_descs

  @staticmethod
  def RemoveUsers(users_to_remove):
    """Removes users from all permissions fields in maps.

    Args:
      users_to_remove: list of users to remove.
    Returns:
      A list of messages describing where users were removed from.
    """
    msg_list = []
    if not users_to_remove:
      return msg_list
    perms.AssertAccess(perms.Role.ADMIN)
    # TODO(andriy): change this to do transactional updates of MapModels, since
    # it's possible that while we have a map someone else can be modifying it,
    # leading to loss of data.  Determine what other methods need to become
    # transactional as a result (e.g. RevokePermission and similar methods).
    for m in Map.GetAll():
      map_users = {'Owners': m.owners, 'Editors': m.editors,
                   'Reviewers': m.reviewers, 'Viewers': m.viewers}
      for user in users_to_remove:
        for role in map_users:
          if user.id in map_users[role]:
            msg = 'Removed user [%s] from map [%s - %s] %s' % (user.email, m.id,
                                                               m.title, role)
            msg_list.append(msg)
            map_users[role].remove(user.id)
      m.model.put()
    return msg_list

  @staticmethod
  def Create(maproot_json, domain, owners=None, editors=None, reviewers=None,
             viewers=None, world_readable=False):
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
    if reviewers is None:
      reviewers = []
    if viewers is None:
      viewers = []
    if domain.initial_domain_role:
      domain_subjects = set(perms.GetSubjectsForTarget(domain.name).keys())
      if domain.initial_domain_role == perms.Role.MAP_OWNER:
        owners = list(set(owners) | domain_subjects)
      elif domain.initial_domain_role == perms.Role.MAP_EDITOR:
        editors = list(set(editors) | domain_subjects)
      elif domain.initial_domain_role == perms.Role.MAP_REVIEWER:
        reviewers = list(set(reviewers) | domain_subjects)
      elif domain.initial_domain_role == perms.Role.MAP_VIEWER:
        viewers = list(set(viewers) | domain_subjects)

    map_object = Map(MapModel(
        key_name=utils.MakeRandomId(),
        created=datetime.datetime.utcnow(), creator_uid=users.GetCurrent().id,
        owners=owners, editors=editors, reviewers=reviewers, viewers=viewers,
        domains=[domain.name], domain_role=domain.initial_domain_role,
        world_readable=world_readable))
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
    return utils.StructFromModel(self.current_version)

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
    if role == perms.Role.MAP_REVIEWER and uid in self.model.reviewers:
      self.model.reviewers.remove(uid)
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
    permissions = [perms.Role.MAP_VIEWER, perms.Role.MAP_REVIEWER,
                   perms.Role.MAP_EDITOR, perms.Role.MAP_OWNER]
    if role not in permissions:
      return
    elif role == perms.Role.MAP_VIEWER and uid not in self.model.viewers:
      self.model.viewers.append(uid)
    elif role == perms.Role.MAP_REVIEWER and uid not in self.model.reviewers:
      self.model.reviewers.append(uid)
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
        key_name='0', owners=[], editors=[], reviewers=[], viewers=[],
        domains=['gmail.com'], world_readable=True, title=self.TITLE,
        description=self.DESCRIPTION))

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


class _CrowdReportModel(ndb.Model):
  """A crowd report.  Entity id: a unique URL with source as a prefix."""

  # A URL identifying the original repository in which the report was created.
  source = ndb.StringProperty()

  # A unique URL identifying the author.
  author = ndb.StringProperty()

  # The time of the observation or prediction that this report is about.
  effective = ndb.DateTimeProperty()

  # The time that this report or its latest edit was posted by the author.
  published = ndb.DateTimeProperty()

  # The time of the last write to any field owned by this datastore entity.
  # This includes, for example: report created in this repository; report
  # edited in this repository; report copied into this repository via an API
  # or import from another repository.  It does not include writes to fields
  # computed from other entities (upvote_count, downvote_count, score, hidden).
  updated = ndb.DateTimeProperty()

  # Text of the user's comment.
  text = ndb.TextProperty()

  # Topics (within maps) to which this report belongs.  The value of topic_id
  # should be globally unique across all topics in all maps.  (As currently
  # implemented, this field begins with map_id + '.' to ensure said uniqueness.)
  topic_ids = ndb.StringProperty(repeated=True)

  # Survey answers in this report.  Each item has the format topic_id + '.' +
  # question_id + '.' + answer_id.  (Note that the definitions of questions and
  # answers can be edited, and we do not record the version of the question and
  # answer that was current at the time that the answer was submitted.)
  answer_ids = ndb.StringProperty(repeated=True)

  # The report's geolocation.
  location = ndb.GeoPtProperty()

  # Number of positive and negative votes for this report, respectively.
  upvote_count = ndb.IntegerProperty(default=0)
  downvote_count = ndb.IntegerProperty(default=0)

  # Aggregate score for this report.
  score = ndb.FloatProperty(default=0)

  # True if the report should be hidden because its score is too low.
  hidden = ndb.BooleanProperty(default=False)

  # True if the report has been reviewed for spam content.
  reviewed = ndb.BooleanProperty(default=False)

  @classmethod
  def _get_kind(cls):  # pylint: disable=g-bad-name
    return 'CrowdReportModel'  # so we can name the Python class with a _


class CrowdReport(utils.Struct):
  """Application-level object representing a crowd report."""
  index = search.Index('CrowdReport')

  @staticmethod
  def GenerateId(source):
    """Generates a new, unique report ID (a URL under the given source URL)."""
    unique_int_id, _ = _CrowdReportModel.allocate_ids(1)
    return source.rstrip('/') + '/.reports/' + str(unique_int_id)

  @classmethod
  def Get(cls, report_id):
    """Gets the report with the given report_id.

    Args:
      report_id: The key().string_id() of the _CrowdReportModel to retrieve

    Returns:
      A struct representing the CrowdReport or None if no such report exists
      for the report_id.
    """
    report = _CrowdReportModel.get_by_id(report_id)
    return report and cls.FromModel(report) or None

  @classmethod
  def GetForAuthor(cls, author, count, offset=0, reviewed=None):
    """Gets reports with the given author.

    Args:
      author: A string matching _CrowdReportModel.author
      count: The maximum number of reports to retrieve.
      offset: The number of reports to skip, for paging cases.
      reviewed: A boolean; if specified, only get reports whose reviewed flag
          matches this value.  (Otherwise, include reviewed and unreviewed.)

    Yields:
      The 'count' most recently updated CrowdReport objects, in order by
      decreasing update time, that have the given author.
    """
    if not author:
      return
    query = _CrowdReportModel.query().order(-_CrowdReportModel.updated)
    query = query.filter(_CrowdReportModel.author == author)
    if reviewed is not None:
      query = query.filter(_CrowdReportModel.reviewed == reviewed)
    for report in query.fetch(count, offset=offset):
      yield cls.FromModel(report)

  @classmethod
  def GetForTopics(cls, topic_ids, count, offset=0, reviewed=None):
    """Gets reports with any of the given topic_ids.

    Args:
      topic_ids: A list of strings in the form map_id + '.' + topic_id.
      count: The maximum number of reports to retrieve.
      offset: The number of reports to skip, for paging cases.
      reviewed: A boolean; if specified, only get reports whose reviewed flag
          matches this value.  (Otherwise, include reviewed and unreviewed.)

    Yields:
      The 'count' most recently updated CrowdReport objects, in order by
      decreasing update time, that have any of the given topic_ids.
    """
    if not topic_ids:
      return
    query = _CrowdReportModel.query().order(-_CrowdReportModel.updated)
    query = query.filter(_CrowdReportModel.topic_ids.IN(topic_ids))
    if reviewed is not None:
      query = query.filter(_CrowdReportModel.reviewed == reviewed)
    for report in query.fetch(count, offset=offset):
      yield cls.FromModel(report)

  @classmethod
  def GetWithoutLocation(cls, topic_ids, count, max_updated=None, hidden=None):
    """Gets reports with the given topic IDs that don't have locations.

    Args:
      topic_ids: A list of strings in the form map_id + '.' + topic_id.
      count: The maximum number of reports to retrieve.
      max_updated: A datetime; if specified, only get reports that were updated
          at or before this time.
      hidden: A boolean; if specified, only get reports whose hidden flag
          matches this value.  (Otherwise, include both hidden and unhidden.)

    Yields:
      The 'count' most recently updated Report objects, in order by decreasing
      update time, that meet the criteria:
        - Has at least one of the specified topic IDs
        - Has no location
        - Has an update time equal to or before 'max_updated'
    """
    query = _CrowdReportModel.query().order(-_CrowdReportModel.updated)
    query = query.filter(_CrowdReportModel.location == NOWHERE)
    if topic_ids:
      query = query.filter(_CrowdReportModel.topic_ids.IN(topic_ids))
    if max_updated:
      query = query.filter(_CrowdReportModel.updated <= max_updated)
    if hidden is not None:
      query = query.filter(_CrowdReportModel.hidden == hidden)

    for report in query.fetch(count):
      yield cls.FromModel(report)

  @classmethod
  def GetByLocation(cls, center, topic_radii, count=1000, max_updated=None,
                    hidden=None):
    """Gets reports with the given topic IDs that are near a given location.

    Args:
      center: A ndb.GeoPt object.
      topic_radii: A dictionary of {topic_id: radius} items where topic_id has
          the form map_id + '.' + topic_id and radius is a distance in metres.
      count: The maximum number of reports to retrieve.
      max_updated: A datetime; if specified, only get reports that were updated
          at or before this time.
      hidden: A boolean; if specified, only get reports whose hidden flag
          matches this value.  (Otherwise, include both hidden and unhidden.)

    Yields:
      The 'count' most recently updated Report objects, in order by decreasing
      update time, that meet the criteria:
        - Has at least one of the specified topic IDs
        - Distance from report location to 'center' is less than the radius
          specified for at least one of its matching topic IDs
        - Has an update time equal to or before 'max_updated'
    """
    query = []
    for topic_id, radius in topic_radii.items():
      subquery = ['%s = "%s"' % ('topic_id', topic_id)]
      subquery.append('distance(location, geopoint(%f, %f)) < %f' %
                      (center.lat, center.lon, radius))
      if max_updated:
        subquery.append('%s <= %s' % ('updated',
                                      utils.UtcToTimestamp(max_updated)))
      if hidden is not None:
        subquery.append('hidden = %s' % bool(hidden))
      query.append('(' + ' '.join(subquery) + ')')

    results = cls.index.search(search.Query(
        ' OR '.join(query),
        options=search.QueryOptions(limit=count, ids_only=True)))
    ids = [ndb.Key(_CrowdReportModel, result.doc_id) for result in results]
    entities = ndb.get_multi(ids)
    for entity in entities:
      if entity:
        yield cls.FromModel(entity)

  @classmethod
  def Search(cls, query, count=1000, max_updated=None):
    """Full-text structured search over reports.

    Args:
      query: A string; a query expression with the full range of syntax
          described at
          developers.google.com/appengine/docs/python/search/query_strings
          To search over a single field, append a GMail-style search
          operator matching one of the indexed fields:
          text, author, updated, topic_id.
          Examples:
              [text:"foo OR bar"] returns reports with foo or bar in the text
              [text:"bar" author:"http://foo.com/123"] returns reports from
                                                       http://foo.com/123 that
                                                       mention bar
      count: The maximum number of reports to retrieve.
      max_updated: A datetime; if specified, only get reports that were updated
          at or before this time.

    Yields:
      The 'count' most recently updated Report objects, in order by decreasing
      update time, that meet the criteria:
        - Matches the given query
        - Has an update time equal to or before 'max_updated'
    """
    if max_updated:
      query += ' (%s <= %s)' % ('updated', utils.UtcToTimestamp(max_updated))
    results = cls.index.search(
        search.Query(query, options=search.QueryOptions(limit=count,
                                                        ids_only=True)))
    ids = [ndb.Key(_CrowdReportModel, result.doc_id) for result in results]
    entities = ndb.get_multi(ids)
    for entity in entities:
      if entity:
        yield cls.FromModel(entity)

  @classmethod
  def Create(cls, source, author, effective, text, topic_ids, answer_ids,
             location):
    """Stores one new crowd report and returns it."""
    now = datetime.datetime.utcnow()
    report_id = cls.GenerateId(source)
    model = _CrowdReportModel(id=report_id, source=source, author=author,
                              effective=effective, published=now, updated=now,
                              topic_ids=topic_ids, answer_ids=answer_ids,
                              text=text, location=location or NOWHERE)
    report = cls.FromModel(model)
    document = cls._CreateSearchDocument(model)

    # Prepare all the arguments for both put() calls before this point, to
    # minimize the possibility that one put() succeeds and the other fails.
    model.put()
    cls.index.put(document)
    return report

  @classmethod
  def _CreateSearchDocument(cls, model):
    # We index updated as a number because DateField has only date precision;
    # see http://developers.google.com/appengine/docs/python/search/
    fields = [
        search.NumberField('updated', utils.UtcToTimestamp(model.updated)),
        search.NumberField('score', model.score),
        search.TextField('text', model.text),
        search.TextField('author', model.author),
        # A 'True'/'False' AtomField is more efficient than a 0/1 NumberField.
        search.AtomField('hidden', str(bool(model.hidden))),
        search.AtomField('reviewed', str(bool(model.reviewed))),
    ] + [search.AtomField('topic_id', tid) for tid in model.topic_ids]
    if model.location:
      fields.append(search.GeoField(
          'location', search.GeoPoint(model.location.lat, model.location.lon)))
    return search.Document(doc_id=model.key.id(), fields=fields)

  @classmethod
  def MarkAsReviewed(cls, report_ids, reviewed=True):
    """Mark a report as reviewed for spam.

    Args:
      report_ids: A single report ID or iterable collection of report IDs.
      reviewed: True to mark the reports reviewed, false to mark unreviewed.
    """
    if isinstance(report_ids, basestring):
      report_ids = [report_ids]
    models = ndb.get_multi([ndb.Key(_CrowdReportModel, i) for i in report_ids])
    documents = []
    for model in models:
      model.reviewed = reviewed
      documents.append(cls._CreateSearchDocument(model))
    ndb.put_multi(models)
    cls.index.put(documents)

  @classmethod
  def UpdateScore(cls, report_id, old_vote=None, new_vote_type=None):
    """Updates the voting stats on the affected report.

    This method prospectively calculates the new voting stats on the report,
    factoring in an update to a single vote that hasn't been written yet.
    Call this just before storing or updating a vote in the datastore, and
    pass in old_vote and new_vote_type to describe what's about to change.

    Args:
      report_id: The ID of the report.
      old_vote: A CrowdVote or None, the vote that's about to be replaced.
      new_vote_type: A member of VOTE_TYPES or None, the vote about to be added.
    """
    # This method is designed this way because scanning the indexes immediately
    # after writing a vote is likely to produce incomplete counts; there's some
    # delay between when a vote is written and when the indexes are updated.
    # Also, we can't do the counting in a transaction, as non-ancestor queries
    # are not allowed.  So we count first and then adjust by one vote; this
    # still relies on indexes being up to date just before a vote is cast, but
    # that's more likely than being up to date just after a vote is cast.  So,
    # the situation in which a report ends up with the wrong score is when
    # (a) multiple people try to vote on the same report at the same time and
    # (b) no one votes on that report for a while afterward.  If a report is so
    # controversial that lots of conflicting votes come in quickly, being off
    # by a few votes is unlikely to sway the final hidden/unhidden outcome.
    def CountVotes(vote_type):
      return _CrowdVoteModel.query(
          _CrowdVoteModel.report_id == report_id,
          _CrowdVoteModel.vote_type == vote_type
      ).count() + (bool(new_vote_type == vote_type) -
                   bool(old_vote and old_vote.vote_type == vote_type))
    upvote_count = CountVotes('ANONYMOUS_UP')
    downvote_count = CountVotes('ANONYMOUS_DOWN')
    reviewer_upvote_count = CountVotes('REVIEWER_UP')
    reviewer_downvote_count = CountVotes('REVIEWER_DOWN')

    score = (upvote_count - downvote_count +
             # Reviewer votes count 1000x user votes
             1000 * (reviewer_upvote_count - reviewer_downvote_count))
    hidden = score <= -2  # for now, two downvotes hide a report
    cls.PutScoreForReport(
        report_id, upvote_count + reviewer_upvote_count,
        downvote_count + reviewer_downvote_count, score, hidden)

  @classmethod
  @ndb.transactional
  def PutScoreForReport(
      cls, report_id, upvote_count, downvote_count, score, hidden):
    """Atomically writes the voting stats on a report."""
    model = _CrowdReportModel.get_by_id(report_id)
    if model:
      model.upvote_count = upvote_count
      model.downvote_count = downvote_count
      model.score = score
      model.hidden = hidden
      document = cls._CreateSearchDocument(model)
      model.put()
      cls.index.put(document)

# Possible types of votes.  Each vote type is associated with a particular
# weight, and some vote types are only available to privileged users.
VOTE_TYPES = ['ANONYMOUS_UP', 'ANONYMOUS_DOWN', 'REVIEWER_UP', 'REVIEWER_DOWN']


class _CrowdVoteModel(ndb.Model):
  """A vote on a crowd report.  Entity id: report_id + '\x00' + voter."""

  # The entity ID of the report.
  report_id = ndb.StringProperty()

  # A unique URL identifying the voter.
  voter = ndb.StringProperty()

  # The type of vote, which determines its weight.  None is allowed, and
  # means that the vote has no weight (the user voted and then unvoted).
  vote_type = ndb.StringProperty(choices=VOTE_TYPES)

  @classmethod
  def _get_kind(cls):  # pylint: disable=g-bad-name
    return 'CrowdVoteModel'  # so the Python class can start with an underscore


class CrowdVote(utils.Struct):
  """Application-level object representing a crowd vote."""

  @classmethod
  def Get(cls, report_id, voter):
    """Gets the vote for a specified report and voter.

    Args:
      report_id: The ID of the report.
      voter: A unique URL identifying the voter.
    Returns:
      The CrowdVote object, or None if this voter has not voted on this report.
    """
    return cls.FromModel(_CrowdVoteModel.get_by_id(report_id + '\x00' + voter))

  @classmethod
  def GetMulti(cls, report_ids, voter):
    """Gets the votes by a given voter on multiple reports.

    Args:
      report_ids: A list of report IDs.
      voter: A unique URL identifying the voter.
    Returns:
      A dictionary mapping a subset of the report IDs to CrowdVote objects.
    """
    ids = [report_id + '\x00' + voter for report_id in report_ids]
    votes = ndb.get_multi([ndb.Key(_CrowdVoteModel, i) for i in ids])
    return {vote.report_id: cls.FromModel(vote) for vote in votes if vote}

  @classmethod
  def Put(cls, report_id, voter, vote_type):
    """Stores or replaces the vote for a specified report and voter.

    Args:
      report_id: The ID of the report.
      voter: A unique URL identifying the voter.
      vote_type: A member of VOTE_TYPES.
    """
    old_vote = CrowdVote.Get(report_id, voter)
    CrowdReport.UpdateScore(report_id, old_vote, vote_type)
    _CrowdVoteModel(id=report_id + '\x00' + voter, report_id=report_id,
                    voter=voter, vote_type=vote_type).put()
