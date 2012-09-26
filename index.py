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

"""Redirector from '/' or '/crisismap' to the appropriate map page."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import urllib

import model

from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


def GetDestination(request):
  """Based on the request, determines the map URL to redirect to."""

  # For backward compatibility, support the id= and crisis= parameters.
  label = (request.get('id') or request.get('crisis') or
           model.Config.Get('default_label') or 'empty')
  url = request.host_url + '/crisismap/' + label

  # Preserve all the query parameters except those that set the label.
  params = dict((key, value) for (key, value) in request.GET.items()
                if key not in ['id', 'crisis'])
  return url + (params and '?' + urllib.urlencode(params) or '')


class Index(webapp.RequestHandler):
  """Redirector from '/' or '/crisismap' to the appropriate map page."""

  # "get" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def get(self):
    self.redirect(GetDestination(self.request))


def main():
  run_wsgi_app(webapp.WSGIApplication([('.*', Index)]))

if __name__ == '__main__':
  main()
