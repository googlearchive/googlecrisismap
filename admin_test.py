# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Tests for admin.py."""

__author__ = 'rew@google.com (Becky Willrich)'


import urllib

import admin
import perms
import test_utils


class AdminTest(test_utils.BaseTest):
  """Tests for the admin.py request handler."""

  def setUp(self):
    super(AdminTest, self).setUp()
    perms.SetDomainRoles('xyz.com', 'xyz.com', [perms.Role.MAP_CREATOR])
    perms.SetDomainRoles(
        'admin@xyz.com', 'xyz.com',
        [perms.Role.CATALOG_EDITOR, perms.Role.DOMAIN_ADMIN])
    perms.SetDomainRoles(
        'catalog@xyz.com', 'xyz.com', [perms.Role.CATALOG_EDITOR])
    perms.SetDomainRoles(
        'outsider@not-xyz.com', 'xyz.com', [perms.Role.MAP_CREATOR])

  def testGet_WithPermissions(self):
    test_utils.SetUser('admin@xyz.com')
    handler = test_utils.SetupHandler(
        '/crisismap/xyz.com/.admin', admin.Admin())
    handler.get('xyz.com')
    self.assertEqual(200, handler.response.status_int)
    result = handler.response.body
    # All users with any kind of permissions should be present
    self.assertTrue('admin@xyz.com' in result)
    self.assertTrue('catalog@xyz.com' in result, result)
    self.assertTrue('outsider@not-xyz.com' in result)

  def testGet_NoPermissions(self):
    # xyz.com does not grant administrative permissions to the entire
    # domain, so this should produce a permissions failure
    test_utils.SetUser('nobody@xyz.com')
    handler = test_utils.SetupHandler(
        '/crisismap/xyz.com/.admin', admin.Admin())
    self.assertRaises(perms.AuthorizationError, handler.get, 'xyz.com')

  def testPost(self):
    # Give catalog@ domain admin; revoke perms for outsider@; create
    # a new administrative user admin2@
    post_data = urllib.urlencode([
        ('catalog@xyz.com.DOMAIN_ADMIN', 'on'),
        ('catalog@xyz.com.CATALOG_EDITOR', 'on'),
        ('new_email', 'admin2@xyz.com'),
        ('new_email.DOMAIN_ADMIN', 'True'),
        ('new_email.MAP_CREATOR', 'True'),
        ('new_email.CATALOG_EDITOR', 'True')
        ])
    test_utils.BecomeAdmin()
    handler = test_utils.SetupHandler('/crisismap/xyz.com/.admin',
                                      admin.Admin(), post_data)
    handler.post('xyz.com')
    response = handler.response
    # Should redirect back to the admin page
    self.assertTrue(300 <= response.status_int < 400)
    self.assertTrue(
        '/crisismap/xyz.com/.admin' in response.headers['Location'])

    self.assertItemsEqual([perms.Role.DOMAIN_ADMIN, perms.Role.CATALOG_EDITOR],
                          perms.GetDomainRoles('catalog@xyz.com', 'xyz.com'))
    self.assertFalse(perms.GetDomainRoles('outsider@not-xyz.com', 'xyz.com'))
    self.assertItemsEqual(
        [perms.Role.DOMAIN_ADMIN, perms.Role.MAP_CREATOR,
         perms.Role.CATALOG_EDITOR],
        perms.GetDomainRoles('admin2@xyz.com', 'xyz.com'))

  def testValidateEmail(self):
    self.assertTrue(admin.ValidateEmail('user@domain.subdomain.com'))
    self.assertTrue(admin.ValidateEmail('a@b.c'))
    self.assertFalse(admin.ValidateEmail('a@b@c'))
    self.assertFalse(admin.ValidateEmail('@domain.com'))
    self.assertFalse(admin.ValidateEmail('domain.com'))
    self.assertFalse(admin.ValidateEmail('user'))
    self.assertFalse(admin.ValidateEmail('a@b'))
    self.assertFalse(admin.ValidateEmail('a@b.'))

  def testValidateDomain(self):
    self.assertTrue(admin.ValidateDomain('domain.org'))
    self.assertTrue(admin.ValidateDomain('domain.subdomain.org'))
    self.assertFalse(admin.ValidateDomain('domain'))
    self.assertFalse(admin.ValidateDomain('domain.'))
    self.assertFalse(admin.ValidateDomain('domain.subdomain.'))
    self.assertFalse(admin.ValidateDomain('domain..org'))
    self.assertFalse(admin.ValidateDomain('.domain.org'))


if __name__ == '__main__':
  test_utils.main()
