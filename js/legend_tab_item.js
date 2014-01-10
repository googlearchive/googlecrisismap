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

goog.provide('cm.LegendTabItem');

goog.require('cm');
goog.require('cm.LegendView');
goog.require('cm.MapModel');
goog.require('cm.MapTabItem');
goog.require('cm.MetadataModel');
goog.require('cm.TabItem');
goog.require('cm.events');


/**
 * Produces the Legend tab in the tab panel.
 * @param {cm.MapModel} mapModel The model for the map being displayed.
 * @param {cm.AppState} appState The application state model.
 * @param {Object} config A dictionary of configuration options.
 * @param {cm.MetadataModel} metadataModel The metadata model for layers.
 * @extends cm.MapTabItem
 * @implements cm.TabItem
 * @constructor
 */
cm.LegendTabItem = function(mapModel, appState, config, metadataModel) {
  cm.MapTabItem.call(this, mapModel, appState, config);

  /**
   * @type cm.MetadataModel
   * @private
   */
  this.metadataModel_ = metadataModel;

  /**
   * @type Element
   * @private
   */
  this.legendContainer_ = cm.ui.create('div');

  this.loadLegends_();
};
goog.inherits(cm.LegendTabItem, cm.MapTabItem);

/**
 * Sets up listeners on the list of layers; adds all legend views for the
 * current layers.
 * @private
 */
cm.LegendTabItem.prototype.loadLegends_ = function() {
  var layers = /** @type google.maps.MVCArray */(this.mapModel.get('layers'));

  cm.events.listen(layers, 'insert_at', this.update_, this);
  cm.events.listen(
      layers, 'remove_at', function(i, layer) { this.update_(); }, this);
  // Triggered when the Arranger rearranges the layers
  cm.events.listen(
      goog.global, cm.events.MODEL_CHANGED, this.update_, this);
  this.update_();
};

/** @override */
cm.LegendTabItem.prototype.addScrollingContent = function(parentElem) {
  parentElem.appendChild(this.legendContainer_);
};

/** @override */
cm.LegendTabItem.prototype.getTitle = function() {
  return cm.MSG_LEGEND_TAB_LABEL;
};

/**
 * Updates the content of legendContainer to contain all legend views.
 * @private
 */
cm.LegendTabItem.prototype.update_ = function() {
  cm.ui.clear(this.legendContainer_);
  var layers = this.mapModel.get('layers');
  goog.array.forEach(layers.getArray(), this.appendLegend_, this);
};

/**
 * Appends the legend view for the given layer to the legend container.
 * @param {cm.LayerModel} layer The layer whose legend should be appended
 * @private
 */
cm.LegendTabItem.prototype.appendLegend_ = function(layer) {
  var legendView = cm.LegendView.getLegendViewForLayer(
      layer, this.metadataModel_, this.appState);
  cm.ui.append(this.legendContainer_, legendView.getContent());
};
