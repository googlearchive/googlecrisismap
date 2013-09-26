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

"""Script to migrate permissions.

Migrates permissions from their historical location in Config (see config.py) to
their new home in PermissionModel (see perms.py).  This file added to Perforce
for historical reasons; it can safely be deleted once the migration is complete.
"""

import re

import config
import perms
import utils

# Prefix used when setting a config for a user/domain's roles
ROLE_PREFIX = 'global_roles:'


# TODO(rew): Delete this file once user permissions have been migrated from
# Config to their new home in PermissionModel (see perms.py)


def Migrate(do_it=False):
  Populate(do_it)
  Purge(do_it)


def Populate(do_it):
  old_configs = config.GetAll()
  for key, value in old_configs.iteritems():
    if not key.startswith(ROLE_PREFIX):
      continue
    user = key[len(ROLE_PREFIX):]
    if not re.search(r'^[\w@.-]+$', user):
      continue
    print 'Translating perms for %s (%s)' % (user, value)
    if '@' in user:
      user = utils.NormalizeEmail(user)
    for perm in value:
      if isinstance(perm, basestring):
        if perm == perms.Role.ADMIN:
          print '...Granting %s admin permissions' % user
          if do_it:
            perms.Grant(user, perms.Role.ADMIN, perms.GLOBAL_TARGET)
        else:
          print '...User %s had global permission %s; ignoring' % (user, perm)
      elif isinstance(perm, list) and len(perm) == 2:
        print '...Granting %s permission %s to %s' % (user, perm[0], perm[1])
        if do_it:
          perms.Grant(user, perm[0], perm[1])
      else:
        print '...User %s has unexpected permission %s; ignoring' % (user, perm)


def Purge(do_it):
  old_configs = config.GetAll()
  for key, _ in old_configs.iteritems():
    if not key.startswith(ROLE_PREFIX):
      if key == 'default_publisher_domain':
        print 'Deleting legacy entry %s' % key
        if do_it:
          config.Delete(key)
      else:
        print 'Ignoring config %s; not a permission.' % key
      continue
    user = key[len(ROLE_PREFIX):]
    if not re.search(r'^[\w@.-]+$', user):
      print 'Deleting bogus entry %s' % key
    else:
      print 'Deleting permissions for user %s' % user
    if do_it:
      config.Delete(key)
