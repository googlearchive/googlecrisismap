// Copyright 2012 Google Inc.  All Rights Reserved.
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
 * @fileoverview A model for all the non-persistent application state.  It is
 *     okay for Views to bind to and change this model and its contents.
 * @author kpy@google.com (Ka-Ping Yee)
 */

goog.provide('cm.AppState');

goog.require('cm');
goog.require('cm.LatLonBox');
goog.require('cm.MapModel');
goog.require('cm.util');
goog.require('goog.Uri');
goog.require('goog.array');
goog.require('goog.object');
goog.require('goog.structs.Set');

/** @const */var DEFAULT_LANGUAGE = 'en';


/**
 * A model for all the non-persistent application state.  This includes the
 * set of layers currently enabled in the panel, the current map viewport,
 * and the currently selected base map type.
 * @param {string=} opt_language The language code for the user's language.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.AppState = function(opt_language) {
  google.maps.MVCObject.call(this);
  /**
   * The BCP 47 language code for the current UI language.
   * type string
   */
  this.set('language', opt_language || DEFAULT_LANGUAGE);

  /**
   * The set of layers currently enabled in the panel.
   * type goog.structs.Set
   */
  this.set('enabled_layer_ids', new goog.structs.Set());

  /**
   * The query in the filter.
   * type string
   */
  this.set('filter_query', '');

  /**
   * The set of layers currently matched by a layer filter query.
   * type Array.<string>
   */
  this.set('matched_layer_ids', []);

  /**
   * The dictionary to keep opacity values of layers.  Indexed by layer ID.  The
   * values in the dictionary are integers from 0 to 100.  All layers that
   * don't appear in the dictionary are assumed to have opacity 100.
   * type Object
   */
  this.set('layer_opacities', {});

  /**
   * The current map viewport.  This shouldn't ever be null.
   * type !cm.LatLonBox
   */
  this.set('viewport', cm.LatLonBox.ENTIRE_MAP);

  /** The currently selected base map type, as a cm.MapModel.Type. */
  this.set('map_type', cm.MapModel.Type.ROADMAP);

  cm.events.listen(goog.global, [cm.events.MODEL_CHANGED], function(e) {
    e.model && this.updateSingleSelectFolders(e.model);
  }, this);
};
goog.inherits(cm.AppState, google.maps.MVCObject);

/**
 * Creates a new AppState from a given app state, copying its properties.
 * @param {cm.AppState} appState AppState to copy from.
 * @return {cm.AppState} The new app state.
 */
cm.AppState.fromAppState = function(appState) {
  var newAppState = new cm.AppState(
      /** @type {string} */ (appState.get('language')));
  newAppState.set('enabled_layer_ids',
      appState.get('enabled_layer_ids').clone());
  newAppState.set('matched_layer_ids', goog.array.clone(
      /** @type {Array.<string>} */ (appState.get('matched_layer_ids'))));
  newAppState.set('layer_opacities', goog.object.clone(
      /** @type {Object} */ (appState.get('layer_opacities'))));
  newAppState.set('viewport', appState.get('viewport'));
  newAppState.set('map_type', appState.get('map_type'));
  return newAppState;
};

/**
 * Returns whether or not a particular layer is enabled.
 * @param {string} id A layer ID.
 * @return {boolean} The enabled state for the layer.
 */
cm.AppState.prototype.getLayerEnabled = function(id) {
  return this.get('enabled_layer_ids').contains(id);
};

/**
 * Sets the enabled state of an individual layer by its ID.
 * @param {string} id A layer ID.
 * @param {boolean} newValue The new enabled state for the layer.
 */
cm.AppState.prototype.setLayerEnabled = function(id, newValue) {
  var layerIds = this.get('enabled_layer_ids');
  var currentlyEnabled = layerIds.contains(id);
  if (currentlyEnabled !== newValue) {
    newValue ? layerIds.add(id) : layerIds.remove(id);
    this.notify('enabled_layer_ids');
  }
};

/**
 * Get the current filter query.
 * @return {string} The filter query.
 */
cm.AppState.prototype.getFilterQuery = function() {
  return /** @type string */ (this.get('filter_query'));
};

/**
 * Set the current filter query.
 * @param {string} query The query.
 */
cm.AppState.prototype.setFilterQuery = function(query) {
  this.set('filter_query', query);
};

/**
 * Returns whether a layer is matched by the current filter query.
 * @param {string} id A layer ID.
 * @return {boolean} True if matches the current query.
 */
cm.AppState.prototype.getLayerMatched = function(id) {
  return goog.array.contains(/** @type Array.<string> */
    (this.get('matched_layer_ids')), id);
};

/**
 * Resets the set of layers matching the current filter query.
 * This function should only be called as a handler for FILTER_MATCHES_CHANGED,
 * in order to maintain consistency with the filter_query property.
 * TODO(romano): Consider moving 'matched_layer_ids' from the app state into
 * a function of the map model that computes this set from a given query.
 * The map model will also cache the matched IDs as long as the model remains
 * unchanged.
 * @param {Array.<string>} ids The layer IDs.
 */
cm.AppState.prototype.setMatchedLayers = function(ids) {
  this.set('matched_layer_ids', ids);
};

/**
 * Sets the opacity of a layer by its ID.
 * @param {string} id A layer ID.
 * @param {number} opacity An integer opacity value between 0 and 100.
 */
cm.AppState.prototype.setLayerOpacity = function(id, opacity) {
  this.get('layer_opacities')[id] = Math.round(opacity);
  this.notify('layer_opacities');
};

/**
 * Returns the ID of the first selected sublayer of the given layer, or null if
 * there is none.
 * @param {cm.LayerModel} layer The parent layer model.
 * @return {?string} The ID of the first enabled sublayer model or null
 *   if there is no enabled sublayer.
 */
cm.AppState.prototype.getFirstEnabledSublayerId = function(layer) {
  var enabledIds = this.get('enabled_layer_ids').intersection(
      layer.getSublayerIds());
  return enabledIds.isEmpty() ? null : enabledIds.getValues()[0];
};

/**
 * Enables a sublayer of the given layer and disables all other sublayers.
 * @param {cm.LayerModel} layer The layer whose sublayer to select.
 * @param {string} selectedId The ID of the sublayer to select.
 */
cm.AppState.prototype.selectSublayer = function(layer, selectedId) {
  var enabledLayerIds = this.get('enabled_layer_ids');
  var sublayerIds = layer.getSublayerIds();
  enabledLayerIds.removeAll(sublayerIds);
  enabledLayerIds.add(selectedId);
  this.notify('enabled_layer_ids');
};

/**
 * Enforces that all non-empty single-select folders in the given map or
 * layer tree have exactly one enabled sublayer.
 * @param {cm.LayerModel|cm.MapModel} model The layer or map model.
 */
cm.AppState.prototype.updateSingleSelectFolders = function(model) {
  var updateSingleSelect = goog.bind(function(layer) {
    var enabledLayerIds = this.get('enabled_layer_ids');
    if (layer.isSingleSelect()) {
      var sublayerIds = layer.getSublayerIds();
      var selectedId = this.getFirstEnabledSublayerId(layer) ||
          (sublayerIds.length && sublayerIds[0]);
      if (selectedId) {
        // Select this sublayer without notifying changes to 'enabled_layer_ids'
        enabledLayerIds.removeAll(sublayerIds);
        enabledLayerIds.add(selectedId);
      }
    }
  }, this);

  if (model.get('layers')) {
    cm.util.forLayersInMap(/** @type cm.MapModel */(model), updateSingleSelect);
  } else {
    cm.util.forLayerAndDescendants(/** @type cm.LayerModel */(model),
      updateSingleSelect);
  }
  this.notify('enabled_layer_ids');
};

/**
 * Returns all layers that should be visible on the map.
 * @param {cm.MapModel} mapModel The map model.
 * @return {goog.structs.Set} The IDs of layers that should be visible.
 */
cm.AppState.prototype.getVisibleLayerIds = function(mapModel) {
  var enabledLayerIds = this.get('enabled_layer_ids');
  var visibleLayerIds = new goog.structs.Set();
  cm.util.forLayersInMap(mapModel,
      function(layer) {
        var id = layer.get('id');
        enabledLayerIds.contains(id) && visibleLayerIds.add(id);
      },
      function(layer) {
        return enabledLayerIds.contains(layer.get('id'));
      },
      this);
  return visibleLayerIds;
};

/**
 * Updates the given mapModel with the properties of this AppState. The map
 * type, viewport, default layers, and layer opacities will be updated.
 * @param {cm.MapModel} mapModel The MapModel to update.
 */
cm.AppState.prototype.writeToMapModel = function(mapModel) {
  mapModel.set('viewport', this.get('viewport'));
  mapModel.set('map_type', this.get('map_type') || cm.MapModel.Type.ROADMAP);
  var enabledLayers = this.get('enabled_layer_ids');
  var opacities = this.get('layer_opacities');
  cm.util.forLayersInMap(mapModel, function(layer) {
    var id = /** @type {string} */(layer.get('id'));
    layer.set('default_visibility', enabledLayers.contains(id));
    layer.set('opacity', opacities[id] !== undefined ? opacities[id] / 100 : 1);
  }, null, this);
};

/**
 * Sets the base map type, map viewport, layer visibility, and layer opacities
 * to the default view specified by the MapModel.
 * @param {cm.MapModel} mapModel The MapModel.
 */
cm.AppState.prototype.setFromMapModel = function(mapModel) {
  // We'll set('layer_opacities') all at once, to avoid emitting n^2 events.
  var opacities = {};
  cm.util.forLayersInMap(mapModel, function(layer) {
    var id = /** @type {string} */(layer.get('id'));
    var opacity = /** @type {number} */(layer.get('opacity'));
    if (opacity < 1) {
      opacities[id] = opacity * 100;
    }
    this.setLayerEnabled(id, layer.get('default_visibility'));
  }, null, this);
  this.updateSingleSelectFolders(mapModel);
  this.set('map_type', mapModel.get('map_type') || cm.MapModel.Type.ROADMAP);
  this.set('layer_opacities', opacities);
  this.set('viewport', mapModel.get('viewport'));
};

/** @return {!goog.Uri} A URI that encodes all the application state. */
cm.AppState.prototype.getUri = function() {
  var viewport = /** @type cm.LatLonBox */(this.get('viewport'));
  var enabledIds = /** @type goog.structs.Set */(this.get('enabled_layer_ids'));

  // TODO(kpy): Consider showing a warning if the user shares a link to a
  // non-default server, such as a development server?
  var uri = new goog.Uri(goog.global.location);
  // Allow the 'base' query parameter to override the base URL for sharing.
  if (uri.getParameterValue('base')) {
    uri = new goog.Uri(uri.getParameterValue('base'));
  }
  // Clear the query so all the parameters are added in a fixed order.
  uri.setQuery('');
  // Include the UI language.
  uri.setParameterValue('hl', this.get('language'));
  // Add query parameters to encode the view state.
  uri.setParameterValue('llbox', viewport.round(4).toString());
  uri.setParameterValue('t', this.get('map_type'));
  uri.setParameterValue('layers', this.getLayersParameter_());
  // Add the layer filter query, if there is one.
  if (this.get('filter_query')) {
    uri.setParameterValue('q', this.get('filter_query'));
  }
  return uri;
};

/**
 * Adjusts the app state based on query parameters as encoded by getUri().
 * Note that parameters for adjusting the viewport aren't handled here; the
 * MapView adjusts its own viewport based on the URI and the AppState picks up
 * the viewport because its 'viewport' property is bound to the MapView.
 * @param {!goog.Uri|!Location|string} uri A URI that encodes the app state.
 */
cm.AppState.prototype.setFromUri = function(uri) {
  uri = new goog.Uri(uri);

  var mapType = (uri.getParameterValue('t') || '').toUpperCase();
  if (mapType) {
    if (!goog.object.containsValue(cm.MapModel.Type, mapType)) {
      mapType = cm.MapModel.Type.ROADMAP;
    }
    this.set('map_type', mapType);
  }
  // TODO(romano): Needs error-checking to verify that the layer
  // ID lists in the 'layers' parameters is valid, and if not,
  // default to a valid value.
  var enabledLayers = uri.getParameterValue('layers');
  if (goog.isDefAndNotNull(enabledLayers)) {
    // 'layers' url parameter defines which layers are enabled and also
    // optionally the opacity values (0 to 100) of the enabled layers.
    // An example of a valid parameter string: layers=1234:67,456,9876:1
    var enabledLayerIds = new goog.structs.Set();
    // We'll set('layer_opacities') all at once, to avoid emitting n^2 events.
    var opacities = goog.object.clone(
        /** @type Object.<number> */(this.get('layer_opacities')));
    goog.array.forEach(enabledLayers.split(','), function(str) {
      var tuple = str.split(':');
      enabledLayerIds.add(tuple[0]);
      if (tuple.length == 2) {
        opacities[tuple[0]] = tuple[1] - 0;
      }
    });
    this.set('enabled_layer_ids', enabledLayerIds);
    this.set('layer_opacities', opacities);
  }
  this.set('filter_query', uri.getParameterValue('q') || '');
};

/**
 * Generates a valid 'layers' URL parameter string using enabled layer IDs and
 * layer opacities.
 * @private
 * @return {string} A 'layers' URL parameter.
 */
cm.AppState.prototype.getLayersParameter_ = function() {
  var enabledIds = this.get('enabled_layer_ids').getValues();
  var layerStrings = [];
  var opacities = this.get('layer_opacities') || {};
  goog.array.forEach(enabledIds, function(id) {
    var layerString = id;
    if (id in opacities) {
      layerString += ':' + opacities[id];
    }
    layerStrings.push(layerString);
  });
  return layerStrings.join(',');
};
