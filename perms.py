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

"""API for accessing permissions and the underlying model for them."""

import collections

import model
import utils

from google.appengine.api import users


class AuthorizationError(Exception):
  """User not authorized to perform operation."""

  def __init__(self, user, role, target):
    super(AuthorizationError, self).__init__(
        'User %s lacks %s access to %r' % (user, role, target))
    self.user = user
    self.role = role
    self.target = target


# Access role constants.
# Role is capitalized like an enum class.  # pylint: disable=g-bad-name
Role = utils.Struct(
    # Global roles
    ADMIN='ADMIN',  # can view, edit, or change permissions for anything

    # Domain-specific roles
    CATALOG_EDITOR='CATALOG_EDITOR',  # can edit the catalog for a domain
    DOMAIN_ADMIN='DOMAIN_ADMIN',  # can grant permissions for the domain
    MAP_CREATOR='MAP_CREATOR',  # can create new maps

    # Map-specific roles
    MAP_OWNER='MAP_OWNER',  # can change permissions for a map
    MAP_EDITOR='MAP_EDITOR',  # can save new versions of a map
    MAP_VIEWER='MAP_VIEWER',  # can view current version of a map
)

# Prefix used when setting a config for a user/domain's roles
ROLE_PREFIX = 'global_roles:'


def SetGlobalRoles(subject, roles):
  """Sets the access roles for a given user or domain that apply to all maps.

  Args:
    subject: A string, either an e-mail address or a domain name.
    roles: A list of roles (see Role) that the user or domain should have.
        The CATALOG_EDITOR, MAP_CREATOR, and DOMAIN_ACCESS roles for a
        particular domain should be specified as a two-item
        list, e.g., [Role.CATALOG_EDITOR, domain].
  """
  model.Config.Set(ROLE_PREFIX + subject, roles)


def GetGlobalRoles(subject):
  """Gets the access roles for a given user or domain that apply to all maps.

  Args:
    subject: An e-mail address or a domain name.

  Returns:
    The list of global roles (see Role) that the user or domain has.
    The CATALOG_EDITOR access role for a particular domain is specified as
    a two-item list: [Role.CATALOG_EDITOR, domain].
  """
  return model.Config.Get(ROLE_PREFIX + subject, [])


def SetDomainRoles(subject, domain, new_roles):
  """Gives the subject the listed roles to the given domain.

  Args:
    subject: An e-mail address or a domain name; the person/domain whose
        roles are being set.
    domain: The domain to whose access is being set.
    new_roles: The list of roles the subject should receive; if the subject
        currently has roles that are not in new_roles, they will be revoked.
  """
  global_roles = [role for role in GetGlobalRoles(subject)
                  if not isinstance(role, list) or role[1] != domain]
  global_roles += [[role, domain] for role in new_roles]
  SetGlobalRoles(subject, global_roles)


def GetDomainRoles(subject, domain):
  """Returns the list of roles held by subject in domain."""
  global_roles = GetGlobalRoles(subject)
  return [r[0] for r in global_roles if isinstance(r, list) and r[1] == domain]


def GetDomainsWithRole(role, user=None):
  """Gets the domains for which the given user has the given type of access.

  Args:
    role: A Role constant.
    user: A google.appengine.api.users.User object, or None.

  Returns:
    A list of strings (domain names).  Note that users with ADMIN access will
    actually have access for all domains, but the result will only include the
    domains that are specifically granted to the user or the user's domain.
  """
  user = user or users.get_current_user()
  email, domain = user.email(), utils.GetUserDomain(user)
  domains = set()
  for item in GetGlobalRoles(email) + GetGlobalRoles(domain):
    if isinstance(item, list) and item[0] == role:
      domains.add(item[1])
  return sorted(domains)


def GetSubjectsInDomain(domain):
  """Retrieves all users granted permissions in the given domain.

  Args:
    domain: (string) the name of the domain being queried.

  Returns:
    A dictionary that maps users (or domains) to the list of granted
    permissions.  Note that permissions they inherit from their domain
    are NOT returned.
  """
  all_perms = model.Config.GetAll()
  result = collections.defaultdict(list)
  for key, value in all_perms.iteritems():
    if not key.startswith(ROLE_PREFIX):
      continue
    user = key[len(ROLE_PREFIX):]
    for perm in value:
      if isinstance(perm, list) and perm[1] == domain:
        result[user].append(perm[0])
  return result


class AccessPolicy(object):
  """Wraps up authorization for user actions."""

  def HasRoleAdmin(self, user):
    """Returns True if a user should get ADMIN access."""
    # Users get admin access if they have global admin access or if they
    # have App Engine administrator permission for this app.
    return user and (self.HasGlobalRole(user, Role.ADMIN) or
                     (user == users.get_current_user() and
                      users.is_current_user_admin()))

  def HasRoleDomainAdmin(self, user, domain):
    """Returns True if the user should get DOMAIN_ADMIN access for a domain."""
    # Users get domain administration access if they have DOMAIN_ADMIN access
    # to the domain, or if they have admin access.
    return user and (self.HasGlobalRole(user, [Role.DOMAIN_ADMIN, domain]) or
                     self.HasRoleAdmin(user))

  def HasRoleCatalogEditor(self, user, domain):
    """Returns True if a user should get CATALOG_EDITOR access for a domain."""
    # Users get catalog editor access if they have catalog editor access to the
    # specified domain, if they have catalog editor access to all domains, or
    # if they have admin access.
    return user and (self.HasGlobalRole(user, [Role.CATALOG_EDITOR, domain]) or
                     self.HasGlobalRole(user, Role.CATALOG_EDITOR) or
                     self.HasRoleAdmin(user))

  def HasRoleMapCreator(self, user, domain):
    """Returns True if a user should get MAP_CREATOR access."""
    # Users get creator access if they have global map creator access or if
    # they have admin access.
    return user and (self.HasGlobalRole(user, [Role.MAP_CREATOR, domain]) or
                     self.HasRoleAdmin(user))

  def HasRoleMapOwner(self, user, map_object):
    """Returns True if a user should get MAP_OWNER access to a given map."""
    # Users get owner access if they are in the owners list for the map, if
    # their domain is an owner of the map, if they have global owner access
    # to all maps, or if they have admin access.
    return user and (user.email() in map_object.owners or
                     self.HasDomainRole(user, Role.MAP_OWNER, map_object) or
                     self.HasGlobalRole(user, Role.MAP_OWNER) or
                     self.HasRoleAdmin(user))

  def HasRoleMapEditor(self, user, map_object):
    """Returns True if a user should get MAP_EDITOR access to a given map."""
    # Users get editor access if they are in the editors list for the map, if
    # their domain is an editor of the map, if they have global editor access
    # to all maps, or if they have owner access.
    return user and (user.email() in map_object.editors or
                     self.HasDomainRole(user, Role.MAP_EDITOR, map_object) or
                     self.HasGlobalRole(user, Role.MAP_EDITOR) or
                     self.HasRoleMapOwner(user, map_object))

  def HasRoleMapViewer(self, user, map_object):
    """Returns True if the user has MAP_VIEWER access to a given map."""
    # Users get viewer access if the map is world-readable, if they are in the
    # viewers list for the map, if their domain is a viewer of the map, if they
    # have global viewer access to all maps, or if they have editor access.
    return (map_object.world_readable or
            user and (user.email() in map_object.viewers or
                      self.HasDomainRole(user, Role.MAP_VIEWER, map_object) or
                      self.HasGlobalRole(user, Role.MAP_VIEWER) or
                      self.HasRoleMapEditor(user, map_object)))

  def HasDomainRole(self, user, role, map_object):
    """Returns True if the user's domain has the given access to the map."""
    return user and (utils.GetUserDomain(user) in map_object.domains and
                     role == map_object.domain_role)

  def HasGlobalRole(self, user, role):
    """Returns True if the user or user's domain has the given role globally."""
    return user and (role in GetGlobalRoles(user.email()) or
                     role in GetGlobalRoles(utils.GetUserDomain(user)))


def CheckAccess(role, target=None, user=None, policy=None):
  """Checks whether the given user has the specified access role.

  Args:
    role: A Role constant identifying the desired access role.
    target: The object to which access is desired.  If 'role' is MAP_OWNER,
        MAP_EDITOR, or MAP_VIEWER, this should be a Map object.  If 'role' is
        CATALOG_EDITOR, MAP_CREATOR, or DOMAIN_ADMIN, this must be a domain
        name (a string).  For other roles, this argument is not used.
    user: (optional) A google.appengine.api.users.User object.  If not
        specified, access permissions are checked for the current user.
    policy: The access policy to apply.

  Returns:
    True if the user has the specified access permission.

  Raises:
    ValueError: The specified role is not a valid member of Role.
  """

  def RequireTargetClass(required_cls, cls_desc):
    if not isinstance(target, required_cls):
      raise ValueError('For role %r, target must be a %s' % (role, cls_desc))

  policy = policy or AccessPolicy()
  user = user or users.get_current_user()

  # Roles that are unrelated to a target.
  if role == Role.ADMIN:
    return policy.HasRoleAdmin(user)

  # Roles with a domain as the target.
  if role == Role.CATALOG_EDITOR:
    RequireTargetClass(basestring, 'string')
    return policy.HasRoleCatalogEditor(user, target)
  if role == Role.MAP_CREATOR:
    RequireTargetClass(basestring, 'string')
    return policy.HasRoleMapCreator(user, target)
  if role == Role.DOMAIN_ADMIN:
    RequireTargetClass(basestring, 'string')
    return policy.HasRoleDomainAdmin(user, target)

  # Roles with a Map as the target
  RequireTargetClass(model.Map, 'Map')
  if role == Role.MAP_OWNER:
    return policy.HasRoleMapOwner(user, target)
  if role == Role.MAP_EDITOR:
    return policy.HasRoleMapEditor(user, target)
  if role == Role.MAP_VIEWER:
    return policy.HasRoleMapViewer(user, target)

  raise ValueError('Invalid role %r' % role)


def AssertAccess(role, target=None, user=None, policy=None):
  """Requires that the given user has the specified access role.

  Args:
    role: A Role constant identifying the desired access role.
    target: The object to which access is desired.  If 'role' is MAP_OWNER,
        MAP_EDITOR, or MAP_VIEWER, this should be a Map object.  If 'role' is
        CATALOG_EDITOR, MAP_CREATOR or DOMAIN_ADMIN, this must be a domain name
        (a string).  For other roles, this argument is not used.
    user: (optional) A google.appengine.api.users.User object.  If not
        specified, access permissions are checked for the current user.
    policy: The access policy to apply.

  Raises:
    AuthorizationError: If the user lacks the given access permission.
  """
  user = user or users.get_current_user()  # ensure user is set in error message
  if not CheckAccess(role, target, user, policy):
    raise AuthorizationError(user, role, target)
