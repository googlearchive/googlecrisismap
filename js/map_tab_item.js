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

goog.provide('cm.MapTabItem');

goog.require('cm.TabItem');

/**
 * Superclass for tabs in the tab panel that require a map model.
 * Subclasses must define getTitle and getIcon.  If they can be disabled,
 * they should override getIsEnabled.
 * @param {cm.MapModel} mapModel The model of the map being rendered
 * @param {cm.AppState} appState The application state model.
 * @param {Object} config Configuration options, largely for editing
 * @implements cm.TabItem
 * @constructor
 */
cm.MapTabItem = function(mapModel, appState, config) {
  /**
   * @type cm.MapModel
   * @protected
   */
  this.mapModel = mapModel;

  /**
   * @type cm.AppState
   * @protected
   */
  this.appState = appState;

  /**
   * @type Object
   * @protected
   */
  this.config = config || {};

  /**
   * @type ?cm.TabView
   * @protected
   */
  this.tabView = null;

  /**
   * @type Element
   * @private
   */
  this.content_ = cm.ui.create('div');

  /**
   * The div containing the scrolling region of the tab item's content.
   * @type Element
   * @private
   */
  this.scrollbarDiv_ = cm.ui.create('div');

  /**
   * @type ?Element
   * @private
   */
  this.toolbarDiv_ = this.config['enable_editing'] ? cm.ui.create('div') : null;

  /** @type boolean */
  this.isSelected = false;

  /** @type boolean */
  this.editingEnabled = this.config['enable_editing'];
};

/**
 * Renders the contents of the tab item in to this.content_.  By default
 * adds the toolbar (if editing), then addHeader(), then addScrollingContent(),
 * then adds both the header and scroll region to the content.
 * @private
 */
cm.MapTabItem.prototype.render_ = function() {
  if (this.rendered_) return;
  this.rendered_ = true;

  if (this.editingEnabled) {
    var me = this;
    goog.module.require('edit', 'cm.ToolbarView', function(ToolbarView) {
      new ToolbarView(me.toolbarDiv_, me.mapModel, !!me.config['save_url'],
                      me.config['dev_mode'], me.config['map_list_url'],
                      cm.util.browserSupportsTouch(), me.config['diff_url']);
    });
    cm.ui.append(this.content_, this.toolbarDiv_);
  }

  var headerElem = cm.ui.create('div', {'class': cm.css.PANEL_HEADER});
  this.addHeader(headerElem);
  this.addScrollingContent(this.scrollbarDiv_);
  cm.ui.append(this.content_, headerElem, this.scrollbarDiv_);
};

/**
 * Called during rendering to fill the non-scrolling heaader region of the tab.
 * Subclasses should override to fill parentElem with content.
 * @param {Element} headerElem The node into which header content should be
 *   placed.
 */
cm.MapTabItem.prototype.addHeader = function(headerElem) {};

/**
 * Called during rendering to fill the scrolling region of the tab.  Subclasses
 * should override to fill parentElem with whatever content they want to appear
 * in the scrolling section of the tab.
 * @param {Element} parentElem The node into which content should be placed.
 */
cm.MapTabItem.prototype.addScrollingContent = function(parentElem) {};

/**
 * Cause the containing tab view to relayout following a change in size of
 * the tab.  Not entirely clear how this should be used; placeholder so that
 * the correct messaging from the tab items up to the view is in place, but we
 * may want a separate message from updateTabItem(), which is used to notify of
 * changes to any aspect of the tab (title, icon, dis/enabled status, etc.)
 */
cm.MapTabItem.prototype.promptRelayout = function() {
  if (this.isSelected) {
    this.tabView.updateTabItem(this);
  }
};

/** @override */
cm.MapTabItem.prototype.getTitle = function() {};

/** @override */
cm.MapTabItem.prototype.getIcon = function() {};

/** @override */
cm.MapTabItem.prototype.getContent = function() {
  this.render_();
  return this.content_;
};

/** @override */
cm.MapTabItem.prototype.getIsEnabled = function() { return true; };

/** @override */
cm.MapTabItem.prototype.setSelected = function(isSelected) {
  this.isSelected = isSelected;
};

/** @override */
cm.MapTabItem.prototype.setTabView = function(tabView) {
  this.tabView = tabView;
};
