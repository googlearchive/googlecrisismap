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

goog.provide('cm.TabItem');

/**
 * A TabItem describes the content of a single tab pane in a TabView.
 * @interface
 */
cm.TabItem = function() {};

/**
 * Returns the title to be used in the tab.
 * @return {string}
 */
cm.TabItem.prototype.getTitle = function() {};

/**
 * Returns an icon that could be used in addition to or in place of the title.
 * @return {?Element}
 */
cm.TabItem.prototype.getIcon = function() {};

/**
 * Returns an element containing the content to be displayed in the tab's pane.
 * @return {Element}
 */
cm.TabItem.prototype.getContent = function() {};

/**
 * Returns whether the tab is currently enabled or disabled.
 * @return {boolean}
 */
cm.TabItem.prototype.getIsEnabled = function() {};

/**
 * Called when a TabItem is selected or unselected from a TabView.  The TabItem
 * is guaranteed it will receive a setSelected(true) call before content() is
 * called to retrieve the element to display.
 * @param {boolean} isSelected Whether the TabItem has been selected.
 */
cm.TabItem.prototype.setSelected = function(isSelected) {};

/**
 * Called to inform a TabItem of its TabView.  Only the TabView itself should
 * issue this call.
 * @param {cm.TabView} tabView The TabView to which the receiver has been added.
 */
cm.TabItem.prototype.setTabView = function(tabView) {};
