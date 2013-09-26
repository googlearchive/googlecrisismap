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

"""Tests for legend_item_extractor.py."""

__author__ = 'joeysilva@google.com (Joey Silva)'

import json
import StringIO
import urllib
import xml.etree.ElementTree as ElementTree
import zipfile

import legend_item_extractor
from legend_item_extractor import GetLegendItems
import mox
import test_utils
import utils

from google.appengine.api import urlfetch


class LegendItemExtractorTest(test_utils.BaseTest):
  def CreateIconFromString(self, xml_iconstyle):
    return legend_item_extractor.ToIconStyleDict(
        ElementTree.fromstring(xml_iconstyle))

  def CreateLineFromString(self, xml_linestyle):
    return legend_item_extractor.ToLineStyleDict(
        ElementTree.fromstring(xml_linestyle))

  def CreatePolygonFromString(self, xml_polystyle,
                              xml_linestyle='<LineStyle></LineStyle>'):
    return legend_item_extractor.ToPolygonStyleDict(
        ElementTree.fromstring(xml_polystyle),
        ElementTree.fromstring(xml_linestyle))

  def CssColors(self, kml_colors):
    return map(legend_item_extractor.CssColor, kml_colors)

  def testFindStyle(self):
    """Tests legend_item_extractor's FindStyle method."""
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml>
      <Document>
        <name>test</name>
        <Style id="a">
          Should ignore repeated styles and select last one
        </Style>
        <Style id="a">Expected style</Style>
      </Document>
    </kml>"""
    self.assertEquals('Expected style', legend_item_extractor.FindStyle(
        ElementTree.fromstring(kml), 'a').text)

  def testFindStyleInStyleMap(self):
    """Tests that FindStyle method can find styles in StyleMaps."""
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml>
      <Document>
        <name>test</name>
        <StyleMap id="a">
          <Pair>
            <key>normal</key>
            <Style>
              Should ignore repeated StyleMaps and select last valid Style
            </Style>
          </Pair>
        </StyleMap>
        <StyleMap id="a">
          <Pair>
            <key>normal</key>
            <Style>Should ignore all pairs except the last "normal" one</Style>
          </Pair>
          <Pair>
            <key>normal</key>
            <Style>Expected style</Style>
          </Pair>
          <Pair>
            <key>hightlight</key>
            <Style>Should ignore non-normal pairs</Style>
          </Pair>
          <Pair>
            <Style>Should ignore non-normal pairs</Style>
          </Pair>
        </StyleMap>
        <StyleMap id="a">
          <Pair>
            <key>highlight</key>
            <Style>
              Even though this is the last StyleMap, should select last valid
            </Style>
          </Pair>
        </StyleMap>
      </Document>
    </kml>"""
    self.assertEquals('Expected style', legend_item_extractor.FindStyle(
        ElementTree.fromstring(kml), 'a').text)

  def testFindLinkedStyleInStyleMap(self):
    """Tests that FindStyle can find styles linked by styleUrls in StyleMaps."""
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml>
      <Document>
        <name>test</name>
        <StyleMap id="a">
          <Pair>
            <key>normal</key>
            <styleUrl>#b</styleUrl>
          </Pair>
        </StyleMap>
        <Style id="b">Expected style</Style>
      </Document>
    </kml>"""
    self.assertEquals('Expected style', legend_item_extractor.FindStyle(
        ElementTree.fromstring(kml), 'a').text)

  def testFindCycle(self):
    """Tests that legend_item_extractor's FindStyle method detects cycles."""
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml>
      <Document>
        <name>test</name>
        <StyleMap id="a">
          <Pair>
            <key>normal</key>
            <styleUrl>#b</styleUrl>
          </Pair>
        </StyleMap>
        <StyleMap id="b">
          <Pair>
            <key>normal</key>
            <styleUrl>#c</styleUrl>
          </Pair>
        </StyleMap>
        <StyleMap id="c">
          <Pair>
            <key>normal</key>
            <styleUrl>#a</styleUrl>
          </Pair>
        </StyleMap>
      </Document>
    </kml>"""
    self.assertEquals(None, legend_item_extractor.FindStyle(
        ElementTree.fromstring(kml), 'a'))

  def testCssColor(self):
    """Tests legend_item_extractor's CssColor method."""
    self.assertEquals('#12abCD',
                      legend_item_extractor.CssColor('eFCDab12'))
    self.assertEquals('#000000',
                      legend_item_extractor.CssColor(''))
    self.assertEquals('#000000',
                      legend_item_extractor.CssColor('a'))
    self.assertEquals('#000000',
                      legend_item_extractor.CssColor('123456789'))
    self.assertEquals('#000000',
                      legend_item_extractor.CssColor('aabbccxx'))

  def testToIconStyleDict(self):
    """Tests legend_item_extractor's CreateIcon method."""
    iconstyle = '<IconStyle><Icon>%s</Icon>%s</IconStyle>'
    self.assertEquals({}, self.CreateIconFromString(iconstyle % ('', '')))

    expected_icon = {'href': 'icon_href'}
    iconstyle %= ('<href>%s</href>' % expected_icon['href'], '%s')
    self.assertEquals(expected_icon, self.CreateIconFromString(iconstyle % ''))

    kml_color = 'AB123456'
    expected_icon['color'] = legend_item_extractor.CssColor(kml_color)
    iconstyle %= ('<color>%s</color>' % kml_color)
    self.assertEquals(expected_icon, self.CreateIconFromString(iconstyle))

  def testCreateIconWithRepeatedProperties(self):
    """Tests that CreateIcon uses the last of repeated properties."""
    kml_color = 'FF123456'
    iconstyle = """<IconStyle>
      <Icon><href>Overridden</href></Icon>
      <Icon></Icon>
      <color>Overridden</color>
      <color>%s</color>
    </IconStyle>""" % kml_color
    self.assertEquals(
        {'color': legend_item_extractor.CssColor(kml_color)},
        self.CreateIconFromString(iconstyle))

    icon_url = 'icon_url'
    iconstyle = """<IconStyle><Icon>
      <href>Overridden</href>
      <href>%s</href>
    </Icon></IconStyle>""" % icon_url
    self.assertEquals({'href': icon_url}, self.CreateIconFromString(iconstyle))

  def testToLineStyleDict(self):
    """Tests legend_item_extractor's CreateLine method."""
    linestyle = '<LineStyle>%s</LineStyle>'
    expected_line = {
        'color': legend_item_extractor.CssColor(
            legend_item_extractor.LINE_DEFAULT_KML_COLOR),
        'width': legend_item_extractor.LINE_DEFAULT_WIDTH
    }

    self.assertEquals(expected_line, legend_item_extractor.ToLineStyleDict())
    self.assertEquals(expected_line, self.CreateLineFromString(linestyle % ''))

    kml_color = 'AB123456'
    expected_line = {
        'color': legend_item_extractor.CssColor(kml_color),
        'width': 3
    }
    linestyle %= ('<color>%s</color><width>%d</width>' %
                  (kml_color, expected_line['width']))
    self.assertEquals(expected_line, self.CreateLineFromString(linestyle))

  def testCreateLineWithRepeatedProperties(self):
    """Tests that CreateLine uses the last of repeated properties."""
    kml_color = 'FF123456'
    expected_line = {
        'color': legend_item_extractor.CssColor(kml_color),
        'width': 3
    }
    linestyle = """<LineStyle>
      <color>Overridden</color>
      <color>%s</color>
      <width>Overridden</width>
      <width>%d</width>
    </LineStyle>""" % (kml_color, expected_line['width'])
    self.assertEquals(expected_line, self.CreateLineFromString(linestyle))

  def testToPolygonStyleDict(self):
    """Tests legend_item_extractor's CreatePolygon method."""
    polystyle = '<PolyStyle>%s</PolyStyle>'
    expected_polygon = {
        'fill_color': legend_item_extractor.CssColor(
            legend_item_extractor.POLYGON_DEFAULT_KML_COLOR),
        'border_color': legend_item_extractor.CssColor(
            legend_item_extractor.LINE_DEFAULT_KML_COLOR),
        'border_width': legend_item_extractor.LINE_DEFAULT_WIDTH
    }

    self.assertEquals(expected_polygon,
                      legend_item_extractor.ToPolygonStyleDict())
    self.assertEquals(expected_polygon,
                      self.CreatePolygonFromString(polystyle % ''))

    kml_color = 'AB123456'
    expected_polygon['fill_color'] = legend_item_extractor.CssColor(
        kml_color)
    polystyle %= ('<color>%s</color><fill>%s</fill><outline>%s</outline>' %
                  (kml_color, '%d', '%d'))
    self.assertEquals(expected_polygon,
                      self.CreatePolygonFromString(polystyle % (1, 1)))

    kml_color = '12ABCDEF'
    expected_polygon['border_color'] = legend_item_extractor.CssColor(kml_color)
    expected_polygon['border_width'] = 3
    linestyle = ('<LineStyle><color>%s</color><width>%d</width></LineStyle>' %
                 (kml_color, expected_polygon['border_width']))
    self.assertEquals(expected_polygon,
                      self.CreatePolygonFromString(polystyle % (1, 1),
                                                   linestyle))
    self.assertEquals({}, self.CreatePolygonFromString(polystyle % (0, 0)))

  def testCreatePolygonWithRepeatedProperties(self):
    """Tests that CreatePolygon uses the last of repeated properties."""
    kml_color = 'FF123456'
    polystyle = """<PolyStyle>
      <color>Overridden</color>
      <color>%s</color>
      <fill>0</fill>
      <fill>1</fill>
      <outline>1</outline>
      <outline>0</outline>
    </PolyStyle>""" % kml_color
    self.assertEquals({'fill_color': legend_item_extractor.CssColor(kml_color)},
                      self.CreatePolygonFromString(polystyle))

  def testExtract(self):
    """Tests legend_item_extractor's Extract method."""
    static_icons = ['icon_href']
    kml_colors = ['FF123456', '12ABCDEF', 'FF654321',
                  legend_item_extractor.LINE_DEFAULT_KML_COLOR]
    href_icon = ('<IconStyle><Icon><href>%s</href></Icon></IconStyle>'
                 % static_icons[0])
    colored_icon = """<IconStyle>
                     <Icon><href>colored_icon_href</href></Icon>
                     <color>%s</color>
                   </IconStyle>"""  % kml_colors[0]
    no_href = '<IconStyle><color>%s</color></IconStyle>' % kml_colors[1]
    linestyle = '<LineStyle><color>%s</color></LineStyle>' % kml_colors[2]
    polystyle = '<PolyStyle><color>%s</color></PolyStyle>' % kml_colors[2]
    color_style = '<color>Ignored</color>'
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://earth.google.com/kml/2.2">
      <Document>
        <name>test</name>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
      </Document>
    </kml>""" % (href_icon, colored_icon, no_href, linestyle, polystyle,
                 linestyle + polystyle, color_style)

    self.assertEquals(
        # Icons
        # pylint: disable=g-long-lambda
        (mox.SameElementsAs(map(self.CreateIconFromString,
                                [no_href, colored_icon, href_icon])),
         # Lines
         [self.CreateLineFromString(linestyle)],
         # Polygons
         mox.SameElementsAs([
             self.CreatePolygonFromString(polystyle),
             self.CreatePolygonFromString(polystyle, linestyle)
         ]),
         # Static icons; Colors
         set(static_icons), set(self.CssColors(kml_colors))),
        legend_item_extractor.Extract(kml))

  def testExtractNoDuplicates(self):
    """Tests that Extract does not extract duplicates of items."""
    icon_href = 'icon_href'
    iconstyle = ('<IconStyle><Icon><href>%s</href></Icon></IconStyle>'
                 % icon_href)
    linestyle = '<LineStyle></LineStyle>'
    polystyle = '<PolyStyle></PolyStyle>'
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://earth.google.com/kml/2.2">
      <Document>
        <name>test</name>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
        <Style>%s</Style>
      </Document>
    </kml>""" % (
        iconstyle, iconstyle,
        linestyle, linestyle,
        polystyle, polystyle
    )
    self.assertEquals(([self.CreateIconFromString(iconstyle)],
                       [legend_item_extractor.ToLineStyleDict()],
                       [legend_item_extractor.ToPolygonStyleDict()],
                       set([icon_href]), set(self.CssColors([
                           legend_item_extractor.LINE_DEFAULT_KML_COLOR,
                           legend_item_extractor.POLYGON_DEFAULT_KML_COLOR,
                       ]))), legend_item_extractor.Extract(kml))

  def testExtractLastIconStyle(self):
    """Tests that Extract only extracts the last of multiple IconStyles."""
    icon_href = 'icon_href'
    iconstyle = ('<IconStyle><Icon><href>%s</href></Icon></IconStyle>'
                 % icon_href)
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://earth.google.com/kml/2.2">
      <Document>
        <name>test</name>
        <Style>
          <IconStyle>
            <Icon><href>Overridden</href></Icon>
            <color>Ignored</color>
          </IconStyle>
          %s
        </Style>
      </Document>
    </kml>""" % iconstyle

    self.assertEquals(([self.CreateIconFromString(iconstyle)], [], [],
                       set([icon_href]), set()),
                      legend_item_extractor.Extract(kml))

  def testExtractLastLineStyle(self):
    """Tests that Extract only extracts the last of multiple LineStyles."""
    kml_color = 'FF123456'
    linestyle = ('<LineStyle><color>%s</color><width>3</width></LineStyle>'
                 % kml_color)
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://earth.google.com/kml/2.2">
      <Document>
        <name>test</name>
        <Style>
          <LineStyle>
            Overridden
            <color>Ignored</color>
          </LineStyle>
          %s
        </Style>
      </Document>
    </kml>""" % linestyle

    self.assertEquals(([], [self.CreateLineFromString(linestyle)],
                       [], set(), set(self.CssColors([kml_color]))),
                      legend_item_extractor.Extract(kml))

  def testExtractLastPolygonStyle(self):
    """Tests that Extract only extracts the last of multiple PolyStyles."""
    kml_colors = ['FF123456', '12ABCDEF']
    polystyle = ('<PolyStyle><color>%s</color><width>3</width></PolyStyle>'
                 % kml_colors[0])
    linestyle = ('<LineStyle><color>%s</color><width>4</width></LineStyle>'
                 % kml_colors[1])
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://earth.google.com/kml/2.2">
      <Document>
        <name>test</name>
        <Style>
          <LineStyle>Overridden</LineStyle>
          <PolyStyle>Overridden</PolyStyle>
          %s
          %s
        </Style>
      </Document>
    </kml>""" % (polystyle, linestyle)
    self.assertEquals(
        ([], [], [self.CreatePolygonFromString(polystyle, linestyle)],
         set(), set(self.CssColors(kml_colors))),
        legend_item_extractor.Extract(kml))

  def testExtractSeparatedPolyAndLineStyles(self):
    """Tests that Extract combines separated PolyStyle and LineStyle styles."""
    kml_colors = ['AA123456', 'BB234567', 'CC345678', 'DD456789',
                  legend_item_extractor.LINE_DEFAULT_KML_COLOR]
    polystyle = '<PolyStyle><color>%s</color><width>%d</width></PolyStyle>'
    linestyle = '<LineStyle><color>%s</color><width>%d</width></LineStyle>'
    polystyles = [polystyle % (kml_colors[0], 3),
                  polystyle % (kml_colors[1], 4)]
    linestyles = [linestyle % (kml_colors[2], 5),
                  linestyle % (kml_colors[3], 6)]
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://earth.google.com/kml/2.2">
      <Document>
        <name>test</name>
        <Placemark>
          Separated PolyStyle and LineStyle should be composed into one polygon
          item. Should not exist as separate line and polygon items.
          Should be able to dig into normal StyleMap Styles.
          <Style>%s</Style>
          <StyleMap>
            <Pair>
              <key>normal</key>
              <Style>%s</Style>
            </Pair>
            <Pair>
              <key>highlight</key>
              <Style><PolyStyle>Should be ignored</PolyStyle></Style>
            </Pair>
          </StyleMap>
        </Placemark>
        <Placemark>
          <StyleMap>
            <Pair>
              <key>normal</key>
              <styleUrl>#a</styleUrl>
            </Pair>
            <Pair>
              Should be ignored
              <key>highlight</key>
              <styleUrl>#b</styleUrl>
            </Pair>
          </StyleMap>
          <styleUrl>#b</styleUrl>
        </Placemark>
        <Style id="a">%s</Style>
        <Style id="b">%s</Style>
      </Document>
    </kml>""" % (polystyles[0], linestyles[0],
                 polystyles[1], linestyles[1])

    self.assertEquals(
        # Line from shared style
        ([], [self.CreateLineFromString(linestyles[1])],
         # Polygons
         mox.SameElementsAs([
             self.CreatePolygonFromString(polystyles[0], linestyles[0]),
             self.CreatePolygonFromString(polystyles[1], linestyles[1]),
             self.CreatePolygonFromString(polystyles[1])
         ]),
         # Icons and colors
         set(), set(self.CssColors(kml_colors))),
        legend_item_extractor.Extract(kml))

  def testExtractImplicitStyles(self):
    """Tests that Extract extracts implicit lines and polygons."""
    kml = """<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://earth.google.com/kml/2.2">
      <Document>
        <name>test</name>
        <Placemark>%s</Placemark>
      </Document>
    </kml>"""

    # No implied styles in empty Placemark
    self.assertEquals(([], [], [], set(), set()),
                      legend_item_extractor.Extract(kml % ''))

    # Implied polygon
    self.assertEquals(
        ([], [], [legend_item_extractor.ToPolygonStyleDict()], set(),
         set(self.CssColors([
             legend_item_extractor.LINE_DEFAULT_KML_COLOR,
             legend_item_extractor.POLYGON_DEFAULT_KML_COLOR
         ]))), legend_item_extractor.Extract(kml % '<Polygon></Polygon>'))

    # Implied lines
    line_tuple = (
        [], [legend_item_extractor.ToLineStyleDict()], [], set(),
        set(self.CssColors([legend_item_extractor.LINE_DEFAULT_KML_COLOR])))
    self.assertEquals(
        line_tuple,
        legend_item_extractor.Extract(kml % '<LineString></LineString>'))
    self.assertEquals(
        line_tuple,
        legend_item_extractor.Extract(kml % '<LinearRing></LinearRing>'))

  def testKmlRetrieval(self):
    """Tests GetLegendItem's GetKmlFromUrl and GetKmlFromFileContent methods."""
    url = 'http://www.maps.com:123/?map=321'

    def DoTest(kml, expected):
      self.mox.StubOutWithMock(urlfetch, 'fetch')
      urlfetch.fetch(url).AndReturn(utils.Struct(content=kml))

      self.mox.ReplayAll()
      self.assertEquals(expected, GetLegendItems.GetKmlFromUrl(url))
      self.mox.VerifyAll()
      self.mox.UnsetStubs()

    DoTest('not kml', None)
    DoTest('<kml></kml>', '<kml></kml>')

  def testKmzRetrieval(self):
    """Tests GetLegendItem's retrieval of KMZ archive files."""
    url = 'http://www.maps.com:123/?map=321'

    def DoTest(pairs, expected_content):
      string_io = StringIO.StringIO()
      zip_file = zipfile.ZipFile(string_io, 'w')
      for name, content in pairs:
        zip_file.writestr(name, content)
      zip_file.close()

      self.mox.StubOutWithMock(urlfetch, 'fetch')
      urlfetch.fetch(url).AndReturn(utils.Struct(content=string_io.getvalue()))

      self.mox.ReplayAll()
      self.assertEquals(expected_content, GetLegendItems.GetKmlFromUrl(url))
      self.mox.VerifyAll()
      self.mox.UnsetStubs()

    DoTest([], None)
    DoTest([('no', 'x'), ('kml', 'y'), ('files', 'z')], None)
    DoTest([('does-not-parse.kml', '<kml>blah</kml')], None)
    DoTest([('foo.png', 'x'), ('bar.kml', '<kml>hey</kml>')], '<kml>hey</kml>')

  def testGetLegendItems(self):
    """Tests the GetLegendItems handler."""
    url = 'http://www.maps.com:123/?map=321'
    kml = 'the kml'
    items = ['icons'], ['lines'], ['polygons'], ['static icons'], ['colors']

    self.mox.StubOutWithMock(GetLegendItems, 'GetKmlFromUrl')
    GetLegendItems.GetKmlFromUrl(url).AndReturn(kml)
    self.mox.StubOutWithMock(legend_item_extractor, 'Extract')
    legend_item_extractor.Extract(kml).AndReturn(items)

    self.mox.ReplayAll()
    response = self.DoGet('/.legend?url=' + urllib.quote(url))
    self.assertEquals({
        'icon_styles': items[0],
        'line_styles': items[1],
        'polygon_styles': items[2],
        'static_icon_urls': list(items[3]),
        'colors': list(items[4])
    }, json.loads(response.body))
    self.mox.VerifyAll()

  def testGetLegendItemsInvalidUrl(self):
    """Tests the GetLegendItems handler for invalid URLs."""
    url = 'http://www.maps.com:123/?map=321'
    self.mox.StubOutWithMock(GetLegendItems, 'GetKmlFromUrl')
    GetLegendItems.GetKmlFromUrl(url).AndReturn(None)

    self.mox.ReplayAll()
    self.DoGet('/.legend?url=' + urllib.quote(url), 400)
    self.mox.VerifyAll()

  def testGetLegendItemsUnsafeUrl(self):
    """Tests the GetLegendItems handler for unsafe URLs."""
    url = '/etc/passwd'
    self.DoGet('/.legend?url=' + urllib.quote(url), 400)

    url = 'ftp://www.maps.com:123/?map=321'
    self.DoGet('/.legend?url=' + urllib.quote(url), 400)


if __name__ == '__main__':
  test_utils.main()
