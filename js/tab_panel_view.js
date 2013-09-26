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

goog.require('cm.AboutTabItem');
goog.require('cm.TabItem');
goog.require('cm.TabView');
goog.require('cm.events');

/**
 * Panel view, containing the map information and layers list.
 * @param {Element} frameElem The frame element surrounding the entire UI.
 * @param {Element} parentElem The DOM element in which to create the panel.
 * @param {Element} mapContainer The map container to put the expand button on.
 * @param {cm.MapModel} mapModel The map model for which to create the panel
 *     view.
 * @param {cm.MetadataModel} metadataModel The metadata model.
 * @param {cm.AppState} appState The application state model.
 * @param {Object=} opt_config Configuration settings.  These fields are used:
 *     draft_mode: Indicate that the map is an unpublished draft?
 *     hide_panel_header: Hide the map title and description?
 *     publisher_name: A string used as the map's publisher
 *     enable_editing: Allow any editing at all?  If true, the following fields
 *       are also used:
 *         save_url: The URL to post to upon save
 *         dev_mode: Enable development mode?
 *         map_list_url: The URL to go to the list of maps
 *         diff_url: The URL to go to see the diff in the map model.
 * @constructor
 */
cm.TabPanelView = function(frameElem, parentElem, mapContainer, mapModel,
                           metadataModel, appState, opt_config) {
  /** The map model
   * @type cm.MapModel
   * @private
   */
  this.mapModel_ = mapModel;

  /**
   * @type cm.AppState
   * @private
   */
  this.appState_ = appState;

  /**
   * @type !Object
   * @private
   */
  this.config_ = opt_config || {};

  /**
   * @type cm.MetadataModel
   * @private
   */
  this.metadataModel_ = metadataModel;

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
  this.tabView_.render(this.parentElem_);
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

/**
 * Create the tabs for the panel view; called during initialization.  Right now
 * we just create some demo tabs.
 * @private
 */
cm.TabPanelView.prototype.createTabs_ = function() {
  if (!this.config_['hide_panel_header']) {
    this.tabView_.appendTabItem(
        new cm.AboutTabItem(this.mapModel_, this.appState_, this.config_));
  }
  var layersTab = new cm.LayersTabItem(
          this.mapModel_, this.appState_, this.config_, this.metadataModel_);
  cm.events.forward(layersTab,
                   [cm.events.TOGGLE_LAYER,
                    cm.events.SELECT_SUBLAYER,
                    cm.events.ZOOM_TO_LAYER],
                   this);
  this.tabView_.appendTabItem(layersTab);
};
