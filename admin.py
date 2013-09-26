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

import re

import base_handler
import domains
import model
import perms
import utils


INITIAL_DOMAIN_ROLE_CHOICES = (
    (domains.NO_ROLE, 'Have no access to the map'),
    (perms.Role.MAP_VIEWER, 'Be able to view the map'),
    (perms.Role.MAP_EDITOR, 'Be able to edit the map'),
    (perms.Role.MAP_OWNER, 'Have full rights to the map'),
)

USER_PERMISSION_CHOICES = (
    (perms.Role.MAP_CREATOR, 'Can create maps'),
    (perms.Role.CATALOG_EDITOR, 'Can edit the catalog'),
    (perms.Role.DOMAIN_ADMIN, 'Has admin permissions'),
)


def ValidateEmail(email):
  """Verify that the given string could plausibly be an e-mail address."""
  match = re.match(r'^[\w.-]+@([\w.-]+)$', email)
  return match and ValidateDomain(match.group(1))


def ValidateDomain(domain):
  """Verify that the given string could plausibly be a domain name."""
  return re.match(r'^([\w-]+\.)+[\w-]+$', domain)


def ValidateNewUser(name):
  return ('@' in name and ValidateEmail(name)
          or ValidateDomain(name))


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

  # "user" is currently unused, but we must have a user (tacetly used in
  # AssertAccess) and we cannot rename the arg.
  def GetDomainAdmin(self, user, domain):  # pylint:disable=unused-argument
    """Displays the administration page for the given domain."""
    domain_name = domain
    perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain_name)
    domain = domains.Domain.Get(domain_name)
    if not domain:
      raise base_handler.Error(404, 'Unknown domain <%s>.' % domain_name)
    all_users = perms.GetSubjectsInDomain(domain_name)
    domain_list = sorted(((u, all_users[u]) for u in all_users if '@' not in u),
                         cmp=lambda x, y: cmp(x[0], y[0]))
    emails = sorted(((u, all_users[u]) for u in all_users if '@' in u),
                    cmp=lambda x, y: cmp(x[0], y[0]))
    labels = sorted(l.label for l in model.CatalogEntry.GetAll(domain_name))
    context = {
        'domain': domain, 'users': emails, 'domains': domain_list,
        'labels': labels, 'user_permission_choices': USER_PERMISSION_CHOICES,
        'initial_domain_role_choices': INITIAL_DOMAIN_ROLE_CHOICES}
    if self.request.get('welcome'):
      context['show_welcome'] = True
    self.response.out.write(self.RenderTemplate('admin_domain.html', context))

  def GetGeneralAdmin(self):
    """Renders the general admin page."""
    perms.AssertAccess(perms.Role.ADMIN)
    self.response.out.write(self.RenderTemplate('admin.html', {}))
    # TODO(kpy): Also show a list of existing domains on this page?

  def Post(self, domain, user):
    """Landing for posts from the domain administration page."""
    which = self.request.POST.pop('form')
    target = self.request.path
    if which != 'create-domain':
      perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain, user)
      if not domains.Domain.Get(domain):
        raise base_handler.Error(404, 'Unknown domain <%s>.' % domain)
    if which == 'domain-settings':
      self.UpdateDomainSettings(self.request.POST, domain)
    elif which == 'create-domain':
      self.CreateDomain(domain, user)
      target += '?welcome=1'
    elif which == 'add-user':
      self.AddUser(self.request.POST, domain)
    else:   # User or domain permissions
      self.UpdatePermissions(self.request.POST, domain)
    self.redirect(target)

  def UpdateDomainSettings(self, inputs, domain_name):
    domain = domains.Domain.Get(domain_name)
    domain.default_label = inputs.get('default_label', 'empty')
    domain.has_sticky_catalog_entries = 'has_sticky_catalog_entries' in inputs
    domain.initial_domain_role = inputs.get(
        'initial_domain_role', perms.Role.MAP_VIEWER)
    domain.Put()

  def AddUser(self, inputs, domain):
    new_user = inputs.get('new_email')
    if not new_user:
      raise base_handler.Error(400, 'No user supplied')
    if not ValidateNewUser(new_user):
      raise base_handler.Error(
          400, 'Could not interpret %s as either an e-mail address '
          'or a domain name' % new_user)
    for role, _ in USER_PERMISSION_CHOICES:
      if inputs.get('new_email.%s' % role):
        perms.Grant(new_user, role, domain)

  def UpdatePermissions(self, inputs, domain):
    new_perms = self.FindNewPerms(inputs, domain)
    for user_or_domain, new_roles in new_perms.iteritems():
      perms.SetDomainRoles(user_or_domain, domain, new_roles)

  def FindNewPerms(self, inputs, domain):
    """Looks at inputs and determines the new permissions for all users.

    Args:
      inputs: a dictionary of the form inputs
      domain: the name of the domain whose permissions are being computed

    Returns:
      A dictionary keyed by user/domain.  Values are lists of the roles
      which the key should have.
    """
    curr_users = perms.GetSubjectsInDomain(domain).keys()
    new_perms = dict((user, []) for user in curr_users)
    for key in inputs:
      user, role = key.rsplit('.', 1)
      new_perms.setdefault(user, []).append(role)
    return new_perms

  def CreateDomain(self, domain_name, user):
    email = utils.NormalizeEmail(user.email())

    def GrantPerms():
      perms.Grant(email, perms.Role.DOMAIN_ADMIN, domain_name)
      perms.Grant(email, perms.Role.CATALOG_EDITOR, domain_name)
      perms.Grant(email, perms.Role.MAP_CREATOR, domain_name)

    def TestPerms():
      return perms.CheckAccess(perms.Role.DOMAIN_ADMIN, domain_name, user)

    domain = domains.Domain.Get(domain_name)
    if domain:
      raise base_handler.Error(404, 'Domain %s already exists' % domain_name)
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
