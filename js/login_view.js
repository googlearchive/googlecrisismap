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

/**
 * @fileoverview User login status with links to sign in or sign out.
 * @author kpy@google.com (Ka-Ping Yee)
 */

goog.provide('cm.LoginView');

goog.require('cm.css');
goog.require('cm.ui');

/**
 * User login status with links to sign in or sign out.
 * @param {Element} parentElem The DOM element in which to place the view.
 * @param {Object=} clientConfig The client configuration object.
 * @constructor
 */
cm.LoginView = function(parentElem, clientConfig) {
  if (clientConfig['user_email']) {
    this.element_ = cm.ui.create('div', {'class': cm.css.LOGIN},
        cm.ui.create('span', {'class': cm.css.USER},
                     clientConfig['user_email']),
        cm.ui.SEPARATOR_DOT,
        cm.ui.createLink(cm.MSG_SIGN_OUT, clientConfig['logout_url']));
  } else {
    this.element_ = cm.ui.create('div', {'class': cm.css.LOGIN},
        cm.ui.createLink(cm.MSG_SIGN_IN, clientConfig['login_url']));
  }
  parentElem.appendChild(this.element_);
};

