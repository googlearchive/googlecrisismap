#!/usr/bin/python
# Copyright 2013 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Sets up domains where all members can publish and catalog entries are sticky.

Usage: tools/console <server_url> tools/domain_init.py <domain_name>...
"""

import sys

import domains
import perms


def CreateOpenDomain(domain_name):
  domains.Domain.Create(domain_name)
  d = domains.DomainModel.get_by_key_name(domain_name)
  d.has_sticky_catalog_entries = True
  d.initial_domain_role = None
  d.put()
  perms.Grant(domain_name, 'CATALOG_EDITOR', domain_name)


for name in sys.argv[1:]:
  CreateOpenDomain(name)
  print 'Created domain:', name
