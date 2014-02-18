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

/**
 * Provides LegendView, which displays the legend for a particular LayerModel,
 * and LegendViewList, which monitors an MVCArray of LayerModels, and maintains
 * a matching list of LegendViews.  LegendViewList is used by the legends tab
 * to watch all layers for a map, and by the folder legend implementation, to
 * watch all sublayers in the folder.
 *
 * To use LegendView, instantiate from the appropriate LayerModel and the global
 * AppState.  Call legendView.getContent() to retrieve the LegendView's DOM
 * element; be prepared for a null return, which means the legend currently
 * should not be displayed.  Listen for the event
 * LEGEND_VIEW_RENDERING_CHANGED, which the LegendView emits when it detects
 * that its content has changed (for instance, in response to changes to the
 * layer); the LegendView will not re-render its content until getContent() is
 * called again.
 *
 * LegendViewList is similar - initialize from an MVCArray of LayerModels; call
 * legendViewList.getLegendViews() to get the properly ordered equivalent list
 * of LegendViews, and listen for LEGEND_VIEW_LIST_RENDERING_CHANGED to know
 * when to re-query the list.  LegendViewList takes care of listening for all
 * changes to the renderings of the individual LegendViews, as well as changes
 * to the list as a whole, but leaves it to the client to actually re-render
 * the LegendViews themselves.
 */

goog.provide('cm.LegendView');
goog.provide('cm.LegendViewList');

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
   * Whether we need to be rendered.  I.e. whether the contents of
   * parentElem_ are currently up-to-date with the layer.
   * @type boolean
   * @private
   */
  this.needsRender_ = true;

  /**
   * Whether our listeners have been created.
   * @type boolean
   * @private
   */
  this.listenersSetup_ = false;

  /**
   * Whether we reported ourselves as hidden when last we rendered. This
   * value must be ignored until our first rendering (indicated by whether_
   * listenersSetup_ is true); after that, isHidden_ has a valid value.
   * @type boolean
   * @private
   */
  this.isHidden_ = true;
};

// Public interface for clients

/**
 * Returns the element for the legend, ready to be inserted into the DOM, or
 *  null if the legend currently is empty or otherwise should not be displayed.
 * @return {?Element}
 */
cm.LegendView.prototype.getContent = function() {
  if (!this.listenersSetup_) {
    this.setupListeners();
    this.listenersSetup_ = true;
  }
  this.isHidden_ = this.isHidden();
  if (this.isHidden_) {
    return null;
  }
  if (this.needsRender_) {
    this.updateTitle_();
    this.updateLegend_();
    this.render();
    this.needsRender_ = false;
  }
  return this.parentElem_;
};

/** Called when the parent folder's rendering changes. */
cm.LegendView.prototype.parentRenderingChanged = function() {
  this.renderingChanged();
};

// Methods to be overridden by subclasses

/**
 * Sets up any needed listeners prior to rendering.
 * @protected
 */
cm.LegendView.prototype.setupListeners = function() {
  cm.events.onChange(
      this.layerModel_, ['min_zoom', 'max_zoom'], this.updateHidden,
      this);

  cm.events.onChange(this.layerModel_, 'title', this.renderingChanged, this);
  cm.events.onChange(this.layerModel_, 'legend', this.renderingChanged, this);

  cm.events.listen(
      cm.app, cm.events.ZOOM_CHANGED, this.handleZoomLevelChanged_, this);

  cm.events.onChange(
      this.appState_, 'enabled_layer_ids', this.updateHidden, this);
};

/**
 * Renders content into this.parentElem_. Only called if isHidden() returns
 * false.
 * @protected
 */
cm.LegendView.prototype.render = function() {};

/**
 * An abstract method that returns whether the legend should be hidden.
 * Subclasses can use isEnabled(), isInZoomRange() and isEmpty() to implement
 * the necessary logic.
 * @return {boolean}
 * @protected
 */
cm.LegendView.prototype.isHidden = function() { return false; };

/**
 * Returns the string to be used as the title of the legend; by default,
 * the title of the layer from the model.
 * @return {string} The title for the legend.
 */
cm.LegendView.prototype.titleString = function() {
  return /** @type string */(this.layerModel_.get('title'));
};

// Helper methods available to subclasses.

/**
 * Whether the layer's legend is empty.
 * @return {boolean}
 */
cm.LegendView.prototype.isEmpty = function() {
  return /** @type cm.Html */(this.layerModel_.get('legend')).isEmpty();
};

/**
 * Whether this legend's layer is currently enabled.
 * @return {boolean}
 * @protected
 */
cm.LegendView.prototype.isEnabled = function() {
  return this.appState_.getLayerEnabled(
      /** @type string */(this.layerModel_.get('id')));
};

/**
 * Whether the map is currently zoomed within the bounds specified
 * for this legend's layer.
 * @return {boolean}
 * @protected
 */
cm.LegendView.prototype.isInZoomRange = function() {
  return this.layerModel_.insideZoomBounds(this.currentZoomLevel_);
};


/**
 * Whether a legend needs to draw a box around itself depends on its ancestors;
 * if the immediate parent is locked or single-select, the legend should not
 * draw the box. If any ancestor is locked, it also should not draw the box.
 * In all other cases, it should.  Because legend views sometimes need to ask
 * about their own rendering and sometimes about their children, there are two
 * instance methods below that call through to this routine.
 * @param {?cm.LayerModel} parentLayer The parent of the layer whose behavior
 *   is being queried.
 * @return {boolean} Whether a child of parentLayer should draw a box.
 * @private
 */
cm.LegendView.shouldDrawBoxHelper_ = function(parentLayer) {
  if (!parentLayer) return true;
  var ancestor = parentLayer;
  while (ancestor) {
    if (ancestor.get('folder_type') === cm.LayerModel.FolderType.LOCKED) {
      return false;
    }
    ancestor = ancestor.get('parent');
  }
  return (parentLayer.get('folder_type') === cm.LayerModel.FolderType.UNLOCKED);
};

/**
 * Helper method to determine whether the legendView should draw a box around
 * itself.
 * @return {boolean} whether the receiver should draw a box when rendering.
 * @protected
 */
cm.LegendView.prototype.shouldDrawBox = function() {
  return cm.LegendView.shouldDrawBoxHelper_(
      /**@type ?cm.LayerModel*/(this.layerModel_.get('parent')));
};

/**
 * Helper method to determine whether the children of the legendView should
 * draw a box around themselves.
 * @return {boolean} whether the receiver's children should draw boxes when
 *   rendering
 * @protected
 */
cm.LegendView.prototype.childrenShouldDrawBox = function() {
  return cm.LegendView.shouldDrawBoxHelper_(this.layerModel_);
};

/** Announces that the legend view's rendering has been changed. */
cm.LegendView.prototype.renderingChanged = function() {
  if (!this.listenersSetup_) return;
  this.needsRender_ = true;
  cm.events.emit(this, cm.events.LEGEND_VIEW_RENDERING_CHANGED);
};

/**
 * Helper method for when only the legend's visibility may have changed; it
 * compares against the last reported state and emits a rendering changed event
 * iff so.
 * @protected
 */
cm.LegendView.prototype.updateHidden = function() {
  if (this.isHidden() !== this.isHidden_) {
    this.renderingChanged();
  }
};

// Private methods

/** @private Updates the title DOM element from the layer model. */
cm.LegendView.prototype.updateTitle_ = function() {
  cm.ui.clear(this.titleElem_);
  cm.ui.append(this.titleElem_, this.titleString());
};

/** @private Updates the legend DOM element from the layer model. */
cm.LegendView.prototype.updateLegend_ = function() {
  cm.ui.clear(this.legendElem_);
  var legendHtml = /** @type cm.Html */(this.layerModel_.get('legend'));
  legendHtml.pasteInto(this.legendElem_);
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
  this.updateHidden();
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
 * Watches a list of layers and maintains the equivalent list of legends,
 * emitting an event when changes that effect the display are made.
 * @param {google.maps.MVCObject} source The object that owns the list of
 *   layers.
 * @param {string} property The property on source to observe.  Its value must
 *   be an MVCArray.
 * @param {cm.AppState} appState The global appState
 * @param {cm.MetadataModel} metadataModel The metadataModel
 * @constructor
 */
cm.LegendViewList = function(source, property, appState, metadataModel) {
  /**
   * The MVCObject that owns the array to which we are listening.  In practice,
   * this will either be a cm.MapModel or a folder type cm.LayerModel.
   * @type google.maps.MVCObject
   * @private
   */
  this.source_ = source;

  /**
   * The property on this.source_ where the MVCArray of LayerModels is kept.
   * For maps, it will be 'layers'; for folders it will be 'sublayers'.
   * @type string
   * @private
   */
  this.property_ = property;

  /**
   * The global appState.
   * @type cm.AppState
   * @private
   */
  this.appState_ = appState;

  /**
   * The global metadata model.  Unfortunately, we need this to construct new
   * LegendViews; otherwise, it is unused.
   * @type cm.MetadataModel
   * @private
   */
  this.metadataModel_ = metadataModel;

  /**
   * The MVCArray of layer models that we are watching.
   * @type ?google.maps.MVCArray
   * @private
   */
  this.layers_ = null;

  /**
   * The array of legend views, ordered to match this.layers_.
   * @type Array
   * @private
   */
  this.legendViews_ = [];

  /**
   * The array of listeners to each of the legend views in this.legendViews_.
   * Its ordering matches this.legendViews_.
   * @type Array.<cm.events.ListenerToken>
   * @private
   */
  this.legendViewListeners_ = [];

  /**
   * Listeners on this.layers_.  These must be unlistened and replaced when
   * this.layers_ changes.
   * @type Array.<cm.events.ListenerToken>
   * @private
   */
  this.layersListeners_ = [];

  /**
   * Whether we are in the middle of an cm.ArrangeCommand, which rearranges
   * all the layers associated with a map in a bulk fashion.  In the midst of
   * that transformation, the tree of layers is often not well-formed, with the
   * same sublayer potentially appearing in two different parent's lists of
   * children.  So instead, we record when the command is in progress, and
   * suspend all notifications until it completes.
   * @type boolean
   * @private
   */
  this.arranging_ = false;

  this.buildLegendViews_();

  cm.events.onChange(source, property, this.resetLegendViews_, this);
  cm.events.listen(cm.app, cm.events.ARRANGE_COMMAND_BEGIN, function() {
        this.arranging_ = true;
  }, this);
  cm.events.listen(cm.app, cm.events.ARRANGE_COMMAND_ENDED, function() {
    this.arranging_ = false;
    this.resetLegendViews_();
  }, this);
};

/**
 * Unlisten from all listeners that were associated with the MVCArray of
 * legendViews.  Used when the original array was discarded and replaced
 * by a different one.
 * @private
 */
cm.LegendViewList.prototype.unlisten_ = function() {
  goog.array.forEach(this.legendViewListeners_, goog.bind(function(listener) {
    cm.events.unlisten(listener, this);
  }, this));
  goog.array.forEach(this.layersListeners_, goog.bind(function(listener) {
    cm.events.unlisten(listener, this);
  }, this));
};

/**
 * Notify any listeners that the list's rendering has changed.
 * @private
 */
cm.LegendViewList.prototype.renderingChanged_ = function() {
  if (!this.arranging_) {
    cm.events.emit(this, cm.events.LEGEND_VIEW_LIST_RENDERING_CHANGED);
  }
};

/**
 * Completely resets all state and all listeners from the source MVCObject.
 * Used when the MVCArray that we have been observing is replaced (rather than
 * its contents mutated) on the source object.
 * @private
 */
cm.LegendViewList.prototype.resetLegendViews_ = function() {
  if (this.arranging_) return;
  this.unlisten_();
  this.layers_ = null;
  this.legendViews_ = [];
  this.legendViewListeners_ = [];
  this.layersListeners_ = [];
  this.buildLegendViews_();
  this.renderingChanged_();
};

/**
 * Helper to setup and return the correct listener for a legend view.
 * @param {cm.LegendView} legendView
 * @return {cm.events.ListenerToken|Array.<cm.events.ListenerToken>}
 * @private
 */
cm.LegendViewList.prototype.listenToLegendView_ = function(legendView) {
  return cm.events.listen(legendView, cm.events.LEGEND_VIEW_RENDERING_CHANGED,
                          this.renderingChanged_, this);
};

/** @private Builds the list of legend views. */
cm.LegendViewList.prototype.buildLegendViews_ = function() {
  this.layers_ = /**@type google.maps.MVCArray*/(this.source_.get(
      this.property_));
  this.layers_.forEach(goog.bind(function(layer, i) {
    var legendView = cm.LegendView.getLegendViewForLayer(
        layer, this.metadataModel_, this.appState_);
    this.legendViews_.push(legendView);
    this.legendViewListeners_.push(this.listenToLegendView_(legendView));
    }, this));
  this.setupListeners_();
};

/**
 * Sets up the listeners necessary to monitor the MVCArray of layers.
 * @private
 */
cm.LegendViewList.prototype.setupListeners_ = function() {
  this.layersListeners_.push(cm.events.listen(
      this.layers_, 'insert_at', function(i) {
        if (this.arranging_) return;
        var legendView = cm.LegendView.getLegendViewForLayer(
            this.layers_.getAt(i), this.metadataModel_, this.appState_);
        this.legendViews_.splice(i, 0, legendView);
        this.legendViewListeners_.splice(
            i, 0, this.listenToLegendView_(legendView));
        if (legendView.getContent()) {
          cm.events.emit(this, cm.events.LEGEND_VIEW_LIST_RENDERING_CHANGED);
        }
      }, this));
  this.layersListeners_.push(cm.events.listen(
      this.layers_, 'remove_at', function(i, layer) {
        if (this.arranging_) return;
        var legendView = this.legendViews_[i];
        cm.events.unlisten(this.legendViewListeners_[i], this);
        this.legendViews_.splice(i, 1);
        this.legendViewListeners_.splice(i, 1);
        if (legendView.getContent()) {
          cm.events.emit(this, cm.events.LEGEND_VIEW_LIST_RENDERING_CHANGED);
        }
      }, this));
};

/**
 * Returns an array of the actual legend views. The order of the array matches
 * the order of the layers in the MVCArray being watched.
 * @return {Array.<cm.LegendView>}
 */
cm.LegendViewList.prototype.getLegendViews = function() {
  return this.legendViews_;
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
  cm.events.onChange(this.layerModel_, 'parent', this.renderingChanged, this);
  this.updateMetadataListener_();
};

/** @override */
cm.SimpleLegendView_.prototype.render = function() {
  // Sometimes a legend renders its comments with a box and title; other times
  // it relies on its parent to render the box and title. this.shouldDrawBox()
  // tells us which behavior we want.
  var drawBox = this.shouldDrawBox();
  cm.ui.clear(this.parentElem_);
  goog.dom.classes.enable(this.parentElem_, cm.css.TABBED_LEGEND_BOX, drawBox);
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
      this.layerModel_, this.updateHidden, this);

  this.updateHidden();
};

/** @override */
cm.SimpleLegendView_.prototype.isHidden = function() {
  // The legend is not visible if:
  // - the layer is disabled
  // - the current map zoom level is outside the min/max zoom limits for
  // the layer (superclass checks this since every layer has zoom limits that
  // should be respected)
  // - there is no legend
  // - the metadataModel is currently reporting the layer as empty (only simple
  // layers have source URLs, so we need to check this ourselves)
  return (!this.isEnabled() || !this.isInZoomRange() ||
      this.isEmpty() || !!this.metadataModel_.isEmpty(this.layerModel_));
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
   * The list of cm.LegendViews for the sublayers of our folder.
   * The LegendViews are constructed immediately, but are not rendered
   * until the FolderLegendView is asked to render.
   * @type cm.LegendViewList
   * @private
   */
  this.sublayerLegendViews_ = new cm.LegendViewList(
      layerModel, 'sublayers', appState, metadataModel);
};
goog.inherits(cm.FolderLegendView_, cm.LegendView);

/** @override */
cm.FolderLegendView_.prototype.setupListeners = function() {
  cm.LegendView.prototype.setupListeners.call(this);

  cm.events.onChange(
      this.layerModel_, 'folder_type', this.handleFolderTypeChanged_, this);
  // Needed because if we are a single-select folder, our displayed title
  // changes when the selected sublayer changes.
  cm.events.onChange(
      this.appState_, 'enabled_layer_ids', function() {
        if (this.folderType_() === cm.LayerModel.FolderType.SINGLE_SELECT) {
          this.renderingChanged();
        }
      }, this);
  cm.events.listen(
      this.sublayerLegendViews_, cm.events.LEGEND_VIEW_LIST_RENDERING_CHANGED,
      this.renderingChanged, this);
};

/**
 * Handler for when the folder changes its type (e.g. from locked to unlocked
 * or single-select).  Notifies the sublegends that their rendering may have
 * changed.
 * @private
 */
cm.FolderLegendView_.prototype.handleFolderTypeChanged_ = function() {
  goog.array.forEach(
      this.sublayerLegendViews_.getLegendViews(),
      function(legendView) { legendView.parentRenderingChanged(); });
  this.renderingChanged();
};

/** @override */
cm.FolderLegendView_.prototype.parentRenderingChanged = function() {
  this.handleFolderTypeChanged_();
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
cm.FolderLegendView_.prototype.render = function() {
  // Clear the existing UI
  cm.ui.clear(this.parentElem_);
  goog.dom.classes.enable(this.parentElem_, cm.css.TABBED_LEGEND_BOX, false);

  // Render our legend
  this.renderOwnLegend_();

  // Render the sublayers
  goog.array.forEach(
      this.sublayerLegendViews_.getLegendViews(), goog.bind(
          function(sublayer) {
            var content = sublayer.getContent();
            content && cm.ui.append(this.parentElem_, content);
          }, this));
};

/**
 * Renders into this.parentElem_ any legend associated with the folder layer
 * itself.
 * @private
 */
cm.FolderLegendView_.prototype.renderOwnLegend_ = function() {
  var legendBox;
  if (!this.childrenShouldDrawBox()) {
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
  }

  if (this.shouldDrawBox()) {
    goog.dom.classes.enable(legendBox, cm.css.TABBED_LEGEND_BOX, true);
    cm.ui.append(legendBox, this.titleElem_);
  }
  cm.ui.append(legendBox, this.legendElem_);
};

/** @override */
cm.FolderLegendView_.prototype.isHidden = function() {
  if (!this.isEnabled()) return true;
  if (!this.isInZoomRange()) return true;
  if (!this.isEmpty()) return false;

  var sublayersHaveContent = false;
  goog.array.forEach(
      this.sublayerLegendViews_.getLegendViews(),
      function(subLegendView) {
        if (subLegendView.getContent()) sublayersHaveContent = true;
      });
  return !sublayersHaveContent;
};

/** @override */
cm.FolderLegendView_.prototype.titleString = function() {
  if (this.folderType_() === cm.LayerModel.FolderType.SINGLE_SELECT &&
      this.sublayerLegendViews_.getLegendViews().length) {
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
      return this.sublayerLegendViews_.getLegendViews()[i];
    }
  }
  return this.sublayerLegendViews_[0];
};
