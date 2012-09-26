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

"""Short URL endpoint. Forwards requests to the URL shortening service."""

__author__ = 'arb@google.com (Anthony Baxter)'

import logging
import sys
import urllib2
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

SHORTENER_URL = 'https://www.googleapis.com/urlshortener/v1/url'


class ShortenUrlHandler(webapp.RequestHandler):
  def post(self):  # pylint: disable-msg=C6409
    try:
      req = urllib2.Request(SHORTENER_URL, self.request.body,
                            {'Content-type': 'application/json'})
      fp = urllib2.urlopen(req)
    except urllib2.HTTPError:
      _, v, _ = sys.exc_info()
      logging.error('error %s from URL shortening service: %s',
                    v.code, v.fp.read())
    else:
      self.response.out.write(fp.read())

application = webapp.WSGIApplication([
    ('/crisismap/shorturl', ShortenUrlHandler),
], debug=True)


def main():
  run_wsgi_app(application)


if __name__ == '__main__':
  main()
