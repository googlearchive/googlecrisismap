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
      expected_url = 'http://app.com/root/.maps/' + self.map.id
      mail.send_mail(
          OWNER, RECIPIENT,
          mox.Func(lambda subject:
                   OWNER in subject and self.map.title in subject),
          mox.Func(lambda body:
                   role in body and MESSAGE in body and expected_url in body))

      self.mox.ReplayAll()
      self.DoPost(
          '/.share/' + self.map.id,
          'role=%s&recipient=%s&message=%s' % (role, RECIPIENT, MESSAGE))

      # Refetch map because the object changed underneath.
      model.Map.Get(self.map.id).AssertAccess(role, users.User(RECIPIENT))
      self.mox.VerifyAll()

      self.mox.UnsetStubs()

  def testSharePostFailureNotOwner(self):
    """Non-owners of a map should not be able to share it."""
    test_utils.SetUser('not_owner@gmail.com')
    self.DoPost('/.share/' + self.map.id,
                'role=MAP_VIEWER&recipient=user@gmail.com', status=403)

  def testSharePostFailureInvalidId(self):
    """Sharing should fail if the map ID is invalid."""
    invalid_map_id = 'xxx' + self.map.id
    self.DoPost('/.share/%s' % invalid_map_id,
                'role=MAP_VIEWER&recipient=user@gmail.com', status=404)

  def testSharePostFailureInvalidRole(self):
    """Sharing should fail if the specified role is invalid."""
    self.DoPost('/.share/%s' % self.map.id,
                'role=other&recipient=user@gmail.com', status=400)

  def testSharePostFailureMissingParameter(self):
    """Sharing should fail if the role or recipient parameter is missing."""
    # Try with missing recipient email.
    self.DoPost('/.share/%s' % self.map.id, 'role=MAP_VIEWER', status=400)

    # Try with missing role.
    self.DoPost('/.share/%s' % self.map.id, 'recipient=foo@bar.com', status=400)

if __name__ == '__main__':
  test_utils.main()
