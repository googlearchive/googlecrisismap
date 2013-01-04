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

"""Tests for the handler defined in share.py."""

__author__ = 'muzny@google.com (Grace Muzny)'

import os

import model
import share
import test_utils

from google.appengine.api import mail
from google.appengine.api import users


class ShareTest(test_utils.BaseTest):
  """Tests for share handler class."""

  def setUp(self):
    super(ShareTest, self).setUp()
    # Clean up user env variables.
    os.environ.pop('USER_EMAIL', None)
    os.environ.pop('USER_ID', None)
    test_utils.BecomeAdmin()
    self.map = model.Map.Create('{}', owners=['owner@gmail.com'],
                                editors=['editor@gmail.com'],
                                viewers=['viewer@gmail.com'])

  def testSendPermissionChangeEmail(self):
    """Tests just the sending of the email to the recipient."""
    user = users.User('user@gmail.com')
    message = 'hello'
    roles = {model.ROLES.MAP_VIEWER: 'MAP_VIEWER',
             model.ROLES.MAP_EDITOR: 'MAP_EDITOR',
             model.ROLES.MAP_OWNER: 'MAP_OWNER'}
    user = users.User('user@gmail.com')

    for role in roles:
      handler = test_utils.SetupHandler('/share/%s' % self.map.id,
                                        share.Share(),
                                        'role=%s&recipient=%s&message=%s'
                                        % (roles[role],
                                           user.email(), message))
      subject = ('%s has shared "%s" with you' %
                 (users.get_current_user().email(), self.map.title))
      url = handler.request.host_url + '/crisismap/maps/' + self.map.id
      body = """
Your permission level for %s has changed to %s.
Access the map at: %s

%s""" % (self.map.title, roles[role], url, message)

      self.mox.StubOutWithMock(mail, 'send_mail')
      mail.send_mail('admin@google.com',
                     user.email(), subject, body)

      # Put in replay mode.
      self.mox.ReplayAll()
      handler.SendPermissionChangeEmail(user.email(), self.map,
                                        roles[role], message)
      self.mox.UnsetStubs()

  def testSharePostSuccess(self):
    """Shares the map with another person successfully."""
    roles = {model.ROLES.MAP_VIEWER: 'MAP_VIEWER',
             model.ROLES.MAP_EDITOR: 'MAP_EDITOR',
             model.ROLES.MAP_OWNER: 'MAP_OWNER'}
    user = users.User('user@gmail.com')
    access_policy = model.AccessPolicy()
    message = 'hello'
    for role in roles:
      handler = test_utils.SetupHandler('/share/%s' % self.map.id,
                                        share.Share(),
                                        'role=%s&recipient=%s&message=%s'
                                        % (roles[role],
                                           user.email(), message))

      subject = ('%s has shared "%s" with you' %
                 (users.get_current_user().email(), self.map.title))
      url = handler.request.host_url + '/crisismap/maps/' + self.map.id
      body = """
Your permission level for %s has changed to %s.
Access the map at: %s

%s""" % (self.map.title, roles[role], url, message)

      self.mox.StubOutWithMock(mail, 'send_mail')
      mail.send_mail(users.get_current_user().email(),
                     user.email(), subject, body)

      # Put in replay mode.
      self.mox.ReplayAll()
      handler.post(self.map.id)
      self.mox.UnsetStubs()
      # Refetch map because the object changed underneath.
      map_object = model.Map.Get(self.map.id)
      map_object.AssertAccess(role, user, access_policy)
      self.assertEquals(201, handler.response.status_int)

  def testSharePostFailureInvalidId(self):
    """Shares the map with another person-fails from invalid map id."""
    invalid_map_id = 'xxx' + self.map.id
    handler = test_utils.SetupHandler('/share/%s' % invalid_map_id,
                                      share.Share(),
                                      'role=%s&recipient=%s&message=%s'
                                      % ('MAP_VIEWER', 'user@gmail.com',
                                         'hello'))
    handler.post(invalid_map_id)
    self.assertEquals(404, handler.response.status_int)

  def testSharePostFailureInvalidRole(self):
    """Shares the map with another person-fails from invalid role type."""
    handler = test_utils.SetupHandler('/share/%s' % self.map.id,
                                      share.Share(),
                                      'role=%s&recipient=%s&message=%s'
                                      % ('other', 'user@gmail.com', 'hello'))
    handler.post(self.map.id)
    self.assertEquals(404, handler.response.status_int)

  def testSharePostFailureMissingParameter(self):
    """Shares the map with another person-fails from missing parameter."""
    role = 'MAP_VIEWER'
    email = 'user@gmail.com'
    message = 'hello'

    # Try with missing recipient email.
    handler = test_utils.SetupHandler('/share/%s' % self.map.id,
                                      share.Share(),
                                      'role=%s&message=%s'
                                      % (role, message))
    handler.post(self.map.id)
    self.assertEquals(404, handler.response.status_int)

    # Try with missing role.
    handler = test_utils.SetupHandler('/share/%s' % self.map.id,
                                      share.Share(),
                                      'recipient=%s&message=%s'
                                      % (email, message))
    handler.post(self.map.id)
    self.assertEquals(404, handler.response.status_int)


if __name__ == '__main__':
  test_utils.main()
