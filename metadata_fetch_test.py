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
import config
import metadata_fetch
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
ATOM_URL = 'http://atom.org/foo.xml'

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

# XML for a valid WMS GetCapabilities response. One layer inherits the
# bounding box from its parent.
VALID_WMS_RESPONSE = """<?xml version="1.0" encoding="UTF-8" ?>
  <WMT_MS_Capabilities version="1.1.1">
    <Service><Name>OGC:WMS</Name>
    </Service>
    <Capability>
      <Layer>
        <Name>Valid</Name>
        <LatLonBoundingBox minx="-50.2" miny="10.9" maxx="50.8" maxy="35.5">
        </LatLonBoundingBox>
        <Layer><Name>Zipcodes</Name>
          <LatLonBoundingBox minx="-124" miny="32.5" maxx="-114" maxy="42.9">
          </LatLonBoundingBox>
        </Layer>
        <Layer><Name>Ireland</Name>
          <LatLonBoundingBox minx="-11.1" miny="50.9" maxx="-4.2" maxy="55.8">
          </LatLonBoundingBox>
            <Layer><Name>NoBbox</Name></Layer>
        </Layer>
      </Layer>
    </Capability>
  </WMT_MS_Capabilities>"""

METADATA_VALID_WMS_RESPONSE = {
    'Valid': {'minx': -50.2, 'miny': 10.9, 'maxx': 50.8, 'maxy': 35.5},
    'Zipcodes': {'minx': -124, 'miny': 32.5, 'maxx': -114, 'maxy': 42.9},
    'Ireland': {'minx': -11.1, 'miny': 50.9, 'maxx': -4.2, 'maxy': 55.8},
    'NoBbox': {'minx': -11.1, 'miny': 50.9, 'maxx': -4.2, 'maxy': 55.8}}

# XML for a WMS GetCapabilities response with invalid layers.
INVALID_LAYERS_WMS_RESPONSE = """<?xml version="1.0"?>
  <WMT_MS_Capabilities version="1.1.1">
    <Service><Name>OGC:WMS</Name>
    </Service>
    <Capability>
      <Layer>
        <Name>valid</Name>
        <LatLonBoundingBox minx="-170" miny="-70" maxx="170" maxy="70"/>
        <Layer>
          <Title>no_name</Title>
          <LatLonBoundingBox minx="0" miny="0" maxx="1" maxy="1"/>
        </Layer>
        <Layer>
          <Name>missing_attributes</Name>
          <LatLonBoundingBox minx="0" miny="0"/>
          <Layer><Name>child_of_invalid</Name></Layer>
        </Layer>
        <Layer>
          <Name>value_error</Name>
          <LatLonBoundingBox minx="0" miny="1" maxx="0" maxy="abc"/>
        </Layer>
      </Layer>
    </Capability>
  </WMT_MS_Capabilities>
"""

METADATA_INVALID_LAYERS_WMS_RESPONSE = {
    'valid': {'minx': -170.0, 'miny': -70.0, 'maxx': 170.0, 'maxy': 70.0}}

# A response that is valid XML but an invalid WMS GetCapabilities response.
INVALID_WMS_RESPONSE = """<?xml version="1.0"?>
  <WMT_MS_Capabilities version="1.1.1">
    <Service><Name>OGC:WMS</Name></Service>
    <Name>Fake</Name>
    <LatLonBoundingBox minx="-50.2" miny="10.9" maxx="50.8" maxy="35.5">
    </LatLonBoundingBox>
  </WMT_MS_Capabilities>
"""

# A WMS GetCapabilities response that is invalid XML.
INVALID_XML_WMS_RESPONSE = """<?xml version="1.0"?>
  <WMT_MS_Capabilities version="1.1.1">
    <Service><Name>OGC:WMS</Name></Service>
    <Capability>
      <Layer>
        <Name>Fake</Name>
        <LatLonBoundingBox minx="-50.2" miny="10.9" maxx="50.8" maxy="35.5">
        </LatLonBoundingBox>
    </Capability>
  </WMT_MS_Capabilities>
"""

SIMPLE_ATOM = '<feed><entry>foo</entry></feed>'
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

  def testParseXml(self):
    # ParseXml should accept ASCII text declared as UTF-8
    xml = metadata_fetch.ParseXml(
        '<?xml version="1.0" encoding="UTF-8"?><a>foo</a>')
    self.assertEquals('foo', xml.text)

    # ParseXml should accept UTF-8 text declared as UTF-8
    xml = metadata_fetch.ParseXml(
        '<?xml version="1.0" encoding="UTF-8"?><a>f\xc3\xb8o</a>')
    self.assertEquals(u'f\xf8o', xml.text)

    # ParseXml should handle non-UTF-8 text declared incorrectly as UTF-8
    xml = metadata_fetch.ParseXml(
        '<?xml version="1.0" encoding="UTF-8"?><a>f\xf8o</a>')
    self.assertEquals(u'f\xf8o', xml.text)

  def testHasUnsupportedKml(self):
    supported_kml = metadata_fetch.ParseXml(
        """<?xml version="1.0" encoding="UTF-8"?>
           <kml xmlns="http://earth.google.com/kml/2.2">
           <Document><name>blah</name></Document></kml>""")
    # Unsupported tag.
    unsupported_kml_1 = metadata_fetch.ParseXml(
        """<?xml version="1.0" encoding="UTF-8"?>
           <kml xmlns="http://earth.google.com/kml/2.2">
           <Document><geomColor></geomColor></Document></kml>""")
    # Supported tags, but case matters.
    unsupported_kml_2 = metadata_fetch.ParseXml(
        """<?xml version="1.0" encoding="UTF-8"?>
           <kml xmlns="http://earth.google.com/kml/2.2">
           <Document><NAME></NAME></Document></kml>""")
    # Supported tags, but maximum number of network links is exceeded.
    unsupported_kml_3 = metadata_fetch.ParseXml(
        """<?xml version="1.0" encoding="UTF-8"?>
           <kml xmlns="http://earth.google.com/kml/2.2">
           <Document><NetworkLink>foo</NetworkLink>
           <NetworkLink>foo</NetworkLink><NetworkLink>foo
           </NetworkLink><NetworkLink>foo</NetworkLink>
           <NetworkLink>foo</NetworkLink><NetworkLink>foo
           </NetworkLink><NetworkLink>foo</NetworkLink>
           <NetworkLink>foo</NetworkLink><NetworkLink>foo
           </NetworkLink><NetworkLink>foo</NetworkLink>
           <NetworkLink>foo</NetworkLink></Document></kml>""")

    self.assertFalse(metadata_fetch.HasUnsupportedKml(supported_kml))
    self.assertTrue(metadata_fetch.HasUnsupportedKml(unsupported_kml_1))
    self.assertTrue(metadata_fetch.HasUnsupportedKml(unsupported_kml_2))
    self.assertTrue(metadata_fetch.HasUnsupportedKml(unsupported_kml_3))

  def testGatherMetadataWmsValid(self):
    self.maxDiff = None
    # A valid WMS GetCapabilities response.
    self.assertEquals(METADATA_VALID_WMS_RESPONSE,
                      metadata_fetch.GatherMetadata('WMS', utils.Struct(
                          status_code=200, headers=RESPONSE_HEADERS,
                          content=VALID_WMS_RESPONSE))['wms_layers'])

    # A response with a valid layer and several invalid Layers.
    self.assertEquals(METADATA_INVALID_LAYERS_WMS_RESPONSE,
                      metadata_fetch.GatherMetadata('WMS', utils.Struct(
                          status_code=200, headers=RESPONSE_HEADERS,
                          content=INVALID_LAYERS_WMS_RESPONSE))['wms_layers'])

  def testGatherMetadataWmsInvalid(self):
    self.maxDiff = None
    # An invalid WMS response that is valid XML.
    self.assertEquals({}, metadata_fetch.GatherMetadata(
        'WMS', utils.Struct(status_code=200, headers=RESPONSE_HEADERS,
                            content=INVALID_WMS_RESPONSE))['wms_layers'])

  def testGatherMetadataWmsInvalidXml(self):
    self.maxDiff = None
    # An WMS response with invalid XML.
    self.assertTrue(metadata_fetch.GatherMetadata(
        'WMS', utils.Struct(status_code=200, headers=RESPONSE_HEADERS,
                            content=INVALID_XML_WMS_RESPONSE))['ill_formed'])

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

    # Valid KML with a NetworkLink, but no ETag or Last-modified header.
    content = '<kml><Document><NetworkLink/></Document></kml>'
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(content),
        'length': len(content),
        'md5_hash': hashlib.md5(content).hexdigest()
    }, metadata_fetch.GatherMetadata('KML', utils.Struct(
        status_code=200, headers={}, content=content)))

    # Valid KML with a NetworkLink, which invalidates the update time.
    content = '<kml><Document><NetworkLink/></Document></kml>'
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(content),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'length': len(content),
        'md5_hash': hashlib.md5(content).hexdigest()
    }, metadata_fetch.GatherMetadata('KML', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=content)))

  def testGatherMetadataKmz(self):
    # KMZ containing valid KML.
    kmz = CreateZip([('doc.kml', SIMPLE_KML)])
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(kmz),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(kmz),
        'md5_hash': hashlib.md5(kmz).hexdigest()
    }, metadata_fetch.GatherMetadata('KML', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=kmz)))

    # KMZ containing valid KML with unsupported features.
    content = '<kml><Document><Placemark><Camera/></Placemark></Document></kml>'
    kmz = CreateZip([('doc.kml', content)])
    self.assertEquals({
        'fetch_status': 200,
        'fetch_length': len(kmz),
        'fetch_last_modified': LAST_MODIFIED_STRING,
        'fetch_etag': ETAG,
        'update_time': LAST_MODIFIED_TIMESTAMP,
        'length': len(kmz),
        'md5_hash': hashlib.md5(kmz).hexdigest(),
        'has_unsupported_kml': True
    }, metadata_fetch.GatherMetadata('KML', utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=kmz)))

  def testGatherMetadataAtom(self):
    # Valid Atom.
    content = '<feed><entry></entry></feed>'
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

    # Valid Atom with no features.
    content = '<feed></feed>'
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
    urlfetch.fetch(SOURCE_URL, headers={}, deadline=30).AndReturn(utils.Struct(
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
    urlfetch.fetch(SOURCE_URL, headers=headers, deadline=30).AndReturn(
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
    urlfetch.fetch(SOURCE_URL, headers=headers, deadline=30).AndReturn(
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
    urlfetch.fetch(SOURCE_URL, headers=headers, deadline=30).AndReturn(
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
        metadata_fetch.FetchAndUpdateMetadata(None, 'WMS:blarg'))
    self.assertEquals(
        {'fetch_impossible': True},
        metadata_fetch.FetchAndUpdateMetadata(None, 'KML:blarg:'))
    self.assertEquals(
        {'fetch_impossible': True},
        metadata_fetch.FetchAndUpdateMetadata(None, 'KML:blarg://'))

  def testFetchDownloadError(self):
    # Simulate a DownloadError.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    urlfetch.fetch(SOURCE_URL, headers={}, deadline=30).AndRaise(
        urlfetch_errors.DownloadError('the internets are down'))

    self.mox.ReplayAll()
    self.assertEquals({
        'fetch_error_occurred': True
    }, metadata_fetch.FetchAndUpdateMetadata(None, SOURCE_ADDRESS))

    self.mox.VerifyAll()

  def testFetchHttpError(self):
    # Simulate a 404 Not found error.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    urlfetch.fetch(SOURCE_URL, headers={}, deadline=30).AndReturn(
        utils.Struct(status_code=404, headers={}, content='Not found'))

    self.mox.ReplayAll()
    self.assertEquals({
        'fetch_error_occurred': True,
        'fetch_status': 404
    }, metadata_fetch.FetchAndUpdateMetadata(None, SOURCE_ADDRESS))

    self.mox.VerifyAll()

  def testDetermineFetchInterval(self):
    # Small files should be fetched every couple of minutes.
    self.assertBetween(60, 180, metadata_fetch.DetermineFetchInterval(
        {'fetch_status': 200, 'fetch_length': 100}))

    # Medium-sized files should be fetched less often.
    self.assertBetween(180, 600, metadata_fetch.DetermineFetchInterval(
        {'fetch_status': 200, 'fetch_length': 100e3}))

    # Big files should be fetched every hour or so.
    self.assertBetween(600, 7200, metadata_fetch.DetermineFetchInterval(
        {'fetch_status': 200, 'fetch_length': 1e6}))

    # Update at least once a day, no matter how huge the file is.
    self.assertBetween(7200, 86400, metadata_fetch.DetermineFetchInterval(
        {'fetch_status': 200, 'fetch_length': 100e6}))

    # If we got a 304, interval should depend on fetch_length instead of length.
    self.assertBetween(60, 180, metadata_fetch.DetermineFetchInterval(
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

  def testUpdateMetadataWithZeroBandwidth(self):
    # FetchAndUpdateMetadata should not be called
    config.Set('metadata_max_megabytes_per_day_per_source', 0)
    metadata_fetch.FetchAndUpdateMetadata = lambda *args: self.fail()

    self.SetTime(1234567890)
    cache.Set(['metadata', SOURCE_ADDRESS], METADATA)
    metadata_fetch.UpdateMetadata(SOURCE_ADDRESS)

  def testScheduleFetch(self):
    # Expect a task to be queued...
    self.mox.StubOutWithMock(taskqueue, 'add')
    taskqueue.add(queue_name='metadata', method='GET',
                  url='/root/.metadata_fetch',
                  params={'source': SOURCE_ADDRESS},
                  countdown=metadata_fetch.DetermineFetchInterval(METADATA))

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
    map_object = test_utils.CreateMap("""{
        "layers": [{"type": "KML",
                    "source": {"kml": {"url": "%s"}}},
                   {"type": "GEORSS",
                    "source": {"georss": {"url": "%s"}}}]
    }""" % (SOURCE_URL, GEORSS_URL), 'xyz.com', owners=['owner'])

    # Simulate the first map load.
    with test_utils.Login('owner'):
      response = self.DoGet('/xyz.com/.maps/' + map_object.id)

    # Get the metadata cache key mentioned in the map page.
    key = re.search(r'"metadata_url": "/root/.metadata\?key=(\w+)"',
                    response.body).group(1)

    # The map load should have queued two metadata_fetch tasks.
    tasks = sorted(self.PopTasks('metadata'))
    self.assertEqual(2, len(tasks))
    self.assertTrue(tasks[0]['url'].startswith('/root/.metadata_fetch'))
    self.assertTrue(tasks[1]['url'].startswith('/root/.metadata_fetch'))

    # Loading the map again should not queue redundant tasks.
    with test_utils.Login('owner'):
      self.DoGet('/xyz.com/.maps/' + map_object.id)
    self.assertEqual(0, len(self.PopTasks('metadata')))

    # Execute the queued metadata_fetch tasks.
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    urlfetch.fetch(GEORSS_URL, headers={}, deadline=30).AndReturn(utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS, content=SIMPLE_GEORSS))
    urlfetch.fetch(SOURCE_URL, headers={}, deadline=30).AndReturn(utils.Struct(
        status_code=200, headers=RESPONSE_HEADERS_2, content=SIMPLE_KML))

    self.mox.ReplayAll()
    self.SetTime(FETCH_TIME)
    self.ExecuteTask(tasks[0])
    self.SetTime(FETCH_TIME_2)
    self.ExecuteTask(tasks[1])

    self.mox.VerifyAll()

    # metadata.py should now return the cached metadata.
    response = self.DoGet('/.metadata?key=' + key)
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
    }, json.loads(response.body))


if __name__ == '__main__':
  test_utils.main()
