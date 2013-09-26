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

import cache
import model
import utils

from google.appengine.api import users
from google.appengine.ext import db


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

# Only used for role ADMIN
GLOBAL_TARGET = '__GLOBAL__'


class PermissionModel(db.Model):

  # The entity (either e-mail address or a domain) granted a
  # particular role
  subject = db.StringProperty()
  # The role being granted
  role = db.StringProperty()
  # The thing to which access is being granted; typically a map,
  # a domain, or the global target
  target = db.StringProperty()

_Permission = collections.namedtuple(
    '_Permission', ['subject', 'role', 'target'])


def _PermissionCachePath(subject=None, target=None):
  return [_Permission, subject or '*', target or '*']


def _PermissionKey(perm):
  return cache.ToCacheKey([_Permission, perm.subject, perm.role, perm.target])


def _FlushRelated(perm):
  for subject in [perm.subject, None]:
    for target in [perm.target, None]:
      cache.Delete(_PermissionCachePath(subject=subject, target=target))


def _LoadPermissions(subject, target):
  # No role arg because we never wish to load by role; we always load more
  # (by subject or target), then filter by role.
  models = PermissionModel.all()
  if subject:
    models.filter('subject =', subject)
  if target:
    models.filter('target =', target)
  return [_Permission(m.subject, m.role, m.target) for m in models]


def Query(subject, role, target):
  perms = cache.Get(_PermissionCachePath(subject=subject, target=target),
                    make_value=lambda: _LoadPermissions(subject, target))
  return [p for p in perms if p.role == role] if role else perms


def Get(subject, role, target):
  perms = Query(subject, role, target)
  return perms[0] if perms else None


def Grant(subject, role, target):
  """Grants the given role to the subject for the target."""
  perm = _Permission(subject, role, target)
  perm_model = PermissionModel(
      subject=subject, role=role, target=target,
      key_name=_PermissionKey(perm))
  perm_model.put()
  _FlushRelated(perm)


def _Revoke(perm):
  perm_model = PermissionModel.get_by_key_name(_PermissionKey(perm))
  if perm_model:
    perm_model.delete()
    _FlushRelated(perm)


def Revoke(subject, role, target):
  _Revoke(_Permission(subject, role, target))


def SetDomainRoles(subject, domain, new_roles):
  """Gives the subject the listed roles to the given domain.

  Args:
    subject: An e-mail address or a domain name; the person/domain whose
        roles are being set.
    domain: The domain to whose access is being set.
    new_roles: The list of roles the subject should receive; if the subject
        currently has roles that are not in new_roles, they will be revoked.
  """
  perms = Query(subject, None, domain)
  for perm in perms:
    if perm.role not in new_roles:
      _Revoke(perm)
  old_roles = [perm.role for perm in perms]
  for role in new_roles:
    if role not in old_roles:
      Grant(subject, role, domain)


def GetDomainRoles(subject, domain):
  """Returns the list of roles held by subject in domain."""
  return [perm.role for perm in Query(subject, None, domain)]


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
  email = user and user.email() or utils.GetCurrentUserEmail()
  domain = user and utils.GetUserDomain(user) or utils.GetCurrentUserDomain()
  return sorted(
      [p.target for p in Query(email, role, None)] +
      [p.target for p in Query(domain, role, None)])


def GetSubjectsInDomain(domain):
  """Retrieves all users granted permissions in the given domain.

  Args:
    domain: (string) the name of the domain being queried.

  Returns:
    A dictionary that maps users (or domains) to the list of granted
    permissions.  Note that permissions they inherit from their domain
    are NOT returned.
  """
  all_perms = Query(None, None, domain)
  result = {}
  for perm in all_perms:
    result.setdefault(perm.subject, []).append(perm.role)
  return result


class AccessPolicy(object):
  """Wraps up authorization for user actions."""

  def HasRoleAdmin(self, user):
    """Returns True if a user should get ADMIN access."""
    # Users get admin access if they have global admin access or if they
    # have App Engine administrator permission for this app.
    return user and (Get(user.email(), Role.ADMIN, GLOBAL_TARGET) or
                     (user == users.get_current_user() and
                      users.is_current_user_admin()))

  def _HasDomainPermission(self, user, role, domain):
    return (Get(user.email(), role, domain) or
            Get(utils.GetUserDomain(user), role, domain))

  def HasRoleDomainAdmin(self, user, domain):
    """Returns True if the user should get DOMAIN_ADMIN access for a domain."""
    # Users get domain administration access if they have DOMAIN_ADMIN access
    # to the domain, or if they have admin access.
    return user and (self._HasDomainPermission(user, Role.DOMAIN_ADMIN, domain)
                     or self.HasRoleAdmin(user))

  def HasRoleCatalogEditor(self, user, domain):
    """Returns True if a user should get CATALOG_EDITOR access for a domain."""
    # Users get catalog editor access if they have catalog editor access to the
    # specified domain, if they have catalog editor access to all domains, or
    # if they have admin access.
    return user and (Get(user.email(), Role.CATALOG_EDITOR, domain)
                     or Get(
                         utils.GetUserDomain(user), Role.CATALOG_EDITOR, domain)
                     or self.HasRoleAdmin(user))

  def HasRoleMapCreator(self, user, domain):
    """Returns True if a user should get MAP_CREATOR access."""
    # Users get creator access if they have global map creator access or if
    # they have admin access.
    return user and (self._HasDomainPermission(user, Role.MAP_CREATOR, domain)
                     or self.HasRoleAdmin(user))

  def _HasMapPermission(self, user, role, map_object):
    if role == Role.MAP_VIEWER and map_object.world_readable:
      return True
    if not user:
      return False
    domain_role = (utils.GetUserDomain(user) in map_object.domains and
                   map_object.domain_role or None)

    # Map permissions exist in a hierarchy - editors can always view;
    # owners can always edit.
    if domain_role == Role.MAP_OWNER or user.email() in map_object.owners:
      return True
    if role == Role.MAP_OWNER:
      return False

    if domain_role == Role.MAP_EDITOR or user.email() in map_object.editors:
      return True
    if role == Role.MAP_EDITOR:
      return False

    if domain_role == Role.MAP_VIEWER or user.email() in map_object.viewers:
      return True
    return False

  def HasRoleMapOwner(self, user, map_object):
    """Returns True if a user should get MAP_OWNER access to a given map."""
    # Users get owner access if they are in the owners list for the map, if
    # their domain is an owner of the map, if they have global owner access
    # to all maps, or if they have admin access.
    return (self._HasMapPermission(user, Role.MAP_OWNER, map_object) or
            self.HasRoleAdmin(user))

  def HasRoleMapEditor(self, user, map_object):
    """Returns True if a user should get MAP_EDITOR access to a given map."""
    # Users get editor access if they are in the editors list for the map, if
    # their domain is an editor of the map, if they have global editor access
    # to all maps, or if they have owner access.
    return (self._HasMapPermission(user, Role.MAP_EDITOR, map_object) or
            self.HasRoleMapOwner(user, map_object))

  def HasRoleMapViewer(self, user, map_object):
    """Returns True if the user has MAP_VIEWER access to a given map."""
    # Users get viewer access if the map is world-readable, if they are in the
    # viewers list for the map, if their domain is a viewer of the map, if they
    # have global viewer access to all maps, or if they have editor access.
    return (self._HasMapPermission(user, Role.MAP_VIEWER, map_object) or
            self.HasRoleMapEditor(user, map_object))


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

  if role not in Role:
    raise ValueError('Invalid role %r' % role)
  policy = policy or AccessPolicy()
  user = user or utils.GetCurrentUser()

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
  user = user or utils.GetCurrentUser()  # ensure user is set in error message
  if not CheckAccess(role, target=target, user=user, policy=policy):
    raise AuthorizationError(user, role, target)
