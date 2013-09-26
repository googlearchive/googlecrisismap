#!/usr/bin/python
# Copyright 2013 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Migrates user identities from e-mail addresses to uids (UserModels).

To do a dry run: tools/console <server_url> migrate_to_uids.py
To do actual migration: tools/console <server_url> migrate_to_uids.py -- -w

To do a dry run of cleanup: tools/console <server_url> migrate_to_uids.py -- -c
To do actual cleanup: tools/console <server_url> migrate_to_uids.py -- -c -w
"""

import sys

import model
import perms
import users

from google.appengine.api import users as gae_users
from google.appengine.ext import db
from google.appengine.ext import ndb

# TODO(kpy): Delete this file after migrations are done.

uids_by_email = {}


def EmailToUid(email):
  if email:
    if email not in uids_by_email:
      uids_by_email[email] = users.GetForEmail(email).id
    return uids_by_email[email]


def EmailsToUids(subjects):
  result = set(subjects)
  for subject in subjects:
    if '@' in subject:
      result.add(EmailToUid(subject))
  return sorted(result)


def GaeUserToUid(gae_user):
  if gae_user:
    return EmailToUid(gae_user.email())


def RemoveEmails(subjects):
  return [subject for subject in subjects if '@' not in subject]


# In production, we don't care about caching _EmailToGaeUserId because it's
# almost never called twice with the same argument during one request.  For
# migration, though, caching saves a lot of time.
gae_user_ids_by_email = {}
MAX_BATCH_SIZE = 100


class DummyUser(ndb.Model):
  users = ndb.UserProperty(repeated=True)


def EmailsToGaeUserIds(emails):
  work = list(set(emails) - set(gae_user_ids_by_email))
  while work:
    batch, work = work[:MAX_BATCH_SIZE], work[MAX_BATCH_SIZE:]
    key = DummyUser(users=map(gae_users.User, batch)).put(use_cache=False)
    gae_user_ids = [u.user_id() for u in key.get(use_cache=False).users]
    key.delete()
    gae_user_ids_by_email.update(dict(zip(batch, gae_user_ids)))
  return map(gae_user_ids_by_email.get, emails)


# pylint: disable=protected-access
users._EmailToGaeUserId = lambda email: EmailsToGaeUserIds([email])[0]


def FetchAll(query):
  batch = query.fetch(100)
  while batch:
    for entity in batch:
      yield entity
    query = query.with_cursor(query.cursor())
    batch = query.fetch(100)


def Migrate(write_data=False):  # dry run by default
  """Adds uids to the datastore for all e-mail addresses."""
  to_write = []

  # First populate the gae_user_ids_by_email cache with all the user IDs.
  sys.stdout.write('Collecting e-mail addresses: ')
  sys.stdout.flush()
  emails = set()
  for m in FetchAll(model.MapModel.all()):
    emails |= set([m.creator and m.creator.email(),
                   m.last_updater and m.last_updater.email(),
                   m.deleter and m.deleter.email(),
                   m.blocker and m.blocker.email()])
    emails |= set(m.owners + m.editors + m.viewers)
    sys.stdout.write('m')
    sys.stdout.flush()
  for v in FetchAll(model.MapVersionModel.all()):
    emails |= set([v.creator and v.creator.email()])
    sys.stdout.write('v')
    sys.stdout.flush()
  for c in FetchAll(model.CatalogEntryModel.all()):
    emails |= set([c.creator and c.creator.email(),
                   c.last_updater and c.last_updater.email()])
    sys.stdout.write('c')
    sys.stdout.flush()
  for p in FetchAll(perms.PermissionModel.all()):
    if '@' in p.subject:
      emails.add(p.subject)
    sys.stdout.write('p')
    sys.stdout.flush()
  emails -= {None}
  print '\nAddresses to convert: %d' % len(emails)
  EmailsToGaeUserIds(emails)

  # Now scan the MapModels and associated MapVersionModels.
  print '\n\nMaps:'
  for m in FetchAll(model.MapModel.all().order('created')):
    print '\n\x1b[33m%s (%r):\x1b[0m' % (m.key().name(), m.title)

    m.creator_uid = GaeUserToUid(m.creator)
    m.updater_uid = GaeUserToUid(m.last_updater)
    m.deleter_uid = GaeUserToUid(m.deleter)
    m.blocker_uid = GaeUserToUid(m.blocker)
    m.updated = m.last_updated
    print '    \x1b[37mcr=%s / up=%s / de=%s / bl=%s\x1b[0m' % (
        m.creator, m.last_updater, m.deleter, m.blocker)
    print ' -> cr=%s / up=%s / de=%s / bl=%s' % (
        m.creator_uid, m.updater_uid, m.deleter_uid, m.blocker_uid)

    owners, editors, viewers = map(repr, [m.owners, m.editors, m.viewers])
    m.owners = EmailsToUids(m.owners)
    m.editors = EmailsToUids(m.editors)
    m.viewers = EmailsToUids(m.viewers)
    print '    owners: \x1b[37m%s\x1b[0m -> %r' % (owners, m.owners)
    print '    editors: \x1b[37m%s\x1b[0m -> %r' % (editors, m.editors)
    print '    viewers: \x1b[37m%s\x1b[0m -> %r' % (viewers, m.viewers)

    to_write.append(m)

    for v in FetchAll(model.MapVersionModel.all().ancestor(m)):
      v.creator_uid = GaeUserToUid(v.creator)
      print '  %d. \x1b[37mcr=%s\x1b[0m -> cr=%s' % (
          v.key().id(), v.creator, v.creator_uid)

      to_write.append(v)

  # Now scan the CatalogEntryModels.
  print '\n\nCatalog entries:'
  for c in FetchAll(model.CatalogEntryModel.all()):
    print '\n\x1b[32m%s/%s:\x1b[0m' % (c.domain, c.label)
    c.creator_uid = GaeUserToUid(c.creator)
    c.updater_uid = GaeUserToUid(c.last_updater)
    c.updated = c.last_updated
    print '    \x1b[37mcr=%s / up=%s\x1b[0m' % (c.creator, c.last_updater)
    print ' -> cr=%s / up=%s' % (c.creator_uid, c.updater_uid)

    to_write.append(c)

  # Now scan the PermissionModels.
  print '\n\nPermissions:'
  for p in FetchAll(perms.PermissionModel.all()):
    if '@' in p.subject:
      nperm = perms._Permission(EmailToUid(p.subject), p.role, p.target)
      np = perms.PermissionModel(
          key_name=perms._PermissionKey(nperm),
          subject=nperm.subject, role=nperm.role, target=nperm.target)
      print '\x1b[37msu=%s\x1b[0m -> su=%s / ro=%s / ta=%s' % (
          p.subject, np.subject, np.role, np.target)

      to_write.append(np)

  if write_data:
    db.put(to_write)
    print '\nEntities written: %d' % len(to_write)
  else:
    print '\nEntities that would be written: %d' % len(to_write)


def CleanUp(write_data=False):
  """Removes all e-mail addresses from the datastore."""
  to_write = []
  to_delete = []

  # Scan the MapModels and associated MapVersionModels, removing all
  # e-mail addresses and clearing UserProperty fields.
  print '\n\nMaps:'
  for m in FetchAll(model.MapModel.all()):
    print '\n\x1b[33m%s (%r):\x1b[0m' % (m.key().name(), m.title)

    print '    \x1b[37mcr=%s / up=%s / de=%s / bl=%s\x1b[0m' % (
        m.creator, m.last_updater, m.deleter, m.blocker)
    print ' -> cr=%s / up=%s / de=%s / bl=%s' % (None, None, None, None)
    m.creator = None
    m.last_updater = None
    m.deleter = None
    m.blocker = None

    owners, editors, viewers = map(repr, [m.owners, m.editors, m.viewers])
    m.owners = RemoveEmails(m.owners)
    m.viewers = RemoveEmails(m.viewers)
    m.editors = RemoveEmails(m.editors)
    print '    owners: \x1b[37m%s\x1b[0m -> %r' % (owners, m.owners)
    print '    editors: \x1b[37m%s\x1b[0m -> %r' % (editors, m.editors)
    print '    viewers: \x1b[37m%s\x1b[0m -> %r' % (viewers, m.viewers)

    to_write.append(m)

    for v in FetchAll(model.MapVersionModel.all().ancestor(m)):
      print '  %d. \x1b[37mcr=%s\x1b[0m -> cr=%s' % (
          v.key().id(), v.creator, None)
      v.creator = None

      to_write.append(v)

  # Clear the UserProperty fields in all the CatalogEntryModels.
  print '\n\nCatalog entries:'
  for c in FetchAll(model.CatalogEntryModel.all()):
    print '\n\x1b[32m%s/%s:\x1b[0m' % (c.domain, c.label)
    print '    \x1b[37mcr=%s / up=%s\x1b[0m' % (c.creator, c.last_updater)
    print ' -> cr=%s / up=%s' % (None, None)
    c.creator = None
    c.last_updater = None

    to_write.append(c)

  # Now scan the PermissionModels.
  print '\n\nPermissions:'
  for p in FetchAll(perms.PermissionModel.all()):
    if '@' in p.subject:
      print 'delete: su=%s / ro=%s / ta=%s' % (p.subject, p.role, p.target)
      to_delete.append(p)

  if write_data:
    db.put(to_write)
    db.delete(to_delete)
    print '\nEntities written: %d' % len(to_write)
    print '\nEntities deleted: %d' % len(to_delete)
  else:
    print '\nEntities that would be written: %d' % len(to_write)
    print '\nEntities that would be deleted: %d' % len(to_delete)


if __name__ == '__main__':
  if '-c' in sys.argv:
    CleanUp('-w' in sys.argv)
  else:
    Migrate('-w' in sys.argv)
