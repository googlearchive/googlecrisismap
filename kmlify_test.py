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
import zipfile

import kmlify
import test_utils

from google.appengine.api import urlfetch


class UrlResponse(object):
  """A fake urlfetch response object."""

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

  def testStringify(self):
    self.assertEquals('abcdef', kmlify.Stringify('abcdef'))
    self.assertEquals('abcdef', kmlify.Stringify(u'abcdef'))
    self.assertEquals('3', kmlify.Stringify(3))
    self.assertEquals('&', kmlify.Stringify('&'))
    self.assertEquals('&amp;', kmlify.Stringify('&', True))
    self.assertEquals('\xe8', kmlify.Stringify('\xe8'))
    self.assertEquals('\xc3\xa8', kmlify.Stringify(u'\xe8'))
    self.assertEquals('&#232;', kmlify.Stringify(u'\xe8', True))
    self.assertEquals("<type 'list'>", kmlify.Stringify(list))
    self.assertEquals("&lt;type 'list'&gt;", kmlify.Stringify(list, True))

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

  def testKmlWithPolygon(self):
    self.DoGoldenFileTest('xml', 'input3.kml', 'output3.kml', {})

  def testXmlWithComplexTemplate(self):
    self.DoGoldenFileTest('xml', 'input4.xml', 'output4.kml',
                          {'record': 'placemat', 'loc': 'elocution@foo',
                           'name': '$fish#jelly', 'id': '$fish#gold',
                           'desc': '$meow $_meow $__meow $/size'})

  def testWazeXml(self):
    self.DoGoldenFileTest('xml', 'waze1.xml', 'waze_output1.kml',
                          {'record': 'item',
                           'loc': 'point',
                           'join': 'subtype,waze_join1.csv',
                           'name': '$readable_subtype',
                           'desc': '$street<br>$city $nearBy<br><br>'
                                   '<small>Reported via Waze app at '
                                   '$pubDate</small>',
                           'icon': 'http://mts0.google.com/vt/icon/name=icons/'
                                   'layers/traffic/other_large_8x.png'},
                          'waze_join1.csv')

  def DoGoldenFileTest(self, input_type, input_name, output_name, url_params,
                       join_name=None):
    """Perform a test using input and output files in the 'goldentests' dir.

    Args:
      input_type: A string, one of 'csv' or 'xml'.
      input_name: File containing the input in the 'goldentests' dir.
      output_name: File containing expected output in the 'goldentests' dir.
      url_params: Dictionary of the query parameters for kmlify.
      join_name: File containing the join CSV in the 'goldentests' dir, or None.
    """
    data_dir = os.path.join(os.path.dirname(__file__), 'goldentests')
    input_data = open(os.path.join(data_dir, input_name)).read()
    expected_data = open(os.path.join(data_dir, output_name)).read()

    # Set up a fake for urlfetch.  If it is called with an incorrect url,
    # responses[url] will raise a KeyError.
    url = 'http://example.com/data.%s' % input_type
    responses = {url: UrlResponse(input_data)}
    if 'join' in url_params:
      join_url = url_params['join'].split(',')[1]
      join_data = open(os.path.join(data_dir, join_name)).read()
      responses[join_url] = UrlResponse(join_data)
    self.mox.stubs.Set(urlfetch, 'fetch', lambda url, **kwargs: responses[url])

    # Perform the kmlify request and check the output.
    response = self.DoGet('/.kmlify?' + urllib.urlencode(
        dict(url_params, type=input_type, url=url)))
    output_kmz = zipfile.ZipFile(StringIO.StringIO(response.body))
    output_data = output_kmz.open('doc.kml').read()

    MaybeUpdateGoldenFile(output_name, output_data)
    self.assertMultiLineEqual(expected_data, output_data)

    # The content should be cached now, so repeating the request should yield
    # the same result even with urlfetch disabled.
    self.mox.stubs.Set(urlfetch, 'fetch', lambda url, **kwargs: UrlResponse(''))
    response2 = self.DoGet('/.kmlify?' + urllib.urlencode(
        dict(url_params, type=input_type, url=url)))
    self.assertEquals(
        response.body, response2.body, "kmlify didn't use cache as expected")


if __name__ == '__main__':
  test_utils.main()
