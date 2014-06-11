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

"""Handler for the map review page."""

__author__ = 'shakusa@google.com (Steve Hakusa)'

import json
import urllib

import base_handler
import config
import model
import perms

# Takes a hex color (rgb or rrggbb) as a %-substitution
_ICON_URL_TEMPLATE = ('https://chart.googleapis.com/chart?'
                      'chst=d_map_xpin_letter'
                      '&chld=pin%%7C+%%7C%s%%7C000%%7CF00')


def _MakeIconUrl(report, answer_colors):
  """Returns a URL to render an icon for the given report.

  Args:
    report: A model.CrowdReport.
    answer_colors: A dict; keys are (question_id, answer_id) pairs, values
        are hex color strings.

  Returns:
    A string, a URL for a marker icon colored by the first answer, if any.
  """
  color = report.answers and answer_colors.get(report.answers.items()[0])
  return _ICON_URL_TEMPLATE % (color or 'aaa').strip('#')


def _NoneIfTrueElseFalse(value):
  return None if value.lower() in {'true', 'yes', '1'} else False


def _NoneIfFalseElseTrue(value):
  return value.lower() in {'true', 'yes', '1'} or None


class _MapReview(base_handler.BaseHandler):
  """Administration page for reviewing crowd reports on a map.

    Supported query params:
      query: An optional string; used to filter crowd reports by keywords.
          May also contain structured search expressions as explained in
          model.CrowdReport.search.
      id: An optional string; If present, ignore other filter parameters
          and return the crowd report with the given identifier
      author: An optional string; if present, review only those crowd reports
          created on this map by the author with this id. If the author
          string is not a full URL, it is assumed to be a user ID or
          anonymous user token created via GetCurrentUserUrl
      topic: An optional string topic ID. If present, review only those crowd
          reports to belonging to the topic with this ID.
      hidden: An optional string; If 'true', 'yes', or '1', review only those
          crowd reports with hidden set to True, otherwise review both hidden
          and non-hidden reports.
      reviewed: An optional string; If 'true', 'yes', or '1', review crowd
          reports regardless of whether they have already been reviewed,
          otherwise, and by default, review only those crowd reports with
          reviewed = False.
      count: An optional integer; Return this many crowd reports to review.
          Defaults to 50.
      skip: An optional integer for paging. Skip this many crowd reports before
          returning count.
  """

  # Query params used in _GetUrl and also passed to map_review.js
  params = ['query', 'id', 'author', 'topic', 'hidden', 'reviewed',
            'count', 'skip']

  def _GetUrl(self, **kwargs):
    """Gets a URL for the review page with params set from self.request.

    Args:
      **kwargs: key, value pairs used to override params in self.request

    Returns:
      A URL for the review page with params set from self.request.
    """
    for param in self.params:
      kwargs[param] = kwargs.get(param, self.request.get(param, ''))
    return 'review?' + urllib.urlencode(
        [(k, v) for k, v in kwargs.iteritems() if v])

  def RenderReviewPage(self, map_object):
    """Renders the map review page.

    Args:
      map_object: The model.Map instance being reviewed.
    """
    perms.AssertAccess(perms.Role.MAP_REVIEWER, map_object)

    self.count = int(self.request.get('count') or 50)
    self.skip = int(self.request.get('skip') or 0)
    self.reviewed = _NoneIfTrueElseFalse(self.request.get('reviewed'))
    self.hidden = _NoneIfFalseElseTrue(self.request.get('hidden'))
    self.report_id = self.request.get('id', '').strip()
    self.query = self.request.get('query', '').strip()
    self.author = self.request.get('author', '').strip() or None
    self.topic_id = self.request.get('topic')

    prev_skip = max(0, self.skip - self.count)
    prev_url = self._GetUrl(skip=prev_skip) if self.skip else None
    next_skip = 0
    next_url = None

    map_id = map_object.key.name()
    map_root = map_object.map_root

    topic_ids = []
    report_dicts = []

    if 'topics' in map_root:
      topic_ids, report_dicts = self._ExtractTopicsAndReports(map_id, map_root)

    if len(report_dicts) > self.count:
      report_dicts = report_dicts[:self.count]
      next_skip = self.skip + self.count
      next_url = self._GetUrl(skip=next_skip)

    self._RenderTemplate(map_object, report_dicts, topic_ids,
                         prev_url, next_url, next_skip)

  def _RenderTemplate(self, map_object, report_dicts, topic_ids,
                      prev_url, next_url, next_skip):
    """Renders the map review template.

    Args:
      map_object: The model.Map instance being reviewed.
      report_dicts: An array of dicts representing reports to review.
      topic_ids: An array of topic IDs representing the map topics.
      prev_url: A string, the URL to review the previous page of reports.
      next_url: A string, the URL to review the next page of reports.
      next_skip: An int, the number of reports to skip when rendering next_url.
    """
    self.response.out.write(self.RenderTemplate('map_review.html', {
        'map': map_object,
        'params_json': json.dumps(self.params),
        'reports': report_dicts,
        'reports_json': json.dumps(report_dicts),
        'topic_id': self.topic_id,
        'topic_ids': topic_ids,
        'id': self.report_id,
        'query': self.query,
        'author': self.request.get('author'),
        'prev_url': prev_url,
        'next_url': next_url,
        'first': self.skip + 1,
        'last': self.skip + len(report_dicts),
        'skip': next_skip,
        'hidden': self.hidden and 'true' or '',
        'reviewed': self.reviewed is None and 'true' or '',
    }))

  def _ExtractTopicsAndReports(self, map_id, map_root):
    """Extracts topics from MapRoot and loads reports to review from datastore.

    Args:
      map_id: A string, the id of the map being reviewed.
      map_root: The MapRoot definition of the map being reviewed.

    Returns:
      A pair (topic_ids, reports) where topic_ids is a list of the map's topic
      IDs and reports is a list of dicts representing reports to review.
    """
    topic_ids = []
    question_types = {}
    question_titles = {}
    answer_colors = {}
    answer_labels = {}
    for topic in map_root['topics']:
      topic_ids.append(topic['id'])
      for question in topic.get('questions', []):
        question_id = '%s.%s.%s' % (map_id, topic['id'], question['id'])
        question_types[question_id] = question.get('type', '')
        question_titles[question_id] = title = question.get('title', '')
        for answer in question.get('answers', []):
          answer_labels[question_id, answer['id']] = (
              answer.get('label', '') or title + ': ' + answer.get('title', ''))
          answer_colors[question_id, answer['id']] = answer.get('color', '')

    def _DescribeAnswer((question_id, answer)):
      if question_types.get(question_id) == 'CHOICE':
        return answer_labels.get((question_id, answer))
      return '%s: %s' % (question_titles[question_id], answer)

    return topic_ids, [{
        'id': report.id,
        'url': '../%s?ll=%.5f,%.5f&z=17' % (
            map_id, report.location.lat, report.location.lon),
        'author': (('%s/.users/' % self.request.root_url) in report.author and
                   report.author.split('/')[-1] or report.author),
        'text': report.text,
        'location': '(%.3f, %.3f)' % (report.location.lat, report.location.lon),
        'lat': report.location.lat,
        'lon': report.location.lon,
        'icon_url': _MakeIconUrl(report, answer_colors),
        'updated': report.updated.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'topics': ','.join(tid.split('.')[1] for tid in report.topic_ids),
        'answers': ', '.join(
            map(_DescribeAnswer, json.loads(report.answers_json).items())),
        'hidden': report.hidden,
        'votes': u'\u2191%d \u2193%d (%.1f)' % (
            report.upvote_count or 0, report.downvote_count or 0,
            report.score or 0)
        } for report in self._QueryForReports(map_id, topic_ids)]

  def _QueryForReports(self, map_id, topic_ids):
    """Queries datastore for reports.

    Args:
      map_id: A string, the id of the map being reviewed.
      topic_ids: An array of topic IDs for which to restrict the query.

    Returns:
      A iterable of model.CrowdReport.
    """
    if self.report_id:
      report = model.CrowdReport.Get(self.report_id)
      return [report] if report else []
    else:
      if self.topic_id and self.topic_id in topic_ids:
        tids = ['%s.%s' % (map_id, self.topic_id)]
      else:
        tids = ['%s.%s' % (map_id, tid) for tid in topic_ids]
      if self.query:
        # Restrict the search to topics for this map.
        # Note that the query itself can be arbitrarily complex, following
        # the syntax at
        # developers.google.com/appengine/docs/python/search/query_strings
        # We don't validate the query here, and an invalid query currently
        # will render an error page.
        restricted_query = [
            self.query,
            'topic_id:(%s)' % (' OR '.join('"%s"' % tid for tid in tids))]
        if self.hidden is not None:
          restricted_query.append('hidden: %s' % self.hidden)
        if self.reviewed is not None:
          restricted_query.append('reviewed: %s' % self.reviewed)
        return model.CrowdReport.Search(' '.join(restricted_query),
                                        self.count + 1, self.skip)
      else:
        if self.author and not self.author.startswith('http'):
          author = '%s/.users/%s' % (self.request.root_url, self.author)
        else:
          author = self.author
        return model.CrowdReport.GetForTopics(tids, self.count + 1, self.skip,
                                              author, self.hidden,
                                              self.reviewed)

  def HandlePost(self, map_object):
    """Handles a POST.

    Possible user actions are marking the set of input reports reviewed,
    upvoted or downvoted.

    Upon success, the user is redirected to the review page.

    Args:
      map_object: The model.Map instance being reviewed.
    """
    perms.AssertAccess(perms.Role.MAP_REVIEWER, map_object)

    to_accept = self.request.get_all('accept')
    to_downvote = self.request.get_all('downvote')
    to_upvote = self.request.get_all('upvote')

    model.CrowdReport.MarkAsReviewed(to_accept + to_downvote + to_upvote)
    for report_id in to_downvote:
      model.CrowdVote.Put(report_id, self.GetCurrentUserUrl(), 'REVIEWER_DOWN')
    for report_id in to_upvote:
      model.CrowdVote.Put(report_id, self.GetCurrentUserUrl(), 'REVIEWER_UP')

    self.redirect(self._GetUrl())


class MapReviewByLabel(_MapReview):
  """A version of MapReview that expects a map label in the URL."""

  def _GetMap(self, label, domain):
    """Loads the model.Map instance being reviewed by label and domain.

    Args:
      label: A string, the published label for the map.
      domain: A string, the domain in which the map was created, eg gmail.com.

    Returns:
      The model.Map instance being reviewed

    Raises:
      base_handler.Error: If the map csnnot be found.
    """
    domain = domain or config.Get('primary_domain') or ''
    entry = model.CatalogEntry.Get(domain, label)
    if not entry:
      raise base_handler.Error(404, 'Map %r not found.' % label)
    map_object = model.Map.Get(entry.map_id)
    if not map_object:
      raise base_handler.Error(404, 'Map %r not found.' % label)
    return map_object

  def Get(self, label, domain=None):
    """Renders the map review page by domain and map label.

    Args:
      label: A string, the published label for the map.
      domain: A string, the domain in which the map was created, eg gmail.com.
    """
    self.RenderReviewPage(self._GetMap(label, domain))

  def Post(self, label, domain=None):
    """Updates report statuses for the map at the given domain and map label.

    Args:
      label: A string, the published label for the map.
      domain: A string, the domain in which the map was created, eg gmail.com.
    """
    self.HandlePost(self._GetMap(label, domain))


class MapReviewById(_MapReview):
  """A version of MapReview that expects a map_id in the URL."""

  def _GetMap(self, map_id):
    """Loads the model.Map instance being reviewed by ID.

    Args:
      map_id: A string, the id of the map being reviewed.

    Returns:
      The model.Map instance being reviewed

    Raises:
      base_handler.Error: If the map csnnot be found.
    """
    map_object = model.Map.Get(map_id)
    if not map_object:
      raise base_handler.Error(404, 'Map %r not found.' % map_id)
    return map_object

  def Get(self, map_id, domain=None):
    """Renders the map review page by map ID.

    Args:
      map_id: A string, the id of the map being reviewed.
      domain: A string, the domain in which the map was created, eg gmail.com.
    """
    self.RenderReviewPage(self._GetMap(map_id))

  def Post(self, map_id, domain=None):
    """Updates report statuses for the map at the given map ID.

    Args:
      map_id: A string, the id of the map being reviewed.
      domain: A string, the domain in which the map was created, eg gmail.com.
    """
    self.HandlePost(self._GetMap(map_id))
