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
import perms
import protect
import utils

from google.appengine.api import datastore_errors
from google.appengine.ext import ndb

# A vote code is a short identifier used in query parameters and in client-side
# JavaScript: 'u' for an upvote, 'd' for a downvote.  A vote type is a constant
# stored in the datastore; see model.VOTE_TYPES.  Client-side JS doesn't deal
# in vote types, only vote codes.
CODES_BY_VOTE_TYPE = {'ANONYMOUS_UP': 'u', 'ANONYMOUS_DOWN': 'd'}
VOTE_TYPES_BY_CODE = dict((v, k) for k, v in CODES_BY_VOTE_TYPE.items())


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
  """Endpoint for fetching and writing map definitions."""

  def Get(self, map_id, domain=''):  # pylint: disable=unused-argument
    """Returns the MapRoot JSON for the specified map."""
    if (self.auth and self.auth.map_read_permission and
        map_id in self.auth.map_ids):
      map_object = model.Map.Get(map_id, user=perms.ROOT)
    else:
      map_object = model.Map.Get(map_id)
    if not map_object:
      raise base_handler.ApiError(404, 'Map %s not found.' % map_id)
    self.WriteJson(map_object.map_root)

  def Post(self, map_id, domain=''):  # pylint: disable=unused-argument
    """Stores a new version of the MapRoot JSON for the specified map."""
    map_object = model.Map.Get(map_id)
    if not map_object:
      raise base_handler.ApiError(404, 'Map %s not found.' % map_id)
    map_object.PutNewVersion(self.GetRequestJson())
    self.response.set_status(201)


class PublishedMaps(base_handler.BaseHandler):
  """Unauthenticated endpoint for fetching the JSON of all published maps."""

  def Get(self, domain=''):  # pylint: disable=unused-argument
    root = self.request.root_path
    self.WriteJson([{'url': root + '/%s/%s' % (entry.domain, entry.label),
                     'map_root': entry.map_root}
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
      hidden: If non-empty, include reports that are hidden due to low scores.
      votes: If non-empty, include information on votes by the current user.

    Any report that is map-restricted will be omitted from the results unless
    the current user has permission to view the associated map.
    """
    ll = ParseGeoPt(self.request.get('ll'))
    topic_ids = self.request.get('topic_ids').split(',')
    count = ParseInt(self.request.get('count'), 100)
    max_updated = ParseDatetime(self.request.get('max_updated'))
    hidden = None if self.request.get('hidden') else False
    if ll:
      radii = [ParseFloat(r, 0) for r in self.request.get('radii').split(',')]
      topic_radii = dict(zip(topic_ids, radii))
      results = model.CrowdReport.GetByLocation(
          ll, topic_radii, count, max_updated, hidden=hidden)
    else:
      results = model.CrowdReport.GetWithoutLocation(
          topic_ids, count, max_updated, hidden=hidden)
    dicts = map(self.ReportToDict, results)
    if self.request.get('votes'):
      report_ids = [d['id'] for d in dicts]
      votes = model.CrowdVote.GetMulti(report_ids, self.GetCurrentUserUrl())
      for d in dicts:
        vote = votes.get(d['id'])
        d['vote'] = CODES_BY_VOTE_TYPE.get(vote and vote.vote_type)
    self.WriteJson(dicts)

  def Post(self):
    """Adds one or several crowd reports.

    If this is invoked as a form submission, we assume it's a single report
    from a user using the browser UI.  The user's login determines the author,
    and spam protection is in effect.  The accepted form parameters are:
      cm-ll: Optional latitude and longitude (two floats separated by a comma).
      cm-text: Text of the report.
      cm-topic-ids: Comma-separated list of topic IDs.
      cm-answers-json: JSON-encoded dictionary of {question IDs: answer values}.

    If this is invoked by posting application/json content, we assume it's an
    upload coming from another repository of reports.  In this case an API key
    is required, and the JSON content must be an array of report dictionaries.
    """
    report_dicts = self.GetRequestJson()
    if report_dicts:
      results = CrowdReportJsonPost(self.auth, report_dicts)
      self.WriteJson(map(self.ReportToDict, results))
    else:
      CrowdReportFormPost(self.GetCurrentUserUrl(), self.request)

  def ReportToDict(self, report):
    """Converts a model.CrowdReport to a dictionary for JSON serialization."""
    if type(report) is dict and 'error' in report:
      # Pass through dicts that we use to signal errors to the client.
      return report
    user = self.GetUserForUrl(report.author)
    return {
        'id': report.key.id(),
        'source': report.source,
        'author': report.author,
        'author_email': user and user.email,
        'effective': utils.UtcToTimestamp(report.effective),
        'updated': utils.UtcToTimestamp(report.updated),
        'published': utils.UtcToTimestamp(report.published),
        'text': report.text,
        'topic_ids': report.topic_ids,
        'answers': report.answers,
        'location': [report.location.lat, report.location.lon],
        'place_id': report.place_id,
        'upvote_count': report.upvote_count,
        'downvote_count': report.downvote_count
    }


def CrowdReportFormPost(author, request):
  """Handles a form submission of a crowd report from the browser UI."""
  # The form parameter names all start with "cm-" because our form protection
  # mechanism uses the DOM element IDs as parameter names, and we prefix our
  # element IDs with "cm-" to avoid collision.  See protect.py and xhr.js.
  if not protect.Verify(
      request, ['cm-topic-ids', 'cm-answers-json', 'cm-ll', 'cm-text']):
    raise base_handler.ApiError(403, 'Unauthorized crowd report.')

  topic_ids = request.get('cm-topic-ids', '').replace(',', ' ').split()
  try:
    answers = dict(json.loads(request.get('cm-answers-json') or '{}'))
  except (TypeError, ValueError):
    raise base_handler.ApiError(400, 'Invalid answers JSON.')
  ll = ParseGeoPt(request.get('cm-ll'))
  text = request.get('cm-text', '')
  now = datetime.datetime.utcnow()
  if ContainsSpam(text):
    # TODO(kpy): Consider applying a big downvote here instead of a 403.
    raise base_handler.ApiError(403, 'Crowd report text rejected as spam.')
  model.CrowdReport.Create(source=request.root_url, author=author,
                           effective=now, text=text, topic_ids=topic_ids,
                           answers=answers, location=ll)


def CrowdReportJsonPost(auth, report_dicts):
  """Handles a POST submission of crowd report JSON."""
  if not (auth and auth.crowd_report_write_permission):
    raise base_handler.ApiError(403, 'Not authorized to submit crowd reports.')

  now = utils.UtcToTimestamp(datetime.datetime.utcnow())
  return [DictToReport(report, auth, now, auth.crowd_report_spam_check)
          for report in report_dicts]


def DictToReport(report, auth, now, spam_check=True):
  """Converts one incoming dictionary to a CrowdReport or an error message."""
  report_id = report.get('id')
  if not report_id:
    return {'error': 'Required "id" field is missing.'}
  source = report.get('source', '')
  if source != auth.source:
    return {'id': report_id, 'error': 'Not authorized for source %r.' % source}
  if not report_id.startswith(source):
    return {'error': 'ID %r not valid for source %r.' % (report_id, source)}
  author = report.get('author', '')
  if not author.startswith(auth.author_prefix):
    return {'id': report_id, 'error': 'Not authorized for author %r.' % author}
  map_id = report.get('map_id', '')
  if map_id not in auth.map_ids:
    return {'id': report_id, 'error': 'Not authorized for map_id %r.' % map_id}
  topic_ids = report.get('topic_ids', [])
  if type(topic_ids) != list:
    return {'id': report_id, 'error': 'An array is required for topic_ids.'}
  answers = report.get('answers', {})
  if type(answers) != dict:
    return {'id': report_id, 'error': 'An object is required for answers.'}
  text = report.get('text', '')
  if not isinstance(text, basestring):
    return {'id': report_id, 'error': 'A string is required for text.'}
  if spam_check and ContainsSpam(text):
    return {'id': report_id, 'error': 'Text rejected as spam.'}
  place_id = report.get('place_id', '')
  if not isinstance(place_id, basestring):
    return {'id': report_id, 'error': 'A string is required for place_id.'}

  effective = utils.TimestampToUtc(report.get('effective', now))
  published = utils.TimestampToUtc(
      report.get('published', report.get('effective', now)))
  location = None
  if 'location' in report:
    try:
      location = ndb.GeoPt(*report['location'])
    except datastore_errors.BadValueError, e:
      return {'id': report_id, 'error': 'Invalid location: %s' % e}
  try:
    return model.CrowdReport.Create(
        id=report_id, source=source, author=author, effective=effective,
        published=published, text=text, topic_ids=topic_ids, answers=answers,
        location=location, place_id=place_id or None, map_id=map_id or None)
  except (TypeError, ValueError), e:
    return {'id': report_id, 'error': str(e)}


class CrowdVotes(base_handler.BaseHandler):
  """Endpoint for fetching and posting votes on crowd reports."""

  def Get(self):
    """Retrieves the current user's vote on a report.

    The query parameter report_id identifies the report.  The result is a
    JSON-encoded vote code: 'u' or 'd' or null, where null means that the user
    has no vote (either never voted, or voted and then removed their vote).
    """
    voter = self.GetCurrentUserUrl()
    report_id = self.request.get('report_id', '')
    vote = model.CrowdVote.Get(report_id, voter)
    self.WriteJson(CODES_BY_VOTE_TYPE.get(vote and vote.vote_type))

  def Post(self):
    """Stores a vote on a report, replacing any existing vote by this user.

    The query parameters are cm-report-id, which identifies the report, and
    cm-vote-code, which is a vote code: 'u' or 'd' or '', where '' causes any
    previously cast vote by this user on this report to be removed.
    """
    if not protect.Verify(
        self.request, ['cm-report-id', 'cm-vote-code']):
      raise base_handler.ApiError(403, 'Unauthorized crowd vote.')

    voter = self.GetCurrentUserUrl()
    report_id = self.request.get('cm-report-id', '')
    vote_type = VOTE_TYPES_BY_CODE.get(self.request.get('cm-vote-code'))
    model.CrowdVote.Put(report_id, voter, vote_type)
