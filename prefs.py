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
import users


class Prefs(base_handler.BaseHandler):
  """Handler for viewing and changing user preferences."""

  def Get(self):
    """Displays user preferences."""
    self.response.out.write(self.RenderTemplate('prefs.html', {}))

  def Post(self, user):
    """Updates user preferences."""
    # The 'save_keys' parameter determines which keys to save.  This lets us
    # selectively save individual preferences, while distinguishing between a
    # checkbox that is unchecked (which produces no query parameter at all)
    # and a key that we don't intend to change.
    save_keys = self.request.get('save_keys').split(',')
    if 'marketing_consent' in save_keys:
      users.SetMarketingConsent(user.id, self.request.get('marketing_consent'))
    if 'welcome_message_dismissed' in save_keys:
      users.SetWelcomeMessageDismissed(
          user.id, self.request.get('welcome_message_dismissed'))

    if self.request.get('redirect'):
      self.redirect(self.request.root_path + self.request.get('redirect'))
    else:
      self.response.set_status(204)
