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

"""Unit tests for perms.py."""

import model
import mox
import perms
import test_utils
import utils


def GetRolesForMap(map_object):
  """Gets the set of all roles that the current user has for a MapModel."""
  map_roles = set(perms.Role) - set(
      ['CATALOG_EDITOR', 'MAP_CREATOR', 'DOMAIN_ADMIN'])
  return set([role for role in map_roles
              if perms.CheckAccess(role, target=map_object)])


class PermsTests(test_utils.BaseTest):

  def testUserRoles(self):
    """Verifies that user access permissions restrict actions correctly."""
    # Check admin roles.
    test_utils.BecomeAdmin()
    m = model.Map.Create('{}', 'xyz.com',
                         owners=['owner@gmail.com'],
                         editors=['editor@gmail.com'],
                         viewers=['viewer@gmail.com'])
    self.assertEquals(set(['ADMIN', 'MAP_OWNER', 'MAP_EDITOR', 'MAP_VIEWER']),
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
    self.assertRaises(
        perms.AuthorizationError, model.Map.Create, '{}', 'xyz.com')
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
    self.assertRaises(
        perms.AuthorizationError, model.Map.Create, '{}', 'xyz.com')
    version_id = m.PutNewVersion('{}')
    self.assertRaises(perms.AuthorizationError, m.SetWorldReadable, False)
    m.GetCurrent()
    m.GetVersions()
    m.GetVersion(version_id)

    # Check viewer roles.
    test_utils.SetUser('viewer@gmail.com')
    self.assertEquals(set(['MAP_VIEWER']), GetRolesForMap(m))

    # Verify the viewer can perform expected operations.
    self.assertRaises(
        perms.AuthorizationError, model.Map.Create, '{}', 'xyz.com')
    self.assertRaises(perms.AuthorizationError, m.PutNewVersion, '{}')
    m.GetCurrent()
    m.GetCurrentJson()
    self.assertRaises(perms.AuthorizationError, m.GetVersion, version_id)
    self.assertRaises(perms.AuthorizationError, m.GetVersions)

    # Check roles for an unknown user.
    test_utils.SetUser('random@gmail.com')
    # Random user can't view a non-world-readable map.
    self.assertEquals(set(), GetRolesForMap(m))

    # Verify that all operations fail.
    self.assertRaises(perms.AuthorizationError, m.PutNewVersion, '{}')
    self.assertRaises(perms.AuthorizationError, m.GetCurrent)
    self.assertRaises(perms.AuthorizationError, m.GetVersions)
    self.assertRaises(perms.AuthorizationError, m.GetVersion, version_id)

    # Check roles for an unknown user on a published map.
    m.model.world_readable = True

    self.assertEquals(set(['MAP_VIEWER']), GetRolesForMap(m))

    # Verify the user can perform only the expected operations.
    self.assertRaises(
        perms.AuthorizationError, model.Map.Create, '{}', 'xyz.com')
    self.assertRaises(perms.AuthorizationError, m.PutNewVersion, '{}')
    self.assertRaises(perms.AuthorizationError, m.SetWorldReadable, True)
    m.GetCurrent()
    self.assertRaises(perms.AuthorizationError, m.GetVersion, version_id)
    self.assertRaises(perms.AuthorizationError, m.GetVersions)

  def testDomainRoles(self):
    """Verifies that domain access permissions restrict actions correctly."""
    test_utils.BecomeAdmin()
    m = model.Map.Create('{}', 'foo.com', domain_role='MAP_OWNER')

    # Verify that user@foo.com gets the domain role for foo.com.
    test_utils.SetUser('user@foo.com')
    self.assertEquals(set(['MAP_OWNER', 'MAP_EDITOR', 'MAP_VIEWER']),
                      GetRolesForMap(m))

    m.model.domain_role = perms.Role.MAP_EDITOR
    self.assertEquals(set(['MAP_EDITOR', 'MAP_VIEWER']),
                      GetRolesForMap(m))

    m.model.domain_role = perms.Role.MAP_VIEWER
    self.assertEquals(set(['MAP_VIEWER']), GetRolesForMap(m))

    # Verify that ADMIN doesn't apply to domains.
    m.model.domain_role = perms.Role.ADMIN
    self.assertEquals(set(), GetRolesForMap(m))

  def testMapCreatorDomains(self):
    """Verifies that the map_creator_domains setting is respected."""
    test_utils.BecomeAdmin()
    perms.Grant('foo.com', perms.Role.MAP_CREATOR, 'xyz.com')

    # bar@foo.com has the CREATOR role.
    current_user = test_utils.SetUser('bar@foo.com')
    access_policy = perms.AccessPolicy()
    self.assertTrue(perms.CheckAccess(
        perms.Role.MAP_CREATOR, 'xyz.com', current_user, access_policy))
    self.assertTrue(
        perms.CheckAccess(perms.Role.MAP_CREATOR, 'xyz.com'),
        'user %s in domain %s failed CheckAccess for %s' % (
            current_user, utils.GetUserDomain(current_user),
            [perms.Role.MAP_CREATOR, 'xyz.com']))
    self.assertFalse(perms.CheckAccess(perms.Role.ADMIN))
    model.Map.Create('{}', 'xyz.com')

    # foo@bar.com doesn't have the CREATOR role.
    test_utils.SetUser('foo@bar.com')
    self.assertFalse(
        perms.CheckAccess(
            perms.Role.MAP_CREATOR, target='xyz.com'))
    self.assertRaises(
        perms.AuthorizationError, model.Map.Create, '{}', 'xyz.com')

  def testDomainAdminRole(self):
    test_utils.BecomeAdmin()
    perms.Grant('xyz.com', perms.Role.DOMAIN_ADMIN, 'xyz.com')
    perms.Grant('foo@not-xyz.com', perms.Role.DOMAIN_ADMIN, 'xyz.com')
    test_utils.SetUser('foo@xyz.com')
    self.assertTrue(
        perms.CheckAccess(perms.Role.DOMAIN_ADMIN, 'xyz.com'))
    test_utils.SetUser('foo@not-xyz.com')
    self.assertTrue(
        perms.CheckAccess(perms.Role.DOMAIN_ADMIN, 'xyz.com'))
    test_utils.SetUser('bar@not-xyz.com')
    self.assertFalse(
        perms.CheckAccess(perms.Role.DOMAIN_ADMIN, 'xyz.com'))
    test_utils.BecomeAdmin()
    self.assertTrue(
        perms.CheckAccess(perms.Role.DOMAIN_ADMIN, 'xyz.com'))

  def assertEqualDomainPerms(self, expected, actual):
    self.assertEqual(len(expected), len(actual))
    for key, domain_perms in expected.iteritems():
      self.assertIn(key, actual)
      self.assertItemsEqual(domain_perms, actual[key])

  def testSetGetDomainRoles(self):
    test_utils.BecomeAdmin()
    # Anyone at xyz.com can create maps on xyz or on abc.com
    perms.SetDomainRoles('xyz.com', 'xyz.com', [perms.Role.MAP_CREATOR])
    perms.SetDomainRoles('xyz.com', 'abc.com', [perms.Role.MAP_CREATOR])
    # Anyone at abc.com can create maps and edit the catalog at abc.com
    perms.SetDomainRoles('abc.com', 'abc.com',
                         [perms.Role.CATALOG_EDITOR, perms.Role.MAP_CREATOR])
    # Sally is a domain admin and catalog editor for xyz.com, and a map creator
    # for abc.com
    perms.SetDomainRoles('sally@xyz.com', 'xyz.com',
                         [perms.Role.DOMAIN_ADMIN, perms.Role.CATALOG_EDITOR])
    perms.SetDomainRoles('sally@xyz.com', 'abc.com', [perms.Role.MAP_CREATOR])
    # Bob is a map creator at xyz.com, despite belonging to abc.com
    perms.SetDomainRoles('bob@abc.com', 'xyz.com', [perms.Role.MAP_CREATOR])
    # Zarg is a map creator at unimportant.org
    perms.SetDomainRoles('zarg@unimportant.org', 'unimportant.org',
                         [perms.Role.MAP_CREATOR])
    # Ensure other values stored in Config don't interfere
    model.SetInitialDomainRole('xyz.com', perms.Role.MAP_VIEWER)

    self.assertEqualDomainPerms(
        {'xyz.com': [perms.Role.MAP_CREATOR],
         'sally@xyz.com': [perms.Role.DOMAIN_ADMIN, perms.Role.CATALOG_EDITOR],
         'bob@abc.com': [perms.Role.MAP_CREATOR]},
        perms.GetSubjectsInDomain('xyz.com'))
    self.assertEqualDomainPerms(
        {'xyz.com': [perms.Role.MAP_CREATOR],
         'abc.com': [perms.Role.CATALOG_EDITOR, perms.Role.MAP_CREATOR],
         'sally@xyz.com': [perms.Role.MAP_CREATOR]},
        perms.GetSubjectsInDomain('abc.com'))

    # Revoke a permission
    perms.SetDomainRoles(
        'sally@xyz.com', 'xyz.com', [perms.Role.CATALOG_EDITOR])
    self.assertEqual(
        [perms.Role.CATALOG_EDITOR],
        perms.GetDomainRoles('sally@xyz.com', 'xyz.com'))

  def testGetDomainsWithRole(self):
    perms.SetDomainRoles('sally@xyz.com', 'xyz.com',
                         [perms.Role.DOMAIN_ADMIN, perms.Role.CATALOG_EDITOR])
    perms.SetDomainRoles('sally@xyz.com', 'abc.com', [perms.Role.MAP_CREATOR])
    perms.SetDomainRoles('xyz.com', 'xyz.com', [perms.Role.MAP_CREATOR])
    test_utils.SetUser('sally@xyz.com')
    self.assertEqual(['abc.com', 'xyz.com'],
                     perms.GetDomainsWithRole(perms.Role.MAP_CREATOR))
    self.assertEqual(['xyz.com'],
                     perms.GetDomainsWithRole(perms.Role.DOMAIN_ADMIN))

  def testCheckAccessRaisesOnBadTarget(self):
    my_map, _ = test_utils.CreateMapAsAdmin()

    # Roles that require a domain as the target
    for role in (perms.Role.CATALOG_EDITOR, perms.Role.MAP_CREATOR):
      # Test both no target and a target of the wrong class
      self.assertRaises(TypeError, perms.CheckAccess, role)
      self.assertRaises(TypeError, perms.CheckAccess, role, target=my_map)

    # Roles that require a map as a target
    for role in (perms.Role.MAP_OWNER, perms.Role.MAP_EDITOR,
                 perms.Role.MAP_VIEWER):
      # Test both no target and a target of the wrong class
      self.assertRaises(TypeError, perms.CheckAccess, role)
      self.assertRaises(TypeError, perms.CheckAccess, role, target='xyz.com')

  def testCheckAssertRaisesOnUnknownRole(self):
    self.assertFalse('NotARole' in perms.Role)
    self.assertRaises(ValueError, perms.CheckAccess, 'NotARole')

  def testUnknownUser(self):
    m, _ = test_utils.CreateMapAsAdmin()
    self.mox.StubOutWithMock(utils, 'GetCurrentUser')
    utils.GetCurrentUser().AndReturn(None)
    self.mox.ReplayAll()
    self.assertFalse(perms.CheckAccess(perms.Role.MAP_EDITOR, target=m))
    self.mox.VerifyAll()

  def testCaching(self):
    subject, role, target = 'admin@xyz.com', perms.Role.DOMAIN_ADMIN, 'xyz.com'
    self.assertFalse(perms.Query(None, None, None))
    perms.Grant(subject, role, target)
    perms.Get(subject, role, target)

    self.mox.StubOutWithMock(perms, '_LoadPermissions')
    perms._LoadPermissions(
        mox.IgnoreArg(), mox.IgnoreArg()).AndRaise(ValueError)

    self.mox.ReplayAll()
    my_perm = perms.Get(subject, role, target)
    self.assertTrue(my_perm)
    perms.Revoke(subject, role, target)
    try:
      # This should hit our mock because the cached entry should be gone
      perms.Get(subject, role, target)
    except ValueError:
      pass
    self.mox.VerifyAll()

  def testRevoke(self):
    subject, role, target = 'edit@xyz.com', perms.Role.CATALOG_EDITOR, 'xyz.com'
    self.assertFalse(perms.Query(None, None, None))
    perms.Grant(subject, role, target)
    test_utils.SetUser(subject)
    self.assertTrue(perms.CheckAccess(role, target))
    my_perm = perms.Get(subject, role, target)
    self.assertTrue(my_perm)
    perms.Revoke(subject, role, target)
    self.assertFalse(perms.CheckAccess(role, target))


if __name__ == '__main__':
  test_utils.main()
