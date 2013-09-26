# Copyright 2013 Google Inc. All Rights Reserved.
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

"""Backs up datastore entities as pickle files of plain dictionaries.

Usage: tools/console <server_url> backup.py <filename> [<class>...]

Specify the model classes to back up, e.g. model.MapModel, config.Config.
If no model classes are specified, backs up everything except MetadataFetchLog.

NOTE: Backup files created using this tool may contain sensitive data.
      Delete these files within 60 days to preserve user privacy.
"""

import inspect
import pickle
import pydoc
import sys

try:
  # Make backup.Load() usable outside of App Engine.
  from google.appengine.api import users  # pylint: disable=g-import-not-at-top
  from google.appengine.ext import db  # pylint: disable=g-import-not-at-top
except ImportError:
  users = None
  db = None


def ToValue(v):
  """Converts google.appengine.api.datastore_types to plain Python values."""
  # google.appengine.api uses subclasses of unicode like Text, Email, etc.
  if isinstance(v, unicode):
    return unicode(v)
  if isinstance(v, str):
    return str(v)
  if isinstance(v, long):
    return long(v)
  if db:
    if isinstance(v, db.Key):
      return v.to_path()
    if isinstance(v, db.BlobKey):
      return str(v)
  if users:
    if isinstance(v, users.User):
      return dict((k, getattr(v, k)())
                  for k in 'user_id email nickname auth_domain'.split())
  return v


def ToDict(e):
  """Converts a db.Model instance to a plain dictionary."""
  return dict([(k, ToValue(getattr(e.__class__, k).get_value_for_datastore(e)))
               for k in e.properties().keys()] +
              [(k, ToValue(getattr(e, k))) for k in e.dynamic_properties()],
              key=e.key().to_path(), key_name=e.key().name())


def FetchAll(query):
  """Generates all the entities for a query."""
  batch = query.fetch(100)
  while batch:
    sys.stderr.write('.')
    sys.stderr.flush()
    for entity in batch:
      yield entity
    query = query.with_cursor(query.cursor())
    batch = query.fetch(100)
  sys.stderr.write('\n')
  sys.stderr.flush()


def Save(filename, entities):
  f = open(filename, 'w')
  sys.stderr.write('Writing to file: %s\n' % filename)
  count = 0
  for e in entities:
    pickle.dump(ToDict(e), f)
    count += 1
  f.close()
  sys.stderr.write('Dictionaries written: %d\n' % count)


def Load(filename):
  f = open(filename)
  while True:
    try:
      yield pickle.load(f)
    except EOFError:
      break
  f.close()


def Backup(name, model_classes):
  for cls in model_classes:
    print '\nBacking up %s.%s' % (cls.__module__, cls.__name__)
    Save(name + '.' + cls.__name__ + '.pickle', FetchAll(cls.all()))


def GetAllModelClasses():
  # Skip MetadataFetchLog; it's too big.
  for module in 'config domains logs maps model perms'.split():
    for _, cls in inspect.getmembers(__import__(module), inspect.isclass):
      if issubclass(cls, db.Model):
        yield cls


if __name__ == '__main__':
  args = sys.argv[1:]
  basename = args.pop(0)
  Backup(basename, [pydoc.locate(arg) for arg in args] or GetAllModelClasses())
  print """
NOTE: Backup files created using this tool may contain sensitive data.
      Delete these files within 60 days to preserve user privacy.
"""
