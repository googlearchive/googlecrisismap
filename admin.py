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
import webapp2

import base_handler
import utils
import perms


def ValidateEmail(email):
  """Verify that the given string could plausibly be an e-mail address."""
  match = re.match(r'^[\w.-]+@([\w.-]+)$', email)
  return match and ValidateDomain(match.group(1))


def ValidateDomain(domain):
  """Verify that the given string could plausibly be a domain name."""
  return re.match(r'^([\w-]+\.)+[\w-]+$', domain)


class Admin(base_handler.BaseHandler):
  """Handler for the domain-specific admin page."""

  def get(self, domain):  # pylint: disable=g-bad-name
    """Displays the administration page for the given domain."""
    admin = utils.GetCurrentUser()
    perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain)

    all_users = perms.GetSubjectsInDomain(domain)
    domains = sorted(((u, all_users[u]) for u in all_users if '@' not in u),
                     cmp=lambda x, y: cmp(x[0], y[0]))
    emails = sorted(((u, all_users[u]) for u in all_users if '@' in u),
                    cmp=lambda x, y: cmp(x[0], y[0]))

    context = {'domain': domain, 'admin': admin,
               'users': emails, 'domains': domains}
    self.response.out.write(self.RenderTemplate('admin.html', context))

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

  def post(self, domain):  # pylint: disable=g-bad-name
    perms.AssertAccess(perms.Role.DOMAIN_ADMIN, domain)
    new_perms = self.FindNewPerms(self.request.POST, domain)
    for user_or_domain, new_roles in new_perms.iteritems():
      perms.SetDomainRoles(user_or_domain, domain, new_roles)
    self.redirect(self.request.path_qs)


app = webapp2.WSGIApplication([(r'.*/([\w.-]+\.\w+)/.admin', Admin)])
