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

"""Tests for jsonp.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import copy
import httplib

import base_handler
import jsonp
import test_utils


class JsonpTest(test_utils.BaseTest):
  def assertRaisesErrorWithStatus(self, expected_status, callable_obj, *args):
    """Asserts that jsonp.Error is raised with the given status code."""
    try:
      callable_obj(*args)
    except base_handler.Error, exception:
      self.assertEquals(expected_status, exception.status)
    else:
      self.fail('base_handler.Error not raised')

  def testSanitizeUrl(self):
    """Confirms that SanitizeUrl raises appropriate errors for unsafe URLs."""
    self.assertEquals('http://example.org/foo?a=b',
                      jsonp.SanitizeUrl('http://example.org/foo?a=b'))
    self.assertEquals('https://example.com:8080/bar?p=q',
                      jsonp.SanitizeUrl('https://example.com:8080/bar?p=q'))
    self.assertRaisesErrorWithStatus(
        httplib.BAD_REQUEST, jsonp.SanitizeUrl, 'ftp://example.net/foo')
    self.assertRaisesErrorWithStatus(
        httplib.BAD_REQUEST, jsonp.SanitizeUrl, 'example.us/foo')
    self.assertRaisesErrorWithStatus(
        httplib.BAD_REQUEST, jsonp.SanitizeUrl, 'http://localhost/foo')

  def testParseJson(self):
    """Confirms that ParseJson returns correct results and handles errors."""
    self.assertEquals({'a': 'b'}, jsonp.ParseJson('{"a": "b"}'))
    self.assertEquals(3, jsonp.ParseJson('3'))
    self.assertEquals(3, jsonp.ParseJson('foo(3)'))
    self.assertEquals(3, jsonp.ParseJson('foo(3) ;\n '))
    self.assertRaisesErrorWithStatus(
        httplib.FORBIDDEN, jsonp.ParseJson, 'x')
    self.assertRaisesErrorWithStatus(
        httplib.FORBIDDEN, jsonp.ParseJson, 'foo(3')

  def testLocalizeMapRoot(self):
    """Confirms that LocalizedMapRoot performs the correct transformations."""
    input_map_root = {
        'title': 'abc',
        'localized_map_roots': [
            {'language': 'fr', 'map_root': {'title': 'def'}},
            {'language': 'it', 'map_root': {'title': 'ghi'}}
        ],
        'layers': [{
            'title': 'lmn',
            'localized_layers': [
                {'language': 'fr', 'layer': {'title': 'opq'}},
                {'language': 'de', 'layer': {'title': 'rst'}}
            ],
            'sublayers': [{
                'title': 'uvw',
                'localized_layers': [
                    {'language': 'fr', 'layer': {'title': 'xyz'}},
                ],
            }]
        }]
    }
    map_root = copy.deepcopy(input_map_root)
    jsonp.LocalizeMapRoot(map_root, 'en')
    expected_map_root = {'title': 'abc', 'layers': [
        {'title': 'lmn', 'sublayers': [{'title': 'uvw'}]}
    ]}
    self.assertEquals(expected_map_root, map_root)

    map_root = copy.deepcopy(input_map_root)
    jsonp.LocalizeMapRoot(map_root, 'fr')
    expected_map_root = {'title': 'def', 'layers': [
        {'title': 'opq', 'sublayers': [{'title': 'xyz'}]}
    ]}
    self.assertEquals(expected_map_root, map_root)

    map_root = copy.deepcopy(input_map_root)
    jsonp.LocalizeMapRoot(map_root, 'it')
    expected_map_root = {'title': 'ghi', 'layers': [
        {'title': 'lmn', 'sublayers': [{'title': 'uvw'}]}
    ]}
    self.assertEquals(expected_map_root, map_root)

    map_root = copy.deepcopy(input_map_root)
    jsonp.LocalizeMapRoot(map_root, 'de')
    expected_map_root = {'title': 'abc', 'layers': [
        {'title': 'rst', 'sublayers': [{'title': 'uvw'}]}
    ]}
    self.assertEquals(expected_map_root, map_root)

if __name__ == '__main__':
  test_utils.main()
