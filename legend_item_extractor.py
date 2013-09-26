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

"""Extracts icon, line, and polygon styles from KML for legend creation."""

__authors__ = ['joeysilva@google.com (Joey Silva)',
               'kazawa@google.com (Hideto Kazawa)']

import copy
import logging
import re
import StringIO
import xml.etree.ElementTree
import zipfile

import base_handler
import jsonp

from google.appengine.api import urlfetch

LINE_DEFAULT_KML_COLOR = 'FFFF8C8C'
LINE_DEFAULT_WIDTH = 2
POLYGON_DEFAULT_KML_COLOR = 'FFFFD5BF'


def Extract(kml):
  """Extracts and returns items from the KML.

  Extracts dictionary objects representing icon styles, line styles, and
  polygon styles from the IconStyle, LineStyle, and PolyStyle elements, and from
  the Placemark elements that define lines or polygons, in the given KML.
  TODO(joeysilva): Support NetworkLinks.

  Args:
    kml: KML document as a string to extract legend items from.

  Returns:
    The tuple (icon_styles, line_styles, polygon_styles, static_icon_urls,
    colors). icon_styles, line_styles, and polygon_styles are the extracted
    legend items from this KML; see ToIconStyleDict, ToLineStyleDict, and
    ToPolygonStyleDict for information about these objects, respectively.
    static_icon_urls is a set of all icon URLs found in all valid icons without
    a tint. colors is a set of all the different colors referenced in valid
    icon_styles, line_styles, and polygon_styles.
  """
  root = xml.etree.ElementTree.fromstring(kml)
  # Remove namespace from document so that we do not need to prefix queries.
  for element in root.getiterator():
    element.tag = element.tag.split('}')[-1]

  style_dict = {}

  # For icon_styles, line_styles, and polygon_styles, we build a set of tuples,
  # each tuple containing sorted dictionary items. We later convert these into
  # lists of dictionaries, when we return them.
  icon_styles = set()
  line_styles = set()
  polygon_styles = set()
  static_icon_urls = set()
  colors = set()

  # Remove all Styles and styleUrls referenced under non-normal StyleMap pairs.
  # This is done to omit styles that are only displayed on mouse-over.
  for stylemap in root.findall('.//StyleMap'):
    for pair in stylemap.findall('Pair'):
      if FindLastText(pair, 'key') != 'normal':
        pair.clear()

  # Create polygon items and line items based on Placemarks. Any Placemark
  # that has referenced PolyStyles, LineStyles, or geometries that may cause
  # lines to be rendered are used. This is done in addition to the main Style
  # loop because that will miss separated PolyStyles and LineStyles (contained
  # in different StyleSelector elements) corresponding to the same polygon, as
  # well as implicit lines defined by geometries in Placemarks. Will potentially
  # create duplicates of items created by the main style loop, but that is okay
  # as items are added to this method's lists uniquely. Follows rules of
  # precedence for applying styles, defined by the KML specification; see
  # FindAppliedStyle.
  for placemark in root.findall('.//Placemark'):

    # Copy Styles referenced by StyleMap styleUrls into the styleUrl so that
    # they are treated the same as inline Style elements by FindAppliedStyle,
    # because they have the same precedence as defined by the specification.
    for style_url in placemark.findall('StyleMap//styleUrl'):
      # Check that we have not already inlined the Style.
      if style_url.find('Style') is not None:
        continue
      style = FindStyle(root, style_url.text.replace('#', ''), style_dict)
      if style is not None:
        style_url.append(copy.deepcopy(style))

    def FindAppliedStyle(tag_name):
      """Finds a Placemark's applied sub-style element.

      Finds the given sub-style element that is applied to this Placemark. The
      applied sub-style is the last defined inline style, including those in
      StyleMaps, which also includes styleUrls contained in StyleMaps. If there
      are no inline styles, then the last styleUrl of the Placemark is used.
      This precedence is defined by the KML specification:
      https://developers.google.com/kml/documentation/kmlreference#feature (see
      the <StyleSelector> field). Inline Style elements are cleared, so that the
      main Style loop does not create separate line_style and polygon_style
      items for polygons.

      Args:
        tag_name: Tag name of the sub-style element, e.g. LineStyle,
          PolyStyle, etc

      Returns:
        Found sub-style element, or None if none were found.
      """
      # Inline styles take precedence (includes those in StyleMaps)
      for style in reversed(placemark.findall('.//Style')):
        if style.find(tag_name) is not None:
          tag = copy.deepcopy(FindLast(style, tag_name))
          # Clear this style, so that separated Styles are not recorded by the
          # main Style loop.
          style.clear()
          return tag

      # Finally, use the styleUrl (since nothing else has been found).
      if placemark.find('styleUrl') is not None:
        style = FindStyle(
            root,
            FindLastText(placemark, 'styleUrl').replace('#', ''),
            style_dict)
        if style is not None:
          return FindLast(style, tag_name)
      return None

    polystyle_elem = FindAppliedStyle('PolyStyle')
    linestyle_elem = FindAppliedStyle('LineStyle')
    polygon_style = None

    # If there is a PolyStyle with a fill or if there is a Polygon element,
    # record the combined style as a polygon style.
    if polystyle_elem is not None or placemark.find('.//Polygon') is not None:
      polygon_style = ToPolygonStyleDict(polystyle_elem, linestyle_elem)
      if 'fill_color' in polygon_style:
        polygon_styles.add(tuple(sorted(polygon_style.items())))
        colors.add(polygon_style['fill_color'])
        if 'border_color' in polygon_style:
          colors.add(polygon_style['border_color'])

    # If there is a PolyStyle with no fill, a LineStyle, or a line geometry
    # element, record the style as a line style.
    if ((polygon_style is not None and 'fill_color' not in polygon_style and
         'border_color' in polygon_style) or
        polygon_style is None and (
            linestyle_elem is not None or
            placemark.find('.//LineString') is not None or
            placemark.find('.//LinearRing') is not None)):
      line_style = ToLineStyleDict(linestyle_elem)
      line_styles.add(tuple(sorted(line_style.items())))
      colors.add(line_style['color'])

  # The main Style loop, that looks for all Style elements anywhere in the
  # KML, and records icons, lines, and polygon_styles based on them.
  for style in root.findall('.//Style'):
    # Icons
    if style.find('IconStyle') is not None:
      icon_style = ToIconStyleDict(FindLast(style, 'IconStyle'))
      if icon_style:
        icon_styles.add(tuple(sorted(icon_style.items())))
        if 'color' in icon_style and icon_style['color'] != '#ffffff':
          colors.add(icon_style['color'])
        elif 'href' in icon_style:
          static_icon_urls.add(icon_style['href'])

    # Polygons
    # Check for PolyStyle before LineStyle, as polygon Styles may contain
    # both, while lines will only contain a LineStyle. PolyStyles with a fill
    # are recorded as polygon styles; PolyStyles with no fill are recorded as
    # line styles.
    polygon_style = None
    polystyle_elem = FindLast(style, 'PolyStyle')
    linestyle_elem = FindLast(style, 'LineStyle')
    if style.find('PolyStyle') is not None:
      polygon_style = ToPolygonStyleDict(polystyle_elem, linestyle_elem)
      if 'fill_color' in polygon_style:
        polygon_styles.add(tuple(sorted(polygon_style.items())))
        colors.add(polygon_style['fill_color'])
        if 'border_color' in polygon_style:
          colors.add(polygon_style['border_color'])

    # Lines.
    if (polygon_style is not None and 'fill_color' not in polygon_style and
        'border_color' in polygon_style or
        polygon_style is None and linestyle_elem is not None):
      line_style = ToLineStyleDict(linestyle_elem)
      line_styles.add(tuple(sorted(line_style.items())))
      colors.add(line_style['color'])

  return (map(dict, icon_styles), map(dict, line_styles),
          map(dict, polygon_styles), static_icon_urls, colors)


def FindStyle(root, style_id, style_dict=None, tail=frozenset()):
  """Returns the shared Style element ultimately pointed to by the given ID.

  Looks for the Style element with the given ID in the KML, or inside of
  StyleMap elements with the given ID. Will recurse in the case of StyleMaps
  that contain styleUrls. Caches results in __style_dict. Does not return
  Styles referenced in non-normal StyleMap pairs.
  TODO(joeysilva): Support global style references (i.e. URLs).

  Args:
    root: The KML element to look in for the style.
    style_id: ID of the shared style (without the #).
    style_dict: Optional dictionary of memoized styles by their ID. If given,
        style_dict will be checked first for the given id; otherwise, the style
        will be added to style_dict when it is found.
    tail: Set of IDs that have been used to recurse; used for cycle detection.

  Returns:
    Found <Style> element, or None if none was found.
  """
  if style_dict is not None and style_id in style_dict:
    return style_dict[style_id]

  if style_id in tail:
    logging.warn('Found circular style references: ' + ','.join(tail))
    return None

  # TODO(joeysilva): Use @id= once using Python 2.7
  style = None
  for some_style in reversed(root.findall('.//Style')):
    if some_style.get('id') == style_id:
      style = some_style
      break

  if style is None:
    for stylemap in reversed(root.findall('.//StyleMap')):
      if stylemap.get('id') != style_id:
        continue

      for pair in reversed(stylemap.findall('Pair')):
        if FindLastText(pair, 'key') == 'normal':
          if pair.find('styleUrl') is not None:
            style = FindStyle(
                root, FindLastText(pair, 'styleUrl').replace('#', ''),
                style_dict, tail.union([style_id]))
          else:
            style = FindLast(pair, 'Style')
          if style is not None:
            break

      if style is not None:
        break

  if style is not None and style_dict is not None:
    style_dict[style_id] = style
  return style


def ToIconStyleDict(iconstyle):
  """Returns a dictionary describing the given IconStyle element.

  TODO(joeysilva): Support gx prefixed properties x, y, w, and h when using
  Python 2.7

  Args:
    iconstyle: <IconStyle> element

  Returns:
    Dictionary defining the icon, with an 'href' field if an href element in an
    Icon element was found, as well as a 'color' field if one was found.
  """
  icon = {}
  icon_element = FindLast(iconstyle, 'Icon')
  if icon_element is not None and icon_element.find('href') is not None:
    icon['href'] = FindLastText(icon_element, 'href')
  if iconstyle.find('color') is not None:
    icon['color'] = CssColor(FindLastText(iconstyle, 'color'))
  return icon


def ToPolygonStyleDict(polystyle=None, linestyle=None):
  """Returns a dictionary describing the given PolyStyle element.

  Args:
    polystyle: <PolyStyle> element. Determines if this polygon has a fill and
      of what color. Also determines whether this polygon has an outline,
      which will be defined by the given linestyle. If not provided, this
      polygon will default to default a default KML polygon with both a fill
      and an outline.

    linestyle: <LineStyle> element that will define the polygon's outline (see
      ToLineStyleDict). If polystyle indicates no outline, this will be ignored.

  Returns:
    Dictionary defining the polygon. May contain a 'color' field with a CSS
    color code, if this polygon has a fill. May contain 'border_width' and
    'border_color' fields if this polygon has an outline, with a line object
    (see ToLineStyleDict).
  """
  polygon = {}
  if polystyle is None or FindLastText(polystyle, 'fill', '1') == '1':
    if polystyle is not None and polystyle.find('color') is not None:
      kml_color = FindLastText(polystyle, 'color')
    else:
      kml_color = POLYGON_DEFAULT_KML_COLOR
    polygon['fill_color'] = CssColor(kml_color)
  if polystyle is None or FindLastText(polystyle, 'outline', '1') == '1':
    border = ToLineStyleDict(linestyle)
    polygon['border_width'] = border['width']
    polygon['border_color'] = border['color']

  return polygon


def ToLineStyleDict(linestyle=None):
  """Returns a dictionary describing the given LineStyle element.

  Args:
    linestyle: <LineStyle> element that will define this line's color and
      width. If not provided, a default KML line will be created.

  Returns:
    Dictionary defining the line. Contains a 'color' field with a CSS color
    code, and a 'width' field containing an integer.
  """
  if linestyle is not None and linestyle.find('color') is not None:
    kml_color = FindLastText(linestyle, 'color')
  else:
    kml_color = LINE_DEFAULT_KML_COLOR

  if linestyle is not None and linestyle.find('width') is not None:
    width = round(float(FindLastText(linestyle, 'width')), 1)
  else:
    width = LINE_DEFAULT_WIDTH

  return {
      'color': CssColor(kml_color),
      'width': width
  }


def CssColor(kml_color):
  """Returns CSS color string corresponding to 'kml_color'.

  cf. http://code.google.com/apis/kml/documentation/kmlreference.html#color
  TODO(joeysilva): Support alpha field.

  Args:
    kml_color: String representing a color in KML.

  Returns:
    String representing the color in CSS. Will return '#000000' (black) in the
    case of invalid input.
  """
  if re.match(r'[0-9a-fA-F]{8}$', kml_color):
    return '#%s%s%s' % (kml_color[6:8], kml_color[4:6], kml_color[2:4])
  else:
    logging.warning('Invalid KML color string. Use black.: %s', kml_color)
    return '#000000'


def FindLast(element, xpath):
  """Returns the last element returned by element.findall(xpath).

  Args:
    element: Element to search under.
    xpath: xpath query to search with.

  Returns:
    Last found element, or None if none were found.
  """
  return (element.findall(xpath) or [None])[-1]


def FindLastText(element, xpath, default=None):
  """Returns the text of last element returned by element.findall(xpath).

  Args:
    element: Element to search under.
    xpath: xpath query to search with.
    default: Text to return if no element was found.

  Returns:
    Text of the last found element, or the given default value.
  """
  return getattr(FindLast(element, xpath), 'text', default)


class GetLegendItems(base_handler.BaseHandler):
  """Handler for retrieving legend items from KML URLs."""

  KML_CONTENT_TYPE = 'application/vnd.google-earth.kml+xml'
  KMZ_CONTENT_TYPE = 'application/vnd.google-earth.kmz'

  def Get(self):
    """Returns legend items extracted from kml at given URL."""
    url = jsonp.SanitizeUrl(self.request.get('url'))
    kml = self.GetKmlFromUrl(url)
    if kml is None:
      raise base_handler.Error(400, 'Failed to get KML from ' + url)

    (icon_styles, line_styles, polygon_styles,
     static_icon_urls, colors) = Extract(kml)

    self.WriteJson({
        'icon_styles': icon_styles, 'line_styles': line_styles,
        'polygon_styles': polygon_styles,
        'static_icon_urls': list(static_icon_urls), 'colors': list(colors)
    })

  @classmethod
  def GetKmlFromUrl(cls, url):
    """Retrieves KML content a URL.

    Args:
      url: Un-escaped KML or KMZ URL string.

    Returns:
      A string representing KML or None upon a failure.
    """
    return cls.GetKmlFromFileContent(urlfetch.fetch(url).content)

  @classmethod
  def GetKmlFromFileContent(cls, content):
    """Retrieve from a file content.

    Args:
      content: String representing a KML or KMZ file content.

    Returns:
      A string representing KML or None upon a failure.
    """
    # First check if this is a zip file by attempting to extract it.
    try:
      kmz = zipfile.ZipFile(StringIO.StringIO(content))
      for info in kmz.infolist():
        if info.filename.endswith('.kml'):
          content = kmz.read(info.filename)
          break
    except zipfile.BadZipfile:
      pass

    try:
      document = xml.etree.ElementTree.fromstring(content)
      if document.tag.endswith('kml'):
        return content
    except xml.etree.ElementTree.ParseError:
      return None
