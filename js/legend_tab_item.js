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

  /**
   * Whether the tab item is currently enabled; set in update_()
   * @type boolean
   * @private
   */
   this.isEnabled_ = true;

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
  cm.events.listen(cm.app, cm.events.MODEL_CHANGED, this.update_, this);
  // Triggered when the set of enabled layers changes (which could change
  // which legend is displayed first, hence the need to re-render).
  cm.events.onChange(
      this.appState, 'enabled_layer_ids', this.update_, this);
  this.update_();
};

/** @override */
cm.LegendTabItem.prototype.addHeader = function(headerElem) {
  // There's nothing to put in the header, so hide it.
  headerElem.style.display = 'none';
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
  var layers = this.mapModel.get('layers').getArray();
  // isFirstLegend is used to tell the legend view whether it should render
  // with the extra styling for the first legend in a larger list.  We set
  // it to true at the beginning, then flip it to false as soon as a legend
  // has rendered visible content.
  var isFirstLegend = true;
  for (var i = 0; i < layers.length; i++) {
    var legendView = cm.LegendView.getLegendViewForLayer(
        layers[i], this.metadataModel_, this.appState);
    cm.ui.append(this.legendContainer_, legendView.getContent(isFirstLegend));
    isFirstLegend = isFirstLegend && legendView.isHidden();
  }
  this.isEnabled_ = !isFirstLegend;
  if (this.tabView) {
    this.tabView.updateTabItem(this);
  }
};

/** @override */
cm.LegendTabItem.prototype.getIsEnabled = function() {
  return this.isEnabled_;
};
