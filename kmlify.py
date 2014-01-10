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

"""Extracts records from CSV or XML and emits them as KML placemarks."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

# App Engine requires that we put this first.  # pylint: disable=C6203,C6204
import base_handler

import StringIO
import csv
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
DEFAULT_ICON_URL = 'http://mw1.google.com/crisisresponse/icons/red_dot.png'
KML_DOCUMENT_TEMPLATE = """\
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.2">
%s</kml>
"""

OPERATORS = {
    '=': lambda x, y: x == y,
    '==': lambda x, y: x == y,
    '!=': lambda x, y: x != y,
    '<': lambda x, y: x < y,
    '<=': lambda x, y: x <= y,
    '>': lambda x, y: x > y,
    '>=': lambda x, y: x >= y,
}


def HtmlEscape(text):
  return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def UrlQuote(text):
  if isinstance(text, unicode):
    text = text.encode('utf-8')
  return urllib.quote(text)


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
        logging.info('before the error: %r', xml[max(0, offset - 100):offset])
        logging.info('after the error: %r', xml[offset:offset + 100])
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
  try:
    lhs = type(rhs)(lhs)  # convert left side to match type of right side
  except Exception:  # pylint:disable=broad-except
    return False
  return op(lhs, rhs)


def NormalizeFieldName(name):
  return '_'.join(re.sub(r'[^\w.@]', ' ', name).split())


def NormalizeRecord(record):
  return dict((NormalizeFieldName(key), record[key].strip()) for key in record)


def DecodeRecord(record, encoding):
  def Decode(s):
    try:
      return s.decode(encoding)
    except UnicodeDecodeError:
      return s.decode('latin-1')
  return dict((Decode(key), Decode(value)) for key, value in record.items())


def GetText(element):
  return (element.text or '') + ''.join(
      GetText(child) + child.tail for child in element.getchildren())


def FetchData(url):
  logging.info('fetching %s', url)
  data = urlfetch.fetch(url, validate_certificate=False, deadline=10).content
  logging.info('retrieved %d bytes', len(data))
  return UnzipData(data, r'.*\.[kx]ml')


def CreateHotspotElement(spec):
  """Creates a KML hotSpot element according to the given specification.

  The specification is a string, and can be of the following form:
    xval,yval: x and y are floats, and are pixel locations.
    Some combination of 'lrtb' (left, right, top, bottom) - e.g 'tl' makes the
    hotspot the top left corner. 'b' makes it the center bottom.

  Args:
    spec: A string specification.
  Returns:
    An xml Element with the hot spot definition.
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


class Template(string.Template):
  idpattern = r'[\w.][\w.@]*'


class Kmlifier(object):
  """A converter for CSV and XML to KML."""

  def __init__(self, name_template, description_template, location_fields,
               id_template, icon_url_template=None,
               color_template=None, hotspot_template=None,
               join_field=None, join_data=None, conditions=None):
    """Sets up a record extractor and KML emitter.

    Args:
      name_template: A string template, in string.Template format, for the name
          to appear in each placemark's <name> element.  Each placeholder is
          replaced with the contents of the corresponding field in the record.
      description_template: A string template, in Python's string.Template
          format, for the HTML description to appear in each placemark's bubble.
          Each placeholder is replaced with the contents of the corresponding
          field within the record.  Field values are HTML-escaped by default.
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
      self.join_records = dict((record[join_field], record)
                               for record in self.RecordsFromCsv(join_data))

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
      self.fields.update(map(str, field.split(',')))
    # TODO(arb): add a test for this - have a join column, don't mention it
    # anywhere else in the URL.
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

  def RecordsFromCsv(self, csv_data, encoding='utf-8'):
    """Extracts records from a string of CSV data.

    The first line of text is expected to give the field names.

    Args:
      csv_data: The CSV data, as a string.
      encoding: The string encoding of the data.
    Returns:
      The records, as a list of dictionaries.
    """
    return [NormalizeRecord(DecodeRecord(record, encoding))
            for record in csv.DictReader(StringIO.StringIO(csv_data))]

  def RecordsFromXml(self, xml_data, record_tag=None, xml_wrapper_tag=None):
    """Extracts records from a string of XML data.

    Fields are sought as XML tags or attributes within each record element.
    For example, if record_tag is "foo", then each <foo> element becomes a
    record.  The field named "bar" will get the contents of the <bar> element
    found anywhere within the <foo> element.  The field named "bar.z" will get
    the contents of the <bar> element whose "id" or "name" attribute is "z".
    The field named "x@y" get the value of the "y" attribute on the <x> element.

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
    records = []
    if xml_wrapper_tag:
      root = ParseXml(xml_data)
      xml_data = ''.join(element.text for element in root.getiterator()
                         if element.tag.split('}')[-1] == xml_wrapper_tag)

    root = ParseXml(xml_data)
    global_record = {}
    for element in root.getiterator():
      if element.tag.split('}')[-1] == record_tag:
        record = {}
        for child in element.getiterator():
          name = child.tag.split('}')[-1]
          if name in self.fields:
            record[name] = GetText(child)
          for attr in child.keys():
            field = name + '@' + attr
            if field in self.fields:
              record[field] = child.get(attr) or ''
            if attr == 'name' or attr == 'id':
              field = name + '.' + child.get(attr).strip()
              if field in self.fields:
                record[field] = GetText(child)
        records.append(record)
      else:
        name = '.' + element.tag.split('}')[-1]
        if name in self.fields:
          global_record[name] = GetText(element)
        for attr in element.keys():
          field = name + '@' + attr
          if field in self.fields:
            global_record[field] = element.get(attr) or ''
          if attr == 'name' or attr == 'id':
            field = name + '.' + element.get(attr).strip()
            if field in self.fields:
              global_record[field] = GetText(element)
    for record in records:
      result = global_record.copy()
      result.update(record)
      record.update(result)
    return records

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
      # Join with the join_data, if any.
      if self.join_field:
        join_record = self.join_records.get(record[self.join_field])
        if join_record:
          record.update(join_record)

      # Substitute raw values into templates.
      values = dict((key, '') for key in self.fields)
      values.update(record)
      name = self.name_template.substitute(**values)
      id_value = self.id_template.substitute(**values)
      icon_url = self.icon_url_template.substitute(**values)
      color = self.color_template.substitute(**values)
      hotspot = self.hotspot_template.substitute(**values)

      # Substitute HTML-escaped values into the description template.
      values.update(dict(('_' + key, '') for key in self.fields))
      values.update(dict(('__' + key, '') for key in self.fields))
      values.update(dict(('_' + key, record[key]) for key in record))
      values.update(dict(('__' + key, UrlQuote(record[key])) for key in record))
      values.update(dict((key, HtmlEscape(record[key])) for key in record))
      description = self.description_template.substitute(**values)

      # Find the latitude and longitude values.
      lats, lons = [], []
      for field in self.location_fields:
        try:
          if ',' in field:
            [lat, lon] = map(record.get, field.split(',')[:2])
          elif field.startswith('^'):
            lon, lat = record[field[1:]].replace(',', ' ').split()[:2]
          else:
            lat, lon = record[field].replace(',', ' ').split()[:2]
          lats.append(float(lat))
          lons.append(float(lon))
        except (KeyError, ValueError, TypeError):
          continue  # skip records that don't have geolocations

      # Add a placemark.
      if lats and lons:
        coordinates = '%.6f,%.6f,0' % (sum(lons)/len(lons), sum(lats)/len(lats))
        key = (icon_url, color, hotspot)
        if key not in style_ids:
          style_ids[key] = 'style%d' % (len(style_ids) + 1)
        placemarks.append(
            xml('Placemark',
                id_value and {'id': id_value} or None,
                xml('name', name),
                xml('description', description),
                xml('Point', xml('coordinates', coordinates)),
                xml('styleUrl', '#' + style_ids[key])))

    styles = [xml('Style', {'id': style_id},
                  xml('IconStyle',
                      xml('color', color),
                      xml('Icon', xml('href', icon_url)),
                      CreateHotspotElement(hotspot)))
              for ((icon_url, color, hotspot), style_id) in style_ids.items()]
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
      data = FetchData(url)

      join_field = join_data = None
      if join:
        join_field, join_url = join.split(',', 1)
        join_data = FetchData(join_url)

      # Perform the conversion.
      kmlifier = Kmlifier(name_template, description_template, location_fields,
                          id_template, icon_url_template, color_template,
                          hotspot_template, join_field, join_data, conditions)
      if data_type == 'xml':
        records = kmlifier.RecordsFromXml(data, record_tag, xml_wrapper_tag)
      elif data_type == 'csv':
        records = kmlifier.RecordsFromCsv(data)
      else:
        raise ValueError('type should be "xml" or "csv", not %r' % data_type)
      logging.info('extracted %d records', len(records))
      records = kmlifier.FilterRecords(records)
      logging.info('conditions were met by %d records', len(records))
      records = records[skip:skip + limit]
      document = kmlifier.RecordsToKmlDocument(records)
    except Exception, e:  # pylint:disable=broad-except
      # Even if conversion fails, always cache something.  We don't want an
      # error to trigger a spike of urlfetch requests to the remote server.
      document = xml_utils.Xml('Document',
                               xml_utils.Xml('name', 'Conversion failed: ', e))
      logging.exception(e)
    kmz = MakeKmz(KML_DOCUMENT_TEMPLATE % xml_utils.Serialize(document))
    memcache.set(cache_key, kmz, self.TTL_SECONDS)
    self.RespondWithKmz(kmz)

  def RespondWithKmz(self, kmz):
    self.response.headers['Content-Type'] = KMZ_CONTENT_TYPE
    self.response.headers['Cache-Control'] = (
        'public, max-age=%s, must-revalidate' % self.TTL_SECONDS)
    self.response.out.write(kmz)



