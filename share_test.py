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

MESSAGE = 'Skinnamarinkydinkydink'


class ShareTest(test_utils.BaseTest):
  """Tests for share handler class."""

  def setUp(self):
    super(ShareTest, self).setUp()
    self.m = test_utils.CreateMap(
        owners=['owner'], editors=['editor'], viewers=['viewer'])

  def testSharePostSuccess(self):
    """Shares the map with another person successfully."""
    user1 = test_utils.SetupUser(test_utils.Login('owner'))
    user4 = test_utils.SetupUser(test_utils.Login('friend'))
    expected_url = 'http://app.com/root/.maps/' + self.m.id

    self.mox.StubOutWithMock(mail, 'send_mail')
    for role in ['MAP_VIEWER', 'MAP_EDITOR', 'MAP_OWNER']:
      mail.send_mail(
          user1.email, user4.email,
          mox.Func(lambda subject: self.m.title in subject),
          mox.Func(lambda body: MESSAGE in body and expected_url in body))

    self.mox.ReplayAll()
    for role in ['MAP_VIEWER', 'MAP_EDITOR', 'MAP_OWNER']:
      with test_utils.Login('owner'):
        self.DoPost(
            '/.share/' + self.m.id,
            'role=%s&recipient=%s&message=%s&xsrf_token=XSRF' %
            (role, user4.email, MESSAGE))
        # Refetch map because the object changed underneath.
        model.Map.Get(self.m.id).AssertAccess(role, user4)

    self.mox.VerifyAll()

  def testSharePostFailureNotOwner(self):
    """Non-owners of a map should not be able to share it."""
    with test_utils.Login('editor'):
      self.DoPost('/.share/' + self.m.id,
                  'role=MAP_VIEWER&recipient=friend@gmail.test&xsrf_token=XSRF',
                  403)

  def testSharePostFailureInvalidId(self):
    """Sharing should fail if the map ID is invalid."""
    with test_utils.Login('owner'):
      self.DoPost('/.share/xxx',
                  'role=MAP_VIEWER&recipient=friend@gmail.test&xsrf_token=XSRF',
                  404)

  def testSharePostFailureInvalidRole(self):
    """Sharing should fail if the specified role is invalid."""
    with test_utils.Login('owner'):
      self.DoPost('/.share/%s' % self.m.id,
                  'role=other&recipient=friend@gmail.test&xsrf_token=XSRF', 400)

  def testSharePostFailureMissingParameter(self):
    """Sharing should fail if the role or recipient parameter is missing."""
    # Try with missing recipient email.
    with test_utils.Login('owner'):
      self.DoPost('/.share/%s' % self.m.id,
                  'role=MAP_VIEWER&xsrf_token=XSRF', 400)

    # Try with missing role.
    with test_utils.Login('owner'):
      self.DoPost('/.share/%s' % self.m.id,
                  'recipient=foo@bar.com&xsrf_token=XSRF', 400)

  def testSharePostFailureInvalidEmail(self):
    """Sharing should fail if the recipient's address is badly formatted."""
    with test_utils.Login('owner'):
      self.DoPost('/.share/%s' % self.m.id,
                  'role=MAP_VIEWER&recipient=@@..&xsrf_token=XSRF', 400)

if __name__ == '__main__':
  test_utils.main()
