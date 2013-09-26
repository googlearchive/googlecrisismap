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

"""Handler that creates a new map."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import base_handler
import logs
import model
import users


class Create(base_handler.BaseHandler):
  """Handler that creates a new map."""

  def Post(self, domain, user):  # pylint: disable=unused-argument
    """Creates a new map."""
    map_object = model.Map.Create('{"title": "Untitled map"}', domain)
    acceptable_org = bool(self.request.get('acceptable_org'))
    logs.RecordEvent(
        logs.Event.MAP_CREATED,
        domain_name=domain,
        map_id=map_object.id,
        acceptable_purpose=bool(self.request.get('acceptable_purpose')),
        acceptable_org=acceptable_org,
        org_name=acceptable_org and self.request.get('organization') or '',
        uid=user.id)
    users.SetMarketingConsent(user.id, self.request.get('marketing_consent'))
    self.redirect('.maps/%s' % map_object.id)
