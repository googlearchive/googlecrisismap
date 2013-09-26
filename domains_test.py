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
import model
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
    test_utils.BecomeAdmin()
    domain = domains.Domain.Get('xyz.com')
    self.assertEquals(
        perms.Role.MAP_VIEWER, domain.initial_domain_role)
    domain.initial_domain_role = perms.Role.MAP_EDITOR
    domain.Put()
    self.assertEquals(perms.Role.MAP_EDITOR,
                      domains.Domain.Get('xyz.com').initial_domain_role)

  def testDomainCreation(self):
    test_utils.BecomeAdmin()
    self.assertIsNone(domains.Domain.Get('MyDomain.com'))
    domain = domains.Domain.Create('MyDomain.com')

    # domain name should have been normalized
    self.assertEqual('mydomain.com', domain.name)
    domain.initial_domain_role = perms.Role.MAP_CREATOR
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
    test_utils.BecomeAdmin()
    domains.Domain.Create('foo.bar.org', initial_domain_role=None)
    domain_model = domains.DomainModel.get_by_key_name('foo.bar.org')
    self.assertEqual(domains.NO_ROLE, domain_model.initial_domain_role)
    cache.Delete(['Domain', 'foo.bar.org'])
    dom2 = domains.Domain.Get('foo.bar.org')
    self.assertIsNone(dom2.initial_domain_role)

  def testNoneDomainRole_Set(self):
    test_utils.BecomeAdmin()
    domain = domains.Domain.Create('blah.com')
    self.assertTrue(domain.initial_domain_role)
    domain.initial_domain_role = None
    domain.Put()
    domain_model = domains.DomainModel.get_by_key_name('blah.com')
    self.assertEqual(domains.NO_ROLE, domain_model.initial_domain_role)

  def testSeedDomains(self):
    test_utils.BecomeAdmin()
    perms.Grant(
        'someone@somewhere.com', perms.Role.CATALOG_EDITOR, 'somewhere.com')
    perms.Grant('other@blah.com', perms.Role.DOMAIN_ADMIN, 'blah.com')
    # Ensure both gmail.com and google.com are created so we can test
    # their special properties
    perms.Grant('gmail.com', perms.Role.MAP_CREATOR, 'gmail.com')
    # CreateMapAsAdmin creates the map in domain 'xyz.com'
    mm, _ = test_utils.CreateMapAsAdmin()
    model.CatalogEntry.Create('dom.ain.gov', 'my_label', mm, is_listed=True)
    config.Set('default_label', 'google-rific-label')
    self.RemoveDefaultDomain()
    config.Delete('default_domain')

    self.assertEqual(0, len(list(domains.DomainModel.all())))
    domains.SeedDomains()
    self.assertEqual(0, len(list(domains.DomainModel.all())))
    domains.SeedDomains(True)
    all_domains = [domains.Domain(m) for m in domains.DomainModel.all()]
    all_domain_names = [d.name for d in all_domains]
    self.assertItemsEqual(
        ['somewhere.com', 'blah.com', 'gmail.com', 'google.com', 'xyz.com',
         'dom.ain.gov'], all_domain_names)
    for d in all_domains:
      if d.name == 'gmail.com':
        self.assertTrue(d.has_sticky_catalog_entries)
      else:
        self.assertFalse(d.has_sticky_catalog_entries)
      if d.name == 'google.com':
        self.assertEqual('google-rific-label', d.default_label)
      else:
        self.assertEqual('empty', d.default_label)
      self.assertEqual(perms.Role.MAP_VIEWER, d.initial_domain_role)


if __name__ == '__main__':
  test_utils.main()
