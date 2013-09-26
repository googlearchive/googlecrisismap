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

goog.require('cm.css');

USER_EMAIL = 'username@hostname.org';
LOGIN_URL = '/test/login/whatever';
LOGOUT_URL = '/test/logout/whatever';

function LoginViewTest() {
  cm.TestBase.call(this);
}
LoginViewTest.prototype = new cm.TestBase();
registerTestSuite(LoginViewTest);

/**
 * Creates a cm.LoginView.
 * @param {Object} config The configuration settings (cm_config).
 * @return {Element} A DOM element containing the new cm.LoginView.
 * @private
 */
LoginViewTest.prototype.createView_ = function(config) {
  var parent = cm.ui.create('div');
  new cm.LoginView(parent, config);
  return parent;
};

/** Tests construction of the LoginView when the user is signed in. */
LoginViewTest.prototype.testSignedInConstruction = function() {
  var parent = this.createView_({
      'login_url': LOGIN_URL,
      'logout_url': LOGOUT_URL,
      'user_email': USER_EMAIL
  });

  var div = expectDescendantOf(parent, 'div', withClass(cm.css.LOGIN));
  expectDescendantOf(div, 'span', withClass(cm.css.USER), withText(USER_EMAIL));
  expectDescendantOf(div, 'a', withHref(LOGOUT_URL), withText('Sign out'));
  expectNoDescendantOf(div, 'a', withHref(LOGIN_URL));
};

/** Tests construction of the LoginView when the user is signed out. */
LoginViewTest.prototype.testSignedOutConstruction = function() {
  var parent = this.createView_({
      'login_url': LOGIN_URL,
      'logout_url': LOGOUT_URL
  });

  var div = expectDescendantOf(parent, 'div', withClass(cm.css.LOGIN));
  expectDescendantOf(div, 'a', withHref(LOGIN_URL), withText('Sign in'));
  expectNoDescendantOf(div, 'span', withClass(cm.css.USER));
  expectNoDescendantOf(div, 'a', withHref(LOGOUT_URL));
};
