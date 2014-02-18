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

from google.appengine.ext import ndb


class _MapReview(base_handler.BaseHandler):
  """Administration page for reviewing crowd reports on a map."""

  def GetUrl(self, **kwargs):
    for param in ['author', 'count', 'skip', 'topic']:
      kwargs[param] = kwargs.get(param, self.request.get(param, ''))
    return 'review?' + urllib.urlencode(
        [(k, v) for (k, v) in kwargs.iteritems() if v])

  def RenderReviewPage(self, map_object):
    """Renders the admin page."""
    map_id = map_object.key.name()
    perms.AssertAccess(perms.Role.MAP_REVIEWER, map_object)

    maproot = json.loads(map_object.GetCurrentJson())

    count = int(self.request.get('count') or 50)
    skip = int(self.request.get('skip') or 0)
    report_id = self.request.get('id')
    query = self.request.get('query')
    author = self.request.get('author')
    topic_id = self.request.get('topic')
    topic_ids = []
    report_dicts = []
    next_skip = 0

    if 'topics' in maproot:
      questions = {}
      answers = {}
      for topic in maproot['topics']:
        if 'questions' not in topic:
          continue
        topic_ids.append(topic['id'])
        tid = map_id + '.' + topic['id']
        for question in topic['questions']:
          question_id = tid + '.' + question['id']
          questions[question_id] = question['text']
          for answer in question['answers']:
            answer_id = question_id + '.' + answer['id']
            answers[answer_id] = answer['title']

      if report_id:
        reports = [x for x in [model.CrowdReport.Get(report_id)] if x]
      elif author:
        full_author = (author.startswith('http') and author or
                       self.request.root_url + '/.users/' + author)
        reports = model.CrowdReport.GetForAuthor(full_author, count + 1, skip)
      else:
        if topic_id and topic_id in topic_ids:
          tids = [map_id + '.' + topic_id]
        else:
          tids = ['%s.%s' % (map_id, topic_id) for topic_id in topic_ids]
        if query:
          # Restrict the search to topics for this map.
          # Note that the query itself can be arbitrarily complex, following
          # the syntax at
          # developers.google.com/appengine/docs/python/search/query_strings
          # We don't validate the query here, and an invalid query currently
          # will render an error page.
          restricted_query = query + ' topic_id:(%s)' % (
              ' OR '.join(['"%s"' % tid for tid in tids]))
          reports = model.CrowdReport.Search(restricted_query, count + 1, skip)
        else:
          reports = model.CrowdReport.GetForTopics(tids, count + 1, skip)

      report_dicts = [{
          'id': report.id,
          'url': '../%s?lat=%.5f&lng=%.5f&z=17' % (
              map_id, report.location.lat, report.location.lon),
          'author': report.author.split('/')[-1],
          'text': report.text,
          'location': '(%.3f, %.3f)' % (report.location.lat,
                                        report.location.lon),
          'updated': report.updated.strftime('%Y-%m-%dT%H:%M:%SZ'),
          'topics': ','.join([tid.split('.')[1] for tid in report.topic_ids]),
          'questions': '\n'.join(
              [questions.get(answer_id.rsplit('.', 1)[0], '') + ' ' +
               answers.get(answer_id, '')
               for answer_id in report.answer_ids])
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
        'reports': report_dicts,
        'topic_id': topic_id,
        'topic_ids': topic_ids,
        'id': report_id,
        'query': query,
        'author': author,
        'prev_url': prev_url,
        'next_url': next_url,
        'first': skip + 1,
        'last': skip + len(report_dicts),
        'skip': next_skip
    }))

  def HandlePost(self, map_object):
    """Handles a POST (delete)."""
    perms.AssertAccess(perms.Role.MAP_REVIEWER, map_object)
    if self.request.get('delete'):
      # pylint: disable=protected-access
      keys = [ndb.Key(model._CrowdReportModel, key_name)
              for key_name in self.request.get_all('report')]
      ndb.delete_multi(keys)
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
