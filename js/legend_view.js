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

goog.provide('cm.LegendView');

goog.require('cm');
goog.require('cm.LayerModel');
goog.require('cm.MetadataModel');

/**
 * A LegendView displays the legend for a single layer.  Abstract superclass;
 * cm.LegendView.getLegendViewForLayer() below ensures the correct subclass is
 * instantiated.
 * @param {cm.LayerModel} layerModel The model for the layer whose legend is
 *   to be rendered
 * @constructor
 */
cm.LegendView = function(layerModel) {
  /**
   * @type cm.LayerModel
   * @private
   */
  this.layerModel_ = layerModel;

  /**
   * @type Element
   * @private
   */
  this.parentElem_ = cm.ui.create('div', {'class': cm.css.LAYER_LEGEND_BOX});

  /**
   * Tracks the current zoom level of the map; this is also available
   * direct from the mapView, so it might be better to get it from
   * there.  Historically, the legend and layer entry views have always
   * relied on events to get it, so we leave it that way for now.
   * @type ?number
   * @private
   */
  this.currentZoomLevel_ = null;

  /**
   * Whether we have rendered at least once
   * @type boolean
   * @private
   */
  this.hasRendered_ = false;

  /**
   * Whether our legend is empty.  Because of the sanitizer, it is
   * difficult to introspect on legendElem_'s contents to determine
   * whether we actually have a legend.
   * @type boolean
   * @protected
   */
  this.isEmpty = false;
};

/**
 * Returns the DOM element for the legend, suitable for adding to the
 * larger document.
 * @return {Element}
 */
cm.LegendView.prototype.getContent = function() {
  if (!this.hasRendered_) {
    this.setupListeners();
    this.render();
    this.hasRendered_ = true;
  }
  return this.parentElem_;
};

/**
 * Sets up any needed listeners prior to rendering.
 * @protected
 */
cm.LegendView.prototype.setupListeners = function() {
  cm.events.onChange(
      this.layerModel_, ['min_zoom', 'max_zoom'], this.updateHidden_,
      this);
  cm.events.onChange(
      this.layerModel_, 'legend', this.handleLegendChanged_, this);
  this.handleLegendChanged_();
  cm.events.listen(
      goog.global, cm.events.ZOOM_CHANGED, this.handleZoomLevelChanged_, this);
};

/**
 * Renders content into this.parentElem_.
 * @protected
 */
cm.LegendView.prototype.render = function() {};

/**
 * Returns whether the legend should be hidden.
 * @return {boolean}
 * @protected
 */
cm.LegendView.prototype.shouldHide = function() {
  return !this.layerModel_.insideZoomBounds(this.currentZoomLevel_);
};

/**
 * Sets the hidden class on our root element according to the return value
 * of shouldHide(), above.
 * @private
 */
cm.LegendView.prototype.updateHidden_ = function() {
  goog.dom.classes.enable(this.parentElem_, cm.css.HIDDEN, this.shouldHide());
};

/**
 * Respond to changes in the zoom level of the map; in particular, check
 * if our layer is now outside its min/max zoom bounds and if so, remove
 * the legend from the map.
 * @param {Object} e The event
 * @private
 */
cm.LegendView.prototype.handleZoomLevelChanged_ = function(e) {
  this.currentZoomLevel_ = /** @type number */(e.zoom);
  this.updateHidden_();
};

/**
 * Update our isEmpty flag depending on the contents of the legend.
 * @private
 */
cm.LegendView.prototype.handleLegendChanged_ = function() {
  this.isEmpty = /** @type cm.Html */(
      this.layerModel_.get('legend')).isEmpty();
};

/**
 * Maps layer IDs to the associated legend views.
 * @type Object.<cm.LegendView>
 * @private
 */
cm.LegendView.legendViews_ = {};

/**
 * Returns the legend view for the given layer, constructing it if necessary.
 * @param {cm.LayerModel} layerModel The model for the layer whose legend is
 *   being rendered
 * @param {cm.MetadataModel} metadataModel The metadata model to use to
 *   register for source data changes.
 * @param {cm.AppState} appState The app state where the current state for the
 *   layer can be found.
 * @return {cm.LegendView} The legend view for the given layer.
 */
cm.LegendView.getLegendViewForLayer =
    function(layerModel, metadataModel, appState) {
  var legendView = cm.LegendView.legendViews_[layerModel.get('id')];
  if (!legendView) {
    // TODO(rew): Restore the if clause below when we have folder legend views.
    // Right now we only have the simple legend view, so we always use it.
    // if (layerModel.get('type') !== cm.LayerModel.Type.FOLDER) {
    //   legendView = new cm.SimpleLegendView_(layerModel, metadataModel);
    // } else if (layerModel.isSingleSelect()) {
    //   legendView = new cm.SingleSelectLegendView_(
    //       layerModel, metadataModel, appState);
    // } else {
    //   legendView = new cm.FolderLegendView_(
    //       layerModel, metadataModel, appState);
    // }
    legendView = new cm.SimpleLegendView_(layerModel, metadataModel);
    cm.LegendView.legendViews_[layerModel.get('id')] = legendView;
  }
  return legendView;
};

/**
 * Renders the legend for a layer that is not a folder.
 * @param {cm.LayerModel} layerModel The model for the layer whose legend
 *   will be rendered
 * @param {cm.MetadataModel} metadataModel The global metadata model object
 *   for tracking changes to the layer's data.
 * @extends cm.LegendView
 * @constructor
 * @private
 */
cm.SimpleLegendView_ = function(layerModel, metadataModel) {
  cm.LegendView.call(this, layerModel);
  this.metadataModel_ = metadataModel;

  this.titleElem_ = cm.ui.create('span', {'class': cm.css.LAYER_TITLE});
  this.legendElem_ = cm.ui.create('div', {'class': cm.css.LAYER_LEGEND});
  cm.ui.append(this.parentElem_, this.titleElem_, this.legendElem_);

  /**
   * Listener for updates on our layer's metadata
   * @type ?cm.events.ListenerToken
   * @private
   */
  this.metadataListener_ = null;

};
goog.inherits(cm.SimpleLegendView_, cm.LegendView);

/** @override */
cm.SimpleLegendView_.prototype.setupListeners = function() {
  cm.LegendView.prototype.setupListeners.call(this);
  cm.events.onChange(
      this.layerModel_, 'title', this.updateTitle_, this);
  cm.events.onChange(this.layerModel_, 'legend', this.updateLegend_, this);
  cm.events.onChange(
      this.layerModel_, ['type', 'url'], this.updateMetadataListener_, this);
  this.updateMetadataListener_();
};

/** @override */
cm.SimpleLegendView_.prototype.render = function() {
  this.updateTitle_();
  this.updateLegend_();
  this.updateHidden_();
};

/**
 * Respond to changes in the layer's title.
 * @private
 */
cm.SimpleLegendView_.prototype.updateTitle_ = function() {
  cm.ui.clear(this.titleElem_);
  cm.ui.append(
      this.titleElem_, /** @type string */(this.layerModel_.get('title')));
};

/**
 * Respond to changes in the layer's legend.
 * @private
 */
cm.SimpleLegendView_.prototype.updateLegend_ = function() {
  cm.ui.clear(this.legendElem_);
  /** @type cm.Html */(this.layerModel_.get('legend')).pasteInto(
      this.legendElem_);
};

/**
 * Update the metadata listener due to a change in the layer's source URL.
 * This can mean the layer is empty, so we update our hidden status, too.
 * @private
 */
cm.SimpleLegendView_.prototype.updateMetadataListener_ = function() {
  if (this.metadataListener_) {
    cm.events.unlisten(this.metadataListener_);
  }
  this.metadataListener_ = this.metadataModel_.onChange(
      this.layerModel_, this.updateHidden_, this);

  this.updateHidden_();
};

/** @override */
cm.SimpleLegendView_.prototype.shouldHide = function() {
  // The layer is not visible if:
  // - the current map zoom level is outside the min/max zoom limits for
  // the layer (superclass checks this since every layer has zoom limits that
  // should be respected)
  // - there is no legend (superclass tracks this in the isEmpty instance
  // variable, but does not check it because folders may want to do a more
  // complex check)
  // - the metadataModel is currently reporting the layer as empty (only simple
  // layers have source URLs, so we need to check this ourselves)

  // TODO(rew): This model may change when we have folder support; make sure
  // this code still works and the comment is accurate.

  return (cm.LegendView.prototype.shouldHide.call(this) ||
      this.isEmpty || this.metadataModel_.isEmpty(this.layerModel_));
};
