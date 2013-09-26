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


def ValidateEmail(email):
  """Verify that the given string could plausibly be an e-mail address."""
  match = re.match(r'^[\w.-]+@([\w.-]+)$', email)
  return match and ValidateDomain(match.group(1))


def ValidateDomain(domain):
  """Verify that the given string could plausibly be a domain name."""
  return re.match(r'^([\w-]+\.)+[\w-]+$', domain)


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

  def GetDomainAdmin(self, user, domain):
    """Displays the administration page for the given domain."""
    perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain)
    all_users = perms.GetSubjectsInDomain(domain)
    domain_list = sorted(((u, all_users[u]) for u in all_users if '@' not in u),
                         cmp=lambda x, y: cmp(x[0], y[0]))
    emails = sorted(((u, all_users[u]) for u in all_users if '@' in u),
                    cmp=lambda x, y: cmp(x[0], y[0]))

    self.response.out.write(self.RenderTemplate('admin_domain.html', {
        'domain': domain, 'admin': user, 'users': emails, 'domains': domain_list
    }))

  def GetGeneralAdmin(self):
    """Renders the general admin page."""
    perms.AssertAccess(perms.Role.ADMIN)
    self.response.out.write(self.RenderTemplate('admin.html', {}))
    # TODO(kpy): Also show a list of existing domains on this page?

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
    new_user = None
    for key, value in inputs.iteritems():
      if key == 'new_email':
        new_user = value
        continue
      user, role = key.rsplit('.', 1)
      new_perms.setdefault(user, []).append(role)
    if new_user:
      if (('@' in new_user and ValidateEmail(new_user))
          or ValidateDomain(new_user)):
        new_perms[new_user] = new_perms['new_email']
      else:
        raise base_handler.Error(
            400, 'Could not interpret %s as either an e-mail address '
            'or a domain name' % new_user)
    if 'new_email' in new_perms:
      del new_perms['new_email']
    return new_perms

  def Post(self, domain, user):
    """Sets permissions for the domain, creating if appropriate."""
    if self.request.get('create'):
      self.CreateDomain(domain, user)
      self.redirect(self.request.path)
    else:
      perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain, user)
      new_perms = self.FindNewPerms(self.request.POST, domain)
      for user_or_domain, new_roles in new_perms.iteritems():
        perms.SetDomainRoles(user_or_domain, domain, new_roles)
      self.redirect(self.request.path_qs)

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
