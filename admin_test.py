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


def AdminUrl(domain):
  return '/%s/.admin' % domain


class AdminDomainTest(test_utils.BaseTest):
  """Tests for the admin.py request handler."""

  def setUp(self):
    super(AdminDomainTest, self).setUp()
    test_utils.SetupUser(test_utils.Login('manager'))
    test_utils.SetupUser(test_utils.DomainLogin('insider', 'xyz.com'))
    test_utils.SetupUser(test_utils.DomainLogin('outsider', 'not-xyz.com'))
    # TODO(kpy): Consider moving this setup into the tests that use it.
    perms.Grant('xyz.com', perms.Role.MAP_CREATOR, 'xyz.com')
    perms.Grant('manager', perms.Role.DOMAIN_ADMIN, 'xyz.com')
    perms.Grant('insider', perms.Role.CATALOG_EDITOR, 'xyz.com')
    perms.Grant('outsider', perms.Role.MAP_CREATOR, 'xyz.com')

  def DoCreateDomainPost(self, domain, status=302):
    post_data = dict(form='create-domain', xsrf_token='XSRF')
    return self.DoPost(AdminUrl(domain), post_data, status)

  def DoUserPermissionsPost(self, domain, new_perms, new_user=None,
                            domain_role=None, status=302):
    post_data = dict(form='user-permissions', xsrf_token='XSRF')
    for user, role, should_delete in new_perms:
      post_data['%s.permission' % user] = role
      if should_delete:
        post_data['%s.delete' % user] = 'on'
    new_email, new_role = new_user or ('', perms.Role.MAP_CREATOR)
    post_data['new_user'] = new_email
    post_data['new_user.permission'] = new_role
    post_data['domain_role'] = domain_role or 'NO_ROLE'
    return self.DoPost(AdminUrl(domain), post_data, status)

  def DoNewUserPost(self, domain, email, role, status=302):
    return self.DoUserPermissionsPost(
        domain, [], new_user=(email, role), status=status)

  def DoDomainSettingsPost(
      self, domain, default_label, sticky_entries, initial_role, status=302):
    post_data = dict(form='domain-settings', default_label=default_label,
                     initial_domain_role=initial_role, xsrf_token='XSRF')
    if sticky_entries:
      post_data['has_sticky_catalog_entries'] = 'on'
    return self.DoPost(AdminUrl(domain), urllib.urlencode(post_data), status)

  def testGeneralAdminGet(self):
    with test_utils.Login('manager'):
      self.DoGet('/.admin', 403)  # only allowed for ADMIN users
    with test_utils.RootLogin():
      self.DoGet('/.admin')

  def testGet_WithPermissions(self):
    with test_utils.Login('manager'):
      response = self.DoGet('/xyz.com/.admin')
    # All users with any kind of permissions should be present
    self.assertTrue('manager@gmail.test' in response.body)
    self.assertTrue('insider@xyz.com' in response.body)
    self.assertTrue('outsider@not-xyz.com' in response.body)
    # Navigation bar should be present; "cm-navbar" is the class of its div.
    self.assertTrue('cm-navbar' in response.body)

  def testGet_NoPermissions(self):
    # xyz.com doesn't grant DOMAIN_ADMIN to the entire domain, so this fails.
    with test_utils.DomainLogin('another_insider', 'xyz.com'):
      self.DoGet('/xyz.com/.admin', 403)

  def testGet_NoSuchDomain(self):
    self.assertIsNone(domains.Domain.Get('nosuchdomain.com'))
    with test_utils.RootLogin():
      response = self.DoGet(AdminUrl('nosuchdomain.com'), 404)
    self.assertIn('nosuchdomain.com', response.status)

  def testGet_WelcomeText(self):
    with test_utils.RootLogin():
      domains.Domain.Create('anydomain.com')
      response = self.DoGet(AdminUrl('anydomain.com') + '?welcome=1')
      self.assertIn('domain-welcome-popup', response.body)

  def testUserPermissionsPost_NoSuchDomain(self):
    self.assertIsNone(domains.Domain.Get('nosuchdomain.com'))
    with test_utils.RootLogin():
      # All POSTs other than the "create domain" operation should give a 404.
      response = self.DoUserPermissionsPost(
          'nosuchdomain.com', [('foo@bar.com', perms.Role.DOMAIN_ADMIN, False)],
          status=404)
      self.assertIn('nosuchdomain.com', response.body)
      response = self.DoNewUserPost('nosuchdomain.com', 'blah@nosuchdomain.com',
                                    perms.Role.DOMAIN_ADMIN, 404)
      self.assertIn('nosuchdomain.com', response.body)
      response = self.DoDomainSettingsPost('nosuchdomain.com', 'empty', False,
                                           perms.Role.MAP_VIEWER, 404)
      self.assertIn('nosuchdomain.com', response.body)

  def testGet_StaleDefaultLabel(self):
    domains.Domain.Create('blah.com', default_label='no-such-label')
    with test_utils.RootLogin():
      response = self.DoGet(AdminUrl('blah.com'))
      self.assertIn('no-such-label', response.body)

  def testPost_NewPermissions(self):
    with test_utils.RootLogin():
      response = self.DoUserPermissionsPost(
          'xyz.com', [('insider', 'DOMAIN_ADMIN', False)])
      # Should redirect back to the admin page.
      self.assertTrue('/root/xyz.com/.admin' in response.headers['Location'])
      self.assertEqual({perms.Role.DOMAIN_ADMIN},
                       perms.GetSubjectsForTarget('xyz.com')['insider'])

  def testPost_NewUser(self):
    with test_utils.RootLogin():
      self.DoNewUserPost(
          'xyz.com', 'recipient@gmail.test',  # gets the uid 'recipient'
          perms.Role.DOMAIN_ADMIN)
    self.assertEqual({perms.Role.DOMAIN_ADMIN},
                     perms.GetSubjectsForTarget('xyz.com')['recipient'])

  def testPost_DeleteUser(self):
    with test_utils.RootLogin():
      self.DoUserPermissionsPost('xyz.com',
                                 [('outsider', 'DOMAIN_ADMIN', True)])
    self.assertNotIn('outsider', perms.GetSubjectsForTarget('xyz.com'))

  def testPost_SetDomainRole(self):
    with test_utils.RootLogin():
      perms.Grant('xyz.com', perms.Role.DOMAIN_ADMIN, 'xyz.com')
      perms.Grant('xyz.com', perms.Role.MAP_CREATOR, 'xyz.com')
      self.DoUserPermissionsPost(
          'xyz.com', [], domain_role=perms.Role.CATALOG_EDITOR)
    self.assertEqual({perms.Role.CATALOG_EDITOR},
                     perms.GetSubjectsForTarget('xyz.com')['xyz.com'])

  def testPost_SetDomainRoleNone(self):
    with test_utils.RootLogin():
      perms.Grant('xyz.com', perms.Role.CATALOG_EDITOR, 'xyz.com')
      self.DoUserPermissionsPost(
          'xyz.com', [], domain_role=admin.NO_PERMISSIONS)
    self.assertNotIn('xyz.com', perms.GetSubjectsForTarget('xyz.com'))

  def testPost_MultipleChangesDontInterfere(self):
    with test_utils.RootLogin():
      # Demote insider to MAP_CREATOR; revoke all permissions for outsider;
      # add recipient as a catalog editor
      self.DoUserPermissionsPost(
          'xyz.com', [('insider', perms.Role.MAP_CREATOR, False),
                      ('outsider', perms.Role.DOMAIN_ADMIN, True)],
          new_user=('recipient@gmail.test', perms.Role.CATALOG_EDITOR),
          domain_role=perms.Role.DOMAIN_ADMIN)
    new_perms = perms.GetSubjectsForTarget('xyz.com')
    self.assertEqual({perms.Role.MAP_CREATOR}, new_perms['insider'])
    self.assertNotIn('outsider', new_perms)
    self.assertEqual({perms.Role.CATALOG_EDITOR}, new_perms['recipient'])
    self.assertEqual({perms.Role.DOMAIN_ADMIN}, new_perms['xyz.com'])

  def testPost_NewUserInvalidEmail(self):
    with test_utils.RootLogin():
      response = self.DoNewUserPost(
          'xyz.com', 'bad@email@address', perms.Role.DOMAIN_ADMIN, 400)
      self.assertIn('bad@email@address', response.body)

  def testPost_NonexistentDomain(self):
    self.assertIsNone(domains.Domain.Get('bar.com'))
    with test_utils.RootLogin():
      self.DoNewUserPost('bar.com', 'foo@bar.com', perms.Role.DOMAIN_ADMIN, 404)

  def testPost_CreateDomain(self):
    self.assertIsNone(domains.Domain.Get('bar.com'))
    with test_utils.DomainLogin('first_bar_user', 'bar.com'):
      response = self.DoCreateDomainPost('bar.com')
      self.assertTrue('welcome=1' in response.headers['Location'])
      self.assertTrue(domains.Domain.Get('bar.com'))
      # The current user should have been granted administrative rights
      self.assertTrue(perms.CheckAccess(perms.Role.DOMAIN_ADMIN, 'bar.com'))

  def testCreateDomain_HighLatencyDatastore(self):
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

    self.assertIsNone(domains.Domain.Get('slow.com'))
    self.mox.stubs.Set(perms, 'CheckAccess', MockCheckAccess)
    self.mox.stubs.Set(time, 'sleep', lambda unused_seconds: None)
    with test_utils.DomainLogin('domain_creator', 'slow.com'):
      self.DoCreateDomainPost('slow.com')
      self.assertTrue(self.sent_true)
      self.assertTrue(domains.Domain.Get('slow.com'))

  def testCreateDomain_DomainAlreadyExists(self):
    with test_utils.RootLogin():
      domains.Domain.Create('foo.com')
      response = self.DoCreateDomainPost('foo.com', 403)
      self.assertIn('foo.com', response.status)

  def testDomainSettingsPost(self):
    domains.Domain.Create(
        'foo.com', has_sticky_catalog_entries=True, default_label='label-a',
        initial_domain_role=perms.Role.MAP_VIEWER)
    perms.Grant('manager', perms.Role.DOMAIN_ADMIN, 'foo.com')
    with test_utils.Login('manager'):
      self.DoDomainSettingsPost(
          'foo.com', 'label-b', False, perms.Role.MAP_EDITOR)
    domain = domains.Domain.Get('foo.com')
    self.assertEqual('label-b', domain.default_label)
    self.assertFalse(domain.has_sticky_catalog_entries)
    self.assertEqual(perms.Role.MAP_EDITOR, domain.initial_domain_role)

  def testDomainSettingsPost_NoInitialDomainRole(self):
    with test_utils.RootLogin():
      domains.Domain.Create(
          'xyz.com', initial_domain_role=perms.Role.MAP_CREATOR)
      self.DoDomainSettingsPost(
          'xyz.com', 'label', False, admin.NO_PERMISSIONS)
    self.assertEqual(None, domains.Domain.Get('xyz.com').initial_domain_role)

  def testSetRolesForDomain(self):
    # Anyone at xyz.com can create maps on xyz or on abc.com
    admin.SetRolesForDomain({'xyz.com': {perms.Role.MAP_CREATOR}}, 'xyz.com')
    admin.SetRolesForDomain({'xyz.com': {perms.Role.MAP_CREATOR}}, 'abc.com')
    # Anyone at abc.com can create maps and edit the catalog at abc.com
    admin.SetRolesForDomain(
        {'abc.com': {perms.Role.CATALOG_EDITOR, perms.Role.MAP_CREATOR}},
        'abc.com')
    # User 1 is a domain admin and catalog editor for xyz.com,
    # and a map creator for abc.com
    admin.SetRolesForDomain(
        {'manager': {perms.Role.DOMAIN_ADMIN, perms.Role.CATALOG_EDITOR}},
        'xyz.com')
    admin.SetRolesForDomain(
        {'manager': {perms.Role.MAP_CREATOR}}, 'abc.com')
    # User 2 is a map creator at xyz.com, despite belonging to abc.com
    admin.SetRolesForDomain(
        {'insider': {perms.Role.MAP_CREATOR}}, 'xyz.com')

    self.assertEquals(
        {'xyz.com': {perms.Role.MAP_CREATOR},
         'manager': {perms.Role.DOMAIN_ADMIN, perms.Role.CATALOG_EDITOR},
         'insider': {perms.Role.MAP_CREATOR},
         'outsider': {perms.Role.MAP_CREATOR}},
        perms.GetSubjectsForTarget('xyz.com'))
    # Revoke DOMAIN_ADMIN from user 'manager'
    admin.SetRolesForDomain(
        {'manager': {perms.Role.CATALOG_EDITOR}}, 'xyz.com')
    self.assertEquals({'xyz.com': {perms.Role.MAP_CREATOR},
                       'manager': {perms.Role.CATALOG_EDITOR},
                       'insider': {perms.Role.MAP_CREATOR},
                       'outsider': {perms.Role.MAP_CREATOR}},
                      perms.GetSubjectsForTarget('xyz.com'))


class AdminMapTest(test_utils.BaseTest):
  def testNavigate(self):
    with test_utils.RootLogin():
      response = self.DoGet('/.admin?map=http://app.com/root/.maps/x', 302)
      self.assertEquals(
          'http://app.com/root/.admin/x', response.headers['Location'])

  def testGet(self):
    map_object = test_utils.CreateMap()
    map_id = map_object.id
    with test_utils.RootLogin():
      response = self.DoGet('/.admin/' + map_id)
    self.assertTrue('xyz.com' in response.body)
    self.assertTrue('title' in response.body)

  def testBlock(self):
    map_object = test_utils.CreateMap()
    map_id = map_object.id
    with test_utils.RootLogin():
      self.DoPost('/.admin/' + map_id, 'block=1&xsrf_token=XSRF')
      self.assertTrue(model.Map.Get(map_id).is_blocked)
      self.DoPost('/.admin/' + map_id, 'unblock=1&xsrf_token=XSRF')
      self.assertFalse(model.Map.Get(map_id).is_blocked)

  def testDelete(self):
    map_object = test_utils.CreateMap()
    map_id = map_object.id
    with test_utils.RootLogin():
      self.DoPost('/.admin/' + map_id, 'delete=1&xsrf_token=XSRF')
      self.assertTrue(model.Map.GetDeleted(map_id).is_deleted)
      self.DoPost('/.admin/' + map_id, 'undelete=1&xsrf_token=XSRF')
      self.assertFalse(model.Map.Get(map_id).is_deleted)

  def testWipe(self):
    map_object = test_utils.CreateMap()
    map_id = map_object.id
    with test_utils.RootLogin():
      self.DoPost('/.admin/' + map_id, 'wipe=1&xsrf_token=XSRF')
      self.assertEquals(None, model.Map.Get(map_id))
      self.assertEquals(None, model.Map.GetDeleted(map_id))

  def testWipeNotAllowed(self):
    map_object = test_utils.CreateMap()
    map_id = map_object.id
    with test_utils.Login('unprivileged'):
      self.DoPost('/.admin/' + map_id, 'wipe=1&xsrf_token=XSRF', 403)


if __name__ == '__main__':
  test_utils.main()
