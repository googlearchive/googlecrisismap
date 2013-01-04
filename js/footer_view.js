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

/** @desc The link text for opening the map in a new browser window. */
var MSG_FULL_MAP_LINK = goog.getMsg('Full map');

/** @desc The link text in the footer for the pop-up with help instructions. */
var MSG_HELP = goog.getMsg('Help');

/**
 * The footer below the map in the UI, which includes some custom text from the
 * map model as well as a "Help" link that shows a popup.
 * @param {Element} parentElem The DOM element in which to place the footer.
 * @param {Element} popupContainer The DOM element on which to center the
 *     "Help" popup window.
 * @param {cm.MapModel} mapModel The map model.
 * @constructor
 */
cm.FooterView = function(parentElem, popupContainer, mapModel) {
  /**
   * @type cm.AboutPopup
   * @private
   */
  this.aboutPopup_ = new cm.AboutPopup(popupContainer);

  /**
   * @type cm.MapModel
   * @private
   */
  this.mapModel_ = mapModel;

  /**
   * @type Element
   * @private
   */
  this.footerSpan_ = cm.ui.create('span');

  cm.ui.append(parentElem, this.footerSpan_);

  if (window != window.top) {
    var uri = new goog.Uri(goog.global.location);
    uri.removeParameter('embedded');
    var fullMapLink = cm.ui.createLink(MSG_FULL_MAP_LINK, '' + uri, '_blank');
    cm.ui.append(parentElem, fullMapLink, cm.ui.SEPARATOR_DOT);
  }

  var helpLink = cm.ui.createLink(MSG_HELP);
  helpLink.onclick = goog.bind(this.aboutPopup_.show, this.aboutPopup_);
  cm.ui.append(parentElem, helpLink);

  cm.events.onChange(mapModel, 'footer', this.updateFooter_, this);
  this.updateFooter_();
};

/** @private Updates the footer to match the MapModel. */
cm.FooterView.prototype.updateFooter_ = function() {
  var footer = /** @type cm.Html */(this.mapModel_.get('footer'));
  (footer || cm.Html.EMPTY).pasteInto(this.footerSpan_);
};
