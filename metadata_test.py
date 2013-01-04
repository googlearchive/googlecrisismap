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

"""Tests for metadata.py."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import datetime
import json
import time
import urllib2

# Allow relative imports within the app.  # pylint: disable=W0403
import map  # Allow use of the name 'map'.  # pylint: disable-msg=W0622
import metadata
import metadata_retriever as retriever
import model
import test_utils

from google.appengine.ext import db


class MetadataTest(test_utils.BaseTest):
  def testGetIntrinsicPropertiesRecord(self):
    """Tests if the instrinsic properties record is successfully generated."""
    address = '{"url": "google.com/abc.kml"}'
    sm = retriever.SourceMetadataModel(key_name=address, content_hash='abc',
                                       content_length=7, server_etag='xyz')
    sm.put()
    record = metadata.GetIntrinsicPropertiesRecord(address)
    self.assertEquals({'content_hash': 'abc', 'content_length': 7}, record)

  def testGet(self):
    """Tests Metadata GET handler."""
    test_utils.SetUser('admin@google.com', '1', is_admin=True)
    address1 = 'y.com/b.xml'
    date1 = datetime.datetime(2012, 4, 17, 9, 5, 34)
    sm = retriever.SourceMetadataModel(key_name=address1, has_no_features=True,
                                       content_last_modified=date1)
    sm.put()
    maproot1 = """{"layers": [{"type": "GEORSS",
                               "source": {"georss": {"url": "y.com/b.xml"}}}
                             ]}"""
    mm1 = model.Map.Create(maproot1)
    key1 = map.CacheLayerAddresses(mm1)

    address2 = 'x.com/a.kml'
    sm = retriever.SourceMetadataModel(key_name=address2, content_length=7,
                                       content_hash='a', has_no_features=False)
    sm.put()
    maproot2 = """{"layers": [{"type": "KML",
                               "source": {"kml": {"url": "x.com/a.kml"}}}
                             ]}"""
    model.Map.Create(maproot2)

    # Token for the Map, valid address of a layer, invalid address of a layer.
    url = ('/metadata?token=' + key1 + '&layers=' + urllib2.quote(address2) +
           '%24abc.com/aaa.xml%24')
    handler = test_utils.SetupHandler(url, metadata.Metadata())
    handler.get()
    result = json.loads(handler.response.body)

    expected = {}
    expected[address1] = metadata.GetIntrinsicPropertiesRecord(address1)
    # Parse datetime into seconds from epoch.
    seconds = int(time.mktime(date1.timetuple()))
    expected[address1]['content_last_modified'] = seconds
    expected[address2] = metadata.GetIntrinsicPropertiesRecord(address2)

    self.assertEquals(expected, result)

if __name__ == '__main__':
  test_utils.main()
