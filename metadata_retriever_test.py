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

"""Tests for retriever.py."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import datetime
import logging
import StringIO
import urllib2
import zipfile

# Allow relative imports within the app.  # pylint: disable=W0403
import metadata_retriever as retriever
import mox
import test_utils


def CreateZip(file_descriptions):
  """Creates a zip file in memory.

  Args:
    file_descriptions: List of tuples having two fields. The first field is
        the file name and the second is the file content.

  Returns:
    The zip file content.
  """
  zip_file_content = StringIO.StringIO()
  zf = zipfile.ZipFile(zip_file_content, mode='w')
  for file_description in file_descriptions:
    zf.writestr(*file_description)
  zf.close()
  return zip_file_content.getvalue()


class MetadataRetrieverTest(test_utils.BaseTest):
  def PatchDateTime(self):
    self.original_date_time = datetime.datetime
    datetime.datetime = test_utils.MyDateTime

  def UnpatchDateTime(self):
    datetime.datetime = self.original_date_time

  def setUp(self):
    super(MetadataRetrieverTest, self).setUp()
    self.PatchDateTime()
    self.fake_kml = """<?xml version="1.0" encoding="UTF-8"?>
                       <kml xmlns="http://earth.google.com/kml/2.2">
                       <Document><Placemark>bla</Placemark></Document></kml>"""
    self.fake_georss = """<?xml version="1.0" encoding="UTF-8"?>
                          <rss version="2.0"
                          xmlns:georss="http://www.w3.org/2003/01/geo/wgs84#">
                          <item><title>abc</title></item></rss>"""

  def tearDown(self):
    super(MetadataRetrieverTest, self).tearDown()
    self.UnpatchDateTime()

  def testGetAllXmlTags(self):
    content = """<?xml version="1.0" encoding="UTF-8"?>
                 <kml xmlns="http://earth.google.com/kml/2.2">
                 <Document><name>blah</name><name>re</name><description>foo
                 </description></Document></kml>"""
    result = retriever.GetAllXmlTags(content)
    # name appears twice.
    self.assertEquals(['Document', 'description', 'kml', 'name', 'name'],
                      sorted(result))

  def testHasUnsupportedKml(self):
    supported_kml = """<?xml version="1.0" encoding="UTF-8"?>
                       <kml xmlns="http://earth.google.com/kml/2.2">
                       <Document><name>blah</name></Document></kml>"""
    # Unsupported tag.
    unsupported_kml_1 = """<?xml version="1.0" encoding="UTF-8"?>
                           <kml xmlns="http://earth.google.com/kml/2.2">
                           <Document><geomColor></geomColor></Document>
                           </kml>"""
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

    self.assertFalse(retriever.HasUnsupportedKml(supported_kml))
    self.assertTrue(retriever.HasUnsupportedKml(unsupported_kml_1))
    self.assertTrue(retriever.HasUnsupportedKml(unsupported_kml_2))
    self.assertTrue(retriever.HasUnsupportedKml(unsupported_kml_3))

  def testGetKml(self):
    url_handle = StringIO.StringIO('foo')
    # Non-zip file content should be returned as it is.
    result = retriever.GetKml(url_handle)
    self.assertEquals('foo', result)
    # Zip file with doc.kml should return doc.kml's content.
    url_handle = StringIO.StringIO(CreateZip([('doc.kml', 'foo content')]))
    result = retriever.GetKml(url_handle)
    self.assertEquals('foo content', result)
    # Zip file with no KML should return None.
    url_handle = StringIO.StringIO(CreateZip([('foo1', 'bar1'),
                                              ('foo2', 'bar2')]))
    result = retriever.GetKml(url_handle)
    self.assertFalse(result)
    # No doc.kml file, but several other .kml files. Alphabetically first
    # should be returned.
    url_handle = StringIO.StringIO(CreateZip([('xyz.kml', 'bar1'),
                                              ('abc.kml', 'bar2')]))
    result = retriever.GetKml(url_handle)
    self.assertEquals(result, 'bar2')

  def testNeedsUpdate(self):
    new_utcnow = datetime.datetime(2012, 4, 17, 20, 30, 40)
    test_utils.MyDateTime.default_datetime = new_utcnow
    stale_datetime = datetime.datetime(2012, 4, 17, 20, 10, 0)
    source_metadata = retriever.SourceMetadataModel(
        check_interval_minutes=10,
        last_checked=stale_datetime)
    self.assertTrue(source_metadata.NeedsUpdate())

    # Use the default check_interval_minutes (15 minutes)
    fresh_datetime = datetime.datetime(2012, 4, 17, 20, 28, 0)
    source_metadata = retriever.SourceMetadataModel(
        last_checked=fresh_datetime)
    self.assertFalse(source_metadata.NeedsUpdate())

  def testCreateMetadata(self):
    class FakeUrl(object):
      def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

      def __get__(self, name, default=None):
        return self.__dict__.get(name, default)

    new_utcnow = datetime.datetime(2012, 4, 17, 20, 30, 40)
    test_utils.MyDateTime.default_datetime = new_utcnow
    last_modified_string = 'Mon, 02 Jul 2012 19:41:36 GMT'
    last_modified_datetime = datetime.datetime(2012, 7, 2, 19, 41, 36)
    etag = 'abcde'
    url_handle = FakeUrl(headers=
                         {'Last-modified': last_modified_string,
                          'Etag': etag})
    content = 'abc'
    key_name = 'www.google.com/abc.kml'
    old_metadata = retriever.SourceMetadataModel(
        key_name=key_name, check_interval_minutes=22)
    metadata = retriever.CreateMetadata(
        key_name, url_handle, content, old_metadata)
    self.assertEquals(3, metadata.content_length)
    self.assertEquals('900150983cd24fb0d6963f7d28e17f72',
                      metadata.content_hash)
    self.assertEquals(last_modified_string,
                      metadata.server_last_modified)
    self.assertEquals(last_modified_datetime,
                      metadata.content_last_modified)
    self.assertEquals(etag, metadata.server_etag)
    self.assertEquals(22, metadata.check_interval_minutes)
    self.assertEquals(test_utils.MyDateTime.default_datetime,
                      metadata.last_checked)

  def testCreateConnection(self):
    last_modified_string = 'Mon, 02 Jul 2012 19:41:36 GMT'
    etag = 'abcde'
    url = 'www.cnn.com'
    source_metadata = retriever.SourceMetadataModel(
        server_last_modified=last_modified_string,
        server_etag=etag)

    self.mox.StubOutWithMock(urllib2.Request, '__init__')
    self.mox.StubOutWithMock(urllib2.Request, 'add_header')
    self.mox.StubOutWithMock(urllib2, 'build_opener')
    self.mox.StubOutWithMock(urllib2.OpenerDirector, 'open')
    self.mox.StubOutWithMock(logging, 'error')

    urllib2.Request.__init__(url)
    urllib2.Request.add_header('If-Modified-Since', last_modified_string)
    urllib2.Request.add_header('If-None-Match', 'abcde')
    opener = self.mox.CreateMock(urllib2.OpenerDirector)
    urllib2.build_opener().AndReturn(opener)
    opener.open(mox.IgnoreArg()).AndRaise(urllib2.HTTPError
                                          ('http://google.com', 404, 'test',
                                           {}, StringIO.StringIO()))
    logging.error(mox.IgnoreArg(), url, mox.IgnoreArg(), mox.IgnoreArg(),
                  mox.IgnoreArg())

    self.mox.ReplayAll()

    try:
      retriever.CreateConnection(url, source_metadata)
    except urllib2.HTTPError, e:
      self.mox.VerifyAll()
      self.assertEquals(404, e.code)
      return
    # The test shouldn't reach here, if it does, fail immediately.
    self.fail()

  def InitSourceUpdateMethodTest(self):
    self.mox.StubOutWithMock(retriever, 'CreateMetadata')
    self.mox.StubOutWithMock(retriever, 'CreateErrorMetadata')
    self.mox.StubOutWithMock(retriever, 'CreateConnection')
    self.mox.StubOutWithMock(retriever, 'GetKml')
    self.mox.StubOutWithMock(retriever.SourceMetadataModel, 'get_by_key_name')
    self.mox.StubOutWithMock(retriever.SourceMetadataModel, 'NeedsUpdate')
    self.mox.StubOutWithMock(retriever.SourceMetadataModel, 'put')
    self.mox.StubOutWithMock(retriever.SourceMetadataModel, '__init__')

  def testUpdateFromKmlWithNoEarlierSavedEntity(self):
    self.InitSourceUpdateMethodTest()
    url = 'http://www.goo.com/foo.kml'
    key_name = url

    retriever.SourceMetadataModel.get_by_key_name(key_name).AndReturn(None)
    url_handle = self.mox.CreateMockAnything()
    retriever.CreateConnection(url, None).AndReturn(url_handle)
    retriever.GetKml(url_handle).AndReturn(self.fake_kml)
    mock_metadata = self.mox.CreateMock(retriever.SourceMetadataModel)
    retriever.CreateMetadata(key_name, url_handle, mox.IgnoreArg(),
                             None).AndReturn(mock_metadata)
    url_handle.close()
    mock_metadata.put()

    self.mox.ReplayAll()

    metadata = retriever.UpdateFromKml(url)

    self.assertFalse(metadata.has_no_features)
    self.assertFalse(metadata.has_unsupported_kml)
    self.mox.VerifyAll()

  def testUpdateFromKmlWithHttpError(self):
    self.InitSourceUpdateMethodTest()
    url = 'http://www.goo.com/foo.kml'
    key_name = url

    old_metadata = self.mox.CreateMock(retriever.SourceMetadataModel)
    (retriever.SourceMetadataModel.get_by_key_name(key_name)
     .AndReturn(old_metadata))
    old_metadata.NeedsUpdate().AndReturn(True)
    (retriever.CreateConnection(url, old_metadata)
     .AndRaise(urllib2.HTTPError('http://google.com', 404, 'test',
                                 {}, StringIO.StringIO())))
    new_metadata = self.mox.CreateMock(retriever.SourceMetadataModel)
    retriever.CreateErrorMetadata(
        key_name, old_metadata).AndReturn(new_metadata)
    new_metadata.put()

    self.mox.ReplayAll()

    metadata = retriever.UpdateFromKml(url)

    self.assertTrue(metadata.server_error_occurred)
    self.mox.VerifyAll()

  def testUpdateFromKmlWithEarlierSavedEntityNoError(self):
    self.InitSourceUpdateMethodTest()
    url = 'http://www.goo.com/foo.kml'
    key_name = url

    old_metadata = self.mox.CreateMock(retriever.SourceMetadataModel)
    (retriever.SourceMetadataModel.get_by_key_name(key_name)
     .AndReturn(old_metadata))
    old_metadata.NeedsUpdate().AndReturn(True)
    url_handle = self.mox.CreateMockAnything()
    retriever.CreateConnection(url, old_metadata).AndReturn(url_handle)
    retriever.GetKml(url_handle).AndReturn(self.fake_kml)
    new_metadata = self.mox.CreateMock(retriever.SourceMetadataModel)
    retriever.CreateMetadata(key_name, url_handle, mox.IgnoreArg(),
                             old_metadata).AndReturn(new_metadata)
    url_handle.close()
    new_metadata.put()

    self.mox.ReplayAll()

    metadata = retriever.UpdateFromKml(url)

    self.assertFalse(metadata.has_no_features)
    self.assertFalse(metadata.has_unsupported_kml)
    self.mox.VerifyAll()

  def testUpdateFromGeorssWithEarlierSavedEntityNoError(self):
    # Other variants of UpdateFromKml tests aren't applied here,
    # since UpdateFromGeorss highly resembles it.
    self.InitSourceUpdateMethodTest()
    url = 'http://www.goo.com/abc.xml'
    key_name = url

    old_metadata = self.mox.CreateMock(retriever.SourceMetadataModel)
    (retriever.SourceMetadataModel.get_by_key_name(key_name)
     .AndReturn(old_metadata))
    old_metadata.NeedsUpdate().AndReturn(True)
    url_handle = self.mox.CreateMockAnything()
    retriever.CreateConnection(url, old_metadata).AndReturn(url_handle)
    url_handle.read(mox.IgnoreArg()).AndReturn(self.fake_georss)
    new_metadata = self.mox.CreateMock(retriever.SourceMetadataModel)
    retriever.CreateMetadata(key_name, url_handle, mox.IgnoreArg(),
                             old_metadata).AndReturn(new_metadata)
    url_handle.close()
    new_metadata.put()

    self.mox.ReplayAll()

    metadata = retriever.UpdateFromGeorss(url)

    self.assertFalse(metadata.has_no_features)
    self.mox.VerifyAll()

if __name__ == '__main__':
  test_utils.main()
