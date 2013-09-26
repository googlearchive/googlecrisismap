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

goog.provide('cm.TabView');

goog.require('cm.TabBar');
goog.require('cm.TabItem');
goog.require('cm.events');
goog.require('cm.ui');

/**
 * An UI element for a group of tabs and a content region for  their associated
 * content; individual tabs are implemented as cm.TabItems then added to the
 * tab view.  Used in the tabbed panel.
 * @constructor
 */
cm.TabView = function() {
  /**
   * The view for the tab bar; the tab bar does not hold the tabs themselves
   * but it tracks the tabs in the same order as this.tabItems_, below, so
   * communication between the TabView and the TabBar is by index.
   * @type cm.TabBar
   * @private
   */
  this.tabBar_ = new cm.TabBar();

  /**
   * The index of the currently selected tab.
   * @type number
   * @private
   */
  this.selectedTabIndex_ = cm.TabView.NO_SELECTION;

  /**
   * The tabs currently in the view; this array is ordered to match the order
   * of the tabs in the tab bar.
   * @type Array.<cm.TabItem>
   * @private
   */
  this.tabItems_ = [];

  /**
   * The element where we display the content of the currently selected tab.
   * @type Element
   * @private
   */
  this.contentElem_ = cm.ui.create('div', {'class': cm.css.TAB_CONTENT});
};

/** Value for indices to indicate no current selection. */
cm.TabView.NO_SELECTION = -1;

/**
 * Inserts the TabView as a child of parent and causes the TabView
 * to render.
 * @param {Element} parent The parent into which the TabView should render.
 */
cm.TabView.prototype.render = function(parent) {
  this.tabBar_.render(parent);

  // Add the tab content.
  cm.ui.append(parent, this.contentElem_);

  cm.events.listen(this.tabBar_, cm.TabBar.NEW_TAB_SELECTED,
                   this.handleTabSelected_, this);
};

/**
 * Add a button to the tab bar. This can later take more arguments if we
 * want the caller to control how/where to add them.
 * @param {Element} button The button to add
 */
cm.TabView.prototype.addButton = function(button) {
  this.tabBar_.addButton(button);
};

/**
 * Fix the preferred height of the panel content so that it does not change on
 * tab selection but does change on window resize.
 * @param {number} height The new content panel height.
 */
cm.TabView.prototype.setHeight = function(height) {
  this.contentElem_.style.height = height - this.tabBar_.getHeight() + 'px';
};

/**
 * Update classes to either expand or collapse the tab panel.
 * @param {boolean} expand If true, expand the tab panel; otherwise,
 *   collapse it.
 */
cm.TabView.prototype.setExpanded = function(expand) {
  goog.dom.classes.enable(this.contentElem_, cm.css.TAB_CONTENT_COLLAPSED,
                          !expand);
};

/**
 * Updates the content of the TabView based on the state of the TabBar. Used
 * as the handler for selection events from the TabBar.
 * @private
 */
cm.TabView.prototype.handleTabSelected_ = function() {
  cm.ui.clear(this.contentElem_);
  if (this.selectedTabIndex_ !== cm.TabView.NO_SELECTION) {
    this.tabItems_[this.selectedTabIndex_].setSelected(false);
  }
  this.selectedTabIndex_ = this.tabBar_.getSelectedTab();
  this.tabItems_[this.selectedTabIndex_].setSelected(true);
  this.contentElem_.appendChild(
      this.tabItems_[this.selectedTabIndex_].getContent());
  cm.events.emit(this, cm.events.TAB_SELECTION_CHANGED);
};

/**
 * Primitive for inserting a tabItem in to the TabView at the given index; all
 * other code that adds tabs to the TabView (e.g. appendTab) should end up here.
 * Note that we must maintain the order of this.tabItems_ to match the order
 * of the tabs in this.tabBar_.
 * @param {cm.TabItem} tabItem The tab item to insert.
 * @param {number} index The index at which to insert.
 */
cm.TabView.prototype.insertTabItem = function(tabItem, index) {
  this.tabItems_.splice(index, 0, tabItem);
  this.tabBar_.insertTab(index, tabItem.getTitle(), tabItem.getIsEnabled());
  tabItem.setTabView(this);
  if (this.selectedTabIndex_ === cm.TabView.NO_SELECTION) {
    this.selectSomething_();
  }
};

/**
 * Adds a cm.TabItem as the last tab in the TabView.
 * @param {cm.TabItem} tabItem The item to append.
 */
cm.TabView.prototype.appendTabItem = function(tabItem) {
  this.insertTabItem(tabItem, this.tabItems_.length);
};

/**
 * Cause some tab to be selected; used when the selected tab has been
 * removed or disabled, or a new tab has been added and there is no tab
 * currently selected.
 * @private
 */
cm.TabView.prototype.selectSomething_ = function() {
  var tabIndex = -1;
  for (var i = 0; i < this.tabItems_.length; i++) {
    if (this.tabItems_[i].getIsEnabled()) {
      tabIndex = i;
      break;
    }
  }
  if (tabIndex < 0) return;
  this.tabBar_.selectTab(tabIndex);
  this.handleTabSelected_();
};

/**
 * Removes as tabItem from the TabView; does nothing if the tabItem is not
 * found.
 * @param {cm.TabItem} tabItem TheTab to be removed.
 */
cm.TabView.prototype.removeTabItem = function(tabItem) {
  var index = this.tabItems_.indexOf(tabItem);
  if (index === -1) return;
  var isSelected = index === this.selectedTabIndex_;
  if (isSelected) {
    cm.ui.clear(this.contentElem_);
    tabItem.setSelected(false);
    this.selectedTabIndex_ = cm.TabView.NO_SELECTION;
  }
  tabItem.setTabView(null);
  this.tabItems_.splice(index, 1);

  this.tabBar_.removeTab(index);
  if (isSelected) this.selectSomething_();
};

/**
 * Sets the selection in a TabView.
 * @param {cm.TabItem} tabItem The TabItem to be selected.
 */
cm.TabView.prototype.selectTabItem = function(tabItem) {
  var index = this.tabItems_.indexOf(tabItem);
  if (index === -1) return;
  this.tabBar_.selectTab(index);
  this.handleTabSelected_();
};

/**
 * Retrieves the currently selected tab or null if there is no selection.
 * @return {?cm.TabItem}
 */
cm.TabView.prototype.selectedTabItem = function() {
  return this.selectedTabIndex_ != cm.TabView.NO_SELECTION ?
      this.tabItems_[this.selectedTabIndex_] : null;
};

/**
 * Called by a TabItem to inform the TabView that its data (title, icon,
 * content) has changed.
 * @param {cm.TabItem} tabItem The tab item that has changed.
 */
cm.TabView.prototype.updateTabItem = function(tabItem) {
  var tabIndex = this.tabItems_.indexOf(tabItem);
  if (tabIndex == -1) return;
  this.tabBar_.updateTab(tabIndex, tabItem.getTitle(), tabItem.getIsEnabled());
  if (tabIndex === this.selectedTabIndex_) {
    if (tabItem.getIsEnabled()) {
      cm.ui.clear(this.contentElem_);
      this.contentElem_.appendChild(tabItem.getContent());
    } else {
      this.selectSomething_();
    }
  }
};
