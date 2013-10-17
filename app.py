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

"""The main WSGI application, which dispatches to all the handlers.

URL paths take one of these two forms:

    <root_path>[/<domain>]/<publication_label>
    <root_path>[/<domain>]/.<handler_name>[/<args>]

We want the entire app to work under any root path, which is determined by
the 'root_path' Config setting.  The domain part is optional; domains and
handler names are distinguishable because domains cannot begin with a dot.
The domain turns into a 'domain' argument to the handler; see BaseHandler.
"""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import re

import webapp2

import config
import utils


class RootPathRoute(webapp2.BaseRoute):
  """A Route that prepends a root path to its child routes."""

  def __init__(self, routes):
    webapp2.BaseRoute.__init__(self, None)
    self.router = webapp2.Router(routes)

  def match(self, request):  # pylint: disable=g-bad-name
    root_path = config.Get('root_path') or ''
    if request.path.startswith(root_path):
      return self.router.match(utils.Struct(
          get=request.get, path=request.path[len(root_path):]))


class OptionalDomainRoute(webapp2.BaseRoute):
  """A Route that accepts an optional domain name in the path or query string.

  The domain name can appear as the first component of the path, or as the
  "domain" query parameter, or not at all, e.g.:

      /.blah
      /example.com/.blah
      /.blah?domain=example.com
  """
  DOMAIN_PREFIX_RE = re.compile(r'^/([a-z0-9.-]+\.[a-z]+)(/.*)')

  def __init__(self, routes):
    webapp2.BaseRoute.__init__(self, None)
    self.router = webapp2.Router(routes)

  def match(self, request):  # pylint: disable=g-bad-name
    domain = request.get('domain', None)
    match = self.DOMAIN_PREFIX_RE.match(request.path)
    if match:
      domain = domain or match.group(1)  # query param overrides domain in path
      request = utils.Struct(get=request.get, path=match.group(2))
    result = self.router.match(request)
    if result and domain:
      result[2]['domain'] = domain  # add an extra 'domain' keyword argument
    return result


def Route(template, handler):
  """Make a Route whose placeholders accept only allowable map IDs or labels."""
  return webapp2.Route(template.replace('>', r':[\w-]+>'), handler)


app = webapp2.WSGIApplication([
    Route('/', 'index.Index'),
    RootPathRoute([
        OptionalDomainRoute([
            # User-facing request handlers
            Route('', 'index.Index'),
            Route('/', 'index.Index'),
            Route('/<label>', 'maps.MapByLabel'),

            Route('/.admin', 'admin.Admin'),
            Route('/.admin/<map_id>', 'admin.AdminMap'),
            Route('/.catalog', 'catalog.Catalog'),
            Route('/.create', 'create.Create'),
            Route('/.delete', 'delete.Delete'),
            Route('/.login', 'login.Login'),
            Route('/.maps', 'maps.MapList'),
            Route('/.maps/<map_id>', 'maps.MapById'),
            Route('/.prefs', 'prefs.Prefs'),
            Route('/.publish', 'publish.Publish'),
            Route('/.redirect/<label>', 'redirect.Redirect'),
            Route('/.wms/tiles/<tileset_id>/<z>/<x>/<y>.<fmt>',
                  'wmscache.tilecache_main.Tiles'),

            # XHR or JSONP request handlers
            Route('/.api/maps', 'api.PublishedMaps'),
            Route('/.api/maps/<map_id>', 'api.MapById'),
            Route('/.diff/<map_id>', 'diff.Diff'),
            Route('/.legend', 'legend_item_extractor.GetLegendItems'),
            Route('/.jsonp', 'jsonp.Jsonp'),
            Route('/.metadata', 'metadata.Metadata'),
            Route('/.rss2kml', 'rss2kml.Rss2Kml'),
            Route('/.share/<map_id>', 'share.Share'),
            Route('/.wms/configure',
                  'wmscache.tileset_config.ConfigureTileset'),
            Route('/.wms/query', 'wmscache.wms_query.WmsQuery'),

            # Tasks executed by cron or taskqueue
            Route('/.metadata_fetch', 'metadata_fetch.MetadataFetch'),
            Route('/.metadata_fetch_log_cleaner',
                  'metadata_fetch.MetadataFetchLogCleaner'),
            Route('/.wms/cleanup', 'wmscache.tileworker.CleanupOldWorkers'),
            Route('/.wms/tileworker', 'wmscache.tileworker.StartWorker'),
        ])
    ]),
])
