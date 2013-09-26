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

"""Redirector from '/' or '/crisismap' to the appropriate map page."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import urllib

import base_handler
import config
import domains


def GetDestination(request, domain_name):
  """Based on the request, determines the map URL to redirect to."""
  # For backward compatibility, support the id= and crisis= parameters.
  label = request.get('id') or request.get('crisis')
  if not label:
    domain = domains.Domain.Get(domain_name)
    label = domain and domain.default_label or 'empty'
  if domain_name:
    url = request.root_path + '/' + domain_name + '/' + label
  else:
    url = request.root_path + '/' + label

  # Preserve all the query parameters except those that set the label.
  params = dict((key, value) for (key, value) in request.GET.items()
                if key not in ['id', 'crisis'])
  return url + (params and '?' + urllib.urlencode(params) or '')


class Index(base_handler.BaseHandler):
  """Redirector from '/' or '/crisismap' to the appropriate map page."""

  def Get(self, domain=''):
    self.redirect(
        str(GetDestination(self.request, domain)))  # non-Unicode is required
