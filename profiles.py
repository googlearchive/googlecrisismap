#!/usr/bin/python
# Copyright 2012 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Storage for user preferences and action history."""

import utils

from google.appengine.ext import db

__author__ = 'romano@google.com (Raquel Romano)'


class ProfileModel(db.Model):
  """Private class for a user's profile."""
  marketing_consent = db.BooleanProperty(default=False)
  marketing_consent_answered = db.BooleanProperty(default=False)

  def SetMarketingConsent(self, value):
    """Update the user consent to receive marketing communication."""
    self.marketing_consent = value
    self.marketing_consent_answered = True
    self.put()


class Profile(object):
  """Public class for accessing a users profile."""

  @staticmethod
  def Get(user_email):
    """Return an object representing the user's profile."""
    return utils.StructFromModel(ProfileModel.get_by_key_name(user_email))

  @staticmethod
  def SetMarketingConsent(user_email, value):
    """Update the user's preference."""
    profile = ProfileModel.get_or_insert(user_email)
    profile.SetMarketingConsent(value)
