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

"""Tests for metadata_scheduler.py."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import base64
import urlparse

# Allow relative imports within the app.  # pylint: disable=W0403
import metadata_scheduler
import model
import test_utils


class MetadataSchedulerTest(test_utils.BaseTest):
  """Tests for the metadata_scheduler.py request handler."""

  def setUp(self):
    super(MetadataSchedulerTest, self).setUp()
    self.taskqueue_stub = self.testbed.get_stub('taskqueue')

  def testGet(self):
    test_utils.BecomeAdmin()
    handler = test_utils.SetupHandler('/crisismap/metadata_scheduler',
                                      metadata_scheduler.MetadataScheduler())
    # Not added to taskqueue because the map is not world readable, and
    # there is no listed CatalogEntry.
    m1 = model.Map.Create('{"layers": [{"type": "KML", '
                          '"source": {"kml": {"url": "j.com/k.kml"}}}]}')
    m1.SetWorldReadable(False)

    # Added successfully to taskqueue, valid MapRoot and world readable map.
    m2 = model.Map.Create('{"layers": [{"type": "KML", '
                          '"source": {"kml": {"url": "a.com/b.kml"}}}]}')
    m2.SetWorldReadable(True)

    m3 = model.Map.Create('{}')
    m3.SetWorldReadable(False)
    # Not added to taskqueue because of invalid MapRoot(no address and type)
    model.CatalogEntry.Create('google.com', 'label1', m3, is_listed=True)

    # Not added to taskqueue because of invalid MapRoot(no address)
    m3.PutNewVersion('{"layers": [{"type": "KML"}]}')
    model.CatalogEntry.Create('google.com', 'label2', m3, is_listed=True)

    # Added to taskqueue, CatalogEntry is listed, MapRoot is valid.
    m3.PutNewVersion('{"layers": [{"type": "KML", '
                     '"source": {"kml": {"url": "x.com/y.kml"}}}]}')
    model.CatalogEntry.Create('google.com', 'label3', m3, is_listed=True)

    # Not added to taskqueue because the CatalogEntry is not listed.
    m3.PutNewVersion('{"layers": [{"type": "KML", '
                     '"source": {"kml": {"url": "z.com/y.kml"}}}]}')
    model.CatalogEntry.Create('google.com', 'label4', m3, is_listed=False)

    # Not added to taskqueue because the type is not supported.
    m3.PutNewVersion('{"layers": [{"type": "FUSION", '
                     '"source": {"georss": {"url": "x.com/n.xml"}}}]}')
    model.CatalogEntry.Create('google.com', 'label5', m3, is_listed=True)

    # Not added to taskqueue because the address is already enqueued.
    m3.PutNewVersion('{"layers": [{"type": "KML", '
                     '"source": {"kml": {"url": "x.com/y.kml"}}}]}')
    model.CatalogEntry.Create('google.com', 'label36', m3, is_listed=True)

    handler.get()

    tasks = self.taskqueue_stub.GetTasks('metadata-queue')
    self.assertEquals(2, len(tasks))

    self.assertEquals({'type': ['KML'], 'address': ['a.com/b.kml']},
                      urlparse.parse_qs(base64.b64decode(tasks[0]['body'])))
    self.assertEquals({'type': ['KML'], 'address': ['x.com/y.kml']},
                      urlparse.parse_qs(base64.b64decode(tasks[1]['body'])))


if __name__ == '__main__':
  test_utils.main()
