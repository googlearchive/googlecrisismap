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

"""Handler for the map review page."""

__author__ = 'shakusa@google.com (Steve Hakusa)'

import json
import urllib

import base_handler
import config
import model
import perms

# Takes the color as a %-substitution
ICON_URL_TEMPLATE = ('https://chart.googleapis.com/chart?'
                     'chst=d_map_xpin_letter&chld=pin%%7C+%%7C%s%%7C000%%7CF00')


def HtmlEscape(text):
  return (text or '').replace(
      '&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


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

  # Query params used in GetUrl and also passed to map_review.js
  params = ['query', 'id', 'author', 'topic', 'hidden', 'reviewed',
            'count', 'skip']

  def GetUrl(self, **kwargs):
    for param in self.params:
      kwargs[param] = kwargs.get(param, self.request.get(param, ''))
    return 'review?' + urllib.urlencode(
        [(k, v) for (k, v) in kwargs.iteritems() if v])

  def RenderReviewPage(self, map_object):
    """Renders the admin page."""
    map_id = map_object.key.name()
    perms.AssertAccess(perms.Role.MAP_REVIEWER, map_object)

    maproot = json.loads(map_object.GetCurrentJson())

    def NoneIfTrueElseFalse(value):
      return None if value.lower() in ['true', 'yes', '1'] else False

    count = int(self.request.get('count') or 50)
    skip = int(self.request.get('skip') or 0)
    reviewed = NoneIfTrueElseFalse(self.request.get('reviewed'))
    hidden = self.request.get('hidden').lower() in ['true', 'yes', '1'] or None
    report_id = self.request.get('id')
    query = self.request.get('query')
    author = self.request.get('author') or None
    topic_id = self.request.get('topic')
    topic_ids = []
    report_dicts = []
    next_skip = 0

    if 'topics' in maproot:
      questions = {}
      answers = {}
      answer_colors = {}
      for topic in maproot['topics']:
        if 'questions' not in topic:
          continue
        topic_ids.append(topic['id'])
        tid = map_id + '.' + topic['id']
        for question in topic['questions']:
          question_id = tid + '.' + question['id']
          questions[question_id] = question.get('text')
          for answer in question['answers']:
            answer_id = question_id + '.' + answer['id']
            answers[answer_id] = answer.get('title')
            answer_colors[answer_id] = answer.get('color')

      if report_id:
        reports = [x for x in [model.CrowdReport.Get(report_id)] if x]
      else:
        if topic_id and topic_id in topic_ids:
          tids = [map_id + '.' + topic_id]
        else:
          tids = ['%s.%s' % (map_id, tid) for tid in topic_ids]
        if query:
          # Restrict the search to topics for this map.
          # Note that the query itself can be arbitrarily complex, following
          # the syntax at
          # developers.google.com/appengine/docs/python/search/query_strings
          # We don't validate the query here, and an invalid query currently
          # will render an error page.
          restricted_query = query + ' topic_id:(%s)' % (
              ' OR '.join(['"%s"' % tid for tid in tids]))
          if hidden is not None:
            restricted_query += ' hidden: %s' % hidden
          if reviewed is not None:
            restricted_query += ' reviewed: %s' % reviewed
          reports = model.CrowdReport.Search(restricted_query, count + 1, skip)
        else:
          if author and not author.startswith('http'):
            author = self.request.root_url + '/.users/' + author
          reports = model.CrowdReport.GetForTopics(tids, count + 1, skip,
                                                   author, hidden, reviewed)

      def MakeIconUrl(report):
        answer_id = report.answer_ids and report.answer_ids[0] or None
        return ICON_URL_TEMPLATE % (answer_colors.get(answer_id) or '#aaa')[1:]

      report_dicts = [{
          'id': report.id,
          'url': '../%s?lat=%.5f&lng=%.5f&z=17' % (
              map_id, report.location.lat, report.location.lon),
          'author': ((self.request.root_url + '/.users/') in report.author and
                     report.author.split('/')[-1] or report.author),
          'text_escaped': HtmlEscape(report.text),
          'location': '(%.3f, %.3f)' % (report.location.lat,
                                        report.location.lon),
          'lat': report.location.lat,
          'lng': report.location.lon,
          'icon_url': MakeIconUrl(report),
          'updated': report.updated.strftime('%Y-%m-%dT%H:%M:%SZ'),
          'topics': ','.join([tid.split('.')[1] for tid in report.topic_ids]),
          'answers_escaped': HtmlEscape('\n'.join(
              [questions.get(answer_id.rsplit('.', 1)[0], '') + ' ' +
               answers.get(answer_id, '')
               for answer_id in report.answer_ids])),
          'votes': '&#x2191;%d &#x2193;%d (%.1f) %s' % (
              report.upvote_count, report.downvote_count, report.score,
              report.hidden and '<b>hidden</b>' or ''),
          } for report in reports]

    if skip > 0:
      prev_url = self.GetUrl(skip=max(0, skip - count))
    else:
      prev_url = None

    if len(report_dicts) > count:
      report_dicts = report_dicts[:count]
      next_skip = skip + count
      next_url = self.GetUrl(skip=next_skip)
    else:
      next_url = None

    self.response.out.write(self.RenderTemplate('map_review.html', {
        'map': map_object,
        'params_json': json.dumps(self.params),
        'reports': report_dicts,
        'reports_json': json.dumps(report_dicts),
        'topic_id': topic_id,
        'topic_ids': topic_ids,
        'id': report_id,
        'query': query,
        'author': self.request.get('author'),
        'prev_url': prev_url,
        'next_url': next_url,
        'first': skip + 1,
        'last': skip + len(report_dicts),
        'skip': next_skip,
        'hidden': hidden and 'true' or '',
        'reviewed': reviewed is None and 'true' or '',
    }))

  def HandlePost(self, map_object):
    """Handles a POST (delete)."""
    perms.AssertAccess(perms.Role.MAP_REVIEWER, map_object)

    to_accept = self.request.get_all('accept')
    to_downvote = self.request.get_all('downvote')
    to_upvote = self.request.get_all('upvote')

    model.CrowdReport.MarkAsReviewed(to_accept + to_downvote + to_upvote)
    for report_id in to_downvote:
      model.CrowdVote.Put(report_id, self.GetCurrentUserUrl(), 'REVIEWER_DOWN')
    for report_id in to_upvote:
      model.CrowdVote.Put(report_id, self.GetCurrentUserUrl(), 'REVIEWER_UP')

    self.redirect(self.GetUrl())


class MapReviewByLabel(_MapReview):
  """A version of MapReview that expects a map label in the URL."""

  def GetMap(self, label, domain):
    domain = domain or config.Get('primary_domain') or ''
    entry = model.CatalogEntry.Get(domain, label)
    if not entry:
      raise base_handler.Error(404, 'Map %r not found.' % label)
    map_object = model.Map.Get(entry.map_id)
    if not map_object:
      raise base_handler.Error(404, 'Map %r not found.' % label)
    return map_object

  def Get(self, label, domain=None):
    self.RenderReviewPage(self.GetMap(label, domain))

  def Post(self, label, domain=None):
    self.HandlePost(self.GetMap(label, domain))


class MapReviewById(_MapReview):
  """A version of MapReview that expects a map_id in the URL."""

  def GetMap(self, map_id):
    map_object = model.Map.Get(map_id)
    if not map_object:
      raise base_handler.Error(404, 'Map %r not found.' % map_id)
    return map_object

  def Get(self, map_id, domain=None):
    self.RenderReviewPage(self.GetMap(map_id))

  def Post(self, map_id, domain=None):
    self.HandlePost(self.GetMap(map_id))
