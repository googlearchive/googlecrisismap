#!/usr/bin/python
# Copyright 2013 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""A fake login page for development."""

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import json

import base_handler
import users


class Login(base_handler.BaseHandler):
  def Get(self):
    """Renders the developer login page."""
    if not users.IsDeveloper():
      raise base_handler.Error(404, 'Not found.')

    if self.request.get('logout'):
      self.response.delete_cookie('crisismap_login')
      self.response.delete_cookie('dev_appserver_login')
      return self.redirect(str(self.request.get('redirect', self.request.path)))

    def SortKey(user):
      if user.id == 'root':
        return (0,)
      if user.id.startswith('test'):
        return (1, user.email_domain, int(user.id[4:]))
      return (2, user.email_domain, user.email)
    previous_users = sorted(users.GetAll(), key=SortKey)

    new_users = []
    if not any(u.id == 'root' for u in previous_users):
      new_users = [users.User(id='root', email='root@gmail.test')]
    old_uids = [u.id for u in previous_users if u.id.startswith('test')]
    uid = 'test%d' % (max(int(uid[4:]) for uid in ['test0'] + old_uids) + 1)
    new_users += [
        users.User(id=uid, email=uid + '@gmail.test'),
        users.User(id=uid, ga_domain='alpha.test', email=uid + '@alpha.test'),
        users.User(id=uid, ga_domain='beta.test', email=uid + '@beta.test')
    ]

    self.response.out.write(self.RenderTemplate('login.html', {
        'redirect_json': json.dumps(self.request.get('redirect', '')),
        'previous_users': previous_users,
        'new_users': new_users
    }))
