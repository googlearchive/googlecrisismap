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

"""Handler to produce HTML diffs of formatted maproot JSON."""

__author__ = 'joeysilva@google.com (Joey Silva)'

import difflib
import json

import base_handler
import model


def ToNormalizedJson(data):
  """Formats JSON with indentation for readability, normalized for diffing."""
  return json.dumps(data, indent=2, sort_keys=True)


class Diff(base_handler.BaseHandler):
  """Handler to produce HTML diffs of formatted maproot JSON."""

  def Post(self, map_id):
    new_json = self.request.get('new_json')
    try:
      new_map_root = json.loads(new_json)
    except ValueError:
      raise base_handler.ApiError(400, 'Invalid or missing JSON data.')
    map_object = model.Map.Get(map_id)
    if not map_object:
      raise base_handler.ApiError(404, 'Map %s not found.' % map_id)

    from_maproot = ToNormalizedJson(map_object.map_root)
    to_maproot = ToNormalizedJson(new_map_root)
    html_diff = difflib.HtmlDiff(wrapcolumn=60)
    saved_diff = html_diff.make_file(
        from_maproot.splitlines(), to_maproot.splitlines(), context=True,
        fromdesc='Saved', todesc='Current')
    catalog_diffs = []
    for entry in model.CatalogEntry.GetByMapId(map_id):
      from_maproot = ToNormalizedJson(entry.map_root)
      catalog_diffs.append({
          'name': entry.domain + '/' + entry.label,
          'diff': html_diff.make_file(
              from_maproot.splitlines(), to_maproot.splitlines(),
              fromdesc=entry.domain + '/' + entry.label, todesc='Current',
              context=True)
      })
    self.WriteJson({'saved_diff': saved_diff, 'catalog_diffs': catalog_diffs})
