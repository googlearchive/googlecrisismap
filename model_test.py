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

import copy
import datetime
import domains
import logs
import model
import perms
import test_utils
import users
import utils

from google.appengine.ext import ndb


MAP1_WITHOUT_ID = {'title': 'One', 'description': 'description1'}
MAP2_WRONG_ID = {'id': 'foo', 'title': 'Two', 'description': 'description2'}
# The 'id' property of the first map written during a test will be set to
# 'random_id_1' due to test_utils.MakePredictableId.
MAP1 = {'id': 'random_id_1', 'title': 'One', 'description': 'description1'}
MAP2 = {'id': 'random_id_1', 'title': 'Two', 'description': 'description2'}
MAP3 = {'id': 'random_id_1', 'title': 'Three', 'description': 'description3'}


class MapTests(test_utils.BaseTest):
  """Tests the map model classes and associated access control logic."""

  def CreateMap(self, title, role, user_ids):
    """Creates a map with all users in user_ids assigned a permissions role."""
    m = test_utils.CreateMap({'title': title})
    for u in user_ids:
      m.ChangePermissionLevel(role, u)
    return m

  def AssertMapPermissions(self, m, role, permissions, missing_permissions):
    """Checks map permissions for a list of users in a given role."""
    for user_id in permissions:
      self.assertTrue(m.CheckAccess(role, user_id))
    for user_id in missing_permissions:
      self.assertFalse(m.CheckAccess(role, user_id))

  def testVersions(self):
    """Verifies that creating and setting versions works properly."""
    with test_utils.RootLogin():
      m = model.Map.Create(MAP1, 'xyz.com')
      id1 = m.GetCurrent().id
      id2 = m.PutNewVersion(MAP2)

      # Verify that versions are returned in reverse chronological order.
      versions = list(m.GetVersions())
      self.assertEquals(id2, versions[0].id)
      self.assertEquals(id1, versions[1].id)

      # Verify that GetCurrent() sees the most recent version as expected.
      current = m.GetCurrent()
      self.assertEquals(id2, current.id)
      self.assertEquals(MAP2, current.map_root)
      self.assertEquals('root', current.creator_uid)

  def testWorldReadable(self):
    # Verify that the map is publicly visible only if world_readable is True.
    with test_utils.RootLogin():
      m = model.Map.Create(MAP1, 'xyz.com')
    with test_utils.Login('outsider'):
      self.assertRaises(perms.AuthorizationError, model.Map.Get, m.id)

    with test_utils.RootLogin():
      m.SetWorldReadable(True)
    with test_utils.Login('outsider'):
      self.assertEquals(MAP1, model.Map.Get(m.id).map_root)

    with test_utils.RootLogin():
      m.SetWorldReadable(False)
    with test_utils.Login('outsider'):
      self.assertRaises(perms.AuthorizationError, model.Map.Get, m.id)

  def testRevokePermission(self):
    """Verifies internal model permission lists are correctly modified."""
    user1 = test_utils.SetupUser(test_utils.Login('user1'))
    user2 = test_utils.SetupUser(test_utils.Login('user2'))
    with test_utils.RootLogin() as user0:
      m = test_utils.CreateMap()

      permissions = {perms.Role.MAP_VIEWER: m.model.viewers,
                     perms.Role.MAP_REVIEWER: m.model.reviewers,
                     perms.Role.MAP_EDITOR: m.model.editors,
                     perms.Role.MAP_OWNER: m.model.owners}
      initial_grantees = copy.deepcopy(permissions)
      for role in permissions:
        permissions[role] += ['user1', 'user2']
        m.AssertAccess(role, user1)
        m.AssertAccess(role, user2)

        m.RevokePermission(role, 'user2')
        self.assertEquals(initial_grantees[role] + ['user1'], permissions[role])
        self.assertFalse(m.CheckAccess(role, user2))
        m.RevokePermission(role, 'user2')  # idempotent, no effect
        self.assertEquals(initial_grantees[role] + ['user1'], permissions[role])
        self.assertFalse(m.CheckAccess(role, user2))
        m.RevokePermission(role, 'user1')
        self.assertEquals(initial_grantees[role], permissions[role])
        self.assertFalse(m.CheckAccess(role, user1))

      # Should do nothing: only viewer, editor, and owner are revocable.
      m.AssertAccess(perms.Role.ADMIN, user0)
      m.RevokePermission(perms.Role.ADMIN, 'root')
      m.AssertAccess(perms.Role.ADMIN, user0)

  def testChangePermissionLevel(self):
    """Verifies that permission level changes appropriately."""
    user1 = test_utils.SetupUser(test_utils.Login('user1'))
    with test_utils.RootLogin():
      m = test_utils.CreateMap()

      permissions = {perms.Role.MAP_VIEWER: m.model.viewers,
                     perms.Role.MAP_REVIEWER: m.model.reviewers,
                     perms.Role.MAP_EDITOR: m.model.editors,
                     perms.Role.MAP_OWNER: m.model.owners}
      initial_grantees = copy.deepcopy(permissions)
      for role in permissions:
        m.ChangePermissionLevel(role, 'user1')  # grant permission
        self.assertEquals(initial_grantees[role] + ['user1'], permissions[role])
        self.assertTrue(m.CheckAccess(role, user1))
        m.ChangePermissionLevel(role, 'user1')  # idempotent, no effect
        self.assertEquals(initial_grantees[role] + ['user1'], permissions[role])
        self.assertTrue(m.CheckAccess(role, user1))

        # Make sure the user doesn't have any of the other permissions.
        for other_role in permissions:
          if other_role != role:
            self.assertFalse('user1' in permissions[other_role])

      # Should do nothing: only viewer, editor, owner are valid roles.
      m.ChangePermissionLevel(perms.Role.ADMIN, 'user1')
      self.assertFalse(m.CheckAccess(perms.Role.ADMIN, user1))

  def testCreate(self):
    """Verifies that map creation works properly."""
    # Verify the default values from Map.Create.
    m = test_utils.CreateMap()
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals([], m.model.viewers)
    self.assertEquals('xyz.com', m.model.domain)
    self.assertEquals(m.model.world_readable, False)

  def testMapId(self):
    """Verifies that the "id" property of maps is enforced to be the map ID."""
    with test_utils.RootLogin():
      # "id" property should be filled in if it's missing.
      m = test_utils.CreateMap(MAP1_WITHOUT_ID)
      self.assertEquals(MAP1, m.map_root)
      # "id" property should be overwritten if it's wrong.
      m.PutNewVersion(MAP2_WRONG_ID)
      self.assertEquals(MAP2, m.map_root)

  def testInitialDomainRole(self):
    """Verifies that map creation sets up initial permissions properly."""
    # Verify the default values from Map.Create.
    perms.Grant('member', perms.Role.MAP_CREATOR, 'xyz.com')
    with test_utils.RootLogin():
      domains.Domain.Put('xyz.com', initial_domain_role=perms.Role.MAP_OWNER)
    m = test_utils.CreateMap()
    self.assertEquals(perms.Role.MAP_OWNER, m.model.domain_role)
    self.assertEquals({'root', 'member'}, set(m.model.owners))
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals([], m.model.viewers)

    with test_utils.RootLogin():
      domains.Domain.Put('xyz.com', initial_domain_role=perms.Role.MAP_EDITOR)
    m = test_utils.CreateMap()
    self.assertEquals(perms.Role.MAP_EDITOR, m.model.domain_role)
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals(['member'], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals([], m.model.viewers)

    with test_utils.RootLogin():
      domains.Domain.Put('xyz.com', initial_domain_role=perms.Role.MAP_REVIEWER)
    m = test_utils.CreateMap()
    self.assertEquals(perms.Role.MAP_REVIEWER, m.model.domain_role)
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals(['member'], m.model.reviewers)
    self.assertEquals([], m.model.viewers)

    with test_utils.RootLogin():
      domains.Domain.Put('xyz.com', initial_domain_role=perms.Role.MAP_VIEWER)
    m = test_utils.CreateMap()
    self.assertEquals(perms.Role.MAP_VIEWER, m.model.domain_role)
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals(['member'], m.model.viewers)

    with test_utils.RootLogin():
      domains.Domain.Put('xyz.com', initial_domain_role=perms.Role.NONE)
    m = test_utils.CreateMap()
    self.assertEquals(perms.Role.NONE, m.model.domain_role)
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals([], m.model.viewers)

  def testMapCache(self):
    """Tests caching of MapRoot data."""
    # Verify the default values from Map.Create.
    self.SetTime(0)
    self.StubTimeSleep()
    with test_utils.RootLogin():
      m = model.Map.Create(MAP1, 'xyz.com', world_readable=True)
      m.PutNewVersion(MAP2)
      self.assertEquals(MAP2, m.map_root)
      self.assertEquals(m.title, 'Two')
      self.assertEquals(m.description, 'description2')
      # GetMapRoot should have filled the cache.
      self.assertEquals(MAP2, model.MAP_ROOT_CACHE.Get(m.id))

      m.PutNewVersion(MAP3)  # should update the cache
      self.SetTime(1)  # advance past the ULL so we see the update
      self.assertEquals(None, model.MAP_ROOT_CACHE.Get(m.id))
      self.assertEquals(MAP3, m.map_root)

  def testGetAll(self):
    """Tests Maps.GetAll and Maps.GetViewable."""
    with test_utils.RootLogin() as root:
      m1 = model.Map.Create({}, 'xyz.com', world_readable=True)
      m2 = model.Map.Create({}, 'xyz.com', world_readable=False)

      def ModelKeys(maps):
        return {m.model.key() for m in maps}

      all_maps = ModelKeys([m1, m2])
      public_maps = ModelKeys([m1])

      self.assertEquals(all_maps, ModelKeys(model.Map.GetViewable(root)))
      self.assertEquals(all_maps, ModelKeys(model.Map.GetAll()))

    with test_utils.Login('outsider') as outsider:
      self.assertRaises(perms.AuthorizationError, model.Map.GetAll)
      self.assertEquals(public_maps, ModelKeys(model.Map.GetViewable(outsider)))


class CatalogEntryTests(test_utils.BaseTest):
  """Tests the CatalogEntry class."""

  def testCreate(self):
    """Tests creation of a CatalogEntry."""
    m = test_utils.CreateMap(
        {'title': 'Fancy fancy'}, editors=['publisher', 'outsider'])
    self.CaptureLog()

    with test_utils.Login('outsider'):
      # User 'outsider' doesn't have CATALOG_EDITOR.
      self.assertRaises(perms.AuthorizationError, model.CatalogEntry.Create,
                        'xyz.com', 'label', m)
      # Even with CATALOG_EDITOR, CatalogEntry.Create should still fail because
      # user 'outsider' can't view the map.
      perms.Grant('outsider', perms.Role.CATALOG_EDITOR, 'xyz.com')

    with test_utils.Login('publisher'):
      # Initially, user 'publisher' doesn't have CATALOG_EDITOR.
      self.assertRaises(perms.AuthorizationError, model.CatalogEntry.Create,
                        'xyz.com', 'label', m)
      # After we grant CATALOG_EDITOR, 'publisher' should be able to publish.
      perms.Grant('publisher', perms.Role.CATALOG_EDITOR, 'xyz.com')
      mc = model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      self.assertEquals('xyz.com', mc.domain)
      self.assertEquals('label', mc.label)
      self.assertEquals('Fancy fancy', mc.title)
      self.assertTrue(mc.is_listed)
      self.assertEquals(m.id, mc.map_id)
      self.AssertLog(logs.Event.MAP_PUBLISHED, map_id=m.id,
                     domain_name='xyz.com', catalog_entry_key=mc.id)

      # Creating another entry with the same path_name should succeed.
      model.CatalogEntry.Create('xyz.com', 'label', m)

  def testDelete(self):
    m = test_utils.CreateMap({'title': 'Bleg'}, viewers=['viewer'])
    with test_utils.RootLogin():
      entry = model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)

    # Validate that the CatalogEntry is created successfully.
    self.assertEquals('Bleg', model.CatalogEntry.Get('xyz.com', 'label').title)
    # Trying to delete a nonexisting entry should raise an exception.
    self.assertRaises(ValueError, model.CatalogEntry.Delete, 'xyz.com', 'xyz')
    # Random users shouldn't be able to delete catalog entries.
    with test_utils.Login('outsider'):
      self.assertRaises(perms.AuthorizationError, model.CatalogEntry.Delete,
                        'xyz.com', 'label')
      # After we grant the CATALOG_EDITOR role, CatalogEntry.Delete should work.
      perms.Grant('outsider', perms.Role.CATALOG_EDITOR, 'xyz.com')
      self.CaptureLog()
      model.CatalogEntry.Delete('xyz.com', 'label')

    # Assert that the entry is successfully deleted.
    self.assertEquals(None, model.CatalogEntry.Get('xyz.com', 'label'))
    self.AssertLog(
        logs.Event.MAP_UNPUBLISHED, uid='outsider', domain_name='xyz.com',
        map_id=m.id, catalog_entry_key=entry.model.key().name())
    # A CatalogEntry cannot be deleted twice.
    self.assertRaises(ValueError, model.CatalogEntry.Delete, 'xyz.com', 'label')

  def testDelete_StickyCatalogEntries(self):
    # Under the sticky catalog policy, even catalog editors should not be able
    # to delete catalog entries if they are not the owner.
    m = test_utils.CreateMap(editors=['publisher', 'coworker'])
    with test_utils.RootLogin():
      domains.Domain.Put('xyz.com', has_sticky_catalog_entries=True)
      perms.Grant('publisher', perms.Role.CATALOG_EDITOR, 'xyz.com')
      perms.Grant('coworker', perms.Role.CATALOG_EDITOR, 'xyz.com')

    with test_utils.Login('publisher'):
      model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
    with test_utils.Login('coworker'):
      self.assertRaises(perms.NotCatalogEntryOwnerError,
                        model.CatalogEntry.Delete, 'xyz.com', 'label')
    with test_utils.Login('publisher'):
      model.CatalogEntry.Delete('xyz.com', 'label')

  def testPut(self):
    """Tests modification and update of an existing CatalogEntry."""
    perms.Grant('publisher', perms.Role.CATALOG_EDITOR, 'xyz.com')
    with test_utils.Login('publisher'):
      m = test_utils.CreateMap(MAP1, editors=['publisher'])
      mc = model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      self.assertEquals('One', mc.title)

      # Update the CatalogEntry to point at a new MapVersion.
      m.PutNewVersion(MAP2)
      mc = model.CatalogEntry.Get('xyz.com', 'label')
      self.assertEquals('One', mc.title)  # no change yet
      mc.is_listed = True
      mc.SetMapVersion(m)

    # Random users shouldn't be able to update catalog entries.
    with test_utils.Login('outsider'):
      self.assertRaises(perms.AuthorizationError, mc.Put)
      # After we grant the CATALOG_EDITOR role, CatalogEntry.Put should work.
      perms.Grant('outsider', perms.Role.CATALOG_EDITOR, 'xyz.com')
      mc.Put()

    # The CatalogEntry should now point at the new MapVersion.
    mc = model.CatalogEntry.Get('xyz.com', 'label')
    self.assertEquals('Two', mc.title)
    self.assertEquals(MAP2, mc.map_root)
    self.assertEquals(True, mc.is_listed)

  def testPut_StickyCatalogEntries(self):
    # Under the sticky catalog policy, even catalog editors should not be able
    # to update catalog entries if they are not the owner.
    with test_utils.RootLogin():
      domains.Domain.Put('xyz.com', has_sticky_catalog_entries=True)
      perms.Grant('publisher', perms.Role.CATALOG_EDITOR, 'xyz.com')
      perms.Grant('coworker', perms.Role.CATALOG_EDITOR, 'xyz.com')

    with test_utils.Login('publisher'):
      m = test_utils.CreateMap(MAP1, editors=['publisher', 'coworker'])
      mc = model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      m.PutNewVersion(MAP2)

    # Even though coworker has CATALOG_EDITOR, she can't overwrite the entry.
    with test_utils.Login('coworker'):
      mc.SetMapVersion(m)
      self.assertRaises(perms.NotCatalogEntryOwnerError, mc.Put)
    with test_utils.Login('publisher'):
      mc.Put()  # publisher owns the catalog entry, so this succeeds

  def testListedMaps(self):
    """Tests CatalogEntry.GetAll and CatalogEntry.GetListed."""
    with test_utils.RootLogin():
      m = test_utils.CreateMap()
      mc = model.CatalogEntry.Create('xyz.com', 'abcd', m, is_listed=False)

    self.assertEquals(0, len(model.CatalogEntry.GetListed()))
    self.assertEquals(0, len(model.CatalogEntry.GetListed('xyz.com')))

    maps = list(model.CatalogEntry.GetAll())
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = list(model.CatalogEntry.GetAll('xyz.com'))
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = list(model.CatalogEntry.GetByMapId(m.id))
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    with test_utils.RootLogin():
      model.CatalogEntry.Create('xyz.com', 'abcd', m, is_listed=True)

    maps = model.CatalogEntry.GetListed()
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

    maps = model.CatalogEntry.GetListed('xyz.com')
    self.assertEquals(1, len(maps))
    self.assertEquals(mc.model.key(), maps[0].model.key())

  def testMapDelete(self):
    with test_utils.RootLogin():
      m = test_utils.CreateMap(owners=['owner'], editors=['editor'],
                               reviewers=['reviewer'], viewers=['viewer'])
      model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      map_id = m.id

    # Non-owners should not be able to delete the map.
    with test_utils.Login('editor'):
      self.assertRaises(perms.AuthorizationError, model.Map.Get(map_id).Delete)
    with test_utils.Login('reviewer'):
      self.assertRaises(perms.AuthorizationError, model.Map.Get(map_id).Delete)
    with test_utils.Login('viewer'):
      self.assertRaises(perms.AuthorizationError, model.Map.Get(map_id).Delete)

    # Owners should be able to delete the map.
    self.CaptureLog()
    with test_utils.Login('owner'):
      m = model.Map.Get(map_id)
      m.Delete()
      self.assertTrue(m.is_deleted)
      self.assertEquals('owner', m.deleter_uid)
      self.AssertLog(logs.Event.MAP_DELETED, map_id=m.id, uid='owner')

    # The catalog entry should be gone.
    self.assertEquals(None, model.CatalogEntry.Get('xyz.com', 'label'))

    # The map should no longer be retrievable by Get and GetAll.
    self.assertEquals(None, model.Map.Get(map_id))
    self.assertEquals([], list(model.Map.GetViewable(users.GetCurrent())))

    # Non-admins (even the owner) should not be able to retrieve deleted maps.
    self.assertRaises(perms.AuthorizationError, model.Map.GetDeleted, map_id)
    self.CaptureLog()

    # Admins should be able to undelete, which makes the map viewable again.
    with test_utils.RootLogin():
      m = model.Map.GetDeleted(map_id)
      m.Undelete()
    with test_utils.Login('viewer'):
      self.assertTrue(model.Map.Get(map_id))
    self.AssertLog(logs.Event.MAP_UNDELETED, map_id=map_id, uid=perms.ROOT.id)

  def testMapBlock(self):
    with test_utils.RootLogin():
      m = test_utils.CreateMap(owners=['owner'], editors=['editor'],
                               reviewers=['reviewer'], viewers=['viewer'])
      model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      map_id = m.id

    # Non-admins should not be able to block the map.
    with test_utils.Login('owner'):
      m = model.Map.Get(map_id)
      self.assertRaises(perms.AuthorizationError, m.SetBlocked, True)

    # Admins should be able to block the map.
    self.CaptureLog()
    with test_utils.RootLogin():
      m.SetBlocked(True)
      self.assertTrue(m.is_blocked)
      self.assertEquals('root', m.blocker_uid)
      self.AssertLog(logs.Event.MAP_BLOCKED, map_id=m.id, uid='root')

    # The catalog entry should be gone.
    self.assertEquals(None, model.CatalogEntry.Get('xyz.com', 'label'))

    # The map should no longer be accessible to non-owners.
    with test_utils.Login('editor'):
      self.assertRaises(perms.AuthorizationError, model.Map.Get, map_id)
    with test_utils.Login('viewer'):
      self.assertRaises(perms.AuthorizationError, model.Map.Get, map_id)

    # The map should be accessible to the owner, but not publishable.
    perms.Grant('owner', perms.Role.CATALOG_EDITOR, 'xyz.com')
    with test_utils.Login('owner'):
      m = model.Map.Get(map_id)
      self.assertRaises(perms.NotPublishableError,
                        model.CatalogEntry.Create, 'xyz.com', 'foo', m)

  def testMapUnblock(self):
    with test_utils.RootLogin():
      m = test_utils.CreateMap(
          owners=['owner'], editors=['editor'], viewers=['viewer'])
      m.SetBlocked(True)
      self.assertTrue(model.Map.Get(m.id).is_blocked)
      self.CaptureLog()
      m.SetBlocked(False)

    self.AssertLog(logs.Event.MAP_UNBLOCKED, uid='root', map_id=m.id)
    with test_utils.Login('viewer'):
      n = model.Map.Get(m.id)
      self.assertFalse(n.is_blocked)

  def testMapWipe(self):
    with test_utils.RootLogin():
      m = test_utils.CreateMap(
          owners=['owner'], editors=['editor'], viewers=['viewer'])
      model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      map_id = m.id

    # Non-admins should not be able to wipe the map.
    with test_utils.Login('owner'):
      self.assertRaises(perms.AuthorizationError, m.Wipe)

    self.CaptureLog()
    # Admins should be able to wipe the map.
    with test_utils.RootLogin():
      m.Wipe()
    self.AssertLog(logs.Event.MAP_WIPED, uid=perms.ROOT.id, map_id=map_id)

    # The catalog entry should be gone.
    self.assertEquals(None, model.CatalogEntry.Get('xyz.com', 'label'))

    # The map should be totally gone.
    self.assertEquals(None, model.Map.Get(map_id))
    with test_utils.RootLogin():
      self.assertEquals(None, model.Map.GetDeleted(map_id))


class CrowdVoteTests(test_utils.BaseTest):
  """Tests the CrowdVote class."""

  def testPutGet(self):
    r1 = test_utils.NewCrowdReport(text='hello')
    model.CrowdVote.Put(r1.id, 'voter1', 'ANONYMOUS_UP')
    vote = model.CrowdVote.Get(r1.id, 'voter1')
    self.assertEquals(r1.id, vote.report_id)
    self.assertEquals('voter1', vote.voter)
    self.assertEquals('ANONYMOUS_UP', vote.vote_type)

  def testPutGetMulti(self):
    r1 = test_utils.NewCrowdReport(text='one')
    r2 = test_utils.NewCrowdReport(text='two')
    r3 = test_utils.NewCrowdReport(text='three')
    model.CrowdVote.Put(r1.id, 'voter1', 'ANONYMOUS_UP')
    model.CrowdVote.Put(r2.id, 'voter1', 'ANONYMOUS_DOWN')
    model.CrowdVote.Put(r3.id, 'voter2', 'ANONYMOUS_UP')
    votes = model.CrowdVote.GetMulti([r1.id, r2.id, r3.id], 'voter1')
    self.assertEquals('ANONYMOUS_UP', votes.get(r1.id).vote_type)
    self.assertEquals('ANONYMOUS_DOWN', votes.get(r2.id).vote_type)
    self.assertEquals(None, votes.get(r3.id))

  def testUpdateScore(self):
    r1 = test_utils.NewCrowdReport(text='hello')

    # Should increment the report's upvote_count.
    model.CrowdVote.Put(r1.id, 'voter1', 'ANONYMOUS_UP')
    r1 = model.CrowdReport.Get(r1.id)
    self.assertEquals(1, r1.upvote_count)
    self.assertEquals(0, r1.downvote_count)

    # Should decrement the report's upvote_count and increment downvote_count.
    model.CrowdVote.Put(r1.id, 'voter1', 'ANONYMOUS_DOWN')
    r1 = model.CrowdReport.Get(r1.id)
    self.assertEquals(0, r1.upvote_count)
    self.assertEquals(1, r1.downvote_count)

    # Should decrement the report's downvote_count.
    model.CrowdVote.Put(r1.id, 'voter1', None)
    r1 = model.CrowdReport.Get(r1.id)
    self.assertEquals(0, r1.upvote_count)
    self.assertEquals(0, r1.downvote_count)

    # Two downvotes should hide the report.
    r1 = model.CrowdReport.Get(r1.id)
    self.assertFalse(r1.hidden)
    model.CrowdVote.Put(r1.id, 'voter1', 'ANONYMOUS_DOWN')
    model.CrowdVote.Put(r1.id, 'voter2', 'ANONYMOUS_DOWN')
    r1 = model.CrowdReport.Get(r1.id)
    self.assertTrue(r1.hidden)

    # Cancelling a downvote should unhide the report.
    model.CrowdVote.Put(r1.id, 'voter2', None)
    r1 = model.CrowdReport.Get(r1.id)
    self.assertFalse(r1.hidden)

    model.CrowdVote.Put(r1.id, 'voter1', None)
    r1 = model.CrowdReport.Get(r1.id)
    self.assertEquals(0, r1.upvote_count)
    self.assertEquals(0, r1.downvote_count)

    # Reviewer votes have a large score but still count as a single vote
    model.CrowdVote.Put(r1.id, 'reviewer1', 'REVIEWER_DOWN')
    r1 = model.CrowdReport.Get(r1.id)
    self.assertTrue(r1.hidden)
    self.assertEquals(0, r1.upvote_count)
    self.assertEquals(1, r1.downvote_count)

    # Change reviewer1's downvote to an upvote
    model.CrowdVote.Put(r1.id, 'reviewer1', 'REVIEWER_UP')
    r1 = model.CrowdReport.Get(r1.id)
    self.assertFalse(r1.hidden)
    self.assertEquals(1, r1.upvote_count)
    self.assertEquals(0, r1.downvote_count)


class CrowdReportTests(test_utils.BaseTest):
  """Tests the CrowdReport class."""

  def setUp(self):
    super(CrowdReportTests, self).setUp()
    domains.Domain.Put('gmail.test')
    perms.Grant('gmail.test', perms.Role.MAP_CREATOR, 'gmail.test')
    self.map_owner_login = test_utils.Login('map_owner')
    # This map is visible only to map_owner@gmail.test.  A crowd report
    # attached to this map should also be visible only to map_owner@gmail.test.
    with self.map_owner_login:
      self.map_object = model.Map.Create(MAP1, 'gmail.test')

  def testGet(self):
    """Tests CrowdReport.Get."""
    cr1 = test_utils.NewCrowdReport(text='testGet')
    self.assertEquals(None, model.CrowdReport.Get('unknown'))
    self.assertEquals(cr1.text, model.CrowdReport.Get(cr1.key.string_id()).text)

  def testGetForAuthor(self):
    """Tests CrowdReport.GetForAuthor."""
    self.SetTime(1300000001)
    cr1 = test_utils.NewCrowdReport(author='alpha@gmail.test', text='Report 1')
    self.SetTime(1300000002)
    cr2 = test_utils.NewCrowdReport(author='alpha@gmail.test', text='Report 2')
    self.SetTime(1300000003)
    cr3 = test_utils.NewCrowdReport(author='beta@gmail.test', text='Report 3')
    self.SetTime(1300000004)
    cr4 = test_utils.NewCrowdReport(author='beta@gmail.test', text='Report 4',
                                    map_id=self.map_object.id)

    # pylint: disable=g-long-lambda,invalid-name
    GetTextsForAuthor = lambda *args, **kwargs: [
        x.text for x in model.CrowdReport.GetForAuthor(*args, **kwargs)]

    self.assertEquals([], GetTextsForAuthor(None, count=10))
    self.assertEquals([], GetTextsForAuthor('unknown', count=10))
    self.assertEquals([cr3.text],
                      GetTextsForAuthor('beta@gmail.test', count=10))
    with self.map_owner_login:
      self.assertEquals([cr4.text, cr3.text],
                        GetTextsForAuthor('beta@gmail.test', count=10))
    self.assertEquals([cr2.text, cr1.text],
                      GetTextsForAuthor('alpha@gmail.test', count=10))
    self.assertEquals([cr2.text],
                      GetTextsForAuthor('alpha@gmail.test', count=1))
    self.assertEquals([cr1.text],
                      GetTextsForAuthor('alpha@gmail.test', count=10, offset=1))

    model.CrowdReport.MarkAsReviewed(cr1.id)
    self.assertEquals([cr2.text, cr1.text],
                      GetTextsForAuthor('alpha@gmail.test', count=10))
    self.assertEquals(
        [cr1.text],
        GetTextsForAuthor('alpha@gmail.test', count=10, reviewed=True))
    self.assertEquals(
        [cr2.text],
        GetTextsForAuthor('alpha@gmail.test', count=10, reviewed=False))

    model.CrowdReport.PutScoreForReport(cr2.id, 0, 2, -2, True)
    self.assertEquals([cr2.text, cr1.text],
                      GetTextsForAuthor('alpha@gmail.test', count=10))
    self.assertEquals(
        [cr2.text],
        GetTextsForAuthor('alpha@gmail.test', count=10, hidden=True))
    self.assertEquals(
        [cr1.text],
        GetTextsForAuthor('alpha@gmail.test', count=10, hidden=False))
    self.assertEquals(
        [],
        GetTextsForAuthor('alpha@gmail.test', count=10,
                          hidden=True, reviewed=True))

  def testGetForTopics(self):
    """Tests CrowdReport.GetForTopics."""
    topic1 = 'VB5ItphmLJ8tLPax.gas'
    topic2 = 'VB5ItphmLJ8tLPax.water'
    topic3 = 'VB5ItphmLJ8tLPax.power'

    self.SetTime(1300000001)
    cr1 = test_utils.NewCrowdReport(topic_ids=[topic1], text='Report 1',
                                    author='alpha@gmail.test')
    self.SetTime(1300000002)
    cr2 = test_utils.NewCrowdReport(topic_ids=[topic1, topic2], text='Report 2',
                                    author='alpha@gmail.test')
    self.SetTime(1300000003)
    cr3 = test_utils.NewCrowdReport(topic_ids=[topic2, topic3], text='Report 3',
                                    author='beta@gmail.test')
    self.SetTime(1300000004)
    cr4 = test_utils.NewCrowdReport(topic_ids=[topic2, topic3], text='Report 4',
                                    author='beta@gmail.test',
                                    map_id=self.map_object.id)

    # pylint: disable=g-long-lambda,invalid-name
    GetTextsForTopics = lambda *args, **kwargs: [
        x.text for x in model.CrowdReport.GetForTopics(*args, **kwargs)]

    self.assertEquals([], GetTextsForTopics([], count=10))
    self.assertEquals([], GetTextsForTopics(['unknown'], count=10))
    self.assertEquals([cr3.text], GetTextsForTopics([topic3], count=10))
    with self.map_owner_login:
      self.assertEquals([cr4.text, cr3.text],
                        GetTextsForTopics([topic3], count=10))
    self.assertEquals([cr3.text, cr2.text],
                      GetTextsForTopics([topic2], count=10))
    self.assertEquals([cr3.text, cr2.text, cr1.text],
                      GetTextsForTopics([topic1, topic3], count=10))
    self.assertEquals([cr2.text, cr1.text],
                      GetTextsForTopics([topic1], count=10))
    self.assertEquals([cr2.text],
                      GetTextsForTopics([topic1], count=1))
    self.assertEquals([cr1.text],
                      GetTextsForTopics([topic1], count=10, offset=1))

    model.CrowdReport.MarkAsReviewed([cr3.id, cr2.id])
    self.assertEquals([cr3.text, cr2.text, cr1.text],
                      GetTextsForTopics([topic1, topic3], count=10))
    self.assertEquals(
        [cr3.text, cr2.text],
        GetTextsForTopics([topic1, topic3], count=10, reviewed=True))
    self.assertEquals(
        [cr1.text],
        GetTextsForTopics([topic1, topic3], count=10, reviewed=False))

    model.CrowdReport.PutScoreForReport(cr2.id, 0, 2, -2, True)
    self.assertEquals([cr3.text, cr2.text, cr1.text],
                      GetTextsForTopics([topic1, topic3], count=10))
    self.assertEquals(
        [cr2.text],
        GetTextsForTopics([topic1, topic3], count=10, hidden=True))
    self.assertEquals(
        [cr3.text, cr1.text],
        GetTextsForTopics([topic1, topic3], count=10, hidden=False))
    self.assertEquals(
        [cr3.text],
        GetTextsForTopics([topic1, topic3], count=10, reviewed=True,
                          hidden=False))
    self.assertEquals(
        [cr3.text],
        GetTextsForTopics([topic1, topic3], count=10, reviewed=True,
                          hidden=False, author='beta@gmail.test'))
    self.assertEquals(
        [],
        GetTextsForTopics([topic1, topic3], count=10, reviewed=True,
                          hidden=False, author='alpha@gmail.test'))

  def testGetWithoutLocation(self):
    """Tests CrowdReport.GetWithoutLocation."""
    now = datetime.datetime.utcnow()
    def TimeAgo(hours=0, minutes=0):
      return now - datetime.timedelta(hours=hours, minutes=minutes)

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=1)))
    test_utils.NewCrowdReport(topic_ids=['foo'], location=ndb.GeoPt(37, -74))

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=2)))
    test_utils.NewCrowdReport(topic_ids=['bar', 'baz'])

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=3)))
    cr3 = test_utils.NewCrowdReport(topic_ids=['foo', 'bar'])

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=4)))
    cr4 = test_utils.NewCrowdReport(topic_ids=['foo', 'bar'])

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=5)))
    cr5 = test_utils.NewCrowdReport(
        topic_ids=['foo', 'bar'], map_id=self.map_object.id)

    self.SetTime(utils.UtcToTimestamp(now))

    # pylint: disable=g-long-lambda,invalid-name
    GetEffectiveWithoutLocation = lambda *args, **kwargs: [
        x.effective
        for x in model.CrowdReport.GetWithoutLocation(*args, **kwargs)]

    # No topic_id match
    self.assertEquals([],
                      GetEffectiveWithoutLocation(topic_ids=['bez'], count=1,
                                                  max_updated=None))
    # No match before max_updated
    self.assertEquals([],
                      GetEffectiveWithoutLocation(topic_ids=['foo'], count=1,
                                                  max_updated=TimeAgo(hours=5)))

    # 2 matches, ignore report with location, return count=1
    self.assertEquals([cr3.effective],
                      GetEffectiveWithoutLocation(topic_ids=['foo'], count=1,
                                                  max_updated=None))
    # 2 matches
    self.assertEquals([cr3.effective, cr4.effective],
                      GetEffectiveWithoutLocation(topic_ids=['foo'], count=10,
                                                  max_updated=None))
    # One more map-restricted report is visible when the map owner is logged in.
    with self.map_owner_login:
      self.assertEquals([cr3.effective, cr4.effective, cr5.effective],
                        GetEffectiveWithoutLocation(topic_ids=['foo'], count=10,
                                                    max_updated=None))

    # 2 matches, one updated too late
    self.assertEquals(
        [cr4.effective],
        GetEffectiveWithoutLocation(topic_ids=['foo'], count=10,
                                    max_updated=TimeAgo(hours=3, minutes=30)))

    # 1 match, 1 hidden
    model.CrowdReport.PutScoreForReport(cr4.id, 0, 2, -2, True)
    self.assertEquals([cr3.effective, cr4.effective],
                      GetEffectiveWithoutLocation(topic_ids=['foo'], count=10))

    # 1 match, 1 hidden (fetch only the hidden report)
    self.assertEquals([cr4.effective],
                      GetEffectiveWithoutLocation(
                          topic_ids=['foo'], count=10, hidden=True))

    # 1 match, 1 hidden (fetch only the unhidden report)
    self.assertEquals([cr3.effective],
                      GetEffectiveWithoutLocation(
                          topic_ids=['foo'], count=10, hidden=False))

  def testGetByLocation(self):
    """Tests CrowdReport.GetByLocation."""
    now = datetime.datetime.utcnow()
    def TimeAgo(hours=0, minutes=0):
      return now - datetime.timedelta(hours=hours, minutes=minutes)

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=1)))
    test_utils.NewCrowdReport(topic_ids=['foo'])

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=2)))
    cr2 = test_utils.NewCrowdReport(topic_ids=['bar', 'baz'],
                                    location=ndb.GeoPt(37, -74))

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=3)))
    cr3 = test_utils.NewCrowdReport(topic_ids=['foo', 'bar'],
                                    location=ndb.GeoPt(37, -74))

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=4)))
    cr4 = test_utils.NewCrowdReport(topic_ids=['foo', 'bar'],
                                    # 0.001 ~= 111m
                                    location=ndb.GeoPt(37.001, -74))

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=5)))
    cr5 = test_utils.NewCrowdReport(topic_ids=['foo', 'bez'],
                                    # 0.1 ~= 11km
                                    location=ndb.GeoPt(37.1, -74))

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=6)))
    cr6 = test_utils.NewCrowdReport(topic_ids=['foo', 'bez'],
                                    # 0.1 ~= 11km
                                    location=ndb.GeoPt(37.1, -74),
                                    map_id=self.map_object.id)

    self.SetTime(utils.UtcToTimestamp(now))

    # pylint: disable=g-long-lambda,invalid-name
    GetEffectiveByLocation = lambda *args, **kwargs: [
        x.effective for x in model.CrowdReport.GetByLocation(*args, **kwargs)]

    # No topic_id match
    self.assertEquals([],
                      GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                             topic_radii={'unk': 1000}, count=1,
                                             max_updated=None))
    # No location match
    self.assertEquals([],
                      GetEffectiveByLocation(center=ndb.GeoPt(37.2, -74),
                                             topic_radii={'bez': 1000}, count=1,
                                             max_updated=None))
    # No match before max_updated
    self.assertEquals([],
                      GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                             topic_radii={'bez': 1000}, count=1,
                                             max_updated=TimeAgo(hours=6)))

    # 2 matches, ignore report with no location, return count=1
    self.assertEquals([cr2.effective],
                      GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                             topic_radii={'bar': 10}, count=1,
                                             max_updated=None))
    # 2 matches with small search radius
    self.assertEquals([cr2.effective, cr3.effective],
                      GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                             topic_radii={'bar': 10},
                                             max_updated=None))
    # 3 matches with expanded search radius
    self.assertEquals([cr2.effective, cr3.effective, cr4.effective],
                      GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                             topic_radii={'bar': 200},
                                             max_updated=None))
    # 3 matches with multiple topics
    self.assertEquals(
        [cr3.effective, cr4.effective, cr5.effective],
        GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                               topic_radii={'foo': 200, 'bez': 12000},
                               max_updated=None))

    # One more map-restricted report is visible when the map owner is logged in.
    with self.map_owner_login:
      self.assertEquals(
          [cr3.effective, cr4.effective, cr5.effective, cr6.effective],
          GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                 topic_radii={'foo': 200, 'bez': 12000},
                                 max_updated=None))

    # Limit to oldest 2 with max_updated
    self.assertEquals(
        [cr4.effective, cr5.effective],
        GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                               topic_radii={'bar': 200, 'bez': 12000},
                               max_updated=TimeAgo(hours=3, minutes=30)))

    # 1 match, 1 hidden
    model.CrowdReport.PutScoreForReport(cr2.id, 0, 2, -2, True)
    self.assertEquals([cr2.effective, cr3.effective],
                      GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                             topic_radii={'bar': 10}))

    # 1 match, 1 hidden (fetch only the hidden report)
    model.CrowdReport.PutScoreForReport(cr2.id, 0, 2, -2, True)
    self.assertEquals([cr2.effective],
                      GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                             topic_radii={'bar': 10},
                                             hidden=True))

    # 1 match, 1 hidden (fetch only the unhidden report)
    model.CrowdReport.PutScoreForReport(cr2.id, 0, 2, -2, True)
    self.assertEquals([cr3.effective],
                      GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                                             topic_radii={'bar': 10},
                                             hidden=False))

  def testSearch(self):
    """Tests CrowdReport.Search."""
    now = datetime.datetime.utcnow()
    def TimeAgo(hours=0, minutes=0):
      return now - datetime.timedelta(hours=hours, minutes=minutes)

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=1)))
    cr1 = test_utils.NewCrowdReport(topic_ids=['shelter'],
                                    text='23 beds available')

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=2)))
    cr2 = test_utils.NewCrowdReport(topic_ids=['food', 'water'],
                                    text='no water')

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=3)))
    cr3 = test_utils.NewCrowdReport(topic_ids=['shelter', 'water'],
                                    text='45 available beds, water running low')

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=4)))
    cr4 = test_utils.NewCrowdReport(topic_ids=['shelter', 'food'],
                                    text='76 open beds, plenty of water')

    self.SetTime(utils.UtcToTimestamp(TimeAgo(hours=5)))
    cr5 = test_utils.NewCrowdReport(topic_ids=['shelter', 'food'],
                                    text='83 open beds, plenty of water',
                                    map_id=self.map_object.id)

    self.SetTime(utils.UtcToTimestamp(now))

    # pylint: disable=g-long-lambda,invalid-name
    Search = lambda *args, **kwargs: [
        x.effective for x in model.CrowdReport.Search(*args, **kwargs)]

    # No match
    self.assertEquals([], Search('clothing', count=1, max_updated=None))

    # No match, misspelling
    self.assertEquals([], Search('awter', count=1, max_updated=None))

    # No match before max_updated
    self.assertEquals([],
                      Search('beds', count=1, max_updated=TimeAgo(hours=5)))

    # 2 matches, return count=1
    self.assertEquals([cr1.effective],
                      Search('beds', count=1, max_updated=None))
    # 3 matches
    self.assertEquals([cr1.effective, cr3.effective, cr4.effective],
                      Search('beds', count=10, max_updated=None))

    # 3 matches, 2 excluded by max_updated
    self.assertEquals([cr4.effective],
                      Search('beds', count=10,
                             max_updated=TimeAgo(hours=3, minutes=30)))

    # One more map-restricted report is visible when the map owner is logged in.
    with self.map_owner_login:
      self.assertEquals([cr4.effective, cr5.effective],
                        Search('beds', count=10,
                               max_updated=TimeAgo(hours=3, minutes=30)))

    # 2 matches, multi-word query
    self.assertEquals([cr1.effective, cr3.effective],
                      Search('available beds', count=10, max_updated=None))

    # 1 match, multi-word quoted query
    self.assertEquals([cr3.effective],
                      Search('"available beds"', count=10, max_updated=None))

    # 2 matches, complex query
    self.assertEquals([cr2.effective, cr3.effective],
                      Search('(beds OR water) topic_id:water',
                             count=10, max_updated=None))

    # Testing the reviewed bit
    model.CrowdReport.MarkAsReviewed(cr2.id)
    self.assertEquals([cr2.effective],
                      Search('(beds OR water) topic_id:water reviewed:True',
                             count=10, max_updated=None))
    self.assertEquals([cr3.effective],
                      Search('(beds OR water) topic_id:water reviewed:False',
                             count=10, max_updated=None))


class AuthorizationTests(test_utils.BaseTest):
  """Tests for Authorization entities."""

  def testAuthorization(self):
    """Creates and reads back an authorization record."""
    key = model.Authorization.Create(
        crowd_report_write_permission=True, map_read_permission=True,
        source='http://foo.example.org/', map_ids=['a', 'b'],
        author_prefix='tel:+1').id
    auth = model.Authorization.Get(key)
    self.assertEquals(True, auth.crowd_report_write_permission)
    self.assertEquals(True, auth.map_read_permission)
    self.assertEquals('http://foo.example.org/', auth.source)
    self.assertEquals(['a', 'b'], auth.map_ids)
    self.assertEquals('tel:+1', auth.author_prefix)
    self.assertTrue(auth.is_enabled)

    # Try disabling and re-enabling the key.
    model.Authorization.SetEnabled(key, False)
    auth = model.Authorization.Get(key)
    self.assertFalse(auth.is_enabled)

    model.Authorization.SetEnabled(key, True)
    auth = model.Authorization.Get(key)
    self.assertTrue(auth.is_enabled)

if __name__ == '__main__':
  test_utils.main()
