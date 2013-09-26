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

"""Tests for create.py."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import domains
import logs
import model
import perms
import test_utils


class CreateTest(test_utils.BaseTest):
  """Tests for create.py."""

  def testCreate(self):
    perms.Grant('creator', perms.Role.MAP_CREATOR, 'xyz.com')
    self.CaptureLog()
    with test_utils.Login('creator'):
      response = self.DoPost('/xyz.com/.create', 'xsrf_token=XSRF', 302)
      # Confirm that a map was created.
      location = response.headers['Location']
      map_object = model.Map.Get(location.split('/')[-1])
      self.assertTrue('Untitled' in map_object.GetCurrentJson())
      self.assertLog(logs.Event.MAP_CREATED, uid='creator',
                     map_id=map_object.id, domain_name='xyz.com')

  def testCreateWithoutPermission(self):
    # Without MAP_CREATOR, the user shouldn't be able to create a map.
    with test_utils.Login('noncreator'):
      self.DoPost('/xyz.com/.create', 'xsrf_token=XSRF', 403)

  def testDomainRole(self):
    # Start with initial_domain_role == None for our domain
    with test_utils.RootLogin():
      domain = domains.Domain.Get('xyz.com')
      domain.initial_domain_role = None
      domain.Put()
      perms.Grant('creator', perms.Role.MAP_CREATOR, 'xyz.com')

    with test_utils.Login('creator'):
      response = self.DoPost('/xyz.com/.create', 'xsrf_token=XSRF', 302)
      location = response.headers['Location']
      # initial_domain_role is unset so domain_role should be None.
      map_object = model.Map.Get(location.split('/')[-1])
      self.assertTrue(map_object is not None)
      # With no initial_domain_role set, domain_role should be None.
      self.assertEquals(['xyz.com'], map_object.domains)
      self.assertEquals(None, map_object.domain_role)

    # Now set the initial_domain_role for xyz.com.
    with test_utils.RootLogin():
      domain.initial_domain_role = perms.Role.MAP_EDITOR
      domain.Put()

    # Create another map.
    with test_utils.Login('creator'):
      response = self.DoPost('/.create?domain=xyz.com', 'xsrf_token=XSRF', 302)
      location = response.headers['Location']
      # Check the map; initial_domain_role is set so domain_role should be set.
      map_object = model.Map.Get(location.split('/')[-1])
      self.assertTrue(map_object is not None)
      self.assertEquals(['xyz.com'], map_object.domains)
      self.assertEquals(perms.Role.MAP_EDITOR, map_object.domain_role)


if __name__ == '__main__':
  test_utils.main()
