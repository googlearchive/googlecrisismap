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

"""Handler for the domain-specific admin page."""

__author__ = 'rew@google.com (Becky Willrich)'

import base_handler
import domains
import model
import perms
import users
import utils


# String used to mean "none of the above" in the HTML
NO_PERMISSIONS = 'NO_PERMISSIONS'


INITIAL_DOMAIN_ROLE_CHOICES = (
    (NO_PERMISSIONS, 'Have no access to the map'),
    (perms.Role.MAP_VIEWER, 'Can view the map'),
    (perms.Role.MAP_EDITOR, 'Can view and edit the map'),
    (perms.Role.MAP_OWNER, 'Can view, edit, and delete the map'),
)

DOMAIN_PERMISSION_CHOICES = (
    (perms.Role.MAP_CREATOR, 'Can create maps'),
    (perms.Role.CATALOG_EDITOR, 'Can publish maps'),
    (perms.Role.DOMAIN_ADMIN, 'Can manage domain'),
)

# _MaxRole relies on these being in order from weakest to strongest.
DOMAIN_PERMISSIONS = [s for s, _ in reversed(DOMAIN_PERMISSION_CHOICES)]


# TODO(rew): This goes away once we migrate the perms data to store only the
# strongest permsision per subject
def _MaxRole(roles):
  for role in DOMAIN_PERMISSIONS:
    if role in roles:
      return role


def SetRolesForDomain(subject_roles, domain_name):
  """Gives each user exactly the specified set of roles to the given domain.

  Args:
    subject_roles: A dictionary mapping subjects (user IDs or domain names)
        to sets of perms.Role constants.  For each subject, all roles in the
        set will be granted, and all roles not in the set will be revoked.
    domain_name: A domain name.
  """
  old_subject_roles = perms.GetSubjectsForTarget(domain_name)
  for subject, new_roles in subject_roles.items():
    old_roles = old_subject_roles.get(subject, set())
    for role in old_roles - new_roles:
      perms.Revoke(subject, role, domain_name)
    for role in new_roles - old_roles:
      perms.Grant(subject, role, domain_name)


class Admin(base_handler.BaseHandler):
  """Handler for the overall admin and domain-specific admin pages."""

  def Get(self, user, domain=''):
    """Routes to a general admin, domain admin, or map admin page."""
    if self.request.get('map'):
      map_id = self.request.get('map').split('/')[-1]
      return self.redirect(str(self.request.root_path + '/.admin/%s' % map_id))
    if domain:
      self.GetDomainAdmin(user, domain)
    else:
      self.GetGeneralAdmin()

  # "user" is currently unused, but we must have a user (tacitly used in
  # AssertAccess) and we cannot rename the arg.
  def GetDomainAdmin(self, user, domain):  # pylint:disable=unused-argument
    """Displays the administration page for the given domain."""
    domain_name = domain
    perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain_name)
    domain = domains.Domain.Get(domain_name)
    if not domain:
      raise base_handler.Error(404, 'Unknown domain %r.' % domain_name)
    subject_roles = perms.GetSubjectsForTarget(domain_name)
    user_roles = [(users.Get(subj), _MaxRole(r)) for (subj, r)
                  in subject_roles.items() if perms.IsUserId(subj)]
    user_roles.sort(key=lambda (u, r): u.email)
    labels = sorted(e.label for e in model.CatalogEntry.GetAll(domain_name))
    self.response.out.write(self.RenderTemplate('admin_domain.html', {
        'domain': domain, 'user_roles': user_roles, 'labels': labels,
        'domain_role': _MaxRole(subject_roles.get(domain_name, set())),
        'user_permission_choices': DOMAIN_PERMISSION_CHOICES,
        'initial_domain_role_choices': INITIAL_DOMAIN_ROLE_CHOICES,
        'show_welcome': self.request.get('welcome', '')
    }))

  def GetGeneralAdmin(self):
    """Renders the general admin page."""
    perms.AssertAccess(perms.Role.ADMIN)
    self.response.out.write(self.RenderTemplate('admin.html', {}))
    # TODO(kpy): Also show a list of existing domains on this page?

  def Post(self, user, domain):
    """Landing for posts from the domain administration page."""
    which = self.request.POST.pop('form')
    target = self.request.path
    if which != 'create-domain':
      perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain, user)
      if not domains.Domain.Get(domain):
        raise base_handler.Error(404, 'Unknown domain %r.' % domain)
    if which == 'domain-settings':
      self.UpdateDomainSettings(self.request.POST, domain)
    elif which == 'create-domain':
      self.CreateDomain(domain, user)
      target += '?welcome=1'
    else:  # user or domain permissions
      inputs = dict(self.request.POST)
      self.AddNewUserIfPresent(inputs, domain)
      self.UpdateDomainRole(inputs, domain)
      SetRolesForDomain(self.FindNewPerms(inputs), domain)
    self.redirect(target)

  def UpdateDomainSettings(self, inputs, domain_name):
    domain = domains.Domain.Get(domain_name)
    domain.default_label = inputs.get('default_label', 'empty')
    domain.has_sticky_catalog_entries = 'has_sticky_catalog_entries' in inputs
    domain.initial_domain_role = inputs.get(
        'initial_domain_role', perms.Role.MAP_VIEWER)
    if domain.initial_domain_role == NO_PERMISSIONS:
      domain.initial_domain_role = None
    domain.Put()

  def AddNewUserIfPresent(self, inputs, domain):
    """Grants domain roles to a new user."""
    new_email = inputs.pop('new_user').strip()
    new_role = inputs.pop('new_user.permission')
    if not new_email or not new_role:
      return
    if not utils.IsValidEmail(new_email):
      raise base_handler.Error(400, 'Invalid e-mail address: %r.' % new_email)
    user = users.GetForEmail(new_email)
    perms.Grant(user.id, new_role, domain)

  def UpdateDomainRole(self, inputs, domain_name):
    # TODO(rew): Simplify this once perms have been migrated to one
    # role per (subject, target).
    new_role = inputs.pop('domain_role')
    new_role = set() if new_role == NO_PERMISSIONS else {new_role}
    SetRolesForDomain({domain_name: new_role}, domain_name)

  def FindNewPerms(self, inputs):
    """Looks at inputs and determines the new permissions for all users.

    Args:
      inputs: a dictionary of the form inputs

    Returns:
      A dictionary keyed by user/domain.  Values are sets of the roles
      that the key should have.
    """
    new_perms = {}
    for key in inputs:
      if '.' in key:
        uid, input_name = key.rsplit('.', 1)
        if input_name == 'permission' and uid + '.delete' not in inputs:
          new_perms[uid] = {inputs[key]}
        elif input_name == 'delete':
          new_perms[uid] = set()
    return new_perms

  def CreateDomain(self, domain_name, user):
    def GrantPerms():
      perms.Grant(user.id, perms.Role.DOMAIN_ADMIN, domain_name)
      perms.Grant(user.id, perms.Role.CATALOG_EDITOR, domain_name)
      perms.Grant(user.id, perms.Role.MAP_CREATOR, domain_name)

    def TestPerms():
      return perms.CheckAccess(perms.Role.DOMAIN_ADMIN, domain_name, user)

    domain = domains.Domain.Get(domain_name)
    if domain:
      raise base_handler.Error(403, 'Domain %r already exists.' % domain_name)
    utils.SetAndTest(GrantPerms, TestPerms)
    domains.Domain.Create(domain_name)


class AdminMap(base_handler.BaseHandler):
  """Administration page for a map."""

  def Get(self, map_id):
    """Renders the admin page."""
    perms.AssertAccess(perms.Role.ADMIN)
    map_object = model.Map.Get(map_id) or model.Map.GetDeleted(map_id)
    if not map_object:
      raise base_handler.Error(404, 'Map %r not found.' % map_id)
    self.response.out.write(self.RenderTemplate('admin_map.html', {
        'map': map_object
    }))

  def Post(self, map_id):
    """Handles a POST (block/unblock, delete/undelete, or wipe)."""
    perms.AssertAccess(perms.Role.ADMIN)
    map_object = model.Map.Get(map_id) or model.Map.GetDeleted(map_id)
    if not map_object:
      raise base_handler.Error(404, 'Map %r not found.' % map_id)
    if self.request.get('block'):
      map_object.SetBlocked(True)
    if self.request.get('unblock'):
      map_object.SetBlocked(False)
    if self.request.get('delete'):
      map_object.Delete()
    if self.request.get('undelete'):
      map_object.Undelete()
    if self.request.get('wipe'):
      map_object.Wipe()
    self.redirect(map_id)
