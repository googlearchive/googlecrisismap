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

import logging
import utils

from google.appengine.ext import db

__author__ = 'romano@google.com (Raquel Romano)'

# User actions to log.
# Action is capitalized like an enum class.  # pylint: disable=g-bad-name
Action = utils.Struct(
    CREATE='CREATE',
    DELETE='DELETE',
    PUBLISH='PUBLISH',
)


class UserActionLog(db.Model):
  """Information about a user action."""
  time = db.DateTimeProperty(auto_now_add=True)
  user = db.UserProperty(auto_current_user_add=True)
  action = db.StringProperty(required=True, choices=list(Action))
  map_id = db.StringProperty()
  map_version_key = db.StringProperty()
  catalog_entry_key = db.StringProperty()
  acceptable_purpose = db.BooleanProperty(default=False)
  acceptable_org = db.BooleanProperty(default=False)
  org_name = db.StringProperty()

  @staticmethod
  def Log(action, map_id=None, map_version_key=None, catalog_entry_key=None,
          acceptable_purpose=None, acceptable_org=None, org_name=None):
    """Stores a user action log entry."""
    try:
      UserActionLog(action=action, map_id=map_id,
                    map_version_key=map_version_key,
                    catalog_entry_key=catalog_entry_key,
                    acceptable_purpose=acceptable_purpose,
                    acceptable_org=acceptable_org,
                    org_name=org_name).put()
    except Exception, e:  # pylint: disable=broad-except
      logging.exception(e)
