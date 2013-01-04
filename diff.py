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

"""Handler to produce HTML diffs of formatted maproot JSON."""

__author__ = 'joeysilva@google.com (Joey Silva)'

import difflib
import simplejson as json

from base_handler import BaseHandler
import jsonp
import model

from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


class Diff(BaseHandler):
  """Handler to produce HTML diffs of formatted maproot JSON."""

  # "post" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def post(self, map_id):
    new_json = self.request.get('new_json')
    map_object = model.Map.Get(map_id)
    if new_json is None:
      self.error(400)
      self.response.out.write('No JSON provided.')
    elif not map_object:
      self.error(404)
      self.response.out.write('Map %r not found.' % map_id)
    else:

      class JSONFloatEncoder(json.encoder.JSONEncoder):
        """JSON encoder which uses str() instead of repr() for floats."""
        FLOAT_REPR = str

      from_maproot = json.dumps(
          json.loads(map_object.GetCurrentJson()),
          cls=JSONFloatEncoder, indent=2)
      to_maproot = json.dumps(json.loads(new_json),
                              cls=JSONFloatEncoder, indent=2)
      html_diff = difflib.HtmlDiff(wrapcolumn=60)
      saved_diff = html_diff.make_file(
          from_maproot.splitlines(), to_maproot.splitlines(), context=True,
          fromdesc='Saved', todesc='Current')
      catalog_diffs = []
      for entry in model.CatalogEntry.GetByMapId(map_id):
        from_maproot = json.dumps(json.loads(entry.maproot_json),
                                  cls=JSONFloatEncoder, indent=2)
        catalog_diffs.append({
            'name': entry.domain + '/' + entry.label,
            'diff': html_diff.make_file(
                from_maproot.splitlines(), to_maproot.splitlines(),
                fromdesc=entry.domain + '/' + entry.label, todesc='Current',
                context=True)
        })

      self.response.out.write(jsonp.ToHtmlSafeJson(
          {'saved_diff': saved_diff, 'catalog_diffs': catalog_diffs}))


def main():
  run_wsgi_app(webapp.WSGIApplication([
      (r'/crisismap/diff/([\w]+)', Diff)]))


if __name__ == '__main__':
  main()
