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

"""Unit tests for config.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import config
import test_utils


class ConfigTests(test_utils.BaseTest):
  """Tests the configuration storage module."""

  def setUp(self):
    test_utils.BaseTest.setUp(self)
    config.Delete('root_path')  # clear this key from setUp
    config.Delete('default_domain')  # clear this key from setUp

  def testConfig(self):
    """Tests storage of simple and structured values in Config entities."""
    self.assertEquals(None, config.Get('k'))
    config.Set('k', 'value')
    self.assertEquals('value', config.Get('k'))
    config.Set('j', False)
    self.assertEquals({'k': 'value', 'j': False}, config.GetAll())
    config.Set('k', [3, 4, {'a': 'b'}, None])
    self.assertEquals([3, 4, {'a': 'b'}, None], config.Get('k'))
    config.Delete('k')
    self.assertEquals(None, config.Get('k'))
