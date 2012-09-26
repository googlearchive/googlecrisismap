// Copyright 2012 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

// Author: kpy@google.com (Ka-Ping Yee)

USER_EMAIL = 'username@hostname.org';
LOGIN_URL = '/test/login/whatever';
LOGOUT_URL = '/test/logout/whatever';

function LoginViewTest() {
  this.parent_ = new FakeElement('PARENT');
  cm.ui.create = gjstest.createMockFunction('cm.ui.create');
  cm.ui.createLink = gjstest.createMockFunction('cm.ui.createLink');
  FakeElement.prototype.appendChild = gjstest.createMockFunction('appendChild');
}
registerTestSuite(LoginViewTest);

/** Tests construction of the LoginView when the user is signed in. */
LoginViewTest.prototype.testSignedInConstruction = function() {
  cm_config = {'user_email': USER_EMAIL, 'logout_url': LOGOUT_URL,
               'login_url': LOGIN_URL};

  var userElem = new FakeElement('USER');
  expectCall(cm.ui.create)('span', recursivelyEquals({'class': 'cm-user'}),
                           USER_EMAIL)
      .willOnce(returnWith(userElem));
  var signOutLink = new FakeElement('LINK');
  expectCall(cm.ui.createLink)('Sign out', LOGOUT_URL)
      .willOnce(returnWith(signOutLink));
  var loginDiv = new FakeElement('LOGIN');
  expectCall(cm.ui.create)('div', recursivelyEquals({'class': 'cm-login'}),
                           userElem, cm.ui.SEPARATOR_DOT, signOutLink)
      .willOnce(returnWith(loginDiv));
  expectCall(this.parent_.appendChild)(loginDiv);

  var view = new cm.LoginView(this.parent_, cm_config);
};

/** Tests construction of the LoginView when the user is signed out. */
LoginViewTest.prototype.testSignedOutConstruction = function() {
  cm_config = {'logout_url': LOGOUT_URL, 'login_url': LOGIN_URL};

  var signInLink = new FakeElement('LINK');
  expectCall(cm.ui.createLink)('Sign in', LOGIN_URL)
      .willOnce(returnWith(signInLink));
  var loginDiv = new FakeElement('LOGIN');
  expectCall(cm.ui.create)('div', recursivelyEquals({'class': 'cm-login'}),
                           signInLink)
      .willOnce(returnWith(loginDiv));
  expectCall(this.parent_.appendChild)(loginDiv);

  var view = new cm.LoginView(this.parent_, cm_config);
};
