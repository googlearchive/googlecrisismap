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
goog.require('goog.array');
goog.require('goog.string');

/**
 * A LegendView displays the legend for a single layer.  Abstract superclass;
 * cm.LegendView.getLegendViewForLayer() below ensures the correct subclass is
 * instantiated.
 * @param {cm.LayerModel} layerModel The model for the layer whose legend is
 *   to be rendered
 * @param {cm.AppState} appState The app state where the current state for the
 *   layer can be found.
 * @constructor
 */
cm.LegendView = function(layerModel, appState) {
  /**
   * @type cm.LayerModel
   * @private
   */
  this.layerModel_ = layerModel;

  /**
   * @type cm.AppState
   * @private
   */
  this.appState_ = appState;

  /**
   * @type Element
   * @private
   */
  this.parentElem_ = cm.ui.create('div');

  /**
   * @type Element
   * @private
   */
  this.titleElem_ = cm.ui.create('span', {'class': cm.css.LAYER_TITLE});


  /**
   * @type Element
   * @private
   */
  this.legendElem_ = cm.ui.create(
      'div', {'class': cm.css.TABBED_LEGEND_CONTENT});

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
 * Returns the element for the legend, ready to be inserted into
 * the DOM.
 * @param {boolean=} opt_isFirst Whether this legend should be rendered
 *   with the extra styling for first legend in a list.
 * @return {Element}
 */
cm.LegendView.prototype.getContent = function(opt_isFirst) {
  return this.getContentForParentType(null, !!opt_isFirst);
};

/**
 * Returns the element for the legend, styled to be inserted in the
 * parent folder's legend (if any).  getContent() calls through to this,
 * passing null as the parentFolderType.
 * @param {?cm.LayerModel.FolderType} parentFolderType The type of the parent
 *     folder into which this legend is being rendered.
 * @param {boolean} isFirst Whether this legend is being displayed at the top
 *   of a list of legends.
 * @return {Element} A DOM element that contains the rendered legend.
 * @protected
 */
cm.LegendView.prototype.getContentForParentType = function(
    parentFolderType, isFirst) {
  if (!this.hasRendered_) {
    this.setupListeners();
    this.hasRendered_ = true;
  }
  this.render(parentFolderType, isFirst);
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
      this.layerModel_, 'title', this.handleTitleChanged_, this);
  this.handleTitleChanged_();

  cm.events.onChange(
      this.layerModel_, 'legend', this.handleLegendChanged_, this);
  this.handleLegendChanged_();

  cm.events.listen(
      goog.global, cm.events.ZOOM_CHANGED, this.handleZoomLevelChanged_, this);

  cm.events.onChange(
      this.appState_, 'enabled_layer_ids', this.updateHidden_, this);
  this.updateHidden_();
};

/**
 * Renders content into this.parentElem_.
 * @param {?cm.LayerModel.FolderType} parentFolderType For sublayers whose
 *   legend is being rendered as part of a larger context, the folder type of
 *   the parent layer.  Right now, we treat locked folders specially and
 *   sublayers remove any adornments (title, box outlines, etc), but we expect
 *   to be experimenting with different folder behaviors and renderings.
 * @param {boolean} isFirst Whether this legend is being displayed at the top
 *   of a list of legends.
 * @protected
 */
cm.LegendView.prototype.render = function(parentFolderType, isFirst) {};

/**
 * Whether this legend's layer is currently enabled.
 * @return {boolean}
 */
cm.LegendView.prototype.isEnabled = function() {
  return this.appState_.getLayerEnabled(
      /** @type string */(this.layerModel_.get('id')));
};

/**
 * Whether the map is currently zoomed within the bounds specified
 * for this legend's layer.
 * @return {boolean}
 */
cm.LegendView.prototype.isInZoomRange = function() {
  return this.layerModel_.insideZoomBounds(this.currentZoomLevel_);
};

/**
 * An abstract method that returns whether the legend should be hidden.
 * Subclasses can use isEnabled(), isInZoomRange() and isEmpty() to implement
 * the necessary logic.
 * @return {boolean}
 */
cm.LegendView.prototype.isHidden = function() { return false; };

/**
 * Respond to changes in the layer's title.
 * @private
 */
cm.LegendView.prototype.handleTitleChanged_ = function() {
  cm.ui.clear(this.titleElem_);
  cm.ui.append(this.titleElem_, this.titleString());
};

/**
 * Returns the string to be used as the title of the legend; by default,
 * the title of the layer from the model.
 * @return {string} The title for the legend.
 */
cm.LegendView.prototype.titleString = function() {
  return /** @type string */(this.layerModel_.get('title'));
};

/**
 * Sets the hidden class on our root element according to the return value
 * of isHidden(), above.
 * @private
 */
cm.LegendView.prototype.updateHidden_ = function() {
  goog.dom.classes.enable(this.parentElem_, cm.css.HIDDEN, this.isHidden());
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
  cm.ui.clear(this.legendElem_);
  var legendHtml = /** @type cm.Html */(this.layerModel_.get('legend'));
  legendHtml.pasteInto(this.legendElem_);
  this.isEmpty = legendHtml.isEmpty();
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
    if (layerModel.get('type') === cm.LayerModel.Type.FOLDER) {
      legendView = new cm.FolderLegendView_(
          layerModel, metadataModel, appState);
    } else {
      legendView = new cm.SimpleLegendView_(
          layerModel, metadataModel, appState);
    }
    cm.LegendView.legendViews_[layerModel.get('id')] = legendView;
  }
  return legendView;
};

/**
 * Convenience method for determining whether a particular parent folder
 * type implies that sublayers should add or suppress their own box/visual
 * adornment.  Sublayers of unlocked folders should; other folder types
 * should not.
 * @param {?cm.LayerModel.FolderType} parentFolderType The type of the parent
 *   folder, if any.
 * @return {boolean}
 */
cm.LegendView.sublayersShouldDrawBox = function(parentFolderType) {
  return (!parentFolderType ||
      parentFolderType === cm.LayerModel.FolderType.UNLOCKED);
};

/**
 * Renders the legend for a layer that is not a folder.
 * @param {cm.LayerModel} layerModel The model for the layer whose legend
 *   will be rendered.
 * @param {cm.MetadataModel} metadataModel The global metadata model object
 *   for tracking changes to the layer's data.
 * @param {cm.AppState} appState The global appState object for tracking
 *   when the layer is turned on and off.
 * @extends cm.LegendView
 * @constructor
 * @private
 */
cm.SimpleLegendView_ = function(layerModel, metadataModel, appState) {
  cm.LegendView.call(this, layerModel, appState);
  this.metadataModel_ = metadataModel;

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
      this.layerModel_, ['type', 'url'], this.updateMetadataListener_, this);
  this.updateMetadataListener_();
};

/** @override */
cm.SimpleLegendView_.prototype.render = function(parentFolderType, isFirst) {
  // Sometimes a legend renders its comments with a box and title; other times
  // it relies on its parent to render the box and title.
  // sublayersShouldDrawBox() tells us which behavior we want.
  var drawBox = cm.LegendView.sublayersShouldDrawBox(parentFolderType);
  cm.ui.clear(this.parentElem_);
  goog.dom.classes.enable(this.parentElem_, cm.css.TABBED_LEGEND_BOX, drawBox);
  goog.dom.classes.enable(
      this.parentElem_, cm.css.FIRST_TABBED_LEGEND_BOX, isFirst && drawBox);
  if (drawBox) {
    cm.ui.append(this.parentElem_, this.titleElem_, this.legendElem_);
  } else {
    cm.ui.append(this.parentElem_, this.legendElem_);
  }
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
cm.SimpleLegendView_.prototype.isHidden = function() {
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

  return (!this.isEnabled() || !this.isInZoomRange() ||
      this.isEmpty || this.metadataModel_.isEmpty(this.layerModel_));
};


/**
 * LegendView subclass for rendering unlocked or single-select folders
 * @param {cm.LayerModel} layerModel The model for the layer whose legend
 *   will be rendered
 * @param {cm.MetadataModel} metadataModel The global metadata model object
 *   for tracking changes to the layer's data.
 * @param {cm.AppState} appState The global appState object.
 * @extends cm.LegendView
 * @constructor
 * @private
 */
cm.FolderLegendView_ = function(layerModel, metadataModel, appState) {
  cm.LegendView.call(this, layerModel, appState);

  /**
   * Sadly, we must store this to be able to initialize our sub-legends;
   * otherwise it is unused.
   * @type cm.MetadataModel
   * @private
   */
  this.metadataModel_ = metadataModel;

  /**
   * The list of cm.LegendViews for the sublayers of our folder.
   * The LegendViews are constructed immediately, but are not rendered
   * until the FolderLegendView is asked to render.
   * @type Array.<cm.LegendView>
   * @private
   */
  this.sublayerLegendViews_ = this.buildSublayerLegendViews_();

  /**
   * The last value we saw for isFirst when we were rendered.
   * @type {boolean}
   * @private
   */
   this.isFirst_ = false;
};
goog.inherits(cm.FolderLegendView_, cm.LegendView);

/**
 * Builds and returns the list of legend views for the sublayers.
 * @return {Array.<cm.LegendView>}
 * @private
 */
cm.FolderLegendView_.prototype.buildSublayerLegendViews_ = function() {
  var sublayerLegendViews = [];
  goog.array.forEach(this.layerModel_.getSublayerIds(), goog.bind(function(id) {
    sublayerLegendViews.push(cm.LegendView.getLegendViewForLayer(
        this.layerModel_.getSublayer(id), this.metadataModel_, this.appState_));
  }, this));
  return sublayerLegendViews;
};

/** @override */
cm.FolderLegendView_.prototype.setupListeners = function() {
  cm.LegendView.prototype.setupListeners.call(this);

  // These listeners only work because the only time our layer's sublayers
  // or folder type can change is if our parent is unlocked!  If the UI for
  // that changes, we need to somehow recover whether one of our ancestors is
  // locked in order to render properly.
  var sublayers = /** @type google.maps.MVCArray */(
      this.layerModel_.get('sublayers'));
  cm.events.listen(sublayers, 'insert_at', function(i) {
    var newLegendView = cm.LegendView.getLegendViewForLayer(
        /** @type cm.LayerModel */(sublayers.getAt(i)), this.metadataModel_,
        this.appState_);
    goog.array.insertAt(this.sublayerLegendViews_, newLegendView, i);
    this.render(null, this.isFirst_);
  }, this);
  cm.events.listen(sublayers, 'remove_at', function(i, layer) {
    goog.array.removeAt(this.sublayerLegendViews_, i);
    this.render(null, this.isFirst_);
  }, this);
  cm.events.onChange(this.layerModel_, ['folder_type'], function() {
    this.render(null, this.isFirst_);
    this.handleTitleChanged_();
    this.handleTitleChanged_();
  }, this);
  cm.events.onChange(
      this.appState_, 'enabled_layer_ids', function() {
        if (this.folderType_() === cm.LayerModel.FolderType.SINGLE_SELECT) {
          this.handleTitleChanged_();
        }
      }, this);
  // Triggered by the layer arranger
  cm.events.listen(
      goog.global, cm.events.MODEL_CHANGED, function() {
        this.sublayerLegendViews_ = this.buildSublayerLegendViews_();
        this.render(null, this.isFirst_);
      }, this);
};

/**
 * Convenience function returning the type of the folder for this legend's
 * layer.
 * @return {?cm.LayerModel.FolderType}
 * @private
 */
cm.FolderLegendView_.prototype.folderType_ = function() {
  return /** @type cm.LayerModel.FolderType */(this.layerModel_.get(
      'folder_type')) || null;
};

/** @override */
cm.FolderLegendView_.prototype.render = function(parentFolderType, isFirst) {
  // Clear the existing UI
  this.isFirst_ = isFirst;
  cm.ui.clear(this.parentElem_);
  goog.dom.classes.enable(this.parentElem_, cm.css.TABBED_LEGEND_BOX, false);
  goog.dom.classes.enable(
      this.parentElem_, cm.css.FIRST_TABBED_LEGEND_BOX, false);

  // Render our legend
  var childIsFirst = this.renderOwnLegend_(parentFolderType, isFirst);

  // Render the sublayers
  goog.array.forEach(this.sublayerLegendViews_, goog.bind(function(sublayer) {
    // If any ancestor is locked, we use the locked style for all descendants
    cm.ui.append(this.parentElem_, sublayer.getContentForParentType(
        (parentFolderType === cm.LayerModel.FolderType.LOCKED) ?
            parentFolderType : this.folderType_(), childIsFirst));
    childIsFirst = childIsFirst && sublayer.isHidden();
  }, this));
  this.updateHidden_();
};

/**
 * Renders into this.parentElem_ any legend associated with the folder layer
 * itself.
 * @param {?cm.LayerModel.FolderType} parentFolderType the type of folder
 *    (if any) into which this folder is being rendered.
 * @param {boolean} isFirst Whether this legend is being displayed at the top
 *   of a list of legends.
 * @return {boolean} Whether the sublayers should be rendered as the first
 *   legend displayed.
 * @private
 */
cm.FolderLegendView_.prototype.renderOwnLegend_ = function(
    parentFolderType, isFirst) {
  var legendBox;
  var childrenAreFirst = false;
  if (!cm.LegendView.sublayersShouldDrawBox(this.folderType_())) {
    // If the sublayers are not drawing their own boxes,the folder can render
    // directly in to parentElem_ because the legends of the sublayers should
    // appear inside the box drawn for the folder itself.
    legendBox = this.parentElem_;
  } else {
    // When sublayers will add their own box, the folder must render its legend
    // in to a separate box, then append the box to parentElem_.  This allows
    // the sublayers to render into their own boxes, which will appear as
    // siblings to the folder's legend.
    legendBox = cm.ui.create('div');
    cm.ui.append(this.parentElem_, legendBox);
    goog.dom.classes.enable(legendBox, cm.css.HIDDEN, this.isEmpty);
  }

  if (cm.LegendView.sublayersShouldDrawBox(parentFolderType)) {
    goog.dom.classes.enable(legendBox, cm.css.TABBED_LEGEND_BOX, true);
    goog.dom.classes.enable(legendBox, cm.css.FIRST_TABBED_LEGEND_BOX, isFirst);
    cm.ui.append(legendBox, this.titleElem_);
    childrenAreFirst = isFirst && this.isEmpty;
  }
  cm.ui.append(legendBox, this.legendElem_);
  return childrenAreFirst;
};

/** @override */
cm.FolderLegendView_.prototype.isHidden = function() {
  if (!this.isEnabled()) return true;
  if (!this.isInZoomRange()) return true;
  if (!this.isEmpty) return false;

  var sublayersHaveContent = false;
  goog.array.forEach(this.sublayerLegendViews_, function(sublayer) {
    if (!sublayer.isHidden()) sublayersHaveContent = true;
  });
  return !sublayersHaveContent;
};

/** @override */
cm.FolderLegendView_.prototype.titleString = function() {
  if (this.folderType_() === cm.LayerModel.FolderType.SINGLE_SELECT &&
      this.sublayerLegendViews_.length) {
    return this.layerModel_.get('title') +
        goog.string.unescapeEntities(' &ndash; ') +
        this.selectedLegendView_().titleString();
  } else {
    return cm.LegendView.prototype.titleString.call(this);
  }
};

/**
 * Helper function to locate and return the sublayer of a single-select
 * folder that's currently selected. The caller needs to ensure that
 * this.sublayerLegendViews_ is non-empty.
 * @return {cm.LegendView} The legend view for the currently selected sublayer.
 * @private
 */
cm.FolderLegendView_.prototype.selectedLegendView_ = function() {
  var selectedId = this.appState_.getFirstEnabledSublayerId(this.layerModel_);
  if (!selectedId) return this.sublayerLegendViews_[0];

  var sublayers = this.layerModel_.get('sublayers');
  for (var i = 0; i < sublayers.getLength(); i++) {
    if (this.appState_.getLayerEnabled(sublayers.getAt(i).get('id'))) {
      return this.sublayerLegendViews_[i];
    }
  }
  return this.sublayerLegendViews_[0];
};
