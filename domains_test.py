#!/usr/bin/python
# Copyright 2013 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Tests for domains.py."""

__author__ = 'rew@google.com (Becky Willrich)'

import cache
import domains
import logs
import perms
import test_utils


class DomainTest(test_utils.BaseTest):
  """Tests for the domain model."""

  def assertDomain(self, name, default_label, has_sticky_catalog_entries,
                   initial_domain_role):
    expected = dict(name=name, default_label=default_label,
                    has_sticky_catalog_entries=has_sticky_catalog_entries,
                    initial_domain_role=initial_domain_role)
    self.assertAttrs(domains.Domain.Get(name), **expected)
    cache.Reset()  # ensure it's correct in the datastore, not just the cache
    self.assertAttrs(domains.Domain.Get(name), **expected)

  def testCreate(self):
    # First one to create a domain gets to own it; no permissions needed.
    self.assertIsNone(domains.Domain.Get('MyDomain.com'))
    self.CaptureLog()
    domain = domains.Domain.Put('MyDomain.com')
    self.assertLog(logs.Event.DOMAIN_CREATED, domain_name='mydomain.com')

    # The name should be normalized and properties should have their default
    # values, both in the returned object and when refetched.
    self.assertAttrs(domain, name='mydomain.com', default_label='empty',
                     has_sticky_catalog_entries=False,
                     initial_domain_role=perms.Role.MAP_VIEWER)
    self.assertDomain('mydomain.com', 'empty', False, perms.Role.MAP_VIEWER)

  def testModify(self):
    # Overwriting a domain should require DOMAIN_ADMIN access.
    self.assertTrue(domains.Domain.Get('xyz.com'))
    self.assertRaises(perms.AuthorizationError, domains.Domain.Put, 'xyz.com')

    # After Put(), the domain should come back with the new values.
    perms.Grant('manager', perms.Role.DOMAIN_ADMIN, 'xyz.com')
    with test_utils.Login('manager'):
      domains.Domain.Put('xyz.com', default_label='fancy-map',
                         has_sticky_catalog_entries=True,
                         initial_domain_role=perms.Role.MAP_EDITOR)
    self.assertDomain('xyz.com', 'fancy-map', True, perms.Role.MAP_EDITOR)
    # TODO(kpy): Check that DOMAIN_CREATED is not logged in this case.

    # Specifying just one property should leave the rest unchanged.
    with test_utils.Login('manager'):
      domains.Domain.Put('xyz.com', default_label='another-map')
    self.assertDomain('xyz.com', 'another-map', True, perms.Role.MAP_EDITOR)


if __name__ == '__main__':
  test_utils.main()
