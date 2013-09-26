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

"""Share handler that deals with permission level and email distribution."""

__author__ = 'muzny@google.com (Grace Muzny)'

import base_handler
import model
import perms
import users
import utils

from google.appengine.api import mail


SHARING_ROLES = {perms.Role.MAP_OWNER: 'owner',
                 perms.Role.MAP_EDITOR: 'editor',
                 perms.Role.MAP_VIEWER: 'viewer'}


class Share(base_handler.BaseHandler):
  """An interface for sharing maps between users."""

  def Post(self, map_id, domain=None):  # pylint: disable=unused-argument
    """Adds the recipient to the appropriate permission areas."""
    map_object = model.Map.Get(map_id)
    if map_object is None:
      raise base_handler.Error(404, 'Map %r not found.' % map_id)
    role = self.request.get('role')
    recipient_email = self.request.get('recipient')
    message = self.request.get('message', '')

    # If these are empty or invalid, we shouldn't try to do anything.
    if role not in SHARING_ROLES:
      raise base_handler.Error(400, 'Invalid role parameter: %r.' % role)
    if not utils.IsValidEmail(recipient_email):
      raise base_handler.Error(
          400, 'Invalid e-mail address: %r.' % recipient_email)

    # Change the recipient's permission level as specified.
    recipient = users.GetForEmail(recipient_email)
    map_object.ChangePermissionLevel(role, recipient.id)
    # Send the recipient an email.
    self.SendPermissionChangeEmail(recipient_email, map_object, role, message)
    self.response.set_status(201)

  def SendPermissionChangeEmail(self, recipient_email, map_object,
                                role, message):
    """Sends recipient_email an email with info of map and permission level."""
    email = users.GetCurrent().email
    subject = map_object.title
    url = (self.request.host_url + self.request.root_path + '/.maps/' +
           map_object.id)
    body = """
I've invited you to collaborate on the map "%s".
You can access the map at:

    %s

You have %s access; please use this invitation within 30 days.

%s""" % (map_object.title, url, SHARING_ROLES[role], message)
    mail.send_mail(email, recipient_email, subject, body)
