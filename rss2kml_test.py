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

"""Tests for rss2kml.py."""

__author__ = 'arb@google.com (Anthony Baxter)'

import xml.etree.ElementTree as ElementTree
# Allow relative imports within the app.  # pylint: disable=W0403
import mox
import rss2kml
import test_utils

from google.appengine.api import memcache
from google.appengine.api import urlfetch


def Deindent(kml):
  return '\n'.join(x.strip() for x in kml.split('\n'))


class Rss2KmlTest(test_utils.BaseTest):
  """Tests for rss2kml.py."""

  def setUp(self):
    self.mox = mox.Mox()
    self.mox.StubOutWithMock(urlfetch, 'fetch')
    self.mox.StubOutWithMock(memcache, 'get')
    self.mox.StubOutWithMock(memcache, 'set')

  def tearDown(self):
    self.mox.UnsetStubs()

  def testConversion(self):
    handler = test_utils.SetupHandler(
        '/crisismap/rss2kml', rss2kml.Rss2Kml(),
        'ib=http%3A%2F%2Fwww.rfs.nsw.gov.au%2Ffile_system%2Fimages%2F'
        'State08%2F%24.png&url=http%3A%2F%2Ffeeds.rfs.nsw.gov.au%2F'
        'majorIncidents.xml&field=category&'
        's=Emergency_Warning:0:Emergency+Warning&'
        's=WatchAndAct:0:Watch+and+Act&'
        's=Advice:0:Advice&'
        's=:0:NotApplicable&'
        'p=11111111:44444444')
    last_mod = 'Wed, 26 Sep 2012 02:45:35 GMT'

    class DummyRSS(object):
      headers = {'Last-modified': last_mod}
      content = """\
<rss xmlns:georss="http://www.georss.org/georss" version="2.0">
  <channel>
    <item>
      <title>TITLE</title>
      <description>DESCR</description>
      <guid>GUID</guid>
      <georss:point>12 24</georss:point>
      <category>emergency warning</category>
    </item>
    <item>
      <title>TITLE2</title>
      <description>DESCR2</description>
      <guid>GUID2</guid>
      <georss:polygon>11 44 55 22</georss:polygon>
      <category>Advice</category>
    </item>
  </channel>
</rss>"""

    memcache.get(mox.IgnoreArg())
    urlfetch.fetch('http://feeds.rfs.nsw.gov.au/majorIncidents.xml',
                   validate_certificate=False, deadline=30).AndReturn(DummyRSS)
    # TODO(arb): test_utils.SetupHandler() doesn't set self.request.query_string
    # This makes our cache key broken.
    cache_key = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
    memcache.set('RSS2KML+' + cache_key, mox.IgnoreArg(), 120)
    memcache.set('RSS2KML+' + cache_key + 'last_mod', last_mod, 120)
    self.mox.ReplayAll()
    handler.get()
    self.mox.VerifyAll()
    expected = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.2">
<Document>
  <Style id="style_advice">
    <IconStyle>
      <Icon>
        <href>http://www.rfs.nsw.gov.au/file_system/images/State08/Advice.png</href>
      </Icon>
    </IconStyle>
    <PolyStyle>
      <color>44444444</color>
      <colorMode>normal</colorMode>
      <fill>1</fill>
      <outline>1</outline>
    </PolyStyle>
    <LineStyle>
      <color>11111111</color>
      <colorMode>normal</colorMode>
    </LineStyle>
  </Style>
  <Style id="style_emergency_warning">
    <IconStyle>
      <Icon>
        <href>http://www.rfs.nsw.gov.au/file_system/images/State08/Emergency_Warning.png</href>
      </Icon>
    </IconStyle>
    <PolyStyle>
      <color>44444444</color>
      <colorMode>normal</colorMode>
      <fill>1</fill>
      <outline>1</outline>
    </PolyStyle>
    <LineStyle>
      <color>11111111</color>
      <colorMode>normal</colorMode>
    </LineStyle>
  </Style>
  <Placemark id="GUID">
    <name>TITLE</name>
    <description>DESCR</description>
    <MultiGeometry>
      <Point>
        <coordinates>24,12,0</coordinates>
        </Point>
    </MultiGeometry>
    <styleUrl>#style_emergency_warning</styleUrl>
  </Placemark>
  <Placemark id="GUID2">
    <name>TITLE2</name>
    <description>DESCR2</description>
    <MultiGeometry>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>44,11,0
          22,55,0</coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
    </MultiGeometry>
    <styleUrl>#style_advice</styleUrl>
  </Placemark>
</Document>
</kml>
"""
    self.assertEquals(Deindent(expected), Deindent(handler.response.body))
    self.assertEquals(last_mod, handler.response.headers['Last-modified'])

  def testCreatePlacemarkPoint(self):
    item_values = {'point': ['12 24'],
                   'title': ['a point'],
                   'description': ['described thing'],
                   'guid': ['GUID']}
    placemark_xml = ('<Placemark id="GUID"><name>a point</name>'
                     '<description>described thing</description>'
                     '<MultiGeometry><Point><coordinates>24,12,0</coordinates>'
                     '</Point></MultiGeometry>'
                     '<styleUrl>#style_icon_foo</styleUrl></Placemark>')
    instance = rss2kml.Rss2Kml()
    placemark = instance.CreatePlacemark(item_values, 'icon_foo')
    self.assertEquals(placemark_xml, ElementTree.tostring(placemark))

  def testCreatePlacemarkMultipolygon(self):
    item_values = {'polygon': ['1 2 3 4 1 2', '4 5 6 7 4 5'],
                   'title': ['2 polys'],
                   'description': ['described thing'],
                   'guid': ['GUID']}
    placemark_xml = ('<Placemark id="GUID"><name>2 polys</name>'
                     '<description>described thing</description>'
                     '<MultiGeometry><Polygon><outerBoundaryIs><LinearRing>'
                     '<coordinates>2,1,0\n4,3,0\n2,1,0</coordinates>'
                     '</LinearRing></outerBoundaryIs></Polygon>'
                     '<Polygon><outerBoundaryIs><LinearRing>'
                     '<coordinates>5,4,0\n7,6,0\n5,4,0</coordinates>'
                     '</LinearRing></outerBoundaryIs></Polygon>'
                     '</MultiGeometry><styleUrl>#style_icon_foo</styleUrl>'
                     '</Placemark>')
    instance = rss2kml.Rss2Kml()
    placemark = instance.CreatePlacemark(item_values, 'icon_foo')
    self.assertEquals(placemark_xml, ElementTree.tostring(placemark))

  def testIconSafety(self):
    cache = rss2kml.IconCache()
    self.assertEquals('foo', cache.Add('foo'))
    self.assertEquals('foo', cache.Add('foo'))
    self.assertEquals(1, len(list(cache)))
    self.assertEquals('foo_bar', cache.Add('foo/bar'))
    self.assertNotEquals('foo_bar', cache.Add('foo#bar'))
    self.assertEquals(3, len(list(cache)))


if __name__ == '__main__':
  test_utils.main()
