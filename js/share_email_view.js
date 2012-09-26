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
 * @author muzny@google.com (Grace Muzny)
 */
goog.provide('cm.ShareEmailView');

goog.require('cm.events');
goog.require('cm.ui');

/** @desc Text for title of popup. */
var MSG_SHARE_TITLE = goog.getMsg('Share Map With User');

/** @desc Text for alert when share handler returns a 404. */
var MSG_EMAIL_ERROR = goog.getMsg('Sorry, we had a problem sharing the map.');

/** @desc Text for label of message box. */
var MSG_MESSAGE = goog.getMsg('Message text');

/** @desc Text for label of message box. */
var MSG_EMAIL = goog.getMsg('User\'s email');

/** @desc Text for label viewer option. */
var MSG_VIEWER = goog.getMsg('viewer');

/** @desc Text for label of editor option. */
var MSG_EDITOR = goog.getMsg('editor');

/** @desc Text for label of owner option. */
var MSG_OWNER = goog.getMsg('owner');

/** @desc Text for label of message box. */
var MSG_PERMISSION = goog.getMsg('Permission type');

/** @desc Label for Share button in a dialog with Share and Cancel buttons. */
var MSG_SHARE = goog.getMsg('Share');

/** @desc Label for Cancel button in a dialog with Share and Cancel buttons. */
var MSG_CANCEL_BTN = goog.getMsg('Cancel');

/** Regex for verifying email addresses on a shallow level. */
var EMAIL_PATTERN = '^(.+)@(.+)$';

/**
 * A share and emailer. Call share() to show a dialog box to
 * share and email a user.
 * @constructor
 */
cm.ShareEmailView = function() {
  /**
   * @type Element
   * @private
   */
  this.popup_;

  /**
   * @type Element
   * @private
   */
  this.titleElem_;

  /**
   * @type Element
   * @private
   */
  this.tableElem_;

  /**
   * @type Element
   * @private
   */
  this.emailLabel_;

  /**
   * @type Element
   * @private
   */
  this.emailInput_;

  /**
   * @type Element
   * @private
   */
  this.viewer_;

  /**
   * @type Element
   * @private
   */
  this.editor_;

  /**
   * @type Element
   * @private
   */
  this.owner_;

  /**
   * @type Element
   * @private
   */
  this.messageLabel_;

  /**
   * @type Element
   * @private
   */
  this.messageBox_;

  /**
   * @type Element
   * @private
   */
  this.shareBtn_;

  /**
   * @type Element
   * @private
   */
  this.cancelBtn_;

  this.popup_ = cm.ui.create('div', {'class': 'cm-share-emailer cm-popup'},
      this.titleElem_ = cm.ui.create('h2', {}, MSG_SHARE_TITLE),
      this.tableElem_ = cm.ui.create('table'),
      cm.ui.create('div', {'class': 'cm-button-area'},
      this.shareBtn_ = cm.ui.create(
          'button', {'class': 'cm-button cm-submit'}, MSG_SHARE),
      this.cancelBtn_ = cm.ui.create(
          'button', {'class': 'cm-button'}, MSG_CANCEL_BTN)));

  cm.events.listen(this.shareBtn_, 'click', this.handleShare_, this);
  cm.events.listen(this.cancelBtn_, 'click', this.handleCancel_, this);
};

/**
 * Build and show the share and email popup box.
 * @param {string} share_url The object to share with another user.
 */
cm.ShareEmailView.prototype.share = function(share_url) {
  this.shareUrl_ = share_url;

  cm.ui.clear(this.tableElem_);
  this.emailInput_ = cm.ui.create('input');
  this.messageBox_ = cm.ui.create('textarea');
  this.viewer_ = cm.ui.create('input', {'type': 'radio',
                                        'name': 'role',
                                        'value': 'MAP_VIEWER',
                                        'checked': 'true'});
  this.editor_ = cm.ui.create('input', {'type': 'radio',
                                        'name': 'role',
                                        'value': 'MAP_EDITOR'});
  this.owner_ = cm.ui.create('input', {'type': 'radio',
                                       'name': 'role',
                                       'value': 'MAP_OWNER'});
  this.emailLabel_ = cm.ui.create('label', {}, MSG_EMAIL);

  cm.ui.append(this.tableElem_,
               cm.ui.create('tr', {},
                            cm.ui.create('th', {}, this.emailLabel_),
                            cm.ui.create('td', {}, this.emailInput_)),
               cm.ui.create('tr', {},
                            cm.ui.create('th', {},
                                         cm.ui.create('label', {},
                                                      MSG_PERMISSION)),
                            cm.ui.create('td', {},
                                         this.viewer_,
                                         cm.ui.create('label', {},
                                                      MSG_VIEWER),
                                         this.editor_,
                                         cm.ui.create('label', {},
                                                      MSG_EDITOR),
                                         this.owner_,
                                         cm.ui.create('label', {},
                                                      MSG_OWNER))),
               cm.ui.create('tr', {},
                            cm.ui.create('th', {},
                                         cm.ui.create('label', {},
                                                      MSG_MESSAGE)),
                            cm.ui.create('td', {}, this.messageBox_)));
  cm.ui.showPopup(this.popup_);
};

/**
 * Shows an error popup for if the share handler does not return a 201.
 */
cm.ShareEmailView.prototype.emailError = function() {
  var okayBtn;
  var errorPopup = cm.ui.create('div', {'class': 'cm-share-emailer cm-popup'},
      cm.ui.create('p', {'class': 'cm-email-error'}, MSG_EMAIL_ERROR),
      cm.ui.create('div', {'class': 'cm-button-area'},
                   okayBtn = cm.ui.create(
                       'button', {'class': 'cm-button cm-submit'}, MSG_OK)));
  cm.ui.showPopup(errorPopup);
  cm.events.listen(okayBtn, 'click', function() {
      cm.ui.remove(errorPopup);
    }, this);
};

/**
 * Shares the map at the proper permission level to the specified user.
 * @private
 */
cm.ShareEmailView.prototype.handleShare_ = function() {
  var messageText = this.messageBox_.value;
  var recipientEmail = this.emailInput_.value;

  if (recipientEmail.length === 0 || !recipientEmail.match(EMAIL_PATTERN)) {
    goog.dom.classes.add(this.emailLabel_, 'cm-email-error');
    return;
  }
  var permission = this.viewer_.value;
  if (this.editor_.checked) {
    permission = this.editor_.value;
  } else if (this.owner_.checked) {
    permission = this.owner_.value;
  }
  var postArgs = 'role=' + encodeURIComponent(permission) +
                 '&recipient=' + encodeURIComponent(recipientEmail) +
                 '&message=' + encodeURIComponent(messageText);
  goog.net.XhrIo.send(this.shareUrl_, function(e) {
      var success = (e.target.getStatus() === 201);
      cm.events.emit(goog.global, success ? cm.events.SHARE_EMAIL_SENT :
                     cm.events.SHARE_EMAIL_FAILED);
    }, 'POST', postArgs);
  cm.ui.remove(this.popup_);
};

/**
 * Cancels the user's decision to share.
 * @private
 */
cm.ShareEmailView.prototype.handleCancel_ = function() {
  cm.ui.remove(this.popup_);
};
