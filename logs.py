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

"""Storage for application-wide event logs."""

import datetime
import logging
import users
import utils

from google.appengine.ext import db

__author__ = 'romano@google.com (Raquel Romano)'

# Events to log.
# Event is capitalized like an enum class.  # pylint: disable=g-bad-name
Event = utils.Struct(
    DOMAIN_CREATED='DOMAIN_CREATED',
    MAP_CREATED='MAP_CREATED',
    MAP_DELETED='MAP_DELETED',
    MAP_PUBLISHED='MAP_PUBLISHED',
    MAP_UNPUBLISHED='MAP_UNPUBLISHED',
    MAP_UNDELETED='MAP_UNDELETED',
    MAP_BLOCKED='MAP_BLOCKED',
    MAP_UNBLOCKED='MAP_UNBLOCKED',
    MAP_WIPED='MAP_WIPED'
)


class EventLog(db.Model):
  """Information about an interesting event."""
  time = db.DateTimeProperty()
  uid = db.StringProperty()
  event = db.StringProperty(required=True, choices=list(Event))
  domain_name = db.StringProperty()
  map_id = db.StringProperty()
  map_version_key = db.StringProperty()
  catalog_entry_key = db.StringProperty()
  acceptable_purpose = db.BooleanProperty(default=False)
  acceptable_org = db.BooleanProperty(default=False)
  org_name = db.StringProperty()


def RecordEvent(event, domain_name=None, map_id=None, map_version_key=None,
                catalog_entry_key=None, acceptable_purpose=None,
                acceptable_org=None, org_name=None, uid=None):
  """Stores an event log entry."""
  if not uid:
    user = users.GetCurrent()
    uid = user and user.id or None
  try:
    EventLog(time=datetime.datetime.utcnow(),
             uid=uid,
             event=event,
             domain_name=domain_name,
             map_id=map_id,
             map_version_key=map_version_key,
             catalog_entry_key=catalog_entry_key,
             acceptable_purpose=acceptable_purpose,
             acceptable_org=acceptable_org,
             org_name=org_name).put()
  except Exception, e:  # pylint: disable=broad-except
    logging.exception(e)
