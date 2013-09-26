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

goog.provide('cm.TabPanelView');

goog.require('cm.TabItem');
goog.require('cm.TabView');

/**
 * Panel view, containing the map information and layers list.
 * @param {Element} frameElem The frame element surrounding the entire UI.
 * @param {Element} parentElem The DOM element in which to create the panel.
 * @param {Element} mapContainer The map container to put the expand button on.
 * @param {cm.MapModel} model The map model for which to create the panel view.
 * @param {cm.MetadataModel} metadataModel The metadata model.
 * @param {cm.AppState} appState The application state model.
 * @param {Object=} opt_config Configuration settings.  These fields are used:
 *     draft_mode: Indicate that the map is an unpublished draft?
 *     hide_panel_header: Hide the map title and description?
 *     enable_editing: Allow any editing at all?
 * @constructor
 */
cm.TabPanelView = function(frameElem, parentElem, mapContainer, model,
                           metadataModel, appState, opt_config) {
  /** The view's parent element.
   * @type Element
   * @private
   */
  this.parentElem_ = parentElem;

  /** The tab view we use to render.
   * @type cm.TabView
   * @private
   */
  this.tabView_ = new cm.TabView();

  this.createTabs_();
  this.tabView_.render(parentElem);
};

/**
 * Sets the maximum height of the panel; currently a no-op.  Carried forward
 * from cm.PanelView to ensure API compatibility.
 * @param {number?} height The maximum height of the panel, in pixels.
 */
cm.TabPanelView.prototype.setMaxHeight = function(height) {
};

/**
 * Return the panel's header element; currently returns null.  Carried forward
 * from cm.PanelView to ensure API compatibility.
 * @return {Element?} The header element.
 */
cm.TabPanelView.prototype.getHeader = function() {
  return null;
};

/**
 * Get the bounds of the element into which the PanelView was rendered. (This is
 * the same element that was passed to the constructor via the parentElem.)
 * @return {goog.math.Rect} The position and size of the element containing the
 *     PanelView.
 */
cm.TabPanelView.prototype.getBounds = function() {
  return goog.style.getBounds(this.parentElem_);
};

// TODO(rew): Several of the classes and methods below have "_demo_" appended
// to their names; they are temporary code added to demonstrate the behavior
// of cm.TabView.  All such code should be gradually deleted and replaced by
// the real implementation of our intended tabs and their content.

/**
 * Create the tabs for the panel view; called during initialization.  Right now
 * we just create some demo tabs.
 * @private
 */
cm.TabPanelView.prototype.createTabs_ = function() {
  this.testTabCount_demo_ = 0;
  this.addSimpleTabItem_demo_();
  this.addTestTabs_demo_(2);
};

/**
 * Instantiates and adds a tab of static HTML with "Hello World" and a link
 * for adding new tabs.
 * @private
 */
cm.TabPanelView.prototype.addSimpleTabItem_demo_ = function() {
  var addLink = cm.ui.createLink('Add tab');
  var simpleTabItem = new cm.SimpleTabItem_demo_('Hello World', cm.ui.create(
      'div', {}, 'Hello world!', cm.ui.create('br'), addLink));
  cm.events.listen(addLink, 'click', this.addTestTab_demo_, this);
  this.tabView_.appendTabItem(simpleTabItem);
};

/**
 * Instantiates some test tabs.
 * @param {number} numberOfTabs The number of test tabs to add.
 * @private
 */
cm.TabPanelView.prototype.addTestTabs_demo_ = function(numberOfTabs) {
  for (var i = 0; i < numberOfTabs; i++) {
    this.addTestTab_demo_();
  }
};


/**
 * Instantiates a cm.TestTabItem_demo_ and adds it to the panel.
 * @private
 */
cm.TabPanelView.prototype.addTestTab_demo_ = function() {
  this.testTabCount_demo_++;
  var testTab = new cm.TestTabItem_demo_(
      this.testTabCount_demo_ + 'Test tab',
      cm.ui.create('b', {},
                   'Test Tab', String(this.testTabCount_demo_), '!!!'));
  this.tabView_.appendTabItem(testTab);
};


/**
 * A simple tab item that has a fixed name and content.
 * @implements cm.TabItem
 * @param {string} title The title of the tab.
 * @param {Element} content The content for the tab.
 * @constructor
 * @private
 */
cm.SimpleTabItem_demo_ = function(title, content)  {
  this.title_ = title;
  this.contentElem_ = content;
};

/** @override */
cm.SimpleTabItem_demo_.prototype.getTitle = function() {
  return this.title_;
};

/** @override */
cm.SimpleTabItem_demo_.prototype.getIcon = function() { return null; };

/** @override */
cm.SimpleTabItem_demo_.prototype.getContent = function() {
  return this.contentElem_;
};

/** @override */
cm.SimpleTabItem_demo_.prototype.getIsEnabled = function() { return true; };

/** @override */
cm.SimpleTabItem_demo_.prototype.setSelected = function(isSelected) {};

/** @override */
cm.SimpleTabItem_demo_.prototype.setTabView = function(tabView) {};


/**
 * A tab item that can be used for testing purposes; it tracks and displays
 * the number of times it has been selected, and provides widgets for
 * changing the title of the tab and for removing the tab from its TabView.
 * @implements cm.TabItem
 * @param {string} title The initial title for the tab.
 * @param {Element} content The initial content for the tab; additional controls
 *   are added to produce the final content for the tab.
 * @constructor
 * @private
 */
cm.TestTabItem_demo_ = function(title, content) {
  this.tabView_ = null;
  this.title_ = title;
  this.titleCounter_ = 0;
  this.selectedCount_ = 0;
  this.selectedCountElem_ = cm.ui.create('div');
  this.removeLink_ = cm.ui.createLink('Remove me');
  this.changeTitleLink_ = cm.ui.createLink('Change my title');
  this.elem_ = cm.ui.create(
      'div', {}, content,
      cm.ui.create(
          'ul', {},
          cm.ui.create(
              'li', {},
              'Selected ', this.selectedCountElem_, ' times'),
          cm.ui.create('li', {}, this.removeLink_),
          cm.ui.create('li', {}, this.changeTitleLink_)));
  cm.events.listen(
      this.removeLink_, 'click', this.handleRemoveMe_, this);
  cm.events.listen(
      this.changeTitleLink_, 'click', this.handleChangeTitle_, this);
};

/**
 * Causes the tab to remove itself from its TabView.
 * @private
 */
cm.TestTabItem_demo_.prototype.handleRemoveMe_ = function() {
  this.tabView_.removeTabItem(this);
};

/**
 * Causes the tab to change its title.
 * @private
 */
cm.TestTabItem_demo_.prototype.handleChangeTitle_ = function() {
  this.titleCounter_++;
  this.tabView_.updateTabItem(this);
};

/** @override */
cm.TestTabItem_demo_.prototype.getTitle = function() {
  return this.title_ + (this.titleCounter_ ? ' ' + this.titleCounter_ : '');
};

/** @override */
cm.TestTabItem_demo_.prototype.getIcon = function() { return null; };

/** @override */
cm.TestTabItem_demo_.prototype.getContent = function() { return this.elem_; };

/** @override */
cm.TestTabItem_demo_.prototype.getIsEnabled = function() { return true; };

/** @override */
cm.TestTabItem_demo_.prototype.setSelected = function(isSelected) {
  if (!isSelected) return;
  this.selectedCount_++;
  cm.ui.clear(this.selectedCountElem_);
  cm.ui.append(this.selectedCountElem_, String(this.selectedCount_));
};

/** @override */
cm.TestTabItem_demo_.prototype.setTabView = function(tabView) {
  this.tabView_ = tabView;
};
