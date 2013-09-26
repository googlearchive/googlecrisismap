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

"""Endpoint for updating user preferences."""

__author__ = 'romano@google.com (Raquel Romano)'

import base_handler
import profiles


class Prefs(base_handler.BaseHandler):
  """Handler for viewing and changing user preferences."""

  def Get(self, user):
    """Displays user preferences."""
    user_profile = profiles.Profile.Get(user.email())
    consent = user_profile.marketing_consent if user_profile else None

    self.response.out.write(self.RenderTemplate('prefs.html', {
        'pref_marketing_consent': consent
        }))

  def Post(self, user):
    """Updates user preferences."""
    profiles.Profile.SetMarketingConsent(
        user.email(), bool(self.request.get('marketing_consent')))
    self.redirect('.maps')
