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
  this.parentElem_ = parentElem;
  parentElem.appendChild(goog.dom.createTextNode('Hello World!'));
};

/**
 * Set the panel's maxHeight. This is triggered in initialize.js when the
 * browser window is resized, so that the map's height can be passed in.
 * Currently stubbed to do nothing.
 * @param {number?} height The maximum height of the panel, in pixels.
 */
cm.TabPanelView.prototype.setMaxHeight = function(height) {
};

/**
 * Return the panel's header element.  Currently stubbed to return null.
 * @return {?Element} The header element.
 */
cm.TabPanelView.prototype.getHeader = function() {
  return null;
};

/**
 * Get the bounds of the Element into which the PanelView was rendered. (This is
 * the same Element that was passed to the constructor via the parentlElem.)
 * @return {goog.math.Rect} The position and size of the Element containing the
 *     PanelView.
 */
cm.TabPanelView.prototype.getBounds = function() {
  return goog.style.getBounds(this.parentElem_);
};
