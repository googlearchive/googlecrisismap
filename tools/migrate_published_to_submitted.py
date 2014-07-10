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

"""Migrate CrowdReportModel.published to CrowdReportModel.submitted."""

import sys

import model

from google.appengine.ext import ndb


def Put(to_put, write_changes):
  if write_changes:
    ndb.put_multi(to_put)
    print 'Put %d reports.' % len(to_put)
  else:
    print 'Would put %d reports.' % len(to_put)


def Migrate(write_changes):
  """Fetches all CrowdReportModels and copies .published to .submitted."""
  # pylint: disable=protected-access
  rs = model._CrowdReportModel.query().fetch(2000)
  # pylint: enable=protected-access
  print 'Fetched %d reports.' % len(rs)
  skipped = 0
  updated = 0
  to_put = []
  for r in rs:
    if not r.submitted:
      r.submitted = r.published
      updated += 1
      to_put.append(r)
      if len(to_put) >= 20:
        Put(to_put, write_changes)
        to_put[:] = []
    else:
      skipped += 1
    if (updated + skipped) % 100 == 0:
      print 'Updated %d, skipped %d.' % (updated, skipped)
  if to_put:
    Put(to_put, write_changes)
    to_put[:] = []
  print 'Updated %d, skipped %d.' % (updated, skipped)


Migrate('-w' in sys.argv)
