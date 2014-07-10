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

"""Model and data object for representing Domains."""

import re

import cache
import logs
import perms
import utils

from google.appengine.ext import ndb


# Domain objects keyed by domain name.  The 100-ms ULL is intended to beat the
# time it takes for the domain admin page to redirect back to showing the
# domain settings after the user has edited them.
CACHE = cache.Cache('domains', 300, 0.1)


class _DomainModel(ndb.Model):
  """"A domain that has its own map catalog, permission settings, etc."""

  # If True, then catalog entries may only be overwritten by their creator or
  # by a domain admin.  Otherwise, catalog entries may be overwritten by anyone
  # with CATALOG_EDITOR permission for the domain.
  has_sticky_catalog_entries = ndb.BooleanProperty()

  # A label identifying which published map to display by default.
  default_label = ndb.StringProperty()

  # When a new map is created in this domain: (a) this role becomes the new
  # map's domain_role (which applies to all users with this e-mail domain);
  # and (b) all users who have access to this domain (any domain-targeted role)
  # are also individually granted this access role on the new map.
  initial_domain_role = ndb.StringProperty(
      choices=[perms.Role.NONE] + perms.MAP_ROLES)

  @classmethod
  def _get_kind(cls):  # pylint: disable=g-bad-name
    return 'DomainModel'  # so we can name the Python class with a _


def NormalizeDomainName(name):
  name = str(name).lower()
  if not re.match('^[a-z0-9.-]+$', name):
    raise ValueError('Invalid domain name %r' % name)
  return name


class Domain(utils.Struct):

  name = property(lambda self: self.id)

  @classmethod
  def Get(cls, name):
    """Gets a Domain by name."""
    name = NormalizeDomainName(name)
    return CACHE.Get(name, lambda: cls.FromModel(_DomainModel.get_by_id(name)))

  @classmethod
  def Put(cls, name, default_label=None, has_sticky_catalog_entries=None,
          initial_domain_role=None, user=None):
    """Creates and stores a Domain object, overwriting any existing one."""
    name = NormalizeDomainName(name)
    domain_model = _DomainModel.get_by_id(name)
    if domain_model:  # modify an existing entity (DOMAIN_ADMIN is required)
      perms.AssertAccess(perms.Role.DOMAIN_ADMIN, name, user)
      if default_label is not None:
        domain_model.default_label = default_label
      if has_sticky_catalog_entries is not None:
        domain_model.has_sticky_catalog_entries = has_sticky_catalog_entries
      if initial_domain_role is not None:
        domain_model.initial_domain_role = initial_domain_role
      domain_model.put()
    else:  # create a new entity (no permissions are required)
      if default_label is None:
        default_label = 'empty'
      if initial_domain_role is None:
        initial_domain_role = perms.Role.MAP_VIEWER
      domain_model = _DomainModel(
          id=name, default_label=default_label,
          has_sticky_catalog_entries=bool(has_sticky_catalog_entries),
          initial_domain_role=initial_domain_role)
      domain_model.put()
      logs.RecordEvent(logs.Event.DOMAIN_CREATED, domain_name=name,
                       uid=user.id if user else None)
    domain = cls.FromModel(domain_model)
    CACHE.Set(name, domain)
    return domain
