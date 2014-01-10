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

"""Purges crowd reports and crowd votes.

To run this:
tools/console <server_url> purge_crowd_reports.py -- [-a] [-n] < /tmp/values
or
echo 'foo' | tools/console <server_url> purge_crowd_reports.py -- [-a] [-n]

/tmp/values would be a list of author URLs or crowd report IDs, one per line.
If -a, values are assumed to be author URLs. Else they are crowd report IDs.
If -n, this is a dry run, and nothing is actually deleted.
"""

import optparse
import sys
import time

import model

from google.appengine.ext import ndb


def Purge(model_name, prop_name, value, is_dry_run):
  model_class = getattr(model, model_name)
  query = model_class.query()
  query = query.filter(getattr(model_class, prop_name) == value)

  count = 0
  cursor = None
  more = True
  while more:
    page, cursor, more = query.fetch_page(50, start_cursor=cursor)
    if is_dry_run:
      print '[DRY_RUN] Would purge %d %ss for %s=%s: %s' % (
          len(page), model_name, prop_name, value, page)
      continue
    if page and count == 0:
      print 'Will purge at least %d %ss for %s=%s in 5 sec. Ctrl-C to stop.' % (
          len(page), model_name, prop_name, value)
      time.sleep(5)
    count += len(page)
    ndb.delete_multi([report.key for report in page])
    print 'Purged %d %ss for %s=%s: %s' % (len(page), model_name, prop_name,
                                           value, page)


# pylint: disable=protected-access
def Main():
  """Purges crowd reports and votes depending on flags and stdin."""
  parser = optparse.OptionParser()
  parser.add_option('-a', dest='values_are_authors', action='store_true',
                    help='Values are authors, not crowd report ids')
  parser.add_option('-n', dest='is_dry_run', action='store_true',
                    help='Dry run, don\'t actually delete anything.')
  options, _ = parser.parse_args()
  for value in sys.stdin:
    value = value.strip()
    if options.values_are_authors:
      Purge('_CrowdReportModel', 'author', value, options.is_dry_run)
      Purge('_CrowdVoteModel', 'voter', value, options.is_dry_run)
    else:  # values are assumed to be crowd report IDs
      value = ndb.Key(model._CrowdReportModel, value)
      Purge('_CrowdReportModel', '_key', value, options.is_dry_run)
  print 'Done.'

Main()
