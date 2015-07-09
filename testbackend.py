#!/usr/bin/python
# Copyright 2014 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Sets up a handler for fake backends in functional testing."""

import base_handler
import utils
import webapp2


KML_MIME_TYPE = 'application/vnd.google-earth.kml+xml'


class TestBackend(base_handler.BaseHandler):
  """Sets up a handler for fake backends in functional testing."""

  def Post(self):
    _CheckIsDevServer()
    service_name = self.request.get('service', '')
    if service_name == 'urlshortener':
      self.response.out.write('{"id": "http://goo.gl/fakeShortUrl"}')
      return
    else:
      raise base_handler.Error(400,
                               'Unsupported test backend [%s]' % service_name)

  def Get(self):
    _CheckIsDevServer()
    service_name = self.request.get('service', '')
    if service_name == 'file':
      # Fetch a static file and return it as an attachment in the response
      file_name = self.request.get('filename', '')
      if file_name[-4:] == '.kml':
        file_content = utils.ReadStaticFile(file_name)
        self.response.headers['Content-Type'] = KML_MIME_TYPE
        self.response.headers.add_header(
            'content-disposition', 'attachment', filename=str(file_name))
        self.response.out.write(file_content)
        return
      else:
        raise base_handler.Error(
            400, 'Unsupported file type %s' % file_name[-4:])
    else:
      raise base_handler.Error(
          400, 'Unsupported test backend [%s]' % service_name)


def _CheckIsDevServer():
  if not utils.IsDevelopmentServer():
    raise base_handler.Error(500, 'testbackend is only accessible in DEV')


app = webapp2.WSGIApplication([('.*', TestBackend)])

