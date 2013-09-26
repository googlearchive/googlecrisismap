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
 * @fileoverview A popup which displays over the map to tell more about the map.
 */

goog.provide('cm.AboutPopup');

goog.require('cm');
goog.require('cm.css');
goog.require('cm.ui');
goog.require('goog.dom');

/**
 * A graphical element that displays information about the map.
 * @param {Element} container The element over which to render the about box.
 * @param {Element=} opt_aboutContainer The optional container for the about
 *   box.
 * @constructor
 */
cm.AboutPopup = function(container, opt_aboutContainer) {

  var aboutBox = cm.AboutPopup.populate_(opt_aboutContainer);

  if (aboutBox) {
    this.container_ = container;

    this.popup_ = cm.ui.create(
        'div', {'id': 'cm-about', 'class': cm.css.POPUP}, aboutBox);

    // Creates a close button for the about popup.
    cm.ui.createCloseButton(this.popup_, goog.bind(function() {
      this.popup_.parentNode.removeChild(this.popup_);
    }, this));
  }

};

/**
 * Shows the About this map popup.
 */
cm.AboutPopup.prototype.show = function() {
  var size = cm.ui.offscreenSize(this.popup_, this.container_);
  var x = Math.max(0, (this.container_.offsetWidth - size.width) / 2);
  var y = Math.max(0, (this.container_.offsetHeight - size.height) / 2);
  this.popup_.style.left = Math.round(x) + 'px';
  this.popup_.style.top = Math.round(y) + 'px';
  cm.ui.document.body.appendChild(this.popup_);
};

/**
 * Populate the about popup.
 * @param {Element=} opt_aboutContainer The optional container for the about
 *   box.
 * @return {Element} The new about box, populated.
 * @private
 */
cm.AboutPopup.populate_ = function(opt_aboutContainer) {
  var aboutBox = opt_aboutContainer || cm.ui.get('cm-aboutText');
  if (aboutBox) {
    var header = cm.ui.create('h2', {'id': 'cm-about-header'});
    header.appendChild(
        goog.dom.htmlToDocumentFragment(cm.MSG_ABOUT_HEADER));
    aboutBox.appendChild(header);
    var text = cm.ui.create('p', {
      'id': 'cm-about-text',
      'class': cm.css.ABOUT_TEXT
    });
    text.appendChild(goog.dom.htmlToDocumentFragment(cm.MSG_ABOUT_HTML));
    aboutBox.appendChild(text);
    aboutBox.style.display = 'block';
  }
  return aboutBox;
};
