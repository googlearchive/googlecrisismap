#!/usr/bin/python2.5
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

# Allow relative imports within the app.  # pylint: disable=W0403
import model
import test_utils

from google.appengine.api import memcache
from google.appengine.api import users


def GetRolesForMap(map_object):
  """Gets the set of all roles that the current user has for a MapModel."""
  map_roles = set(model.ROLES) - set(['CATALOG_EDITOR'])
  return set([role for role in map_roles
              if model.CheckAccess(role, object=map_object)])


class MapTests(test_utils.BaseTest):
  """Tests the map model classes and associated access control logic."""

  def setUp(self):
    super(MapTests, self).setUp()

  def testUserRoles(self):
    """Verifies that user access permissions restrict actions correctly."""
    # Check admin roles.
    test_utils.BecomeAdmin()
    m = model.Map.Create('{}', owners=['owner@gmail.com'],
                         editors=['editor@gmail.com'],
                         viewers=['viewer@gmail.com'])
    self.assertEquals(set(['ADMIN', 'MAP_CREATOR', 'MAP_OWNER', 'MAP_EDITOR',
                           'MAP_VIEWER']),
                      GetRolesForMap(m))

    # Verify an admin can perform all operations.
    version_id = m.PutNewVersion('{}')
    m.SetWorldReadable(False)
    m.GetCurrent()
    m.GetVersions()
    m.GetVersion(version_id)

    # Check owner roles.
    test_utils.SetUser('owner@gmail.com')
    self.assertEquals(set(['MAP_OWNER', 'MAP_EDITOR', 'MAP_VIEWER']),
                      GetRolesForMap(m))

    # Verify the owner can perform expected operations.
    self.assertRaises(model.AuthorizationError, model.Map.Create, '{}')
    version_id = m.PutNewVersion('{}')
    m.SetWorldReadable(False)
    m.GetCurrent()
    m.GetVersions()
    m.GetVersion(version_id)

    # Check editor roles.
    test_utils.SetUser('editor@gmail.com')
    self.assertEquals(set(['MAP_EDITOR', 'MAP_VIEWER']),
                      GetRolesForMap(m))

    # Verify the editor can perform expected operations.
    self.assertRaises(model.AuthorizationError, model.Map.Create, '{}')
    version_id = m.PutNewVersion('{}')
    self.assertRaises(model.AuthorizationError, m.SetWorldReadable, False)
    m.GetCurrent()
    m.GetVersions()
    m.GetVersion(version_id)

    # Check viewer roles.
    test_utils.SetUser('viewer@gmail.com')
    self.assertEquals(set(['MAP_VIEWER']), GetRolesForMap(m))

    # Verify the viewer can perform expected operations.
    self.assertRaises(model.AuthorizationError, model.Map.Create, '{}')
    self.assertRaises(model.AuthorizationError, m.PutNewVersion, '{}')
    m.GetCurrent()
    m.GetCurrentJson()
    self.assertRaises(model.AuthorizationError, m.GetVersion, version_id)
    self.assertRaises(model.AuthorizationError, m.GetVersions)

    # Check roles for an unknown user.
    test_utils.SetUser('random@gmail.com')
    # Random user can't view a non-world-readable map.
    self.assertEquals(set(), GetRolesForMap(m))

    # Verify that all operations fail.
    self.assertRaises(model.AuthorizationError, m.PutNewVersion, '{}')
    self.assertRaises(model.AuthorizationError, m.GetCurrent)
    self.assertRaises(model.AuthorizationError, m.GetVersions)
    self.assertRaises(model.AuthorizationError, m.GetVersion, version_id)

    # Check roles for an unknown user on a published map.
    m.model.world_readable = True

    self.assertEquals(set(['MAP_VIEWER']), GetRolesForMap(m))

    # Verify the user can perform only the expected operations.
    self.assertRaises(model.AuthorizationError, model.Map.Create, '{}')
    self.assertRaises(model.AuthorizationError, m.PutNewVersion, '{}')
    self.assertRaises(model.AuthorizationError, m.SetWorldReadable, True)
    m.GetCurrent()
    self.assertRaises(model.AuthorizationError, m.GetVersion, version_id)
    self.assertRaises(model.AuthorizationError, m.GetVersions)

  def testDomainRoles(self):
    """Verifies that domain access permissions restrict actions correctly."""
    test_utils.BecomeAdmin()
    m = model.Map.Create('{}', domain_role='MAP_OWNER', domains=['foo.com'])

    # Verify that user@foo.com gets the domain role for foo.com.
    test_utils.SetUser('user@foo.com')
    self.assertEquals(set(['MAP_OWNER', 'MAP_EDITOR', 'MAP_VIEWER']),
                      GetRolesForMap(m))

    m.model.domain_role = model.ROLES.MAP_EDITOR
    self.assertEquals(set(['MAP_EDITOR', 'MAP_VIEWER']),
                      GetRolesForMap(m))

    m.model.domain_role = model.ROLES.MAP_VIEWER
    self.assertEquals(set(['MAP_VIEWER']), GetRolesForMap(m))

    # Verify that ADMIN doesn't apply to domains.
    m.model.domain_role = model.ROLES.ADMIN
    self.assertEquals(set(), GetRolesForMap(m))

  def testMapCreatorDomains(self):
    """Verifies that the map_creator_domains setting is respected."""
    test_utils.BecomeAdmin()
    model.SetGlobalRoles('foo.com', [model.ROLES.MAP_CREATOR])

    # bar@foo.com has the CREATOR role.
    current_user = test_utils.SetUser('bar@foo.com')
    access_policy = model.AccessPolicy()
    self.assertTrue(
        access_policy.HasGlobalRole(current_user, model.ROLES.MAP_CREATOR))
    self.assertTrue(model.CheckAccess(model.ROLES.MAP_CREATOR),
                    'user %s in domain %s failed CheckAccess for %s' % (
                        current_user, model.GetUserDomain(current_user),
                        model.ROLES.MAP_CREATOR))
    self.assertFalse(model.CheckAccess(model.ROLES.ADMIN))
    model.Map.Create('{}')

    # foo@bar.com doesn't have the CREATOR role.
    test_utils.SetUser('foo@bar.com')
    self.assertFalse(model.CheckAccess(model.ROLES.MAP_CREATOR))
    self.assertRaises(model.AuthorizationError, model.Map.Create, '{}')

  def testVersions(self):
    # pylint is unable to verify the members of Structs
    # pylint: disable-msg=E1101
    """Verifies that creating and setting versions works properly."""
    test_utils.BecomeAdmin()

    json1 = '{"description": "description1"}'
    json2 = '{"description": "description2"}'
    m = model.Map.Create(json1)
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
    m = model.Map.Create(json)

    test_utils.SetUser('random@gmail.com')
    self.assertRaises(model.AuthorizationError, m.GetCurrent)

    test_utils.SetUser('admin@google.com')
    m.SetWorldReadable(True)
    test_utils.SetUser('random@gmail.com')
    self.assertEquals(json, m.GetCurrent().maproot_json)

    test_utils.SetUser('admin@google.com')
    m.SetWorldReadable(False)
    test_utils.SetUser('random@gmail.com')
    self.assertRaises(model.AuthorizationError, m.GetCurrent)

  def testRevokePermission(self):
    """Verifies internal model permission lists are correctly modified."""
    admin = test_utils.BecomeAdmin()
    json = '{"description": "description1"}'
    m = model.Map.Create(json)
    access_policy = model.AccessPolicy()

    user = users.User('user@gmail.com')
    user2 = users.User('user2@gmail.com')

    # Verify starting state of lists.
    self.assertEquals([], m.model.viewers)
    self.assertEquals([], m.model.editors)
    self.assertEquals([admin.email()], m.model.owners)

    permissions = {model.ROLES.MAP_VIEWER: m.model.viewers,
                   model.ROLES.MAP_EDITOR: m.model.editors,
                   model.ROLES.MAP_OWNER: m.model.owners}
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
    m.AssertAccess(model.ROLES.MAP_CREATOR, admin)
    m.RevokePermission(model.ROLES.MAP_CREATOR, user)
    m.AssertAccess(model.ROLES.MAP_CREATOR, admin)

    self.assertEquals([], m.model.viewers)
    self.assertEquals([], m.model.editors)
    self.assertEquals([admin.email()], m.model.owners)

  def testChangePermissionLevel(self):
    """Verifies that permission level changes appropriately."""
    # ChangePermissionLevel calls RevokePermission internally, make sure
    # that the RevokePermissions tests are passing as well.
    test_utils.BecomeAdmin()
    json = '{"description": "description1"}'
    m = model.Map.Create(json)
    access_policy = model.AccessPolicy()

    admin = test_utils.SetUser('admin@google.com')
    user = users.User('user@gmail.com')

    # Verify starting state of lists.
    self.assertEquals([], m.model.viewers)
    self.assertEquals([], m.model.editors)
    self.assertEquals([admin.email()], m.model.owners)

    permissions = {model.ROLES.MAP_VIEWER: m.model.viewers,
                   model.ROLES.MAP_EDITOR: m.model.editors,
                   model.ROLES.MAP_OWNER: m.model.owners}
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
      for other_role in permissions.keys():
        if other_role != role:
          self.assertFalse(user.email() in permissions[other_role])

    # Should do nothing: only viewer, editor, owner roles
    # changeable permissions.
    m.ChangePermissionLevel(model.ROLES.MAP_CREATOR, user)
    self.assertFalse(m.CheckAccess(model.ROLES.MAP_CREATOR, user,
                                   access_policy))

  def testCreate(self):
    """Verifies that map creation works properly."""
    # Verify the default values from Map.Create.
    test_utils.BecomeAdmin()

    m = model.Map.Create('{}')
    self.assertEquals(['admin@google.com'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.viewers)
    self.assertEquals([], m.model.domains)
    self.assertEquals(m.model.world_readable, False)

  def testDelete(self):
    """Tests whether map deletion works properly."""
    m, _ = CreateMapAsAdmin()
    self.assertEquals(m, model.Map.Get(m.id))
    m.Delete()
    self.assertEquals(None, model.Map.Get(m.id))

  def testToCacheKey(self):
    """Tests that cache keys are properly serialized and escaped."""
    self.assertEquals('foo', model.ToCacheKey('foo'))
    self.assertEquals('foo', model.ToCacheKey(['foo']))
    self.assertEquals('foo/bar', model.ToCacheKey(['foo', 'bar']))
    self.assertEquals('foo\\//bar', model.ToCacheKey(['foo/', 'bar']))
    self.assertEquals('f\\\\\\\\oo\\/\\//\\\\b\\/ar',
                      model.ToCacheKey(['f\\\\oo//', '\\b/ar']))

  def testMapCache(self):
    """Tests caching of current JSON data."""
    # Verify the default values from Map.Create.
    test_utils.BecomeAdmin()

    json1 = '{"description": "description1"}'
    json2 = '{"description": "description2", "title": "title2"}'
    json3 = '{"description": "description3", "title": "title3"}'
    m = model.Map.Create(json1, world_readable=True)
    m.PutNewVersion(json2)
    self.assertEquals(json2, m.GetCurrentJson())
    self.assertEquals(m.title, 'title2')
    self.assertEquals(m.description, 'description2')
    # GetCurrentJson should have filled the cache.
    self.assertEquals(json2, memcache.get('Map/%s/json' % m.id))

    # PutVersion should clear the cache.
    m.PutNewVersion(json3)
    self.assertEquals(None, memcache.get('Map/%s/json' % m.id))
    self.assertEquals(json3, m.GetCurrentJson())

  def testConfig(self):
    """Tests storage of simple and structured values in Config entities."""
    key = 'item'
    self.assertEquals(None, model.Config.Get(key))
    model.Config.Set(key, 'value')
    self.assertEquals('value', model.Config.Get(key))
    self.assertEquals('value', model.Config.GetOrInsert(key, 'new value'))
    model.Config.Set(key, [3, 4, {'a': 'b'}, None])
    self.assertEquals([3, 4, {'a': 'b'}, None], model.Config.Get(key))
    self.assertEquals('new value', model.Config.GetOrInsert('xy', 'new value'))
    self.assertEquals(None, model.GetInitialDomainRole('xyz.com'))
    model.SetInitialDomainRole('xyz.com', model.ROLES.MAP_VIEWER)
    self.assertEquals(model.ROLES.MAP_VIEWER,
                      model.GetInitialDomainRole('xyz.com'))

  def testGetAll(self):
    """Tests Maps.GetAll and Maps.GetViewable."""
    test_utils.BecomeAdmin()
    m1 = model.Map.Create('{}', world_readable=True)
    m2 = model.Map.Create('{}', world_readable=False)

    def ModelKeys(maps):
      return set([m.model.key() for m in maps])

    all_maps = ModelKeys([m1, m2])
    public_maps = ModelKeys([m1])
    self.assertEquals(all_maps, ModelKeys(list(model.Map.GetViewable())))
    self.assertEquals(all_maps, ModelKeys(list(model.Map.GetAll())))
    test_utils.SetUser('john.q.public@gmail.com')
    self.assertRaises(model.AuthorizationError, model.Map.GetAll)
    self.assertEquals(public_maps, ModelKeys(model.Map.GetViewable()))


def CreateMapAsAdmin(**kwargs):
  test_utils.BecomeAdmin()
  map_object = model.Map.Create(
      '{"description": "description", "title": "title"}', **kwargs)
  return map_object, map_object.GetCurrent().id


class CatalogEntryTests(test_utils.BaseTest):
  """Tests the CatalogEntry class."""

  def testCreate(self):
    """Tests creation of a CatalogEntry."""
    mm, _ = CreateMapAsAdmin(viewers=['random_user@gmail.com'])

    # Random users shouldn't be able to create catalog entries.
    test_utils.SetUser('random_user@gmail.com')
    self.assertRaises(model.AuthorizationError, model.CatalogEntry.Create,
                      'foo.com', 'label', mm, is_listed=True)
    # After we grant the CATALOG_EDITOR role, CatalogEntry.Create should work.
    model.SetGlobalRoles('random_user@gmail.com', [model.ROLES.CATALOG_EDITOR])
    mc = model.CatalogEntry.Create('foo.com', 'label', mm, is_listed=True)

    self.assertEquals('foo.com', mc.domain)
    self.assertEquals('label', mc.label)
    self.assertEquals('title', mc.title)
    self.assertEquals(True, mc.is_listed)
    self.assertEquals(mm.id, mc.map_id)

    # Creating another entry with the same path_name should succeed.
    model.CatalogEntry.Create('foo.com', 'label', mm)

  def testDelete(self):
    mm, _ = CreateMapAsAdmin(viewers=['random_user@gmail.com'])
    model.CatalogEntry.Create('foo.com', 'label', mm, is_listed=True)

    # Validate that CatalogEntry is created successfully.
    self.assertEquals('title', model.CatalogEntry.Get('foo.com', 'label').title)
    # Trying to delete a nonexisting entry should raise an exception.
    self.assertRaises(ValueError, model.CatalogEntry.Delete, 'foo.com', 'xyz')
    # Random users shouldn't be able to delete catalog entries.
    test_utils.SetUser('random_user@gmail.com')
    self.assertRaises(model.AuthorizationError, model.CatalogEntry.Delete,
                      'foo.com', 'label')
    # After we grant the CATALOG_EDITOR role, CatalogEntry.Delete should work.
    model.SetGlobalRoles('random_user@gmail.com', [model.ROLES.CATALOG_EDITOR])
    model.CatalogEntry.Delete('foo.com', 'label')

    # Assert that the entry is successfully deleted.
    self.assertEquals(None, model.CatalogEntry.Get('foo.com', 'label'))
    # A CatalogEntry cannot be deleted twice.
    self.assertRaises(ValueError, model.CatalogEntry.Delete, 'foo.com', 'label')

  def testUpdate(self):
    """Tests modification and update of an existing CatalogEntry."""
    mm, vid = CreateMapAsAdmin(viewers=['random_user@gmail.com'])
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
    self.assertRaises(model.AuthorizationError, mc.Put)
    # After we grant the CATALOG_EDITOR role, CatalogEntry.Put should work.
    model.SetGlobalRoles('random_user@gmail.com', [model.ROLES.CATALOG_EDITOR])
    mc.Put()

    # The CatalogEntry should now point at the new MapVersion.
    mc = model.CatalogEntry.Get('foo.com', 'label')
    self.assertEquals(new_vid, mc.model.map_version.key().id())
    self.assertEquals('title2', mc.title)
    self.assertEquals(new_json, mc.maproot_json)
    self.assertEquals(False, mc.is_listed)

  def testListedMaps(self):
    """Tests CatalogEntry.GetAll{InDomain} and .GetListed{InDomain}."""
    mm, _ = CreateMapAsAdmin()
    mc = model.CatalogEntry.Create('foo.com', 'abcd', mm, is_listed=False)

    self.assertEquals(0, len(model.CatalogEntry.GetListed()))
    self.assertEquals(0, len(model.CatalogEntry.GetListedInDomain('foo.com')))

    maps = list(model.CatalogEntry.GetAll())
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = list(model.CatalogEntry.GetAllInDomain('foo.com'))
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = list(model.CatalogEntry.GetByMapId(mm.id))
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    model.CatalogEntry.Create('foo.com', 'abcd', mm, is_listed=True)

    maps = model.CatalogEntry.GetListed()
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = model.CatalogEntry.GetListedInDomain('foo.com')
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())


if __name__ == '__main__':
  test_utils.main()
