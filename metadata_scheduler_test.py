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
import cgi

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
    # Should not be queued because the map is not world readable or published.
    m1 = model.Map.Create('{"layers": [{"type": "KML", '
                          '"source": {"kml": {"url": "j.com/k.kml"}}}]}')
    m1.SetWorldReadable(False)

    # Should be queued because the layer is valid and the map is world-readable.
    m2 = model.Map.Create('{"layers": [{"type": "KML", '
                          '"source": {"kml": {"url": "a.com/b.kml"}}}]}')
    m2.SetWorldReadable(True)

    # Should not be queued because the layer has no type.
    m3 = model.Map.Create('{}')
    m3.SetWorldReadable(False)
    model.CatalogEntry.Create('google.com', 'label1', m3, is_listed=True)

    # Should not be queued because the layer has no address.
    m3.PutNewVersion('{"layers": [{"type": "KML"}]}')
    model.CatalogEntry.Create('google.com', 'label2', m3, is_listed=True)

    # Listed map should be queued (map is published and the layer is valid).
    m3.PutNewVersion('{"layers": [{"type": "KML", '
                     '"source": {"kml": {"url": "x.com/y.kml"}}}]}')
    model.CatalogEntry.Create('google.com', 'label3', m3, is_listed=True)

    # Unlisted map should be queued (map is published and the layer is valid).
    m3.PutNewVersion('{"layers": [{"type": "KML", '
                     '"source": {"kml": {"url": "z.com/y.kml"}}}]}')
    model.CatalogEntry.Create('google.com', 'label4', m3, is_listed=False)

    # Should not be queued because the type is not supported.
    m3.PutNewVersion('{"layers": [{"type": "FUSION", '
                     '"source": {"georss": {"url": "x.com/n.xml"}}}]}')
    model.CatalogEntry.Create('google.com', 'label5', m3, is_listed=True)

    # Should not be queued because the address is a duplicate.
    m3.PutNewVersion('{"layers": [{"type": "KML", '
                     '"source": {"kml": {"url": "x.com/y.kml"}}}]}')
    model.CatalogEntry.Create('google.com', 'label36', m3, is_listed=True)

    # Call the handler as a cron job (with user set to None).
    test_utils.ClearUser()
    handler = test_utils.SetupHandler('/crisismap/metadata_scheduler',
                                      metadata_scheduler.MetadataScheduler())
    handler.get()

    tasks = self.taskqueue_stub.GetTasks('metadata')
    self.assertEquals(3, len(tasks))

    self.assertEquals({'type': ['KML'], 'address': ['a.com/b.kml']},
                      cgi.parse_qs(base64.b64decode(tasks[0]['body'])))
    self.assertEquals({'type': ['KML'], 'address': ['x.com/y.kml']},
                      cgi.parse_qs(base64.b64decode(tasks[1]['body'])))
    self.assertEquals({'type': ['KML'], 'address': ['z.com/y.kml']},
                      cgi.parse_qs(base64.b64decode(tasks[2]['body'])))


if __name__ == '__main__':
  test_utils.main()
