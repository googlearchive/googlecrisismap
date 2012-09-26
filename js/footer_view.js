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
 * @fileoverview The footer below the map in the UI.
 */

goog.provide('cm.FooterView');

goog.require('cm');
goog.require('cm.AboutPopup');
goog.require('cm.Html');
goog.require('cm.MapModel');
goog.require('cm.ui');

/** @const */var CRISIS_RESPONSE_URL = 'http://www.google.org/crisisresponse/';

/** @desc The copyright tag in the footer. */
var MSG_COPYRIGHT = goog.getMsg('\xa9 Google');

/** @desc The text for the Crisis Response link in the footer. */
var MSG_CRISIS_RESPONSE = goog.getMsg('Google.org Crisis Response');

/** @desc The link text for the 'About this map' popup in the footer. */
var MSG_ABOUT_THIS_MAP = goog.getMsg('About this map');

/**
 * The footer below the map in the UI, which includes some custom text from the
 * map model as well as an "About" link that shows a popup.
 * TODO(kpy): Make this easier to customize for non-Google deployments.
 * @param {Element} parentElem The DOM element in which to place the footer.
 * @param {Element} popupContainer The DOM element on which to center the
 *     "About" popup window.
 * @param {cm.MapModel} mapModel The map model.
 * @constructor
 */
cm.FooterView = function(parentElem, popupContainer, mapModel) {
  /**
   * @type cm.AboutPopup
   * @private
   */
  this.aboutPopup_ = new cm.AboutPopup(popupContainer);

  parentElem.appendChild(cm.ui.create(
      'div', {}, /** @type cm.Html */(mapModel.get('footer'))));

  var aboutLink = cm.ui.createLink(MSG_ABOUT_THIS_MAP);
  parentElem.appendChild(cm.ui.create('div', {},
      MSG_COPYRIGHT,
      cm.ui.SEPARATOR_DOT,
      cm.ui.createLink(MSG_CRISIS_RESPONSE, CRISIS_RESPONSE_URL, '_blank'),
      cm.ui.SEPARATOR_DOT,
      aboutLink
  ));
  aboutLink.onclick = goog.bind(this.aboutPopup_.show, this.aboutPopup_);
};
