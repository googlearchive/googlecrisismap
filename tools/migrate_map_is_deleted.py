# Copyright 2012 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Migrate MapModel.is_deleted to MapModel.deleted.

To run this: tools/console <server_url> migrate_map_is_deleted.py
Deleted maps will get deleted = last_updated and deleter = owners[0].
"""

import sys

import model

from google.appengine.api import users


def PrintModel(m):
  print """\
%stitle: %r (owners: %s)
  is_deleted: %s / deleted: %s / deleter: %s\x1b[0m""" % (
      m.is_deleted and '\x1b[36m' or '', m.title, m.owners,
      m.is_deleted, m.deleted, m.deleter)


def Migrate(write_changes):
  """Migrates MapModel.is_deleted to MapModel.deleted."""
  print '\nOriginal state:\n'

  updated_models = []
  for m in model.MapModel.all():
    PrintModel(m)
    if m.is_deleted:
      m.deleted = m.last_updated
      m.deleter = users.User(m.owners[0])
    else:
      m.deleted = model.NEVER
      m.deleter = None
    updated_models.append(m)

  if write_changes:
    print '\nWriting updated models:\n'
    for m in updated_models:
      PrintModel(m)
    # Don't overwrite last_updated with the current time.
    model.MapModel.last_updated.auto_now = False
    model.db.put(updated_models)
  else:
    print '\nDry run (use -w to really write data):\n'
    for m in updated_models:
      PrintModel(m)


Migrate('-w' in sys.argv)
