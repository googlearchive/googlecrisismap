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
 * @fileoverview A dropdown menu of links to other maps.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.MapPicker');

goog.require('cm');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.Uri');
goog.require('goog.array');

/**
 * A dropdown triangle that reveals a menu of links to other maps.
 * @param {Element} parentElem The element in which to display the arrow.
 *     The menu will appear when the arrow is clicked.
 * @param {Array} menuItems An array of items, where each item has the keys:
 *     title: The title to display in the menu.
 *     url: The URL to navigate to when the item is clicked.
 * @constructor
 */
cm.MapPicker = function(parentElem, menuItems) {
  /**
   * @type boolean
   * @private
   */
  this.menuShown_;

  /**
   * @type Element
   * @private
   */
  this.menuElem_;

  /**
   * @type Element
   * @private
   */
  this.buttonElem_;

  var menuElem = cm.MapPicker.createMenu_(menuItems);
  this.createMenuButton_(parentElem, menuElem);
};

/**
 * Constructs the menu of maps.
 * @param {Array} menuItems An array of items, where each item has the keys:
 *     title: The title to display in the menu.
 *     url: The URL to navigate to when the item is clicked.
 * @return {Element} The menu's top-level element.
 * @private
 */
cm.MapPicker.createMenu_ = function(menuItems) {
  var currentUrl = new goog.Uri(goog.global.location);
  currentUrl.setQuery('');
  currentUrl.setFragment('');
  return cm.ui.create('ul', {'class': [cm.css.POPUP, cm.css.MAP_PICKER]},
                      goog.array.map(menuItems, function(item) {
    var destinationUrl = currentUrl.resolve(new goog.Uri(item.url));
    var selected = (destinationUrl.toString() === currentUrl.toString());
    var link = cm.ui.create(
        'li', selected ? {'class': cm.css.SELECTED} : {},
        cm.ui.createLink(item.title, selected ? null : item.url));
    cm.events.listen(link, 'click', function() {
      cm.Analytics.logAction(
          cm.Analytics.LayersPanelAction.MAP_PICKER_ITEM_SELECTED, null);
    });
    return link;
  }));
};

/**
 * Aligns the top-left or top-right corner of the menu with the menu button.
 * @param {Element} menu The menu element to position.
 * @param {Element} button The menu button with which to align the menu.
 * @private
 */
cm.MapPicker.positionMenu_ = function(menu, button) {
  var menuWidth = cm.ui.offscreenSize(menu, cm.ui.document.body).width;
  var buttonPos = goog.style.getPageOffset(button);
  var buttonSize = goog.style.getSize(button);
  // If the menu fits on the left (right edge aligned with button), put it
  // there; otherwise put it as far left as it will go.
  var menuOnLeftX = buttonPos.x + buttonSize.width - menuWidth;
  menu.style.left = (menuOnLeftX < 4 ? 4 : menuOnLeftX) + 'px';
  menu.style.top = (buttonPos.y + buttonSize.height) + 'px';
};

/**
 * Shows or hides the menu.
 * @param {boolean} show If true, show menu, otherwise hide it.
 */
cm.MapPicker.prototype.showMenu = function(show) {
  if (show) {
    cm.MapPicker.positionMenu_(this.menuElem_, this.buttonElem_);
    cm.ui.append(cm.ui.document.body, this.menuElem_);
  } else {
    cm.ui.remove(this.menuElem_);
  }
  this.menuShown_ = show;
};

/**
 * Creates the dropdown button with listeners to open the menu when clicked.
 * @param {Element} parentElem The parent element in which to create the button.
 * @param {Element} menuElem The menu to show when the button is clicked.
 * @private
 */
cm.MapPicker.prototype.createMenuButton_ = function(parentElem, menuElem) {
  this.menuShown_ = false;
  this.menuElem_ = menuElem;
  this.buttonElem_ = cm.ui.create('div', {'class': cm.css.MAP_PICKER_BUTTON});

  cm.ui.append(parentElem, this.buttonElem_);

  cm.events.listen(cm.ui.document.body, 'click', goog.bind(function(e) {
    // If the user clicks on the button, we toggle whether the menu is showing.
    // If the user clicks anywhere else, we hide the menu.
    this.showMenu((e.target == this.buttonElem_) ? !this.menuShown_ : false);
  }, this));
  // If things move around, just hide the menu (don't bother to reposition it).
  // Collapsing the cm.PanelView emits 'resize' on the window, so this happens
  // on panel expand/collapse as well as manual resizing of the browser window.
  cm.events.listen(goog.global, 'resize', goog.bind(function(e) {
    this.showMenu(false);
  }, this));
};
