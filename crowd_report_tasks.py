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

"""Tasks related to crowd reports."""

import datetime
import logging

import base_handler
import model

from google.appengine import runtime
from google.appengine.ext import ndb

CROWD_REPORT_TTL_DAYS = 30


class Cleanup(base_handler.BaseHandler):
  """Deletes expired crowd reports."""

  def FetchAndDelete(self, query):
    """Fetches keys from query in batches; deletes the corresponding entities.

    Args:
      query: A ndb.Query object. All results will be deleted.

    Returns:
      A count of the number of entities that have been deleted.
    """
    count = 0
    try:
      cursor = None
      more = True
      while more:
        page, cursor, more = query.fetch_page(100, start_cursor=cursor,
                                              keys_only=True)
        ndb.delete_multi(page)
        count += len(page)
    except runtime.DeadlineExceededError:
      pass
    return count

  # pylint: disable=protected-access
  def Get(self):
    """Deletes expired crowd reports."""
    # Delete reports published longer ago than max_published
    max_published = (datetime.datetime.utcnow() -
                     datetime.timedelta(days=CROWD_REPORT_TTL_DAYS))

    query = model._CrowdReportModel.query()
    query = query.filter(model._CrowdReportModel.published < max_published)
    query = query.order(model._CrowdReportModel.published)

    count = self.FetchAndDelete(query)
    logging.info('Deleted %d expired CrowdReportModel entries', count)
