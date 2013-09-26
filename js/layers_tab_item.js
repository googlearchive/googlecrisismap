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

goog.provide('cm.LayersTabItem');

goog.require('cm');
goog.require('cm.MapModel');
goog.require('cm.MapTabItem');
goog.require('cm.MetadataModel');
goog.require('cm.TabItem');
goog.require('cm.events');
goog.require('cm.layerFilter');

goog.require('goog.i18n.MessageFormat');

/**
 * Produces the Layers tab in the tab panel.
 * @param {cm.MapModel} mapModel The model for the map being displayed.
 * @param {cm.AppState} appState The application state model.
 * @param {Object} config A dictionary of configuration options.
 * @param {cm.MetadataModel} metadataModel The metadata model for layers.
 * @extends cm.MapTabItem
 * @implements cm.TabItem
 * @constructor
 */
cm.LayersTabItem = function(mapModel, appState, config, metadataModel) {
  cm.MapTabItem.call(this, mapModel, appState, config);

  /**
   * @type cm.MetadataModel
   * @private
   */
  this.metadataModel_ = metadataModel;

  /**
   * @type Object.<cm.LayerEntryView>
   * @private
   */
  this.layerEntryViews_ = {};

  /**
   * @type Element
   * @private
   */
  this.panelLayers_ = cm.ui.create('div', {'class': cm.css.PANEL_LAYERS});

  /**
   * @type ?Element
   * @private
   */
  this.layerFilterBox_ = null;

  /**
   * Shows how many layers match the current layer filter query, if there
   * is a query.
   * @type ?Element
   * @private
   */
  this.matchingLayersMessage_ = null;

  if (config['enable_layer_filter']) {
    this.configureLayerFilter_();
  }
  this.configureLayerEntryViews_();
};
goog.inherits(cm.LayersTabItem, cm.MapTabItem);

/**
 * The layer filter input element is shown if there are at least
 * this many layers in the map model.
 * NOTE(user): The number was somewhat arbitrarily chosen;
 * it may be changed as necessary.
 * @type number
 * @const
 */
cm.LayersTabItem.LAYER_FILTER_VISIBILITY_THRESHOLD = 8;

/** @override */
cm.LayersTabItem.prototype.addScrollingContent = function(parentElem) {
  if (this.layerFilterBox_) {
    parentElem.appendChild(this.layerFilterBox_);
    parentElem.appendChild(this.matchingLayersMessage_);
  }
  parentElem.appendChild(this.panelLayers_);
};

/**
 * Creates the layer entry views and sets up all listeners.
 * @private
 */
cm.LayersTabItem.prototype.configureLayerEntryViews_ = function() {
  var layers = /** @type google.maps.MVCArray */(this.mapModel.get('layers'));
  goog.array.forEach(layers.getArray(), this.addLayer_, this);

  cm.events.listen(layers, 'insert_at', function(i) {
    this.addLayer_(layers.getAt(i), i);
  }, this);
  cm.events.listen(layers, 'remove_at', function(i, layer) {
    this.removeLayer_(layer);
  }, this);
  cm.events.listen(layers, ['insert_at', 'remove_at'],
    this.updateLayerFilterVisibility_, this);
};

/**
 * Adds an entry for a layer.
 * @param {cm.LayerModel} layer A layer model for which to create a view.
 * @param {number} index The index into this layer entry's sibling
 *   array at which to insert the layer.
 * @private
 */
cm.LayersTabItem.prototype.addLayer_ = function(layer, index) {
  var id = /** @type string */(layer.get('id'));
  this.layerEntryViews_[id] = new cm.LayerEntryView(
      this.panelLayers_, layer, this.metadataModel_, this.appState,
      this.config, index, false);
  var view = this.layerEntryViews_[id];
  cm.events.listen(view, cm.events.DELETE_LAYER, function(e) {
    cm.events.emit(goog.global, cm.events.DELETE_LAYER,
                   {model: this.model, id: e.id});
  }, this);
  cm.events.forward(view, [cm.events.TOGGLE_LAYER,
                           cm.events.SELECT_SUBLAYER,
                           cm.events.ZOOM_TO_LAYER],
                           this);
};

/**
 * Removes an entry for a layer.
 * @param {cm.LayerModel} layer The layer model whose view to remove.
 * @private
 */
cm.LayersTabItem.prototype.removeLayer_ = function(layer) {
  if (!layer) return;
  var id = /** @type string */(layer.get('id'));
  this.layerEntryViews_[id].dispose();
  delete this.layerEntryViews_[id];
};

/**
 * Sets up the layer filter.
 * @private
 */
cm.LayersTabItem.prototype.configureLayerFilter_ = function() {
  this.layerFilterBox_ = cm.ui.create(
      'input', {'type': 'text', 'class': cm.css.LAYER_FILTER,
                'placeholder': cm.MSG_LAYER_FILTER_PLACEHOLDER});
  this.matchingLayersMessage_ = cm.ui.create(
      'span', {'class': cm.css.LAYER_FILTER_INFO});

  cm.events.listen(
      this.layerFilterBox_, ['change', 'input', 'cut', 'paste', 'keyup'],
      function() {
        cm.events.emit(this, cm.events.FILTER_QUERY_CHANGED,
                       {'query': this.layerFilterBox_.value});
        this.filterLayers_();
      }, this);

  // Set up a one-time listener because the app state filter_query is set from
  // the URL after the panel view is constructed.
  var filterToken = cm.events.onChange(
      this.appState, 'filter_query', function() {
        cm.events.unlisten(filterToken);
        this.layerFilterBox_.value = this.appState.getFilterQuery();
        this.filterLayers_();
      }, this);

  // Show or hide the layer filter as appropriate.
  this.updateLayerFilterVisibility_();

  // TODO(romano): There should be UX decison made about how the editor and
  // layer filter interact, since this listener could result in a layer
  // disappearing after being edited.
  cm.events.listen(
      goog.global, cm.events.MODEL_CHANGED, this.filterLayers_, this);
};

/**
 * Runs a filter query and updates the matched layers in the appState.
 * @private
 */
cm.LayersTabItem.prototype.filterLayers_ = function() {
  // Retrieve the query from the AppState in case it was set by the q= URL
  // parameter.
  var query = this.appState.getFilterQuery();
  var matches = cm.layerFilter.matchAllLayers(this.mapModel, query);
  // Hide the message about total matching layers if there isn't a query.
  goog.dom.classes.enable(this.matchingLayersMessage_, cm.css.HIDDEN, !query);
  if (query) {
    cm.ui.setText(this.matchingLayersMessage_,
      (new goog.i18n.MessageFormat(cm.MSG_NUMBER_MATCHING_LAYERS)).format(
        {'NUM_LAYERS': matches.length}));
  }
  cm.events.emit(this, cm.events.FILTER_MATCHES_CHANGED, {matches: matches});
};

/**
 * Shows or hides the layer filter depending on the number of layers in the map.
 * @private
 */
cm.LayersTabItem.prototype.updateLayerFilterVisibility_ = function() {
  if (this.layerFilterBox_) {
    // TODO(romano): do not count layers in locked folders (see b/10511489)
    var hide = this.mapModel.getAllLayerIds().length <
        cm.LayersTabItem.LAYER_FILTER_VISIBILITY_THRESHOLD;
    goog.dom.classes.enable(this.layerFilterBox_, cm.css.HIDDEN, hide);
  }
};

/** @override */
cm.LayersTabItem.prototype.getTitle = function() {
  return cm.MSG_LAYERS_TAB_LABEL;
};

/** @override */
cm.LayersTabItem.prototype.getIcon = function() { return null; };
