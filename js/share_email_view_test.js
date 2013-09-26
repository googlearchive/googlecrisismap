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

// Author: muzny@google.com (Grace Muzny)

goog.require('cm.css');

function ShareEmailViewTest() {
  cm.TestBase.call(this);
  this.view_ = new cm.ShareEmailView();

  // Listen for a SHARE_EMAIL event.
  this.shareEmail_ = false;
  cm.events.listen(goog.global, cm.events.SHARE_EMAIL, function(e) {
      this.shareEmail_ = true;
    }, this);

  // Listen for a SHARE_EMAIL_SENT or SHARE_EMAIL_FAILED event.
  this.shareEmailSent_ = false;
  cm.events.listen(goog.global, cm.events.SHARE_EMAIL_SENT, function(e) {
      this.shareEmailSent_ = true;
    }, this);

  this.shareEmailFailed_ = false;
  cm.events.listen(goog.global, cm.events.SHARE_EMAIL_FAILED, function(e) {
      this.shareEmailFailed_ = true;
    }, this);

}
ShareEmailViewTest.prototype = new cm.TestBase();
registerTestSuite(ShareEmailViewTest);

/**
 * Opens the share popup.
 * @private
 */
ShareEmailViewTest.prototype.openShareEmail_ = function() {
  // Grab the popup that the ShareEmailView will open.
  var me = this;
  this.setForTest_('cm.ui.showPopup', function(popup) {
    me.popup_ = popup;
  });

  this.view_.share('bogus_url');
};


/** Tests that clicking the share button emits the proper event. */
ShareEmailViewTest.prototype.testShare = function() {
  this.openShareEmail_();

  // Click the 'Collaborate' button.
  var button = expectDescendantOf(this.popup_, 'button', withText('Invite'));
  cm.events.emit(button, 'click');

  var emailInput = expectDescendantOf(this.popup_,
                                      withClass(cm.css.EMAIL_ERROR));

  expectDescendantOf(this.popup_, 'input', withValue('MAP_VIEWER'));
  expectDescendantOf(this.popup_, 'input', withValue('MAP_EDITOR'));
  expectDescendantOf(this.popup_, 'input', withValue('MAP_OWNER'));


};

/** Tests that clicking the Cancel button removes the popup, sends no events. */
ShareEmailViewTest.prototype.testCancel = function() {
  this.openShareEmail_();

  // Click the Cancel button.
  var button = expectDescendantOf(this.popup_, 'button', withText('Cancel'));
  cm.events.emit(button, 'click');

  // Confirm that the SHARE_EMAIL_SENT or SHARE_EMAIL_FAILED events
  // were not emitted.
  expectFalse(this.shareEmailSent_);
  expectFalse(this.shareEmailFailed_);

  // Confirm that the popup disappeared.
  expectNoDescendantOf(cm.ui.document.body, this.popup_);
};
