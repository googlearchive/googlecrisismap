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

import model
import mox
import test_utils

from google.appengine.api import mail
from google.appengine.api import users


OWNER = 'owner@gmail.com'
RECIPIENT = 'recipient@gmail.com'
MESSAGE = 'Skinnamarinkydinkydink'


class ShareTest(test_utils.BaseTest):
  """Tests for share handler class."""

  def setUp(self):
    super(ShareTest, self).setUp()
    test_utils.BecomeAdmin()
    self.map = model.Map.Create('{}', 'xyz.com',
                                owners=['owner@gmail.com'],
                                editors=['editor@gmail.com'],
                                viewers=['viewer@gmail.com'])
    test_utils.SetUser(OWNER)

  def testSharePostSuccess(self):
    """Shares the map with another person successfully."""
    for role in ['MAP_VIEWER', 'MAP_EDITOR', 'MAP_OWNER']:
      self.mox.StubOutWithMock(mail, 'send_mail')
      # pylint: disable=g-long-lambda
      mail.send_mail(
          OWNER, RECIPIENT,
          mox.Func(lambda subject: (OWNER in subject and
                                    self.map.title in subject)),
          mox.Func(lambda body: (role in body and MESSAGE in body and
                                 '/root/.maps/' + self.map.id in body)))

      self.mox.ReplayAll()
      response = test_utils.DoPost(
          '/.share/' + self.map.id,
          'role=%s&recipient=%s&message=%s' % (role, RECIPIENT, MESSAGE))
      self.assertEquals(201, response.status_int)

      # Refetch map because the object changed underneath.
      model.Map.Get(self.map.id).AssertAccess(role, users.User(RECIPIENT))
      self.mox.VerifyAll()

      self.mox.UnsetStubs()

  def testSharePostFailureNotOwner(self):
    """Non-owners of a map should not be able to share it."""
    test_utils.SetUser('not_owner@gmail.com')
    response = test_utils.DoPost(
        '/.share/' + self.map.id,
        'role=MAP_VIEWER&recipient=%s&message=%s' % (RECIPIENT, MESSAGE))
    self.assertEquals(403, response.status_int)

  def testSharePostFailureInvalidId(self):
    """Sharing should fail if the map ID is invalid."""
    invalid_map_id = 'xxx' + self.map.id
    response = test_utils.DoPost(
        '/.share/%s' % invalid_map_id,
        'role=MAP_VIEWER&recipient=user@gmail.com&message=hello')
    self.assertEquals(404, response.status_int)

  def testSharePostFailureInvalidRole(self):
    """Sharing should fail if the specified role is invalid."""
    response = test_utils.DoPost(
        '/.share/%s' % self.map.id,
        'role=other&recipient=user@gmail.com&message=hello')
    self.assertEquals(400, response.status_int)

  def testSharePostFailureMissingParameter(self):
    """Sharing should fail if the role or recipient parameter is missing."""
    role = 'MAP_VIEWER'
    email = 'user@gmail.com'
    message = 'hello'

    # Try with missing recipient email.
    response = test_utils.DoPost(
        '/.share/%s' % self.map.id,
        'role=%s&message=%s' % (role, message))
    self.assertEquals(400, response.status_int)

    # Try with missing role.
    response = test_utils.DoPost(
        '/.share/%s' % self.map.id,
        'recipient=%s&message=%s' % (email, message))
    self.assertEquals(400, response.status_int)

if __name__ == '__main__':
  test_utils.main()
