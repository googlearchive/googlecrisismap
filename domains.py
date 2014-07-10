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

import cache
import config
import logs
import perms

from google.appengine.ext import db


# Dictionaries of domain settings, keyed by domain name.  The 100-ms ULL is
# intended to beat the time it takes for the domain admin page to redirect back
# to showing the domain settings after the user has edited them.
CACHE = cache.Cache('domains', 300, 0.1)

# The value to put in the datastore to represent an initial_domain_role of None
# (AppEngine doesn't index None, so we put this value instead).
NO_ROLE = 'NO_ROLE'


class UnknownDomainError(Exception):
  """Raised when the name of a nonexistent domain is specified."""

  def __init__(self, name):
    super(UnknownDomainError, self).__init__('No such domain %s' % name)
    self.name = name


class DomainModel(db.Model):
  """"A domain that has its own map catalog, permission settings, etc."""

  # If True, then catalog entries may only be overwritten by their creator or
  # by a domain admin.  Otherwise, catalog entries may be overwritten by anyone
  # with CATALOG_EDITOR permission for the domain.
  has_sticky_catalog_entries = db.BooleanProperty(default=False)

  # A label identifying which published map to display by default.
  default_label = db.StringProperty()

  # The domain_role given to new maps created in this domain, and the
  # role granted to all MAP_CREATORs upon mew map creation
  initial_domain_role = db.StringProperty()


class Domain(object):

  def __init__(self, domain_model):
    """Constructor not to be called directly; use Get or Create instead."""
    for attr in ['has_sticky_catalog_entries', 'default_label',
                 'initial_domain_role']:
      setattr(self, attr, getattr(domain_model, attr))
    self.name = domain_model.key().name()
    if self.initial_domain_role == NO_ROLE:
      self.initial_domain_role = None

  @classmethod
  def _UpdateCache(cls, domain):
    CACHE.Set(domain.name, {
        'has_sticky_catalog_entries': domain.has_sticky_catalog_entries,
        'default_label': domain.default_label,
        'initial_domain_role': domain.initial_domain_role
    })

  @staticmethod
  def NormalizeDomainName(domain_name):
    return str(domain_name).lower()

  @classmethod
  def Create(cls, domain_name, has_sticky_catalog_entries=False,
             default_label='empty', initial_domain_role=perms.Role.MAP_VIEWER,
             user=None):
    """Creates and stores a Domain object, overwriting any existing one."""
    domain_name = cls.NormalizeDomainName(domain_name)
    if not initial_domain_role:
      initial_domain_role = NO_ROLE
    domain_model = DomainModel(
        key_name=domain_name, default_label=default_label,
        has_sticky_catalog_entries=has_sticky_catalog_entries,
        initial_domain_role=initial_domain_role)
    domain_model.put()
    domain = Domain(domain_model)
    cls._UpdateCache(domain)
    logs.RecordEvent(logs.Event.DOMAIN_CREATED, domain_name=domain.name,
                     uid=user.id if user else None)
    return domain

  @classmethod
  def Get(cls, domain_name):
    """Gets the domain given its name."""
    domain_name = domain_name or config.Get('default_domain')
    domain_name = cls.NormalizeDomainName(domain_name)
    properties = CACHE.Get(domain_name)
    if properties:
      return cls(DomainModel(key_name=domain_name, **properties))
    domain_model = DomainModel.get_by_key_name(domain_name)
    if domain_model:
      domain = cls(domain_model)
      cls._UpdateCache(domain)
      return domain

  def Put(self, user=None):
    """Updates the settings for a domain."""
    perms.AssertAccess(perms.Role.DOMAIN_ADMIN, self.name, user)
    domain_model = DomainModel(
        key_name=self.name, default_label=self.default_label,
        has_sticky_catalog_entries=self.has_sticky_catalog_entries,
        initial_domain_role=self.initial_domain_role or NO_ROLE)
    domain_model.put()
    self._UpdateCache(self)
