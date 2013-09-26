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

import time
import urllib

import admin
import domains
import model
import perms
import test_utils
import utils


def AdminUrl(domain):
  return '/%s/.admin' % domain


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

  def DoCreateDomainPost(self, domain, status=302):
    post_data = urllib.urlencode([('form', 'create-domain')])
    return self.DoPost(AdminUrl(domain), post_data, status=status)

  def DoUserPermissionsPost(self, domain, new_perms, status=302):
    post_data = [('form', 'user-permissions')]
    for user, roles in new_perms.iteritems():
      for role in roles:
        post_data.append(('%s.%s' % (user, role), 'on'))
    return self.DoPost(
        AdminUrl(domain), urllib.urlencode(post_data), status=status)

  def DoNewUserPost(self, domain, user, role_list, status=302):
    post_data = [('form', 'add-user'), ('new_email', user)]
    for role in role_list:
      post_data.append(('new_email.%s' % role, 'on'))
    return self.DoPost(
        AdminUrl(domain), urllib.urlencode(post_data), status=status)

  def DoDomainSettingsPost(
      self, domain, default_label, sticky_entries, initial_role, status=302):
    post_data = [('form', 'domain-settings'), ('default_label', default_label),
                 ('initial_domain_role', initial_role)]
    if sticky_entries:
      post_data.append('has_sticky_catalog_entries', 'on')
    return self.DoPost(
        AdminUrl(domain), urllib.urlencode(post_data), status=status)

  def testGeneralAdminGet(self):
    # Set a user so we don't end up at the login page
    test_utils.SetUser('joerandom@anywhere.com')
    self.DoGet('/.admin', status=403)
    test_utils.BecomeAdmin()
    self.DoGet('/.admin')

  def testGet_WithPermissions(self):
    test_utils.SetUser('admin@xyz.com')
    response = self.DoGet('/xyz.com/.admin')
    # All users with any kind of permissions should be present
    self.assertTrue('admin@xyz.com' in response.body)
    self.assertTrue('catalog@xyz.com' in response.body, response.body)
    self.assertTrue('outsider@not-xyz.com' in response.body)
    # Navigation bar should be present; cm-navbar is the class of the
    # navigation bar's <div>.
    self.assertTrue('cm-navbar' in response.body)

  def testGet_NoPermissions(self):
    # xyz.com does not grant administrative permissions to the entire
    # domain, so this should produce a permissions failure
    test_utils.SetUser('nobody@xyz.com')
    self.DoGet('/xyz.com/.admin', status=403)

  def testGet_NoSuchDomain(self):
    self.assertIsNone(domains.Domain.Get('nosuchdomain.com'))
    test_utils.BecomeAdmin()
    response = self.DoGet(AdminUrl('nosuchdomain.com'), status=404)
    self.assertIn('nosuchdomain.com', response.status)

  def testUserPermissionsPost_NoSuchDomain(self):
    self.assertIsNone(domains.Domain.Get('nosuchdomain.com'))
    test_utils.BecomeAdmin()
    # all posts except for the create domain post should end in a 404
    response = self.DoUserPermissionsPost(
        'nosuchdomain.com', {'me@somewhere.com': perms.Role.DOMAIN_ADMIN},
        status=404)
    self.assertIn('nosuchdomain.com', response.status)
    response = self.DoNewUserPost('nosuchdomain.com', 'blah@nosuchdomain.com',
                                  [perms.Role.DOMAIN_ADMIN], status=404)
    self.assertIn('nosuchdomain.com', response.status)
    response = self.DoDomainSettingsPost('nosuchdomain.com', 'empty', False,
                                         perms.Role.MAP_VIEWER, status=404)
    self.assertIn('nosuchdomain.com', response.status)

  def testGet_StaleDefaultLabel(self):
    domains.Domain.Create('blah.com', default_label='no-such-label')
    test_utils.BecomeAdmin()
    response = self.DoGet(AdminUrl('blah.com'))
    self.assertIn('no-such-label', response.body)

  def testPost_NewPermissions(self):
    # Give catalog@ domain admin; revoke perms for outsider@
    data = {'catalog@xyz.com': ('DOMAIN_ADMIN', 'CATALOG_EDITOR')}
    test_utils.BecomeAdmin()

    response = self.DoUserPermissionsPost('xyz.com', data)
    # Should redirect back to the admin page
    self.assertTrue('/root/xyz.com/.admin' in response.headers['Location'])
    self.assertItemsEqual([perms.Role.DOMAIN_ADMIN, perms.Role.CATALOG_EDITOR],
                          perms.GetDomainRoles('catalog@xyz.com', 'xyz.com'))
    self.assertFalse(perms.GetDomainRoles('outsider@not-xyz.com', 'xyz.com'))

  def testPost_NewUser(self):
    test_utils.BecomeAdmin()
    self.DoNewUserPost('xyz.com', 'admin2@xyz.com', (
        perms.Role.DOMAIN_ADMIN, perms.Role.MAP_CREATOR,
        perms.Role.CATALOG_EDITOR))
    self.assertItemsEqual([perms.Role.DOMAIN_ADMIN, perms.Role.MAP_CREATOR,
                           perms.Role.CATALOG_EDITOR],
                          perms.GetDomainRoles('admin2@xyz.com', 'xyz.com'))

  def testPost_NewUser_Malformed(self):
    test_utils.BecomeAdmin()
    response = self.DoNewUserPost(
        'xyz.com', 'bad@email@address', [perms.Role.DOMAIN_ADMIN], status=400)
    self.assertIn('bad@email@address', response.body)

  def testPost_NoDomainsFails(self):
    self.assertIsNone(domains.Domain.Get('bar.com'))
    test_utils.SetUser('foo@bar.com')
    self.DoNewUserPost(
        'bar.com', 'foo@bar.com', (perms.Role.DOMAIN_ADMIN,), status=403)

  def testPost_CreateDomain(self):
    self.assertIsNone(domains.Domain.Get('bar.com'))
    test_utils.SetUser('foo@bar.com')
    self.DoCreateDomainPost('bar.com')
    self.assertTrue(domains.Domain.Get('bar.com'))
    # The current user should have been granted administrative rights
    self.assertTrue(perms.CheckAccess(
        perms.Role.DOMAIN_ADMIN, 'bar.com', utils.GetCurrentUser()))

  def testCreateDomain_HighLatencyDatastore(self):
    self.assertIsNone(domains.Domain.Get('slow.com'))
    self.sent_true = False
    self.false_count = 0

    # Function signature (especially named arguments) needs to match CheckAccess
    # pylint: disable=unused-argument
    def MockCheckAccess(role, target=None, user=None, policy=None):
      if self.false_count < 4:
        self.false_count += 1
        return False
      self.sent_true = True
      return True
    # pylint: enable=unused-argument

    def NoOpSleep(unused_seconds):
      pass

    self.assertIsNone(domains.Domain.Get('slow.com'))
    self.mox.stubs.Set(perms, 'CheckAccess', MockCheckAccess)
    self.mox.stubs.Set(time, 'sleep', NoOpSleep)
    test_utils.SetUser('somebody@slow.com')
    self.DoCreateDomainPost('slow.com')
    self.assertTrue(self.sent_true)
    self.assertTrue(domains.Domain.Get('slow.com'))

  def testCreateDomain_DomainAlreadyExists(self):
    test_utils.BecomeAdmin()
    domains.Domain.Create('foo.com')
    response = self.DoCreateDomainPost('foo.com', status=404)
    self.assertIn('foo.com', response.status)

  def testDomainSettingsPost(self):
    test_utils.BecomeAdmin()
    domains.Domain.Create(
        'foo.com', has_sticky_catalog_entries=True, default_label='label-a',
        initial_domain_role=perms.Role.MAP_VIEWER)
    perms.Grant('testuser@bar.com', perms.Role.DOMAIN_ADMIN, 'foo.com')
    test_utils.SetUser('testuser@bar.com')
    self.DoDomainSettingsPost(
        'foo.com', 'label-b', False, perms.Role.MAP_EDITOR)
    domain = domains.Domain.Get('foo.com')
    self.assertEqual('label-b', domain.default_label)
    self.assertFalse(domain.has_sticky_catalog_entries)
    self.assertEqual(perms.Role.MAP_EDITOR, domain.initial_domain_role)

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


class AdminMapTest(test_utils.BaseTest):
  def testNavigate(self):
    test_utils.BecomeAdmin()
    response = self.DoGet('/.admin?map=http://app.com/root/.maps/x', status=302)
    self.assertEquals(
        'http://app.com/root/.admin/x', response.headers['Location'])

  def testGet(self):
    map_object, _ = test_utils.CreateMapAsAdmin()
    map_id = map_object.id
    response = self.DoGet('/.admin/' + map_id)
    self.assertTrue('xyz.com' in response.body)
    self.assertTrue('title' in response.body)

  def testBlock(self):
    map_object, _ = test_utils.CreateMapAsAdmin()
    map_id = map_object.id
    self.DoPost('/.admin/' + map_id, 'block=1')
    self.assertTrue(model.Map.Get(map_id).is_blocked)
    self.DoPost('/.admin/' + map_id, 'unblock=1')
    self.assertFalse(model.Map.Get(map_id).is_blocked)

  def testDelete(self):
    map_object, _ = test_utils.CreateMapAsAdmin()
    map_id = map_object.id
    self.DoPost('/.admin/' + map_id, 'delete=1')
    self.assertTrue(model.Map.GetDeleted(map_id).is_deleted)
    self.DoPost('/.admin/' + map_id, 'undelete=1')
    self.assertFalse(model.Map.Get(map_id).is_deleted)

  def testWipe(self):
    map_object, _ = test_utils.CreateMapAsAdmin()
    map_id = map_object.id
    self.DoPost('/.admin/' + map_id, 'wipe=1')
    self.assertEquals(None, model.Map.Get(map_id))
    self.assertEquals(None, model.Map.GetDeleted(map_id))


if __name__ == '__main__':
  test_utils.main()
