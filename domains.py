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


# Used when initial_domain_role should be None (but AppEngine won't
# let us search on that).
NO_ROLE = 'NO_ROLE'


class UnknownDomainError(Exception):
  """Returned when asked about to mutate a domain that does not exist."""

  def __init__(self, unknown_name):
    super(UnknownDomainError, self).__init__('No such domain %s' % unknown_name)
    self.unknown_name = unknown_name


class DomainModel(db.Model):
  """"A domain that has its own catalog of maps, permissions, etc."""

  # Value from LabelPolicy, above.
  has_sticky_catalog_entries = db.BooleanProperty(default=False)

  # The label of the map to display by default
  default_label = db.StringProperty()

  # The domain_role given to new maps created in this domain, and the
  # role granted to all MAP_CREATORs upon mew map creation
  initial_domain_role = db.StringProperty()


class Domain(object):

  def __init__(self, domain_model):
    """Constructor not to be called directly; use Get or New instead."""
    for attr in ['has_sticky_catalog_entries', 'default_label',
                 'initial_domain_role']:
      setattr(self, attr, getattr(domain_model, attr))
    self.name = domain_model.key().name()
    if self.initial_domain_role == NO_ROLE:
      self.initial_domain_role = None

  def _Cache(self):
    cached = {'has_sticky_catalog_entries': self.has_sticky_catalog_entries,
              'default_label': self.default_label,
              'initial_domain_role': self.initial_domain_role}
    cache.Set(['Domain', self.name], cached)

  @staticmethod
  def NormalizeDomainName(domain_name):
    return str(domain_name).lower()

  @staticmethod
  def Create(domain_name, has_sticky_catalog_entries=False,
             default_label='empty', initial_domain_role=perms.Role.MAP_VIEWER,
             user=None):
    """Creates and stores a Domain object, overwriting any existing one."""
    domain_name = Domain.NormalizeDomainName(domain_name)
    if not initial_domain_role:
      initial_domain_role = NO_ROLE
    domain_model = DomainModel(
        key_name=domain_name, default_label=default_label,
        has_sticky_catalog_entries=has_sticky_catalog_entries,
        initial_domain_role=initial_domain_role)
    domain_model.put()
    domain = Domain(domain_model)
    domain._Cache()  # pylint: disable=protected-access
    logs.RecordEvent(logs.Event.DOMAIN_CREATED, domain_name=domain.name,
                     uid=user.id if user else None)
    return domain

  @staticmethod
  def Get(domain_name):
    """Gets the domain given its name."""
    domain_name = domain_name or config.Get('default_domain')
    domain_name = Domain.NormalizeDomainName(domain_name)
    cached = cache.Get(['Domain', domain_name])
    if cached:
      domain_model = DomainModel(key_name=domain_name, **cached)
      return Domain(domain_model)
    domain_model = DomainModel.get_by_key_name(domain_name)
    if not domain_model:
      return None
    domain = Domain(domain_model)
    domain._Cache()  # pylint: disable=protected-access
    return domain

  def Put(self, user=None):
    perms.AssertAccess(perms.Role.DOMAIN_ADMIN, self.name, user)
    domain_model = DomainModel(
        key_name=self.name, default_label=self.default_label,
        has_sticky_catalog_entries=self.has_sticky_catalog_entries,
        initial_domain_role=self.initial_domain_role or NO_ROLE)
    domain_model.put()
    self._Cache()
