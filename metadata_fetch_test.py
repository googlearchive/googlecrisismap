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

"""Tests for metadata_fetch.py."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import hashlib
import json
import re
import StringIO
import zipfile

import cache
import maps
import metadata
import metadata_fetch
import model
import test_utils
import utils

from google.appengine.api import taskqueue
from google.appengine.api import urlfetch
from google.appengine.api import urlfetch_errors


def CreateZip(name_content_pairs):
  """Creates a zip file in memory.

  Args:
    name_content_pairs: List of (filename, content) pairs.

  Returns:
    The string content of the packed zip file.
  """
  zip_file_content = StringIO.StringIO()
  zf = zipfile.ZipFile(zip_file_content, mode='w')
  for (name, content) in name_content_pairs:
    zf.writestr(name, content)
  zf.close()
  return zip_file_content.getvalue()


# Some values used in tests.
SOURCE_ADDRESS = 'KML:http://example.org/example.kml'
SOURCE_URL = 'http://example.org/example.kml'
GEORSS_URL = 'http://georss.org/foo.xml'

LAST_MODIFIED_TIMESTAMP = 1341258096
LAST_MODIFIED_STRING = 'Mon, 02 Jul 2012 19:41:36 GMT'
ETAG = 'abcde'
RESPONSE_HEADERS = {'Last-modified': LAST_MODIFIED_STRING, 'Etag': ETAG}
SIMPLE_KML = '<kml><Document><Placemark>abc</Placemark></Document></kml>'

LAST_MODIFIED_TIMESTAMP_2 = 1341318896
LAST_MODIFIED_STRING_2 = 'Tue, 03 Jul 2012 12:34:56 GMT'
ETAG_2 = 'fghij'
RESPONSE_HEADERS_2 = {'Last-modified': LAST_MODIFIED_STRING_2, 'Etag': ETAG_2}
SIMPLE_KML_2 = '<kml><Document><Placemark>def</Placemark></Document></kml>'

SIMPLE_GEORSS = '<rss><channel><item>foo</item></channel></rss>'
FETCH_TIME = 1341324364
FETCH_TIME_2 = 1341324371

METADATA = {'fetch_time': 1234560000, 'fetch_status': 200, 'length': 1234}
METADATA_2 = {'fetch_time': 1234567890, 'fetch_status': 200, 'length': 123456}


class MetadataFetchTest(test_utils.BaseTest):
  def testGetKml(self):
    # Non-zip file content should be returned as is.
    self.assertEquals('foo', metadata_fetch.GetKml('foo'))

    # Zip archive with doc.kml should return doc.kml's content.
    self.assertEquals('foo content', metadata_fetch.GetKml(
        CreateZip([('doc.kml', 'foo content')])))

    # Zip archive with no .kml files should return None.
    self.assertEquals(None, metadata_fetch.GetKml(
        CreateZip([('foo1', 'bar1'), ('foo2', 'bar2')])))

    # No doc.kml file, but some other .kml files. First one should be returned.
    self.assertEquals('asdf', metadata_fetch.GetKml(
        CreateZip([('xyz.kml', 'asdf'), ('abc.kml', 'zxcv')])))

  def testGetAllXmlTags(self):
    kml = """<?xml version="1.0" encoding="UTF-8"?>
             <kml xmlns="http://earth.google.com/kml/2.2">
             <Document><name>blah</name><name>re</name><description>foo
             </description></Document></kml>"""
    self.assertEquals(['kml', 'Document', 'name', 'name', 'description'],
                      metadata_fetch.GetAllXmlTags(kml))

  def testHasUnsupportedKml(self):
    supported_kml = """<?xml version="1.0" encoding="UTF-8"?>
                       <kml xmlns="http://earth.google.com/kml/2.2">
                       <Document><name>blah</name></Document></kml>"""
    # Unsupported tag.
    unsupported_kml_1 = """<?xml version="1.0" encoding="UTF-8"?>
                           <kml xmlns="http://earth.google.com/kml/2.2">
                           <Document><geomColor></geomColor></Document></kml>"""
    # Supported tags, but case matters.
    unsupported_kml_2 = """<?xml version="1.0" encoding="UTF-8"?>
                           <kml xmlns="http://earth.google.com/kml/2.2">
                           <Document><NAME></NAME></Document></kml>"""
    # Supported tags, but maximum number of network links is exceeded.
    unsupported_kml_3 = """<?xml version="1.0" encoding="UTF-8"?>
                           <kml xmlns="http://earth.google.com/kml/2.2">
                           <Document><NetworkLink>foo</NetworkLink>
                           <NetworkLink>foo</NetworkLink><NetworkLink>foo
                           </NetworkLink><NetworkLink>foo</NetworkLink>
                           <NetworkLink>foo</NetworkLink><NetworkLink>foo
                           </NetworkLink><NetworkLink>foo</NetworkLink>
                           <NetworkLink>foo</NetworkLink><NetworkLink>foo
                           </NetworkLink><NetworkLink>foo</NetworkLink>
                           <NetworkLink>foo</NetworkLink></Document></kml>"""

    self.assertFalse(metadata_fetch.HasUnsupportedKml(supported_kml))
    self.assertTrue(metadata_fetch.HasUnsupportedKml(unsupported_kml_1))
    self.assertTrue(metadata_fetch.HasUnsupportedKml(unsupported_kml_2))
    self.assertTrue(metadata_fetch.HasUnsupportedKml(unsupported_kml_3))

  def testGatherMetadataKml(self):
    # Valid KML.
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(SIMPLE_KML),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(SIMPLE_KML),
        'md5_hash': hashlib.md5(SIMPLE_KML).hexdigest()
    }, metadata_fetch.GatherMetadata('KML', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=SIMPLE_KML)))

    # Valid KML with no features.
    content = '<kml><Document></Document></kml>'
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(content),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(content),
        'md5_hash': hashlib.md5(content).hexdigest(),
        'has_no_features': True
    }, metadata_fetch.GatherMetadata('KML', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=content)))

    # Valid KML with unsupported features.
    content = '<kml><Document><Placemark><Camera/></Placemark></Document></kml>'
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(content),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(content),
        'md5_hash': hashlib.md5(content).hexdigest(),
        'has_unsupported_kml': True
    }, metadata_fetch.GatherMetadata('KML', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=content)))

  def testGatherMetadataGeorss(self):
    # Valid GeoRSS.
    content = '<rss><channel><item></item></channel></rss>'
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(content),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(content),
        'md5_hash': hashlib.md5(content).hexdigest()
    }, metadata_fetch.GatherMetadata('GEORSS', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=content)))

    # Valid GeoRSS with no features.
    content = '<rss><channel></channel></rss>'
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(content),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(content),
        'md5_hash': hashlib.md5(content).hexdigest(),
        'has_no_features': True
    }, metadata_fetch.GatherMetadata('GEORSS', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=content)))

  def testGatherMetadataInvalid(self):
    # Invalid XML syntax.
    content = '<blah'
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(content),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(content),
        'md5_hash': hashlib.md5(content).hexdigest(),
        'ill_formed': True
    }, metadata_fetch.GatherMetadata('KML', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=content)))

  def testFetchFirstTime(self):
    # Simulate a normal, successful fetch of a document for the first time.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    urlfetch.fetch(SOURCE_URL, headers={}, deadline=10).AndReturn(utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=SIMPLE_KML))

    self.mox.ReplayAll()
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(SIMPLE_KML),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(SIMPLE_KML),
        'md5_hash': hashlib.md5(SIMPLE_KML).hexdigest()
    }, metadata_fetch.FetchAndUpdateMetadata(None, SOURCE_ADDRESS))

    self.mox.VerifyAll()

  def testFetchSecondTime(self):
    # Simulate a successful fetch of a document that was previously fetched.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    headers = {'If-none-match': ETAG}
    urlfetch.fetch(SOURCE_URL, headers=headers, deadline=10).AndReturn(
        utils.Struct(status_code=200, headers=RESPONSE_HEADERS_2,
                     content=SIMPLE_KML_2))

    self.mox.ReplayAll()
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(SIMPLE_KML_2),
        'fetch_last_modified': LAST_MODIFIED_STRING_2,
        'fetch_etag': ETAG_2,
        'update_time': LAST_MODIFIED_TIMESTAMP_2,
        'length': len(SIMPLE_KML_2),
        'md5_hash': hashlib.md5(SIMPLE_KML_2).hexdigest()
    }, metadata_fetch.FetchAndUpdateMetadata({
        'fetch_status': 200,
        'fetch_length': len(SIMPLE_KML),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(SIMPLE_KML),
        'md5_hash': hashlib.md5(SIMPLE_KML).hexdigest()
    }, SOURCE_ADDRESS))

    self.mox.VerifyAll()

  def testFetchWithLastModified(self):
    # Verify that we send "If-modified-since", and simulate getting a 304.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    headers = {'If-modified-since': LAST_MODIFIED_STRING}
    urlfetch.fetch(SOURCE_URL, headers=headers, deadline=10).AndReturn(
        utils.Struct(status_code=304, headers={}, content='Not modified'))

    self.mox.ReplayAll()
    # Pretend there is existing metadata for 1234 bytes of content.
    old_metadata = {
        'fetch_status': 200,
        'fetch_length': 1234,
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': 1234,
        'md5_hash': 'foo'
    }
    # Updated metadata should be the same except fetch_status and fetch_length.
    self.assertEquals({
        'fetch_status': 304,
        'fetch_length': len('Not modified'),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': 1234,
        'md5_hash': 'foo'
    }, metadata_fetch.FetchAndUpdateMetadata(old_metadata, SOURCE_ADDRESS))

    self.mox.VerifyAll()

  def testFetchWithEtag(self):
    # Verify that we send "If-none-match", and simulate getting a 304.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    headers = {'If-none-match': ETAG}
    urlfetch.fetch(SOURCE_URL, headers=headers, deadline=10).AndReturn(
        utils.Struct(status_code=304, headers={}, content='Not modified'))

    self.mox.ReplayAll()
    # Pretend there is existing metadata for 1234 bytes of content.
    old_metadata = {
        'fetch_status': 200,
        'fetch_length': 1234,
        'fetch_etag': ETAG,
        'length': 1234,
        'md5_hash': 'foo'
    }
    # Updated metadata should be the same except fetch_status and fetch_length.
    self.assertEquals({
        'fetch_status': 304,
        'fetch_length': len('Not modified'),
        'fetch_etag': ETAG,
        'length': 1234,
        'md5_hash': 'foo'
    }, metadata_fetch.FetchAndUpdateMetadata(old_metadata, SOURCE_ADDRESS))

    self.mox.VerifyAll()

  def testFetchInvalidUrl(self):
    self.assertEquals(
        {'fetch_impossible': True},
        metadata_fetch.FetchAndUpdateMetadata(None, 'KML:blarg'))
    self.assertEquals(
        {'fetch_impossible': True},
        metadata_fetch.FetchAndUpdateMetadata(None, 'KML:blarg:'))
    self.assertEquals(
        {'fetch_impossible': True},
        metadata_fetch.FetchAndUpdateMetadata(None, 'KML:blarg://'))

  def testFetchDownloadError(self):
    # Simulate a DownloadError.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    urlfetch.fetch(SOURCE_URL, headers={}, deadline=10).AndRaise(
        urlfetch_errors.DownloadError('the internets are down'))

    self.mox.ReplayAll()
    self.assertEquals({
        'fetch_error_occurred': True
    }, metadata_fetch.FetchAndUpdateMetadata(None, SOURCE_ADDRESS))

    self.mox.VerifyAll()

  def testFetchHttpError(self):
    # Simulate a 404 Not found error.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    urlfetch.fetch(SOURCE_URL, headers={}, deadline=10).AndReturn(
        utils.Struct(status_code=404, headers={}, content='Not found'))

    self.mox.ReplayAll()
    self.assertEquals({
        'fetch_error_occurred': True,
        'fetch_status': 404
    }, metadata_fetch.FetchAndUpdateMetadata(None, SOURCE_ADDRESS))

    self.mox.VerifyAll()

  def testDetermineFetchDelay(self):
    # Small files should be fetched every couple of minutes.
    self.assertBetween(60, 180, metadata_fetch.DetermineFetchDelay(
        {'fetch_status': 200, 'fetch_length': 100}))

    # Medium-sized files should be fetched less often.
    self.assertBetween(180, 600, metadata_fetch.DetermineFetchDelay(
        {'fetch_status': 200, 'fetch_length': 100e3}))

    # Big files should be fetched every hour or so.
    self.assertBetween(600, 7200, metadata_fetch.DetermineFetchDelay(
        {'fetch_status': 200, 'fetch_length': 1e6}))

    # Update at least once a day, no matter how huge the file is.
    self.assertBetween(7200, 86400, metadata_fetch.DetermineFetchDelay(
        {'fetch_status': 200, 'fetch_length': 100e6}))

    # If we got a 304, delay should depend on fetch_length rather than length.
    self.assertBetween(60, 180, metadata_fetch.DetermineFetchDelay(
        {'fetch_status': 304, 'fetch_length': 100, 'length': 1e6}))

  def testUpdateMetadata(self):
    self.mox.StubOutWithMock(metadata_fetch, 'FetchAndUpdateMetadata')
    metadata_fetch.FetchAndUpdateMetadata(
        METADATA, SOURCE_ADDRESS).AndReturn(METADATA_2)

    self.mox.ReplayAll()
    self.SetTime(1234567890)
    cache.Set(['metadata', SOURCE_ADDRESS], METADATA)
    metadata_fetch.UpdateMetadata(SOURCE_ADDRESS)
    self.assertEquals(METADATA_2, cache.Get(['metadata', SOURCE_ADDRESS]))

    self.mox.VerifyAll()

  def testScheduleFetch(self):
    # Expect a task to be queued...
    self.mox.StubOutWithMock(taskqueue, 'add')
    taskqueue.add(queue_name='metadata', method='GET',
                  url='/crisismap/.metadata_fetch',
                  params={'source': SOURCE_ADDRESS},
                  countdown=metadata_fetch.DetermineFetchDelay(METADATA))

    # ...when the metadata_active flag is set.
    self.mox.ReplayAll()
    cache.Set(['metadata', SOURCE_ADDRESS], METADATA)
    cache.Set(['metadata_active', SOURCE_ADDRESS], 1)
    metadata_fetch.ScheduleFetch(SOURCE_ADDRESS)

    self.mox.VerifyAll()

  def testDontScheduleFetch(self):
    # Expect no tasks to be queued...
    self.mox.StubOutWithMock(taskqueue, 'add')

    # ...when the address is unfetchable.
    cache.Set(['metadata', SOURCE_ADDRESS], {'fetch_impossible': True})
    cache.Set(['metadata_active', SOURCE_ADDRESS], 1)
    metadata_fetch.ScheduleFetch(SOURCE_ADDRESS)

    self.mox.VerifyAll()

  def testSystem(self):
    """Tests map, metadata_fetch, and metadata, all working together."""
    test_utils.BecomeAdmin()
    map_object = model.Map.Create("""{
        "layers": [{"type": "KML",
                    "source": {"kml": {"url": "%s"}}},
                   {"type": "GEORSS",
                    "source": {"georss": {"url": "%s"}}}]
    }""" % (SOURCE_URL, GEORSS_URL), 'xyz.com')

    # Simulate the first map load.
    handler = test_utils.SetupHandler(
        '/crisismap/xyz.com/.map/' + map_object.id, maps.MapById())
    handler.get('xyz.com', map_object.id)

    # Get the metadata cache key mentioned in the map page.
    key = re.search(r'"metadata_url": "/crisismap/.metadata\?key=(\w+)"',
                    handler.response.body).group(1)

    # The map load should have queued two metadata_fetch tasks.
    tasks = sorted(self.PopTasks('metadata'))
    self.assertEqual(2, len(tasks))
    self.assertTrue(tasks[0]['url'].startswith('/crisismap/.metadata_fetch'))
    self.assertTrue(tasks[1]['url'].startswith('/crisismap/.metadata_fetch'))

    # Loading the map again should not queue redundant tasks.
    handler = test_utils.SetupHandler(
        '/crisismap/xyz.com/.map/' + map_object.id, maps.MapById())
    handler.get('xyz.com', map_object.id)
    self.assertEqual(0, len(self.PopTasks('metadata')))

    # Execute the queued metadata_fetch tasks.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    urlfetch.fetch(GEORSS_URL, headers={}, deadline=10).AndReturn(utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=SIMPLE_GEORSS))
    urlfetch.fetch(SOURCE_URL, headers={}, deadline=10).AndReturn(utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS_2, content=SIMPLE_KML))

    self.mox.ReplayAll()
    self.SetTime(FETCH_TIME)
    self.ExecuteTask(tasks[0], metadata_fetch.MetadataFetch())
    self.SetTime(FETCH_TIME_2)
    self.ExecuteTask(tasks[1], metadata_fetch.MetadataFetch())

    self.mox.VerifyAll()

    # metadata.py should now return the cached metadata.
    handler = test_utils.SetupHandler(
        '/crisismap/.metadata?key=' + key, metadata.Metadata())
    handler.get()
    self.assertEquals({
        'GEORSS:' + GEORSS_URL: {
            'fetch_time': FETCH_TIME,
            'fetch_status': 200,
            'fetch_length': len(SIMPLE_GEORSS),
            'fetch_last_modified': LAST_MODIFIED_STRING,
            'fetch_etag': ETAG,
            'update_time': LAST_MODIFIED_TIMESTAMP,
            'length': len(SIMPLE_GEORSS),
            'md5_hash': hashlib.md5(SIMPLE_GEORSS).hexdigest()
        },
        'KML:' + SOURCE_URL: {
            'fetch_time': FETCH_TIME_2,
            'fetch_status': 200,
            'fetch_length': len(SIMPLE_KML),
            'fetch_last_modified': LAST_MODIFIED_STRING_2,
            'fetch_etag': ETAG_2,
            'update_time': LAST_MODIFIED_TIMESTAMP_2,
            'length': len(SIMPLE_KML),
            'md5_hash': hashlib.md5(SIMPLE_KML).hexdigest()
        }
    }, json.loads(handler.response.body))


if __name__ == '__main__':
  test_utils.main()
