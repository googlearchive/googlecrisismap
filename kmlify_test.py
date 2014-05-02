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


__author__ = 'romano@google.com (Raquel Romano)'

import os
import StringIO
import urllib
import xml.etree.ElementTree
import zipfile

import kmlify
import mox
import test_utils

from google.appengine.api import memcache
from google.appengine.api import urlfetch


SAMPLE_CSV = """\
Id,Timestamp,Latitude,Longitude,Name,Contact Number,Description\n
1,,30.28,78.98,Main Elementary,555-555-5555,<b>Place:</b>Main Elementary\n
2,,29.84,80.53,Main High School,222-222-2222,<b>Place:</b>Main High School"""

SAMPLE_XML = """<?xml version="1.0" encoding="UTF-8"?>
                  <kml xmlns="http://earth.google.com/kml/2.2">
                 <Document><Folder>
                   <Placemark><Point>
                     <coordinates>-108.8,36.3,0.0</coordinates>
                   </Point></Placemark>
                   <Placemark><Point>
                     <coordinates>-92.5,46.1,0.0</coordinates>
                   </Point></Placemark>
                 </Folder></Document>
               </kml>"""


class UrlResponse(object):
  """Dummy urlfetch response object."""

  def __init__(self, content):
    self.content = content


def MaybeUpdateGoldenFile(file_name, generated_file_data):
  golden_dir = os.environ.get('GOLDEN_FILES_DIR')
  if golden_dir:
    golden_path = os.path.join(golden_dir, file_name)
    with open(golden_path, 'w') as golden_file:
      golden_file.write(generated_file_data)


class KmlifyTests(test_utils.BaseTest):
  """Tests kmlify routines and classes."""

  def setUp(self):
    super(KmlifyTests, self).setUp()
    # Maximum size of diffs that unittest will show (in bytes)
    self.maxDiff = 4096

  def tearDown(self):
    self.mox.UnsetStubs()

  def testSimpleCsv(self):
    self.DoGoldenFileTest('csv', 'input1.csv', 'output1.kml',
                          {'loc': 'Latitude,Longitude', 'name': '$Name',
                           'desc': '$_Description', 'id': '$Id'})

  def testTrailingEmptyColumnCsv(self):
    self.DoGoldenFileTest('csv', 'input1_trailingemptycolumn.csv',
                          'output1.kml',
                          {'loc': 'Latitude,Longitude', 'name': '$Name',
                           'desc': '$_Description', 'id': '$Id'})

  def testMultiLineHeaderCsv(self):
    self.DoGoldenFileTest('csv', 'input1_multilineheader.csv', 'output1.kml',
                          {'loc': 'Latitude,Longitude', 'name': '$Name',
                           'desc': '$_Description', 'id': '$Id'})

  def testSimpleGeoJson(self):
    self.DoGoldenFileTest('geojson', 'input2.geojson', 'output2.kml',
                          {'name': '$name', 'desc': '$_description'})

  def testSimpleXml(self):
    self.DoGoldenFileTest('xml', 'input3.xml', 'output3.kml',
                          {'loc': '^coordinates', 'name': '$name',
                           'desc': '$_description', 'id': '$Placemark@id'})

  def DoGoldenFileTest(self, input_type, input_name, output_name, url_flags):
    """Perform a golden test, check the response matches expected output.

    Args:
      input_type: A string, one of 'csv' or 'xml'.
      input_name: The file containing the input in the 'goldentests' dir.
      output_name: The file containing the output in the 'goldentests' dir.
      url_flags: A dictionary containing query parameters for the conversion.
    """
    cwd = os.path.dirname(__file__)

    infile = open(os.path.join(cwd, 'goldentests', input_name)).read()
    expectedfile = open(os.path.join(cwd, 'goldentests', output_name)).read()
    # This is in app startup
    self.mox.StubOutWithMock(memcache, 'get')
    memcache.get('Config,root_path').MultipleTimes().AndReturn('')

    self.mox.StubOutWithMock(kmlify, 'FetchData')
    kmlify.FetchData(mox.IgnoreArg()).AndReturn(infile)

    url = 'http://whatever/'
    url_flags = urllib.urlencode(url_flags)
    memcache.get(mox.StrContains('S\'%s' % url))  # Nothing cached
    self.mox.ReplayAll()
    response = self.DoGet('/.kmlify?type=%s&url=%s&%s' % (input_type, url,
                                                          url_flags))
    self.mox.VerifyAll()
    outkmz = zipfile.ZipFile(StringIO.StringIO(response.body))

    outfile = outkmz.open('doc.kml').read()

    MaybeUpdateGoldenFile(output_name, outfile)

    self.assertMultiLineEqual(expectedfile, outfile)

  def testGetCsvWithCaching(self):
    unused_kml_doc = self.DoGetTest('csv', 'http://geo.com/a.csv', SAMPLE_CSV)
    # TODO(arb): How much do we want to check the KML? Should we drop this
    # in favor of the golden tests?

  def testGetXmlWithCaching(self):
    unused_kml_doc = self.DoGetTest('xml', 'http://geo.com/a.kml', SAMPLE_XML)
    # TODO(arb): How much do we want to check the KML? Should we drop this
    # in favor of the golden tests?

  def DoGetTest(self, filetype, url, response, extra_flags=''):
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    self.mox.StubOutWithMock(memcache, 'get')
    self.mox.StubOutWithMock(memcache, 'set')
    # These are app setup
    memcache.get('Config,root_path').MultipleTimes().AndReturn('')
    memcache.set('Config,root_path', '/root', time=10).MultipleTimes()
    # Check the bit of the pickle we care about.
    memcache.get(mox.StrContains('S\'%s' % url))
    urlfetch.fetch(url, deadline=10,
                   validate_certificate=False).AndReturn(
                       UrlResponse(response))
    save_kmz = []

    def SaveMemcacheSet(unused_key, kmz, unused_ttl):
      save_kmz.append(kmz)

    # Consider a fake rather than a mock?
    memcache.set(mox.StrContains('S\'%s' % url),
                 mox.IsA(basestring),
                 kmlify.Kmlify.TTL_SECONDS).WithSideEffects(SaveMemcacheSet)
    self.mox.ReplayAll()

    response = self.DoGet('/.kmlify?type=%s&url=%s&%s' % (filetype, url,
                                                          extra_flags))
    self.mox.VerifyAll()
    self.assertEquals(save_kmz[0], response.body)
    kmz = zipfile.ZipFile(StringIO.StringIO(save_kmz[0]))
    self.assertEquals(['doc.kml'], kmz.namelist())
    kml_doc = kmz.open('doc.kml').read()
    self.CheckValidKml(kml_doc)
    return kml_doc

  def CheckValidKml(self, kml_doc):
    xml.etree.ElementTree.fromstring(kml_doc)


if __name__ == '__main__':
  test_utils.main()
