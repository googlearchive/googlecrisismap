#!/usr/bin/python2.5
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

"""Tests for metadata_cleaner.py."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import datetime

# Allow relative imports within the app.  # pylint: disable=W0403
import metadata_cleaner
import metadata_retriever
import test_utils

from google.appengine.ext import db


class MetadataCleanerTest(test_utils.BaseTest):
  """Tests for the metadata_cleaner.py request handler."""

  def setUp(self):
    super(MetadataCleanerTest, self).setUp()
    test_utils.BecomeAdmin()

  def testGet(self):
    handler = test_utils.SetupHandler('/crisismap/metadata_cleaner',
                                      metadata_cleaner.MetadataCleaner())

    # We don't use test_utils.MyDateTime here because MetadataCleaner uses
    # Datastore filters and custom types cannot be used for filters.
    sm1_last_checked = (datetime.datetime.utcnow() -
                        datetime.timedelta(days=5))
    sm1 = metadata_retriever.SourceMetadataModel(last_checked=sm1_last_checked)
    key1 = db.put(sm1)
    sm2_last_checked = (datetime.datetime.utcnow() -
                        datetime.timedelta(seconds=20))
    sm2 = metadata_retriever.SourceMetadataModel(last_checked=sm2_last_checked)
    key2 = db.put(sm2)

    handler.get()
    self.assertFalse(db.get(key1))
    self.assertEquals(sm2_last_checked, db.get(key2).last_checked)


if __name__ == '__main__':
  test_utils.main()
