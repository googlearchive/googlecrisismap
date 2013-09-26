// Copyright 2013 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

goog.provide('cm.TabBar');

goog.require('goog.ui.Tab');
goog.require('goog.ui.TabBar');


/**
 * The TabBar class used by TabView.  Currently, this is a thin shim on
 * goog.ui.TabBar; we add this class to both provide an abstraction layer and
 * to isolate goog.ui.TabBar in case we choose to remove it later.
 * @constructor
 */
cm.TabBar = function() {
  /**
   * @type goog.ui.TabBar
   * @private
   */
  this.tabBar_ = new goog.ui.TabBar(goog.ui.TabBar.Location.TOP);

  /**
   * The element containing the tab bar.
   * @type Element
   * @private
   */
  this.container_ = cm.ui.create('div', {'class': cm.css.TAB_BAR_CONTAINER});

  /**
   * A container for buttons that appear adjacent to the tab bar.
   * @type Element
   * @private
   */
  this.buttons_ = cm.ui.create('div', {'class': cm.css.TAB_BAR_BUTTONS});

  /**
   * The listeners to the tabs in the same order as they are
   * positioned in the tab bar. Selection events come from the individual tabs,
   * not the tab bar, so we need one listener per tab.
   * @type Array.<cm.events.ListenerToken>
   * @private
   */
  this.listeners_ = [];
};

/** Emitted when the user changes the selection in the tabbar. */
cm.TabBar.NEW_TAB_SELECTED = 'TabView.tabBar_.NEW_TAB_SELECTED';

/**
 * Renders the tab bar in to the given parent.
 * @param {Element} parent The node in to which the tab bar should be rendered.
 */
cm.TabBar.prototype.render = function(parent) {
  this.tabBar_.render(this.container_);
  cm.ui.append(this.container_, this.buttons_);
  cm.ui.append(parent, this.container_);
};

/**
 * Insert a button into the button region that is layed out with the tab bar.
 * The caller is responsible for managing events attached to the button.
 * @param {Element} button The button to add to the tab bar.
 */
cm.TabBar.prototype.addButton = function(button) {
  cm.ui.append(this.buttons_, button);
};

/**
 * Inserts a new tab at the given index.
 * @param {number} index The index at which to insert.
 * @param {string} title The title for the new tab.
 * @param {boolean} isEnabled Whether the tab should be enabled (true by
 *   default).
 */
cm.TabBar.prototype.insertTab = function(index, title, isEnabled) {
  var googTab = new goog.ui.Tab(title);
  var tok = cm.events.forward(googTab, goog.ui.Component.EventType.ACTION,
                              this, cm.TabBar.NEW_TAB_SELECTED);
  this.listeners_.splice(index, 0, tok);
  this.tabBar_.addChildAt(googTab, index, true);
  if (!isEnabled) {
    googTab.setEnabled(false);
  }
};

/**
 * Removes a tab.
 * @param {number} index The index of the tab to remove.
 */
cm.TabBar.prototype.removeTab = function(index) {
  cm.events.unlisten(this.listeners_[index]);
  this.tabBar_.removeChild(this.tabBar_.getChildAt(index), true);
  this.listeners_.splice(index, 1);
};

/**
 * Selects a tab.
 * @param {number} index The index of the tab to select.
 */
cm.TabBar.prototype.selectTab = function(index) {
  this.tabBar_.setSelectedTabIndex(index);
};

/**
 * Gets the index of the selected tab.
 * @return {number} The index of the selected tab.
 */
cm.TabBar.prototype.getSelectedTab = function() {
  return this.tabBar_.getSelectedTabIndex();
};

/**
 * Updates the title of a particular tab.
 * @param {number} index The index of the tab whose title is to be updated.
 * @param {string} title The new title fo the tab
 * @param {boolean} isEnabled Whether the tab is enabled.
 */
cm.TabBar.prototype.updateTab = function(index, title, isEnabled) {
  var tab = this.tabBar_.getChildAt(index);
  tab.setContent(title);
  tab.setEnabled(isEnabled);
};

/**
 *
 * @return {number} The tab bar's height.
 */
cm.TabBar.prototype.getHeight = function() {
  return this.container_.offsetHeight;
};
