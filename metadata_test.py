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

import json

import cache
import metadata
import test_utils


MAPROOT = {
    'title': 't1',
    'layers': [{'id': 12,
                'type': 'KML',
                'source': {'kml': {'url': 'http://x.com/a'}}},
               {'id': 15,
                'type': 'GEORSS',
                'source': {'georss': {'url': 'http://y.com/b'}}},
               {'id': 16,
                'type': 'GOOGLE_TRAFFIC'}]
}


class MetadataTest(test_utils.BaseTest):
  def testGetSourceAddresses(self):
    self.assertEquals(
        set(['KML:http://x.com/a', 'GEORSS:http://y.com/b']),
        set(metadata.GetSourceAddresses(MAPROOT)))

  def testCacheSourceAddresses(self):
    key1, sources = metadata.CacheSourceAddresses('abc', MAPROOT)
    self.assertEquals(
        set(['KML:http://x.com/a', 'GEORSS:http://y.com/b']),
        set(cache.Get(['source_addresses', key1])))
    self.assertEquals(
        set(['KML:http://x.com/a', 'GEORSS:http://y.com/b']),
        set(sources))

    # Same map_version_key should yield the same cache key.
    key2, sources = metadata.CacheSourceAddresses('abc', MAPROOT)
    self.assertEquals(key1, key2)

  def testActivateSources(self):
    sources = ['KML:http://x.com/a', 'GEORSS:http://y.com/b']
    metadata.ActivateSources(sources)

    # Both sources should now be queued for metadata fetches.
    urls = sorted(task['url'] for task in self.PopTasks('metadata'))
    self.assertEquals(2, len(urls))
    self.assertEqualsUrlWithUnorderedParams(
        '/root/.metadata_fetch?source=GEORSS:http://y.com/b', urls[0])
    self.assertEqualsUrlWithUnorderedParams(
        '/root/.metadata_fetch?source=KML:http://x.com/a', urls[1])

    # Activating multiple times should not add redundant tasks.
    metadata.ActivateSources(sources)
    metadata.ActivateSources(sources)
    self.assertEquals(0, len(self.PopTasks('metadata')))

  def testGet(self):
    key, _ = metadata.CacheSourceAddresses('abc', MAPROOT)
    cache.Set(['metadata', 'KML:http://x.com/a'], {'length': 123})
    cache.Set(['metadata', 'KML:http://p.com/q'], {'length': 456})

    # Map cache key, an address with metadata, and an address without metadata.
    response = self.DoGet('/.metadata?key=' + key +
                          '&source=KML:http://p.com/q' +
                          '&source=KML:http://z.com/z')
    self.assertEquals({
        'KML:http://x.com/a': {'length': 123},  # in map, has metadata
        'GEORSS:http://y.com/b': None,  # in map, no metadata
        'KML:http://p.com/q': {'length': 456},  # source param, has metadata
        'KML:http://z.com/z': None  # source param, no metadata
    }, json.loads(response.body))

  def testGetAndActivate(self):
    self.DoGet('/.metadata?source=KML:http://u.com/v')

    # Requesting metadata should activate the source and queue a task.
    self.assertEquals(1, cache.Get(['metadata_active', 'KML:http://u.com/v']))
    urls = sorted(task['url'] for task in self.PopTasks('metadata'))
    self.assertEquals(1, len(urls))
    self.assertEqualsUrlWithUnorderedParams(
        '/root/.metadata_fetch?source=KML:http://u.com/v', urls[0])

    # Requesting multiple times should not add redundant tasks.
    self.DoGet('/.metadata?source=KML:http://u.com/v')
    self.DoGet('/.metadata?source=KML:http://u.com/v')
    self.assertEquals(0, len(self.PopTasks('metadata')))

if __name__ == '__main__':
  test_utils.main()
