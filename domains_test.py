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
import config
import domains
import logs
import perms
import test_utils


class DomainTest(test_utils.BaseTest):
  """Tests for the domain model."""

  def RemoveDefaultDomain(self):
    default_model = domains.DomainModel.get_by_key_name(
        config.Get('default_domain'))
    default_model.delete()

  def testInitialDomainRole(self):
    domain = domains.Domain.Get('nosuchdomain.com')
    self.assertIsNone(domain)
    domain = domains.Domain.Get('xyz.com')
    self.assertEquals(
        perms.Role.MAP_VIEWER, domain.initial_domain_role)
    domain.initial_domain_role = perms.Role.MAP_EDITOR
    with test_utils.RootLogin():
      domain.Put()
    self.assertEquals(perms.Role.MAP_EDITOR,
                      domains.Domain.Get('xyz.com').initial_domain_role)

  def testDomainCreation(self):
    self.assertIsNone(domains.Domain.Get('MyDomain.com'))
    self.CaptureLog()
    domain = domains.Domain.Create('MyDomain.com')
    self.assertLog(logs.Event.DOMAIN_CREATED, domain_name='mydomain.com')

    # domain name should have been normalized
    self.assertEqual('mydomain.com', domain.name)
    domain.initial_domain_role = perms.Role.MAP_CREATOR
    with test_utils.RootLogin():
      domain.Put()

    # domains found in the cache should return new instances, but
    # with identical values
    other = domains.Domain.Get('MyDomain.com')
    self.assertTrue(other is not domain)
    self.assertEqual(perms.Role.MAP_CREATOR, other.initial_domain_role)

    # changes to a domain shouldn't be seen until Put() is called
    domain.default_label = 'fancy-map'
    other = domains.Domain.Get('MyDomain.com')
    self.assertNotEqual(domain.default_label, other.default_label)

    # After a put, the new label should be seen
    with test_utils.RootLogin():
      domain.Put()
    other = domains.Domain.Get('MyDomain.com')
    self.assertEqual(domain.default_label, other.default_label)

    # Verify the most recent values were written through to the datastore
    cache.Delete(['Domain', domain.name])
    other = domains.Domain.Get('MyDomain.com')
    self.assertEqual(domain.default_label, other.default_label)
    self.assertEqual(
        domain.initial_domain_role, other.initial_domain_role)

  def testNoneDomainRole_Create(self):
    domains.Domain.Create('foo.bar.org', initial_domain_role=None)
    domain_model = domains.DomainModel.get_by_key_name('foo.bar.org')
    self.assertEqual(domains.NO_ROLE, domain_model.initial_domain_role)
    cache.Delete(['Domain', 'foo.bar.org'])
    dom2 = domains.Domain.Get('foo.bar.org')
    self.assertIsNone(dom2.initial_domain_role)

  def testNoneDomainRole_Set(self):
    domain = domains.Domain.Create('blah.com')
    self.assertTrue(domain.initial_domain_role)
    domain.initial_domain_role = None
    with test_utils.RootLogin():
      domain.Put()
    domain_model = domains.DomainModel.get_by_key_name('blah.com')
    self.assertEqual(domains.NO_ROLE, domain_model.initial_domain_role)


if __name__ == '__main__':
  test_utils.main()
