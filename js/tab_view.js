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
goog.require('goog.array');
goog.require('goog.module');

/**
 * An UI element for a group of tabs and a content region for their associated
 * content; individual tabs are implemented as cm.TabItems then added to the
 * tab view.  Used in the tabbed panel.
 * @param {!cm.MapModel} mapModel The map model for which to create the tab
 *     view.
 * @param {Object=} opt_config Configuration settings.  These fields are used:
 *     enable_editing: Allow any editing at all?  If true, the following fields
 *         are also used:
 *         save_url: The URL to post to upon save
 *         dev_mode: Enable development mode?
 *         map_list_url: The URL to go to the list of maps
 *         diff_url: The URL to go to see the diff in the map model.
 * @constructor
 */
cm.TabView = function(mapModel, opt_config) {
  /** @private {!cm.MapModel} The map model. */
  this.mapModel_ = mapModel;

  /** @private {!Object} The client configuration. */
  this.config_ = opt_config || {};

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
   * The element containing the editing toolbar if editing is enabled.
   * @private {?Element}
   */
  this.toolbarElem_ = null;

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

  if (this.config_['enable_editing']) {
    this.toolbarElem_ = cm.ui.create('div');
    cm.ui.append(parent, this.toolbarElem_);
    goog.module.require('edit', 'cm.ToolbarView',
                        goog.bind(this.toolbarViewHandler_, this));
  }

  // Add the tab content.
  cm.ui.append(parent, this.contentElem_);

  cm.events.listen(this.tabBar_, cm.TabBar.TAB_SELECTED,
                   this.handleTabSelected_, this);
};

/**
 * Callback for loading cm.ToolbarView from edit module.
 * @param {Function} toolbarViewCtor The cm.ToolbarView constructor.
 * @private
 */
cm.TabView.prototype.toolbarViewHandler_ = function(toolbarViewCtor) {
  new toolbarViewCtor(
       this.toolbarElem_, this.mapModel_, !!this.config_['save_url'],
       this.config_['dev_mode'], this.config_['map_list_url'],
       cm.util.browserSupportsTouch(), this.config_['diff_url']);
  cm.events.emit(cm.app, 'resize');
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
 * Resize tab content to not exceed the given maximum height.
 * @param {number} maxPanelHeight The maximum height the panel can reach.
 * @param {boolean} below Whether the tab panel is below the map.
 */
cm.TabView.prototype.resize = function(maxPanelHeight, below) {
  var contentOffset = this.tabBar_.getHeight();
  if (this.toolbarElem_) {
    contentOffset += goog.style.getSize(this.toolbarElem_).height;
  }

  var height = maxPanelHeight - contentOffset + 'px';
  if (below) {
    this.contentElem_.style.height = height;
    this.contentElem_.style.maxHeight = '';
  } else {
    this.contentElem_.style.height = '';
    this.contentElem_.style.maxHeight = height;
  }
};

/**
 * Update classes to either expand or collapse the tab panel.
 * @param {boolean} expand If true, expand the tab panel; otherwise,
 *   collapse it.
 */
cm.TabView.prototype.setExpanded = function(expand) {
  goog.style.setElementShown(this.contentElem_, expand);
  if (this.toolbarElem_) {
    goog.style.setElementShown(this.toolbarElem_, expand);
  }
  // On expanding, select the tab that was selected before the view was
  // collapsed. On collapsing, just deselect the tab bar, but remember the
  // index of the currently selected item
  this.tabBar_.selectTab(
      expand ? this.selectedTabIndex_ : cm.TabView.NO_SELECTION);
};

/**
 * Return the tab item that has the given title, or null if there is none.
 * @param {string} title The tab title.
 * @return {?cm.TabItem} The tab item if it exists.
 */
cm.TabView.prototype.getTabItemByTitle = function(title) {
  return (goog.array.find(this.tabItems_, function(tab, index, items) {
    return tab.getTitle() === title;
  }));
};

/**
 * Updates the content of the TabView based on the state of the TabBar. Used as
 * the handler for selection events from the TabBar. If an unselected tab is
 * clicked on, it gets selected; if a selected tab is clicked on, it emits the
 * cm.events.SAME_TAB_SELECTED event.
 * @private
 */
cm.TabView.prototype.handleTabSelected_ = function() {
  if (this.selectedTabIndex_ == this.tabBar_.getSelectedTab()) {
    cm.events.emit(this, cm.events.SAME_TAB_SELECTED);
    return;
  }
  cm.Analytics.logAction(
      this.tabItems_[this.tabBar_.getSelectedTab()].analyticsSelectionEvent(),
      null);
  this.doSelectTabItem_();

  var start = cm.Analytics.getTimer(cm.Analytics.Timer.PANEL_TAB_SELECTED);
  cm.Analytics.logTime(
      cm.Analytics.TimingCategory.PANEL_ACTION,
      cm.Analytics.TimingVariable.PANEL_TAB_CHANGED, goog.now() - start,
      this.selectedTabItem().getTitle());
};

/**
 * Updates the content of the TabView based on the state of the TabBar. Used
 * as the handler for selection events from the TabBar.
 * @private
 */
cm.TabView.prototype.doSelectTabItem_ = function() {
  cm.ui.clear(this.contentElem_);
  if (this.selectedTabIndex_ !== cm.TabView.NO_SELECTION) {
    this.tabItems_[this.selectedTabIndex_].setSelected(false);
  }
  this.selectedTabIndex_ = this.tabBar_.getSelectedTab();
  this.tabItems_[this.selectedTabIndex_].setSelected(true);
  cm.ui.append(this.contentElem_,
               this.tabItems_[this.selectedTabIndex_].getContent());
  cm.events.emit(this, cm.events.NEW_TAB_SELECTED);
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
  this.doSelectTabItem_();
};

/**
 * Removes as tabItem from the TabView; does nothing if the tabItem is not
 * found.
 * @param {cm.TabItem} tabItem TheTab to be removed.
 */
cm.TabView.prototype.removeTabItem = function(tabItem) {
  var index = goog.array.indexOf(this.tabItems_, tabItem);
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
  var index = goog.array.indexOf(this.tabItems_, tabItem);
  if (index === -1) return;
  this.tabBar_.selectTab(index);
  this.doSelectTabItem_();
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
  var tabIndex = goog.array.indexOf(this.tabItems_, tabItem);
  if (tabIndex == -1) return;
  this.tabBar_.updateTab(tabIndex, tabItem.getTitle(), tabItem.getIsEnabled());
  if (tabIndex === this.selectedTabIndex_) {
    if (tabItem.getIsEnabled()) {
      cm.ui.clear(this.contentElem_);
      cm.ui.append(this.contentElem_, tabItem.getContent());
    } else {
      this.selectSomething_();
    }
  }
};
