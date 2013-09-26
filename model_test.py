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

"""Unit tests for model.py."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import model
import perms
import test_utils
import utils

from google.appengine.api import memcache
from google.appengine.api import users


class MapTests(test_utils.BaseTest):
  """Tests the map model classes and associated access control logic."""

  def setUp(self):
    super(MapTests, self).setUp()

  def testVersions(self):
    """Verifies that creating and setting versions works properly."""
    test_utils.BecomeAdmin()

    json1 = '{"description": "description1"}'
    json2 = '{"description": "description2"}'
    m = model.Map.Create(json1, 'xyz.com')
    id1 = m.GetCurrent().id
    id2 = m.PutNewVersion(json2)

    # Verify that versions are returned in reverse chronological order.
    versions = list(m.GetVersions())
    self.assertEquals(id2, versions[0].id)
    self.assertEquals(id1, versions[1].id)

    # Verify that GetCurrent() sees the most recent version as expected.
    current = m.GetCurrent()
    self.assertEquals(id2, current.id)
    self.assertEquals(json2, current.maproot_json)
    self.assertEquals('admin@google.com', current.creator.email())

  def testWorldReadable(self):
    # Verify that the current version is only visible to the public after
    # setting world_readable to True.
    test_utils.BecomeAdmin()
    json = '{"description": "description1"}'
    m = model.Map.Create(json, 'xyz.com')

    test_utils.SetUser('random@gmail.com')
    self.assertRaises(perms.AuthorizationError, m.GetCurrent)

    test_utils.SetUser('admin@google.com')
    m.SetWorldReadable(True)
    test_utils.SetUser('random@gmail.com')
    self.assertEquals(json, m.GetCurrent().maproot_json)

    test_utils.SetUser('admin@google.com')
    m.SetWorldReadable(False)
    test_utils.SetUser('random@gmail.com')
    self.assertRaises(perms.AuthorizationError, m.GetCurrent)

  def testRevokePermission(self):
    """Verifies internal model permission lists are correctly modified."""
    admin = test_utils.BecomeAdmin()
    json = '{"description": "description1"}'
    m = model.Map.Create(json, 'xyz.com')
    access_policy = perms.AccessPolicy()

    user = users.User('user@gmail.com')
    user2 = users.User('user2@gmail.com')

    # Verify starting state of lists.
    self.assertEquals([], m.model.viewers)
    self.assertEquals([], m.model.editors)
    self.assertEquals([admin.email()], m.model.owners)

    permissions = {perms.Role.MAP_VIEWER: m.model.viewers,
                   perms.Role.MAP_EDITOR: m.model.editors,
                   perms.Role.MAP_OWNER: m.model.owners}
    for role in permissions:
      # Local copy is manually updated to reflect proper state of model list.
      expected_users = list(permissions[role])
      permissions[role].append(user.email())  # Grant permission.
      expected_users.append(user.email())
      m.AssertAccess(role, user, access_policy)
      self.assertEquals(expected_users, permissions[role])

      permissions[role].append(user2.email())  # Grant permission.
      expected_users.append(user2.email())
      m.AssertAccess(role, user2, access_policy)
      self.assertEquals(expected_users, permissions[role])

      m.RevokePermission(role, user2)
      expected_users.pop()
      self.assertFalse(m.CheckAccess(role, user2, access_policy))
      self.assertEquals(expected_users, permissions[role])

      # Should do nothing: revoking a permission the user doesn't have.
      m.RevokePermission(role, user2)
      self.assertFalse(m.CheckAccess(role, user2, access_policy))
      self.assertEquals(expected_users, permissions[role])

      m.RevokePermission(role, user)
      expected_users.pop()
      self.assertFalse(m.CheckAccess(role, user, access_policy))
      self.assertEquals(expected_users, permissions[role])

    self.assertEquals([], m.model.viewers)
    self.assertEquals([], m.model.editors)
    self.assertEquals([admin.email()], m.model.owners)

    # Should do nothing: only viewer, editor, owner revokable.
    m.AssertAccess(perms.Role.ADMIN, admin)
    m.RevokePermission(perms.Role.ADMIN, admin)
    m.AssertAccess(perms.Role.ADMIN, admin)

    self.assertEquals([], m.model.viewers)
    self.assertEquals([], m.model.editors)
    self.assertEquals([admin.email()], m.model.owners)

  def testChangePermissionLevel(self):
    """Verifies that permission level changes appropriately."""
    # ChangePermissionLevel calls RevokePermission internally, make sure
    # that the RevokePermissions tests are passing as well.
    test_utils.BecomeAdmin()
    json = '{"description": "description1"}'
    m = model.Map.Create(json, 'xyz.com')
    access_policy = perms.AccessPolicy()

    admin = test_utils.SetUser('admin@google.com')
    user = users.User('user@gmail.com')

    # Verify starting state of lists.
    self.assertEquals([], m.model.viewers)
    self.assertEquals([], m.model.editors)
    self.assertEquals([admin.email()], m.model.owners)

    permissions = {perms.Role.MAP_VIEWER: m.model.viewers,
                   perms.Role.MAP_EDITOR: m.model.editors,
                   perms.Role.MAP_OWNER: m.model.owners}
    for role in permissions:
      expected_users = list(permissions[role])
      m.ChangePermissionLevel(role, user)  # Grant permission.
      expected_users.append(user.email())
      m.AssertAccess(role, user, access_policy)
      self.assertEquals(expected_users, permissions[role])
      # Should do nothing. List should still only have one copy of user info.
      m.ChangePermissionLevel(role, user)
      self.assertEquals(expected_users, permissions[role])

      # Make sure the user doesn't have any of the other permissions.
      for other_role in permissions:
        if other_role != role:
          self.assertFalse(user.email() in permissions[other_role])

    # Should do nothing: only viewer, editor, owner roles
    # changeable permissions.
    m.ChangePermissionLevel(perms.Role.ADMIN, user)
    self.assertFalse(m.CheckAccess(perms.Role.ADMIN, user, access_policy))

  def testCreate(self):
    """Verifies that map creation works properly."""
    # Verify the default values from Map.Create.
    test_utils.BecomeAdmin()

    m = model.Map.Create('{}', 'xyz.com')
    self.assertEquals(['admin@google.com'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.viewers)
    self.assertEquals(['xyz.com'], m.model.domains)
    self.assertEquals(m.model.world_readable, False)

  def testDelete(self):
    """Tests whether map deletion works properly."""
    m, _ = test_utils.CreateMapAsAdmin()
    self.assertEquals(m, model.Map.Get(m.id))
    m.Delete()
    self.assertEquals(None, model.Map.Get(m.id))

  def testMapCache(self):
    """Tests caching of current JSON data."""
    # Verify the default values from Map.Create.
    test_utils.BecomeAdmin()

    json1 = '{"description": "description1"}'
    json2 = '{"description": "description2", "title": "title2"}'
    json3 = '{"description": "description3", "title": "title3"}'
    m = model.Map.Create(json1, 'xyz.com', world_readable=True)
    m.PutNewVersion(json2)
    self.assertEquals(json2, m.GetCurrentJson())
    self.assertEquals(m.title, 'title2')
    self.assertEquals(m.description, 'description2')
    # GetCurrentJson should have filled the cache.
    self.assertEquals(json2, memcache.get('Map,%s,json' % m.id))

    # PutVersion should clear the cache.
    m.PutNewVersion(json3)
    self.assertEquals(None, memcache.get('Map,%s,json' % m.id))
    self.assertEquals(json3, m.GetCurrentJson())

  def testConfig(self):
    """Tests storage of simple and structured values in Config entities."""
    key = 'item'
    self.assertEquals(None, model.Config.Get(key))
    model.Config.Set(key, 'value')
    self.assertEquals('value', model.Config.Get(key))
    model.Config.Set(key, [3, 4, {'a': 'b'}, None])
    self.assertEquals([3, 4, {'a': 'b'}, None], model.Config.Get(key))
    self.assertEquals(None, model.GetInitialDomainRole('xyz.com'))
    model.SetInitialDomainRole('xyz.com', perms.Role.MAP_VIEWER)
    self.assertEquals(perms.Role.MAP_VIEWER,
                      model.GetInitialDomainRole('xyz.com'))

  def testGetAll(self):
    """Tests Maps.GetAll and Maps.GetViewable."""
    test_utils.BecomeAdmin()
    m1 = model.Map.Create('{}', 'xyz.com', world_readable=True)
    m2 = model.Map.Create('{}', 'xyz.com', world_readable=False)

    def ModelKeys(maps):
      return set([m.model.key() for m in maps])

    all_maps = ModelKeys([m1, m2])
    public_maps = ModelKeys([m1])

    user = utils.GetCurrentUser()
    self.assertEquals(all_maps, ModelKeys(list(model.Map.GetViewable(user))))
    self.assertEquals(all_maps, ModelKeys(list(model.Map.GetAll())))

    test_utils.SetUser('john.q.public@gmail.com')
    user = utils.GetCurrentUser()
    self.assertRaises(perms.AuthorizationError, model.Map.GetAll)
    self.assertEquals(public_maps, ModelKeys(model.Map.GetViewable(user)))


class CatalogEntryTests(test_utils.BaseTest):
  """Tests the CatalogEntry class."""

  def testCreate(self):
    """Tests creation of a CatalogEntry."""
    mm, _ = test_utils.CreateMapAsAdmin(viewers=['random_user@gmail.com'])

    # Random users shouldn't be able to create catalog entries.
    test_utils.SetUser('random_user@gmail.com')
    self.assertRaises(perms.AuthorizationError, model.CatalogEntry.Create,
                      'foo.com', 'label', mm, is_listed=True)
    # After we grant the CATALOG_EDITOR role, CatalogEntry.Create should work.
    perms.SetGlobalRoles('random_user@gmail.com', [perms.Role.CATALOG_EDITOR])
    mc = model.CatalogEntry.Create('foo.com', 'label', mm, is_listed=True)

    self.assertEquals('foo.com', mc.domain)
    self.assertEquals('label', mc.label)
    self.assertEquals('title', mc.title)
    self.assertEquals(True, mc.is_listed)
    self.assertEquals(mm.id, mc.map_id)

    # Creating another entry with the same path_name should succeed.
    model.CatalogEntry.Create('foo.com', 'label', mm)

  def testCatalogDelete(self):
    mm, _ = test_utils.CreateMapAsAdmin(viewers=['random_user@gmail.com'])
    model.CatalogEntry.Create('foo.com', 'label', mm, is_listed=True)

    # Validate that CatalogEntry is created successfully.
    self.assertEquals('title', model.CatalogEntry.Get('foo.com', 'label').title)
    # Trying to delete a nonexisting entry should raise an exception.
    self.assertRaises(ValueError, model.CatalogEntry.Delete, 'foo.com', 'xyz')
    # Random users shouldn't be able to delete catalog entries.
    test_utils.SetUser('random_user@gmail.com')
    self.assertRaises(perms.AuthorizationError, model.CatalogEntry.Delete,
                      'foo.com', 'label')
    # After we grant the CATALOG_EDITOR role, CatalogEntry.Delete should work.
    perms.SetGlobalRoles('random_user@gmail.com', [perms.Role.CATALOG_EDITOR])
    model.CatalogEntry.Delete('foo.com', 'label')

    # Assert that the entry is successfully deleted.
    self.assertEquals(None, model.CatalogEntry.Get('foo.com', 'label'))
    # A CatalogEntry cannot be deleted twice.
    self.assertRaises(ValueError, model.CatalogEntry.Delete, 'foo.com', 'label')

  def testUpdate(self):
    """Tests modification and update of an existing CatalogEntry."""
    mm, vid = test_utils.CreateMapAsAdmin(viewers=['random_user@gmail.com'])
    mc = model.CatalogEntry.Create('foo.com', 'label', mm, is_listed=True)
    self.assertEquals('title', mc.title)

    # Update the CatalogEntry to point at a new MapVersion.
    new_json = '{"description": "description2", "title": "title2"}'
    new_vid = mm.PutNewVersion(new_json)
    e = mc.Get('foo.com', 'label')
    self.assertEquals(vid, e.model.map_version.key().id())
    mc.is_listed = False
    mc.SetMapVersion(mm)

    # Random users shouldn't be able to update catalog entries.
    test_utils.SetUser('random_user@gmail.com')
    self.assertRaises(perms.AuthorizationError, mc.Put)
    # After we grant the CATALOG_EDITOR role, CatalogEntry.Put should work.
    perms.SetGlobalRoles('random_user@gmail.com', [perms.Role.CATALOG_EDITOR])
    mc.Put()

    # The CatalogEntry should now point at the new MapVersion.
    mc = model.CatalogEntry.Get('foo.com', 'label')
    self.assertEquals(new_vid, mc.model.map_version.key().id())
    self.assertEquals('title2', mc.title)
    self.assertEquals(new_json, mc.maproot_json)
    self.assertEquals(False, mc.is_listed)

  def testListedMaps(self):
    """Tests CatalogEntry.GetAll and CatalogEntry.GetListed."""
    mm, _ = test_utils.CreateMapAsAdmin()
    mc = model.CatalogEntry.Create('foo.com', 'abcd', mm, is_listed=False)

    self.assertEquals(0, len(model.CatalogEntry.GetListed()))
    self.assertEquals(0, len(model.CatalogEntry.GetListed('foo.com')))

    maps = list(model.CatalogEntry.GetAll())
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = list(model.CatalogEntry.GetAll('foo.com'))
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = list(model.CatalogEntry.GetByMapId(mm.id))
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    model.CatalogEntry.Create('foo.com', 'abcd', mm, is_listed=True)

    maps = model.CatalogEntry.GetListed()
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = model.CatalogEntry.GetListed('foo.com')
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

  def testMapDelete(self):
    m, _ = test_utils.CreateMapAsAdmin(owners=['owner@example.com'],
                                       editors=['editor@example.com'],
                                       viewers=['viewer@example.com'])
    map_id = m.id
    delete_datetime = self.SetTime(1234567890)

    # Non-owners should not be able to delete the map.
    test_utils.SetUser('editor@example.com')
    m = model.Map.Get(map_id)
    self.assertRaises(perms.AuthorizationError, m.Delete)

    test_utils.SetUser('viewer@example.com')
    m = model.Map.Get(map_id)
    self.assertRaises(perms.AuthorizationError, m.Delete)

    # Owners should be able to delete the map.
    test_utils.SetUser('owner@example.com')
    m = model.Map.Get(map_id)
    m.Delete()
    self.assertEquals(delete_datetime, m.deleted)
    self.assertEquals('owner@example.com', m.deleter.email())


if __name__ == '__main__':
  test_utils.main()
