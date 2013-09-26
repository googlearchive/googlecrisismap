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
import users
import utils

from google.appengine.ext import ndb

# A special user with ADMIN access.  Real user objects that come from a
# Google sign-in page always have numeric IDs.
ROOT = users.User(id='root')


class AuthorizationError(Exception):
  """Subject is not authorized to perform an operation on a domain or a map."""

  def __init__(self, subject, role, target):
    super(AuthorizationError, self).__init__(
        '%r lacks %s access to %r' % (subject, role, target))
    self.subject = subject
    self.role = role
    self.target = target


class NotCatalogEntryOwnerError(Exception):
  """User is not authorized to change or delete a catalog entry."""

  def __init__(self, subject, target):
    Exception.__init__(self, '%r does not own catalog entry %s/%s' %
                       (subject, target.domain, target.label))


class NotPublishableError(Exception):
  """Map is blocked and cannot be published."""

  def __init__(self, target):
    Exception.__init__(self, 'Map %r cannot be published.' % target.id)


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


class _PermissionModel(ndb.Model):
  # The entity that is granted permission to do something: a domain or uid
  subject = ndb.StringProperty()
  # The type of access being granted: a Role constant
  role = ndb.StringProperty()
  # The thing to which access is granted: a map, a domain, or GLOBAL_TARGET
  target = ndb.StringProperty()

  @classmethod
  def _get_kind(cls):  # pylint: disable=g-bad-name
    return 'PermissionModel'  # so we can name the Python class with _ in front

_Permission = collections.namedtuple(
    '_Permission', ['subject', 'role', 'target'])


def _PermissionCachePath(subject=None, target=None):
  return [_Permission, subject or '*', target or '*']


def _PermissionId(perm):
  return cache.ToCacheKey([_Permission, perm.subject, perm.role, perm.target])


def _FlushRelated(perm):
  for subject in [perm.subject, None]:
    for target in [perm.target, None]:
      cache.Delete(_PermissionCachePath(subject=subject, target=target))


def _LoadPermissions(subject, target):
  # No role arg because we never wish to load by role; we always load more
  # (by subject or target), then filter by role.
  query = _PermissionModel.query()
  if subject:
    query = query.filter(_PermissionModel.subject == subject)
  if target:
    query = query.filter(_PermissionModel.target == target)
  return [_Permission(p.subject, p.role, p.target) for p in query]


def _Query(subject, role, target):
  """Gets a list of all _Permissions matching a given subject, role, and target.

  Args:
    subject: A user ID or domain name, or None to query for all subjects.
    role: A Role constant, or None to query for all roles.
    target: A domain name, or None to query for all domains.
  Returns:
    A list of matching _Permission objects.
  """
  if subject and role and target:
    # When querying for just one item, let NDB take care of caching.
    p = _Permission(subject, role, target)
    return _PermissionModel.get_by_id(_PermissionId(p)) and [p] or []
  # Otherwise, use cache.Get to put the query result in memcache.
  perms = cache.Get(_PermissionCachePath(subject=subject, target=target),
                    make_value=lambda: _LoadPermissions(subject, target))
  return [p for p in perms if p.role == role] if role else perms


def _QueryForUser(user, role, target):
  """Gets all _Permissions for the user's ID and e-mail domain."""
  return _Query(user.id, role, target) + _Query(user.email_domain, role, target)


def _Exists(subject, role, target):
  """Returns True if the specified single _Permission exists."""
  return subject and role and target and bool(_Query(subject, role, target))


def _ExistsForUser(user, role, target):
  """Returns True if a _Permission exists for the user's ID or GA domain."""
  return (_Exists(user.id, role, target) or
          _Exists(user.email_domain, role, target))


def Grant(subject, role, target):
  """Grants the given role to the subject for the target.

  Args:
    subject: A user ID or domain name.
    role: A Role constant.
    target: A domain name.
  """
  perm = _Permission(subject, role, target)
  perm_model = _PermissionModel(
      subject=subject, role=role, target=target, id=_PermissionId(perm))
  perm_model.put()
  _FlushRelated(perm)


def _Revoke(perm):
  perm_model = _PermissionModel.get_by_id(_PermissionId(perm))
  if perm_model:
    perm_model.key.delete()
    _FlushRelated(perm)


def Revoke(subject, role, target):
  """Removes a specific permission.  Note: inherited access may still apply.

  Args:
    subject: A user ID or domain name.
    role: A Role constant.
    target: A domain name.
  """
  _Revoke(_Permission(subject, role, target))


def GetSubjectsForTarget(target):
  """Gets information on subjects that have any permissions to a given target.

  Args:
    target: A domain name.
  Returns:
    A dictionary whose keys are subjects (user IDs or domain names) and values
    are sets of the roles for those subjects.
  """
  result = {}
  for perm in _Query(None, None, target):
    result.setdefault(perm.subject, set()).add(perm.role)
  return result


def IsUserId(subject):
  """Returns True if the subject is a user ID, False if it's a domain."""
  return '.' not in subject


class AccessPolicy(object):
  """Wraps up authorization for user actions."""

  def HasRoleAdmin(self, user):
    """Returns True if a user should get ADMIN access."""
    # Users get admin access if they have the global ADMIN permission.  The
    # special user ROOT, which can only be created programmatically and cannot
    # come from a real Google sign-in page, also gets ADMIN access.
    return user and (_Exists(user.id, Role.ADMIN, GLOBAL_TARGET) or
                     user.id == ROOT.id)

  def HasRoleDomainAdmin(self, user, domain):
    """Returns True if the user should get DOMAIN_ADMIN access for a domain."""
    # Users get domain administration access if they have domain administrator
    # permission to the domain, or if they have global admin access.
    return user and (_ExistsForUser(user, Role.DOMAIN_ADMIN, domain) or
                     self.HasRoleAdmin(user))

  def HasRoleCatalogEditor(self, user, domain):
    """Returns True if a user should get CATALOG_EDITOR access for a domain."""
    # Users get catalog editor access if they have catalog editor permission to
    # the specified domain, or if they have domain admin access.
    return user and (_ExistsForUser(user, Role.CATALOG_EDITOR, domain) or
                     self.HasRoleDomainAdmin(user, domain))

  def HasRoleMapCreator(self, user, domain):
    """Returns True if a user should get MAP_CREATOR access."""
    # Users get map creator access if they have map creator permission to the
    # specified domain, or if they have catalog editor access.
    return user and (_ExistsForUser(user, Role.MAP_CREATOR, domain)
                     or self.HasRoleCatalogEditor(user, domain))

  def _HasMapPermission(self, user, role, map_object):
    # If the map is blocked, only the first owner can access it.
    if map_object.is_blocked:
      if not (user and [user.id] == map_object.owners[:1]):
        return False

    if role == Role.MAP_VIEWER and map_object.world_readable:
      return True
    if not user:
      return False
    domain_role = (user.email_domain in map_object.domains and
                   map_object.domain_role) or None

    # Map permissions exist in a hierarchy - editors can always view;
    # owners can always edit.
    if domain_role == Role.MAP_OWNER or user.id in map_object.owners:
      return True
    if role == Role.MAP_OWNER:
      return False

    if domain_role == Role.MAP_EDITOR or user.id in map_object.editors:
      return True
    if role == Role.MAP_EDITOR:
      return False

    if domain_role == Role.MAP_VIEWER or user.id in map_object.viewers:
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


def GetAccessibleDomains(user, role):
  """Gets the set of domains for which the user has the specified access."""
  # Ordered by increasing strength: stronger roles implicitly grant weaker ones.
  DOMAIN_ROLES = [Role.MAP_CREATOR, Role.CATALOG_EDITOR, Role.DOMAIN_ADMIN]
  if role not in DOMAIN_ROLES:
    return set()
  # This set includes the desired role and all stronger roles.
  qualifying_roles = DOMAIN_ROLES[DOMAIN_ROLES.index(role):]
  return {p.target for p in _QueryForUser(user, None, None)
          if p.role in qualifying_roles}


def CheckAccess(role, target=None, user=None, policy=None):
  """Checks whether the given user has the specified access role.

  Args:
    role: A Role constant identifying the desired access role.
    target: The object to which access is desired.  If 'role' is MAP_OWNER,
        MAP_EDITOR, or MAP_VIEWER, this should be a Map object.  If 'role' is
        CATALOG_EDITOR, MAP_CREATOR, or DOMAIN_ADMIN, this must be a domain
        name (a string).  For other roles, this argument is not used.
    user: (optional) A users.User object.  If not specified, access permissions
        are checked for the currently signed-in user.
    policy: The access policy to apply.

  Returns:
    True if the user has the specified access permission.

  Raises:
    ValueError: The specified role is not a valid member of Role.
    TypeError: The target has the wrong type for the given role.
  """

  def RequireTargetClass(required_cls, cls_desc):
    if not isinstance(target, required_cls):
      raise TypeError('For role %r, target must be a %s' % (role, cls_desc))

  if role not in Role:
    raise ValueError('Invalid role %r' % role)
  policy = policy or AccessPolicy()
  user = user or users.GetCurrent()

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
  if target.__class__.__name__ not in ['Map', 'EmptyMap']:
    raise TypeError('For role %r, target must be a Map' % role)
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
    user: (optional) A users.User object.  If not specified, access permissions
        are checked for the currently signed-in user.
    policy: The access policy to apply.

  Raises:
    AuthorizationError: If the user lacks the given access permission.
  """
  user = user or users.GetCurrent()  # ensure user is set in error message
  if not CheckAccess(role, target=target, user=user, policy=policy):
    raise AuthorizationError(user, role, target)


def AssertPublishable(map_object):
  """Requires that the given map be publishable."""
  if map_object.is_blocked:
    raise NotPublishableError(map_object)


def AssertCatalogEntryOwner(entry, user=None):
  user = user or users.GetCurrent()
  if user.id != entry.creator_uid:
    raise NotCatalogEntryOwnerError(user, entry)
