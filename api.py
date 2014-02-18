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

"""HTTP API endpoints for fetching and submitting maps and crowd reports."""

__author__ = 'lschumacher@google.com (Lee Schumacher)'

import datetime
import json

import base_handler
import config
import model
import utils

from google.appengine.ext import ndb


def ParseInt(string, default=None):
  try:
    return int(string)
  except ValueError:
    return default


def ParseFloat(string, default=None):
  try:
    return float(string)
  except ValueError:
    return default


def ParseGeoPt(string, default=None):
  lat_lon = string.split(',')
  if len(lat_lon) == 2:
    lat, lon = map(ParseFloat, lat_lon)
    if -90 <= lat <= 90 and -180 <= lon <= 180:
      return ndb.GeoPt(lat, lon)
  return default


def ParseDatetime(string, default=None):
  try:
    return datetime.datetime.utcfromtimestamp(float(string))
  except ValueError:
    return default


def ContainsSpam(text):
  """Checks text for words and phrases that are considered spam.

  Args:
    text: The text to be scanned.

  Returns:
    True if the text contains any of the words or phrases in the config setting
    'crowd_report_spam_phrases', which should be a list of strings.  Whitespace
    is normalized and case is ignored for comparison.
  """
  lowercase_text = ' '.join(text.lower().split())
  for spam_phrase in config.Get('crowd_report_spam_phrases', []):
    lowercase_spam = ' '.join(spam_phrase.lower().split())
    if lowercase_spam in lowercase_text:
      return True


class MapById(base_handler.BaseHandler):
  """An HTTP API for fetching and saving map definitions."""

  def Get(self, map_id, domain=''):  # pylint: disable=unused-argument
    """Returns the MapRoot JSON for the specified map."""
    map_object = model.Map.Get(map_id)
    if map_object:
      self.WriteJson({
          'json': json.loads(map_object.GetCurrentJson() or 'null')
      })
    else:
      self.error(404)
      self.response.out.write('Map %s not found' % map_id)

  def Post(self, map_id, domain=''):  # pylint: disable=unused-argument
    """Stores a new version of the MapRoot JSON for the specified map."""
    map_object = model.Map.Get(map_id)
    if map_object:
      map_object.PutNewVersion(self.request.get('json'))
      self.response.set_status(201)
    else:
      self.error(404)
      self.response.out.write('Map %s not found' % map_id)


class PublishedMaps(base_handler.BaseHandler):
  """Handler for fetching the JSON of all published maps."""

  def Get(self, domain=''):  # pylint: disable=unused-argument
    root = self.request.root_path
    self.WriteJson([{'url': root + '/%s/%s' % (entry.domain, entry.label),
                     'maproot': json.loads(entry.maproot_json)}
                    for entry in model.CatalogEntry.GetAll()])


class CrowdReports(base_handler.BaseHandler):
  """Endpoint for fetching and submitting crowd reports."""

  def Get(self):
    """Fetches reports by topic and location.

    The accepted query parameters are:
      ll: Optional latitude and longitude (two floats separated by a comma).
      topic_ids: Comma-separated list of topic IDs.
      radii: Comma-separated list of lengths in meters, with the same
          cardinality as topic_ids (one radius corresponding to each topic ID).
      count: Optional maximum number of results (default 100).
      max_updated: Optional upper bound on report update time in epoch seconds.
    """
    ll = ParseGeoPt(self.request.get('ll'))
    topic_ids = self.request.get('topic_ids').split(',')
    count = ParseInt(self.request.get('count'), 100)
    max_updated = ParseDatetime(self.request.get('max_updated'))
    if ll:
      radii = [ParseFloat(r, 0) for r in self.request.get('radii').split(',')]
      topic_radii = dict(zip(topic_ids, radii))
      results = model.CrowdReport.GetByLocation(
          ll, topic_radii, count, max_updated)
    else:
      results = model.CrowdReport.GetWithoutLocation(
          topic_ids, count, max_updated)
    self.WriteJson(map(self.ReportToDict, results))

  def Post(self):
    """Adds a crowd report.

    The accepted form parameters are:
      author: URL identifying the author of the report.
      topic_ids: Comma-separated list of topic IDs.
      answer_ids: Comma-separated list of answer IDs.
      ll: Optional latitude and longitude (two floats separated by a comma).
      text: Text of the report.
    """
    author = self.GetCurrentUserUrl()
    topic_ids = self.request.get('topic_ids', '').split(',')
    answer_ids = self.request.get('answer_ids', '').split(',')
    topic_ids = [i.strip() for i in topic_ids if i.strip()]
    answer_ids = [i.strip() for i in answer_ids if i.strip()]
    ll = ParseGeoPt(self.request.get('ll'))
    text = self.request.get('text', '')
    now = datetime.datetime.utcnow()
    if ContainsSpam(text):
      raise base_handler.Error(403, 'Crowd report text rejected as spam.')
    model.CrowdReport.Create(source=self.request.root_url, author=author,
                             effective=now, text=text, topic_ids=topic_ids,
                             answer_ids=answer_ids, location=ll)

  def ReportToDict(self, report):
    """Converts a model.CrowdReport to a dictionary for JSON serialization."""
    user = self.GetUserForUrl(report.author)
    return {
        'id': report.key.id(),
        'author': report.author,
        'author_email': user and user.email,
        'effective': utils.UtcToTimestamp(report.effective),
        'updated': utils.UtcToTimestamp(report.updated),
        'published': utils.UtcToTimestamp(report.published),
        'text': report.text,
        'topic_ids': report.topic_ids,
        'answer_ids': report.answer_ids,
        'location': [report.location.lat, report.location.lon]
    }
