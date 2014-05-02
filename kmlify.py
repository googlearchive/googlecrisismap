#!/usr/bin/python2.5
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

"""Gets records from CSV, GeoJSON, or XML and emits them as KML placemarks."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

# App Engine requires that we put this first.  # pylint: disable=C6203,C6204
import base_handler

import StringIO
import collections
import csv
import json
import logging
import pickle
import re
import string
import urllib
import xml_utils
import zipfile

from google.appengine.api import memcache
from google.appengine.api import urlfetch

KMZ_CONTENT_TYPE = 'application/vnd.google-earth.kmz'
KML_CONTENT_TYPE = 'application/vnd.google-earth.kml+xml'
KML_DOCUMENT_TEMPLATE = """\
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
%s
</kml>
"""
DEFAULT_ICON_URL = 'http://mw1.google.com/crisisresponse/icons/red_dot.png'
ICON_FILES = {'small': 'pin16.png', 'medium': 'pin24.png', 'large': 'pin32.png'}
OPERATORS = {
    '=': lambda x, y: x == y,
    '==': lambda x, y: x == y,
    '!=': lambda x, y: x != y,
    '<': lambda x, y: x < y,
    '<=': lambda x, y: x <= y,
    '>': lambda x, y: x > y,
    '>=': lambda x, y: x >= y,
}


def Stringify(text, html=False):
  """Converts the input to a string, handling encoding and HTML-escaping.

  Args:
    text: The thing to convert.
    html: True if the result should be HTML-escaped.
  Returns:
    An 8-bit string, either encoded in UTF-8 or HTML-escaped.
  """
  if text is None:
    return ''
  if not isinstance(text, (str, unicode)):
    text = str(text)
  if html:
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
  if isinstance(text, unicode):
    # Encode non-ASCII chars as XML char refs for HTML, or UTF-8 otherwise.
    if html:
      return text.encode('ascii', errors='xmlcharrefreplace')
    return text.encode('utf-8')
  return text


def HtmlEscape(text):
  return Stringify(text, html=True)


def UrlQuote(text):
  return urllib.quote(Stringify(text))


def ParseXml(xml):
  """Tries to parse some XML, logging informative errors if parsing fails."""
  xml = xml.replace('\r', '\n')  # simplify line numbering of SyntaxErrors
  try:
    return xml_utils.Parse(xml)
  except SyntaxError, e:
    try:  # in case there's no root element, try adding one
      return xml_utils.Parse('<_>' + xml + '</_>')
    except SyntaxError:  # report the original error in a more informative way
      logging.error('syntax error in XML input (%s)', e)
      logging.info('beginning of input: %r', xml[:200])
      match = re.search(r'line (\d+), column (\d+)', e.message)
      if match:
        lineno, column = int(match.group(1)), int(match.group(2))
        offset = len('\n'.join(xml.split('\n')[:lineno - 1])) + 1 + column - 1
        logging.info('before the error: %r', xml[:offset][-100:])
        logging.info('after the error: %r', xml[offset:][:100])
      raise e


def UnzipData(data, preferred_filename_regex='.*'):
  """Unzips data from a zip file.

  If given a zip file, returns the contents of the first file whose entire
  name matches preferred_filename_regex.  If no filename matches, returns the
  contents of the first file.  If not a zip file, returns the data as given.

  Args:
    data: The zipfile contents, as a string.
    preferred_filename_regex: Regular expression, as a string.
  Returns:
    The matching file contents, as a string.
  """
  try:
    archive = zipfile.ZipFile(StringIO.StringIO(data))
  except zipfile.BadZipfile:
    return data  # not a zip archive
  for name in archive.namelist():  # return first matching file
    if re.search('^' + preferred_filename_regex + '$', name):
      return archive.read(name)
  for name in archive.namelist():  # fall back to returning first file
    return archive.read(name)
  return ''  # zip archive contains no entries, return ''


def MakeKmz(kml):
  """Packs a KML document into a KMZ file."""
  output_buffer = StringIO.StringIO()
  archive = zipfile.ZipFile(output_buffer, 'w')
  info = zipfile.ZipInfo('doc.kml')
  info.external_attr = 0644 << 16L  # Unix permission bits
  info.compress_type = zipfile.ZIP_DEFLATED
  archive.writestr(info, kml)
  archive.close()
  return output_buffer.getvalue()


def Compare(op, lhs, rhs):
  """Applies a comparison operator, converting the type of rhs as needed."""
  try:
    # In general, we do the comparison according to the type of the right side
    # (string or float).  However, we don't convert None; that way if an XML
    # element is missing, it is considered less than all strings and floats,
    # Thus, comparing to '' is a way to test for existence of an XML element.
    if lhs is not None:
      lhs = type(rhs)(lhs)
  except (TypeError, ValueError):  # return False when conversion fails
    return False
  return op(lhs, rhs)


def NormalizeFieldName(name):
  """Normalizes a field name as used in templates, e.g. (foo);Bar -> foo_Bar."""
  return '_'.join(re.sub(r'[^/\w.@#]', ' ', name).split())


def NormalizeRecord(record):
  return {NormalizeFieldName(key): record[key].strip() for key in record}


def Decode(s, encoding):
  try:
    return s.decode(encoding)
  except UnicodeDecodeError:
    return s.decode('latin-1')


def DecodeRecord(record, encoding):
  return {Decode(key, encoding): Decode(value, encoding)
          for key, value in record.items()}


def GetText(element):
  return (element.text or '') + ''.join(
      GetText(child) + child.tail for child in element.getchildren())


def FetchData(url, referer=None):
  headers = referer and {'Referer': referer} or {}
  logging.info('fetching %s', url)
  data = urlfetch.fetch(
      url, headers=headers, validate_certificate=False, deadline=10).content
  logging.info('retrieved %d bytes', len(data))
  return UnzipData(data, r'.*\.[kx]ml')


def CreateHotspotElement(spec):
  """Creates a KML hotSpot element according to the given specification.

  Args:
    spec: A string "x,y" indicating a pixel offset from the bottom-left corner;
        or any of the letters 'l', 'r', 't', 'b' (e.g. 'tr' for top-right,
        'l' for center left); or '' to indicate the center of the image.
  Returns:
    An XML <hotSpot> Element.
  """
  try:
    x, y = spec.split(',')
    x, y = float(x), float(y)
    units = 'pixels'
  except ValueError:
    letters = set(spec.lower())
    x = [0.5, 0, 1, 0.5][('l' in letters) + ('r' in letters)*2]
    y = [0.5, 0, 1, 0.5][('b' in letters) + ('t' in letters)*2]
    units = 'fraction'
  return xml_utils.Xml('hotSpot', x=x, y=y, xunits=units, yunits=units)


def KmlCoordinatesFromJson(coords):
  if isinstance(coords[0], (int, float)):
    coords = [coords]
  return ' '.join(','.join(map(str, position)) for position in coords)


def KmlGeometryFromJson(geom):
  """Converts a GeoJSON Geometry object to a KML Geometry element."""
  xml = xml_utils.Xml
  t = geom.get('type')
  coords = geom.get('coordinates', [])
  if t in ['MultiPoint', 'MultiLineString', 'MultiPolygon']:
    return xml('MultiGeometry', *(
        KmlGeometryFromJson({'type': t[5:], 'coordinates': subcoords})
        for subcoords in coords
    ))
  if t in ['Point', 'LineString']:
    return xml(t, xml('coordinates', KmlCoordinatesFromJson(coords)))
  if t == 'Polygon':
    return xml('Polygon', *(
        xml(i == 0 and 'outerBoundaryIs' or 'innerBoundaryIs',
            xml('LinearRing', xml('coordinates', KmlCoordinatesFromJson(ring))))
        for i, ring in enumerate(coords)
    ))


def KmlStyleFromJson(props, root_url):
  """Converts a dictionary of GeoJSON properties to a KML Style element."""
  # See https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0
  xml = xml_utils.Xml
  icon_file = ICON_FILES.get(props.get('marker-size', 'medium'))
  return xml('Style',
             xml('IconStyle',
                 xml('Icon', xml('href', root_url + '/.static/' + icon_file)),
                 KmlColorFromJson(props.get('marker-color', '48d')),
                 CreateHotspotElement('b')),  # bottom center
             xml('LineStyle',
                 xml('width', props.get('stroke-width', 2)),
                 KmlColorFromJson(props.get('stroke', 'f80'),
                                  props.get('stroke-opacity', 0.5))),
             xml('PolyStyle',
                 xml('outline', '1'),
                 xml('fill', '1'),
                 KmlColorFromJson(props.get('fill', 'f80'),
                                  props.get('fill-opacity', 0.15))))


def KmlColorFromJson(color, opacity=1):
  xml = xml_utils.Xml
  color = color.replace('#', ' ').strip()
  opacity_hex = '%02x' % (255.999*opacity)
  if len(color) == 3:
    return xml('color', opacity_hex + color[2]*2 + color[1]*2 + color[0]*2)
  if len(color) == 6:
    return xml('color', opacity_hex + color[4:6] + color[2:4] + color[0:2])


class Template(string.Template):
  idpattern = r'/?\w[\w.@#]*'


class Kmlifier(object):
  """A converter for CSV/XML/GeoJSON to KML."""

  def __init__(self, root_url, name_template, description_template,
               location_fields, id_template, icon_url_template=None,
               color_template=None, hotspot_template=None,
               join_field=None, join_data=None, conditions=None):
    """Sets up a record extractor and KML emitter.

    Args:
      root_url: A base URL to use in construction of icon URLs.
      name_template: A string template, in string.Template format, for the name
          to appear in each placemark's <name> element.  Each placeholder is
          replaced with the contents of the corresponding field in the record.
      description_template: A string template, in string.Template format, for
          the HTML description to appear in each placemark's bubble.  Each
          placeholder is replaced with the contents of the corresponding field
          within the record.  Field values are HTML-escaped by default.
          Prepend '_' to the name of a field to get the non-escaped field value
          or '__' to the name of the field to get the URL-escaped field value
          (e.g. $foo gives the HTML-escaped value, $_foo gives the raw value).
      location_fields: A list of fields to look for in each record.  Each item
          should be of the form 'foo' (field 'foo' should contain latitude and
          longitude, separated by a comma or whitespace), '^foo' (like 'foo'
          but in longitude, latitude order), or 'foo,bar' (fields 'foo' and
          'bar' should specify latitude and longitude respectively).  If the
          list has > 1 item, the result is the centroid of all the locations.
      id_template: A string template, in string.Template format, for the value
          to appear in each placemark's "id" attribute.  Each placeholder is
          replaced with the contents of the corresponding field in the record.
      icon_url_template: A string template, in string.Template format, for the
          URL of the icon image to use.  Each placeholder is replaced with the
          contents of the corresponding field in the record.  If unspecified,
          the icon defaults to a small red dot.
      color_template: A string template, in string.Template format, that yields
          a color code in KML format (aabbggrr) to tint the icon.
      hotspot_template: A string template, in string.Template format, that
          yields the icon hotspot, specified either as x,y pixels from the
          top-left corner, or as letters to specify an edge or corner ('t',
          'b', 'l', 'r' for the center of the top, bottom, left, or right
          edge; 'tl', 'tr', 'bl', 'br' for a corner).  If unspecified or
          empty, the hotspot defaults to the center of the image.
      join_field: A field name on which to join against another table of data.
      join_data: Another table of CSV data.
      conditions: A list of conditions to filter by.  Each condition is a
          string consisting of a field name, an operator, and a value.  The
          operator can be one of ['==', '!=', '<', '<=', '>', '>='].  Values
          are compared as numbers if the value is parseable as a float;
          otherwise values are compared as strings.
    """
    self.root_url = root_url
    self.name_template = Template(name_template)
    self.description_template = Template(description_template)
    self.location_fields = location_fields
    self.id_template = Template(id_template)
    self.icon_url_template = Template(icon_url_template or DEFAULT_ICON_URL)
    self.color_template = Template(color_template or 'ffffffff')
    self.hotspot_template = Template(hotspot_template or 'mc')
    self.join_field = join_field or ''
    self.join_records = {}
    if join_data:
      self.join_records = {
          record[join_field]: record
          for record in self.RecordsFromCsv(join_data, header_fields_hint=[])}

    # Gather the set of all fields mentioned in templates or conditions.
    self.fields = set()
    def Gather(match):
      name = match.group('named') or match.group('braced')
      if name:
        self.fields.add(str(name).lstrip('_'))
    self.name_template.pattern.sub(Gather, name_template)
    self.description_template.pattern.sub(Gather, description_template)
    self.id_template.pattern.sub(Gather, id_template)
    for field in location_fields:
      if field.startswith('^'):
        field = field[1:]
      self.location_fields_cleaned = map(str, field.split(','))
      self.fields.update(self.location_fields_cleaned)
    if self.join_field:
      self.fields.add(self.join_field)

    self.conditions = []
    if conditions:
      for condition in conditions:
        if condition:
          try:
            field, opsym, value = re.split('([=<>!]+)', str(condition), 1)
            op = OPERATORS[opsym]
          except (KeyError, ValueError):
            raise ValueError('ill-formed condition: %r' % condition)
          try:
            value = float(value)  # compare as a float
          except ValueError:
            pass  # compare as a string
          self.conditions.append((field, op, value))
          self.fields.add(field)

  def RecordsFromGeoJson(self, geojson_data):
    """Extracts records from a GeoJSON string.

    Args:
      geojson_data: A GeoJSON object, serialized as a string.  See
          http://geojson.org/geojson-spec.html#geojson-objects for details.
    Returns:
      The records, as a list of dictionaries containing KML Geometry and Style
      elements in their '__geometry__' and '__style__' keys, respectively.
    """
    obj = json.loads(geojson_data)
    if obj['type'] not in ['Feature', 'FeatureCollection']:
      obj = {'type': 'Feature', 'geometry': obj}
    records = []
    for feature in obj.get('features', [obj]):
      if feature.get('type') == 'Feature':
        geometry = KmlGeometryFromJson(feature.get('geometry', {}))
        props = feature.get('properties', {})
        style = KmlStyleFromJson(props, self.root_url)
        if geometry:
          records.append(dict(props, __geometry__=geometry, __style__=style))
    return records

  def RecordsFromCsv(self, csv_data, encoding='utf-8', header_fields_hint=None):
    """Extracts records from a string of CSV data.

    Args:
      csv_data: The CSV data, as a string. There should be a header, 1 or 2
          rows of which should contain the field names.
      encoding: The string encoding of csv_data, e.g. 'utf-8'.
      header_fields_hint: A list of fields required to be in the header row.
          If empty, use the first row as the header.
          If None, use self.location_fields_cleaned.
    Returns:
      The records, as a list of dictionaries.
    """
    csv_file = StringIO.StringIO(csv_data)
    if header_fields_hint is None:
      header_fields_hint = self.location_fields_cleaned
    fieldnames = self.FindCsvFieldnames(csv_file, encoding, header_fields_hint)
    logging.info('CSV fieldnames: %s', fieldnames)
    return [NormalizeRecord(DecodeRecord(record, encoding))
            for record in csv.DictReader(csv_file, fieldnames=fieldnames)]

  def FindCsvFieldnames(self, csv_file, encoding, header_fields_hint):
    """Finds a suitable set of fieldnames to map fields to CSV columns.

    Field names are taken from the first row with cells that match the
    latitude, longitude fields specified in self.location_fields.
    If that row contains empty cells, the algorithm presumes that field
    names span multiple rows, and it searches the following row for fields in
    self.fields.  If found, they are copied into the return value.

    Note that the current implementation does not support the case where
    self.location_fields are in the second row of field definitions.

    Args:
      csv_file: A CSV file-like object.
      encoding: The string encoding of csv_data, e.g. 'utf-8'.
      header_fields_hint: A list of fields required to be in the header row.
          Pass an empty list to use the first row as the header.
    Returns:
      An array suitable for passing to fieldnames in csv.DictReader
    """
    fieldnames = []
    csv_reader = csv.reader(csv_file)
    for row in csv_reader:
      row = [NormalizeFieldName(Decode(f, encoding)) for f in row]
      if set(row).issuperset(header_fields_hint):
        fieldnames = row
        break

    if '' in fieldnames:
      # Handle rowspans in the fieldnames line.  Example:
      # | Name | Location             | Description | Lat | Lon |
      # |      | Address | City State |             |     |     |
      # is stored in csv as
      # Name,Location,,Description,Lat,Lon
      # ,Address,City State,,,
      # and should end up as
      # ['Name', 'Address', 'City_State', 'Description', 'Lat', 'Lon']
      # if we need to refer to Address or City_State in self.fields
      first_header_row_pos = csv_file.tell()
      row = [NormalizeFieldName(Decode(f, encoding)) for f in csv_reader.next()]
      for index in range(len(fieldnames)):
        if row[index] in self.fields:
          fieldnames[index] = row[index]
      csv_file.seek(first_header_row_pos)
    return fieldnames

  def RecordsFromXml(self, xml_data, record_tag=None, xml_wrapper_tag=None):
    """Extracts records from a string of XML data.

    Fields in self.fields are sought as XML tags or attributes in each record.
    For example, if record_tag is "foo", then each <foo> element becomes a
    record.  A field named "bar" gets the contents of the <bar> element found
    anywhere within the <foo> element.  A field named "bar#z" gets the contents
    of the <bar> element whose "id" or "name" attribute is "z".  A field named
    "p.q" gets the contents of the <p> element whose "class" attribute is "q".
    A field named "x@y" gets the value of the "y" attribute on the <x> element.

    Args:
      xml_data: A string of XML to parse.
      record_tag: The XML tag surrounding each record.  Any tag with this
          name is matched, regardless of namespace.
      xml_wrapper_tag: An XML tag name.  If this is specified, it is assumed
          that all the records have been serialized as XML text in the text
          content of XML elements with this tag name.
    Returns:
      The records, as a list of dictionaries.
    """
    if xml_wrapper_tag:
      root = ParseXml(xml_data)
      xml_data = ''.join(element.text for element in root.getiterator()
                         if element.tag.split('}')[-1] == xml_wrapper_tag)
    root = ParseXml(xml_data)
    for element in root.getiterator():
      element.tag = element.tag.split('}')[-1]  # remove XML namespaces

    styles = {element.get('id'): element
              for element in root.findall('.//Style')}

    def ExtractFields(field_prefix, element, record):
      """Copies field values from an element into the given dictionary."""
      def ExtractField(field, value):
        if field in self.fields:
          record[field] = value
      text = GetText(element)
      ExtractField(field_prefix, text)
      for attr in element.keys():
        ExtractField(field_prefix + '@' + attr, element.get(attr))
      ExtractField(field_prefix + '.' + element.get('class', '').strip(), text)
      ExtractField(field_prefix + '#' + element.get('id', '').strip(), text)
      ExtractField(field_prefix + '#' + element.get('name', '').strip(), text)

    # We walk over the the whole document looking for the record_tag XML tag;
    # for each record tag, we scan all elements and attributes within, pulling
    # out their values into records only if they are specified in self.fields.
    records = []
    # global_fields collects fields outside of record tags, so that if, for
    # example, there is a single <title> for the whole XML document, it can
    # be referenced in templates as $/title.
    global_fields = {}
    for element in root.getiterator():
      if element.tag == record_tag:
        record = {}
        for child in element.getiterator():
          ExtractFields(child.tag, child, record)
          if (child.tag in 'Point LineString Polygon MultiGeometry'.split() and
              child.find('.//coordinates') is not None):
            record['__geometry__'] = child  # preserve KML geometry
        style = element.find('.//Style')
        style_url = element.find('.//styleUrl')
        if style is not None:
          record['__style__'] = style  # preserve KML style
        elif style_url is not None and style_url.text.startswith('#'):
          record['__style__'] = styles.get(style_url.text.lstrip('#'))
        records.append(record)
      else:
        ExtractFields('/' + element.tag, element, global_fields)

    def OverlayDictionaries(base, overlay):
      result = base.copy()
      result.update(overlay)
      return result
    return [OverlayDictionaries(global_fields, record) for record in records]

  def FilterRecords(self, records):
    """Filters the given a list of records by the specified conditions."""
    return [record for record in records
            if all(Compare(op, record.get(field, None), value)
                   for field, op, value in self.conditions)]

  def RecordsToKmlDocument(self, records):
    """Turns a list of records into a KML Document element of placemarks."""
    xml = xml_utils.Xml
    placemarks = []
    styles = []
    style_ids = {}
    for record in records:
      geometry = record.pop('__geometry__', None)
      style = record.pop('__style__', None)

      # Join with the join_data, if any.
      if self.join_field:
        join_record = self.join_records.get(record[self.join_field])
        if join_record:
          record.update(join_record)

      # Substitute raw values into templates.
      values = collections.defaultdict(lambda: '', record)
      name = self.name_template.substitute(values)
      id_value = self.id_template.substitute(values)
      icon_url = self.icon_url_template.substitute(values)
      color = self.color_template.substitute(values)
      hotspot = self.hotspot_template.substitute(values)

      # Substitute escaped or quoted values into the description template.
      values.update({key: HtmlEscape(record[key]) for key in record})
      values.update({'_' + key: record[key] for key in record})
      values.update({'__' + key: UrlQuote(record[key]) for key in record})
      description = self.description_template.substitute(values)

      # Get geometry information.
      if not geometry:
        # Take the first field specification that gets us to a valid latitude
        # and longitude.  This is handy because, if the location might appear
        # in one of two different fields, you can specify both and you'll get
        # whichever field is populated.
        for field in self.location_fields:
          try:
            if ',' in field:
              [lat, lon] = map(record.get, field.split(',')[:2])
            elif field.startswith('^'):
              lon, lat = record[field[1:]].replace(',', ' ').split()[:2]
            else:
              lat, lon = record[field].replace(',', ' ').split()[:2]
            coords = '%.6f,%.6f,0' % (float(lon), float(lat))
            geometry = xml('Point', xml('coordinates', coords))
            break
          except (KeyError, ValueError, TypeError):
            continue

      if geometry:
        # When the Maps API gives us click events on a KmlLayer, it conveys
        # the name and description but not the coordinates of the item.  :(
        # So we have to pass along the coordinates inside the description.
        try:
          coords = geometry.find('.//coordinates').text
          # Take the center of the bounding box around all the points, which
          # approximates the center of a polyline, polygon, etc.  (This totally
          # fails for polygons that cross the 180-degree meridian.)
          lons, lats = zip(*[map(float, xyz.split(',')[:2])
                             for xyz in coords.split()])
          description += (
              '<input type="hidden" name="kmlify-location" value="%.6f,%.6f">' %
              ((min(lats) + max(lats)) / 2, (min(lons) + max(lons)) / 2))
        except (AttributeError, ValueError):
          continue

      # Get style information.
      if not style:
        style = xml('Style',
                    xml('IconStyle',
                        xml('color', color),
                        xml('Icon', xml('href', icon_url)),
                        CreateHotspotElement(hotspot)))
      key = xml_utils.Serialize(style)
      if key not in style_ids:
        style_ids[key] = 'style%d' % (len(style_ids) + 1)

      # Add a placemark.
      if geometry:
        placemarks.append(
            xml('Placemark',
                id_value and {'id': id_value} or None,
                xml('name', name),
                xml('description', description),
                geometry,
                xml('styleUrl', '#' + style_ids[key])))

    styles = [xml('Style', *xml_utils.Parse(key).getchildren(), id=style_id)
              for key, style_id in sorted(style_ids.items())]
    return xml('Document', *(styles + placemarks))


class Kmlify(base_handler.BaseHandler):
  """Web handler for the kmlify endpoint."""

  TTL_SECONDS = 60  # memcache lifetime; TODO(kpy): configure this per URL

  def Get(self):
    """GET handler."""
    url = str(self.request.get('url', ''))
    data_type = str(self.request.get('type', ''))
    xml_wrapper_tag = str(self.request.get('wrapper', ''))
    record_tag = str(self.request.get('record', 'Placemark'))
    name_template = str(self.request.get('name', '$name'))
    description_template = str(self.request.get('desc', '$_description'))
    location_fields = map(str, self.request.get_all('loc') or ['^coordinates'])
    id_template = str(self.request.get('id', '$Placemark@id'))
    icon_url_template = str(self.request.get('icon', ''))
    color_template = str(self.request.get('color', 'ffffffff'))
    hotspot_template = str(self.request.get('hotspot', ''))
    join = str(self.request.get('join', ''))
    conditions = map(str, self.request.get_all('cond') or [])
    conditions = ','.join(conditions).split(',')
    try:
      skip = int(self.request.get('skip', '0'))
    except ValueError:
      skip = 0
    try:  # 10000 features is likely to be more than KmlLayer can handle
      limit = int(self.request.get('limit', '10000'))
    except ValueError:
      limit = 10000

    cache_key = pickle.dumps((url, data_type, xml_wrapper_tag, record_tag,
                              name_template, description_template,
                              location_fields, id_template,
                              icon_url_template, color_template,
                              hotspot_template, join, conditions, skip, limit))

    # TODO(kpy): Keep track of how much time the cache entry has left, and
    # extend its lifetime if the remote server temporarily fails to respond.
    kmz = memcache.get(cache_key)
    if kmz is not None:
      logging.info('got %d bytes from memcache', len(kmz))
      return self.RespondWithKmz(kmz)

    try:
      # Fetch the source data.
      data = FetchData(url, self.request.host)

      join_field = join_data = None
      if join:
        join_field, join_url = join.split(',', 1)
        join_data = FetchData(join_url)

      # Perform the conversion.
      kmlifier = Kmlifier(
          self.request.root_url, name_template, description_template,
          location_fields, id_template, icon_url_template, color_template,
          hotspot_template, join_field, join_data, conditions)
      if data_type == 'xml':
        records = kmlifier.RecordsFromXml(data, record_tag, xml_wrapper_tag)
      elif data_type == 'csv':
        records = kmlifier.RecordsFromCsv(data)
      elif data_type == 'geojson':
        records = kmlifier.RecordsFromGeoJson(data)
      else:
        raise ValueError(
            'type is %r, but should be "xml", "csv", or "geojson"' % data_type)
      logging.info('extracted %d records', len(records))
      records = kmlifier.FilterRecords(records)
      logging.info('conditions were met by %d records', len(records))
      records = records[skip:skip + limit]
      document = kmlifier.RecordsToKmlDocument(records)
    except Exception, e:  # pylint:disable=broad-except
      # Even if conversion fails, always cache something.  We don't want an
      # error to trigger a spike of urlfetch requests to the remote server.
      document = xml_utils.Xml(
          'Document', xml_utils.Xml('name', 'Conversion failed: %r' %  e))
      logging.exception(e)
    kmz = MakeKmz(KML_DOCUMENT_TEMPLATE % xml_utils.Serialize(document))
    memcache.set(cache_key, kmz, self.TTL_SECONDS)
    self.RespondWithKmz(kmz)

  def RespondWithKmz(self, kmz):
    self.response.headers['Content-Type'] = KMZ_CONTENT_TYPE
    self.response.headers['Cache-Control'] = (
        'public, max-age=%s, must-revalidate' % self.TTL_SECONDS)
    self.response.out.write(kmz)
