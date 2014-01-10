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

from google.appengine.api import memcache
from google.appengine.ext import ndb

JSON1 = '{"title": "One", "description": "description1"}'
JSON2 = '{"title": "Two", "description": "description2"}'
JSON3 = '{"title": "Three", "description": "description3"}'


class MapTests(test_utils.BaseTest):
  """Tests the map model classes and associated access control logic."""

  def testVersions(self):
    """Verifies that creating and setting versions works properly."""
    with test_utils.RootLogin():
      m = model.Map.Create(JSON1, 'xyz.com')
      id1 = m.GetCurrent().id
      id2 = m.PutNewVersion(JSON2)

      # Verify that versions are returned in reverse chronological order.
      versions = list(m.GetVersions())
      self.assertEquals(id2, versions[0].id)
      self.assertEquals(id1, versions[1].id)

      # Verify that GetCurrent() sees the most recent version as expected.
      current = m.GetCurrent()
      self.assertEquals(id2, current.id)
      self.assertEquals(JSON2, current.maproot_json)
      self.assertEquals('root', current.creator_uid)

  def testWorldReadable(self):
    # Verify that the current version is only visible to the public after
    # setting world_readable to True.
    with test_utils.RootLogin():
      m = model.Map.Create(JSON1, 'xyz.com')
    with test_utils.Login('outsider'):
      self.assertRaises(perms.AuthorizationError, m.GetCurrent)

    with test_utils.RootLogin():
      m.SetWorldReadable(True)
    with test_utils.Login('outsider'):
      self.assertEquals(JSON1, m.GetCurrent().maproot_json)

    with test_utils.RootLogin():
      m.SetWorldReadable(False)
    with test_utils.Login('outsider'):
      self.assertRaises(perms.AuthorizationError, m.GetCurrent)

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
    self.assertEquals(['xyz.com'], m.model.domains)
    self.assertEquals(m.model.world_readable, False)

  def testInitialDomainRole(self):
    """Verifies that map creation sets up initial permissions properly."""
    # Verify the default values from Map.Create.
    perms.Grant('member', perms.Role.MAP_CREATOR, 'xyz.com')
    domains.Domain.Create('xyz.com', initial_domain_role=perms.Role.MAP_OWNER)
    m = test_utils.CreateMap()
    self.assertEquals({'root', 'member'}, set(m.model.owners))
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals([], m.model.viewers)

    domains.Domain.Create('xyz.com', initial_domain_role=perms.Role.MAP_EDITOR)
    m = test_utils.CreateMap()
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals(['member'], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals([], m.model.viewers)

    domains.Domain.Create('xyz.com',
                          initial_domain_role=perms.Role.MAP_REVIEWER)
    m = test_utils.CreateMap()
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals(['member'], m.model.reviewers)
    self.assertEquals([], m.model.viewers)

    domains.Domain.Create('xyz.com', initial_domain_role=perms.Role.MAP_VIEWER)
    m = test_utils.CreateMap()
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals(['member'], m.model.viewers)

    domains.Domain.Create('xyz.com', initial_domain_role=None)
    m = test_utils.CreateMap()
    self.assertEquals(['root'], m.model.owners)
    self.assertEquals([], m.model.editors)
    self.assertEquals([], m.model.reviewers)
    self.assertEquals([], m.model.viewers)

  def testMapCache(self):
    """Tests caching of current JSON data."""
    # Verify the default values from Map.Create.
    with test_utils.RootLogin():
      m = model.Map.Create(JSON1, 'xyz.com', world_readable=True)
      m.PutNewVersion(JSON2)
      self.assertEquals(JSON2, m.GetCurrentJson())
      self.assertEquals(m.title, 'Two')
      self.assertEquals(m.description, 'description2')
      # GetCurrentJson should have filled the cache.
      self.assertEquals(JSON2, memcache.get('Map,%s,json' % m.id))

      # PutVersion should clear the cache.
      m.PutNewVersion(JSON3)
      self.assertEquals(None, memcache.get('Map,%s,json' % m.id))
      self.assertEquals(JSON3, m.GetCurrentJson())

  def testGetAll(self):
    """Tests Maps.GetAll and Maps.GetViewable."""
    with test_utils.RootLogin() as root:
      m1 = model.Map.Create('{}', 'xyz.com', world_readable=True)
      m2 = model.Map.Create('{}', 'xyz.com', world_readable=False)

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
        '{"title": "Fancy fancy"}', editors=['publisher', 'outsider'])
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
      self.assertLog(logs.Event.MAP_PUBLISHED, map_id=m.id,
                     domain_name='xyz.com', catalog_entry_key=mc.id)

      # Creating another entry with the same path_name should succeed.
      model.CatalogEntry.Create('xyz.com', 'label', m)

  def testDelete(self):
    m = test_utils.CreateMap('{"title": "Bleg"}', viewers=['viewer'])
    with test_utils.RootLogin():
      entry = model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      domains.Domain.Create('xyz.com')

    # Validate that CatalogEntry is created successfully.
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
    self.assertLog(
        logs.Event.MAP_UNPUBLISHED, uid='outsider', domain_name='xyz.com',
        map_id=m.id, catalog_entry_key=entry.model.key().name())
    # A CatalogEntry cannot be deleted twice.
    self.assertRaises(ValueError, model.CatalogEntry.Delete, 'xyz.com', 'label')

  def testDelete_StickyCatalogEntries(self):
    # Under the sticky catalog policy, even catalog editors should not be able
    # to delete catalog entries if they are not the owner.
    m = test_utils.CreateMap(editors=['publisher', 'coworker'])
    with test_utils.RootLogin():
      domains.Domain.Create('xyz.com', has_sticky_catalog_entries=True)
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
      m = test_utils.CreateMap(JSON1, editors=['publisher'])
      mc = model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      self.assertEquals('One', mc.title)

      # Update the CatalogEntry to point at a new MapVersion.
      m.PutNewVersion(JSON2)
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
    self.assertEquals(JSON2, mc.maproot_json)
    self.assertEquals(True, mc.is_listed)

  def testPut_StickyCatalogEntries(self):
    # Under the sticky catalog policy, even catalog editors should not be able
    # to update catalog entries if they are not the owner.
    with test_utils.RootLogin():
      domains.Domain.Create('xyz.com', has_sticky_catalog_entries=True)
      perms.Grant('publisher', perms.Role.CATALOG_EDITOR, 'xyz.com')
      perms.Grant('coworker', perms.Role.CATALOG_EDITOR, 'xyz.com')

    with test_utils.Login('publisher'):
      m = test_utils.CreateMap(JSON1, editors=['publisher', 'coworker'])
      mc = model.CatalogEntry.Create('xyz.com', 'label', m, is_listed=True)
      m.PutNewVersion(JSON2)

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
      self.assertLog(logs.Event.MAP_DELETED, map_id=m.id, uid='owner')

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
    self.assertLog(logs.Event.MAP_UNDELETED, map_id=map_id, uid=perms.ROOT.id)

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
      self.assertLog(logs.Event.MAP_BLOCKED, map_id=m.id, uid='root')

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

    self.assertLog(logs.Event.MAP_UNBLOCKED, uid='root', map_id=m.id)
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
    self.assertLog(logs.Event.MAP_WIPED, uid=perms.ROOT.id, map_id=map_id)

    # The catalog entry should be gone.
    self.assertEquals(None, model.CatalogEntry.Get('xyz.com', 'label'))

    # The map should be totally gone.
    self.assertEquals(None, model.Map.Get(map_id))
    with test_utils.RootLogin():
      self.assertEquals(None, model.Map.GetDeleted(map_id))


class CrowdReportTests(test_utils.BaseTest):
  """Tests the CrowdReport class."""

  def testGet(self):
    """Tests CrowdReport.Get."""
    cr1 = test_utils.NewCrowdReport(text='testGet')
    self.assertEquals(None, model.CrowdReport.Get('unknown'))
    self.assertEquals(cr1.text, model.CrowdReport.Get(cr1.key.string_id()).text)

  def testGetForAuthor(self):
    """Tests CrowdReport.GetForAuthor."""
    self.SetTime(1)
    cr1 = test_utils.NewCrowdReport(author='alpha@gmail.test', text='Report 1')
    self.SetTime(2)
    cr2 = test_utils.NewCrowdReport(author='alpha@gmail.test', text='Report 2')
    self.SetTime(3)
    cr3 = test_utils.NewCrowdReport(author='beta@gmail.test', text='Report 3')

    # pylint: disable=g-long-lambda,invalid-name
    GetTextsForAuthor = lambda *args, **kwargs: [
        x.text for x in model.CrowdReport.GetForAuthor(*args, **kwargs)]

    self.assertEquals([], GetTextsForAuthor(None, count=10))
    self.assertEquals([], GetTextsForAuthor('unknown', count=10))
    self.assertEquals([cr3.text],
                      GetTextsForAuthor('beta@gmail.test', count=10))
    self.assertEquals([cr2.text, cr1.text],
                      GetTextsForAuthor('alpha@gmail.test', count=10))
    self.assertEquals([cr2.text],
                      GetTextsForAuthor('alpha@gmail.test', count=1))
    self.assertEquals([cr1.text],
                      GetTextsForAuthor('alpha@gmail.test', count=10, offset=1))

  def testGetForTopics(self):
    """Tests CrowdReport.GetForTopics."""
    topic1 = 'VB5ItphmLJ8tLPax.gas'
    topic2 = 'VB5ItphmLJ8tLPax.water'
    topic3 = 'VB5ItphmLJ8tLPax.power'

    self.SetTime(1)
    cr1 = test_utils.NewCrowdReport(topic_ids=[topic1], text='Report 1')
    self.SetTime(2)
    cr2 = test_utils.NewCrowdReport(topic_ids=[topic1, topic2], text='Report 2')
    self.SetTime(3)
    cr3 = test_utils.NewCrowdReport(topic_ids=[topic2, topic3], text='Report 3')

    # pylint: disable=g-long-lambda,invalid-name
    GetTextsForTopics = lambda *args, **kwargs: [
        x.text for x in model.CrowdReport.GetForTopics(*args, **kwargs)]

    self.assertEquals([], GetTextsForTopics([], count=10))
    self.assertEquals([], GetTextsForTopics(['unknown'], count=10))
    self.assertEquals([cr3.text], GetTextsForTopics([topic3], count=10))
    self.assertEquals([cr3.text, cr2.text],
                      GetTextsForTopics([topic2], count=10))
    self.assertEquals([cr3.text, cr2.text, cr1.text],
                      GetTextsForTopics([topic1, topic3], count=10))
    self.assertEquals([cr3.text],
                      GetTextsForTopics([topic1, topic3], count=1))
    self.assertEquals([cr2.text, cr1.text],
                      GetTextsForTopics([topic1, topic3], count=10, offset=1))

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

    self.SetTime(utils.UtcToTimestamp(now))

    # pylint: disable=g-long-lambda,invalid-name
    GetEffectiveWithoutLocation = lambda *args, **kwargs: [
        x.effective for x in model.CrowdReport.GetWithoutLocation(*args,
                                                                  **kwargs)]

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
    # 2 matches, one updated too late
    self.assertEquals(
        [cr4.effective],
        GetEffectiveWithoutLocation(topic_ids=['foo'], count=10,
                                    max_updated=TimeAgo(hours=3, minutes=30)))

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

    # Limit to oldest 2 with max_updated
    self.assertEquals(
        [cr4.effective, cr5.effective],
        GetEffectiveByLocation(center=ndb.GeoPt(37, -74),
                               topic_radii={'bar': 200, 'bez': 12000},
                               max_updated=TimeAgo(hours=3, minutes=30)))


if __name__ == '__main__':
  test_utils.main()
