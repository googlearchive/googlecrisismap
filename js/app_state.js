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
 * @param {string} opt_language The language code for the user's language.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.AppState = function(opt_language) {
  google.maps.MVCObject.call(this);
  /**
   * The BCP 47 language code for the current UI language.
   * @type string
   */
  this.set('language', opt_language || DEFAULT_LANGUAGE);

  /**
   * The set of layers currently enabled in the panel.
   * @type goog.structs.Set
   */
  this.set('enabled_layer_ids', new goog.structs.Set());

  /**
   * The set of layers that are currently promoted sublayers of a time series.
   * @type goog.structs.Set
   */
  this.set('promoted_layer_ids', new goog.structs.Set());

  /**
   * The dictionary to keep opacity values of layers.  Indexed by layer ID.  The
   * values in the dictionary are integers from 0 to 100.  All layers that
   * don't appear in the dictionary are assumed to have opacity 100.
   * @type Object
   */
  this.set('layer_opacities', {});

  /**
   * The current map viewport.  This shouldn't ever be null.
   * @type !cm.LatLonBox
   */
  this.set('viewport', cm.LatLonBox.ENTIRE_MAP);

  /**
   * The Maps API MapTypeId of the currently selected base map (road,
   * satellite, terrain, etc.).
   * @type google.maps.MapTypeId
   */
  this.set('map_type_id', google.maps.MapTypeId.ROADMAP);
};
goog.inherits(cm.AppState, google.maps.MVCObject);

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
 * Sets the opacity of a layer by its ID.
 * @param {string} id A layer ID.
 * @param {number} opacity An integer opacity value between 0 and 100.
 */
cm.AppState.prototype.setLayerOpacity = function(id, opacity) {
  this.get('layer_opacities')[id] = Math.round(opacity);
  this.notify('layer_opacities');
};

/**
 * Promote and enable the given layer, and demote its sibling sublayers.
 * @param {cm.LayerModel} layer The layer to promote.
 */
cm.AppState.prototype.promoteLayer = function(layer) {
  var id = /** @type string */(layer.get('id'));
  var siblingIds = layer.get('parent').getSublayerIds();
  var promotedLayerIds = this.get('promoted_layer_ids');
  var enabledLayerIds = this.get('enabled_layer_ids');
  var promotedClone = promotedLayerIds.clone();
  var enabledClone = enabledLayerIds.clone();

  // Operate on a clone of each property to prevent listeners from firing
  // when nothing has changed.
  promotedClone.removeAll(siblingIds);
  enabledClone.removeAll(siblingIds);
  promotedClone.add(id);
  enabledClone.add(id);

  promotedClone.equals(promotedLayerIds) ||
      this.set('promoted_layer_ids', promotedClone);
  enabledClone.equals(enabledLayerIds) ||
      this.set('enabled_layer_ids', enabledClone);
};

/**
 * Demote all sublayers of the given layer. We don't check whether
 * the sublayers were already promoted before calling notify(), because
 * typically there is a single sublayer promoted when this is called.
 * @param {cm.LayerModel} layer The parent layer.
 */
cm.AppState.prototype.demoteSublayers = function(layer) {
  this.get('promoted_layer_ids').removeAll(layer.getSublayerIds());
  this.notify('promoted_layer_ids');
};

/**
 * Returns whether or not a layer is currently promoted.
 * @param {string} id A layer ID.
 * @return {boolean} The promoted state for the layer.
 */
cm.AppState.prototype.getLayerPromoted = function(id) {
  return this.get('promoted_layer_ids').contains(id);
};

/**
 * Returns the promoted sublayer of the given parent time series layer, or
 * null if none exists.
 * @param {cm.LayerModel} layer The parent layer model.
 * @return {?cm.LayerModel} The promoted sublayer model if it exists.
 */
cm.AppState.prototype.getPromotedSublayer = function(layer) {
  var promotedLayerIds = this.get('promoted_layer_ids');
  var sublayerIds = promotedLayerIds.intersection(layer.getSublayerIds());
  return sublayerIds.isEmpty() ? null :
      layer.getSublayer(sublayerIds.getValues()[0]);
};

/**
 * Return all layers that should be visible on the map.
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
 * Sets the base map type, map viewport, layer visibility, layer promotion,
 * and layer opacities to the default view specified by the MapModel.
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
    // By default, all time series are loaded with a promoted sublayer,
    // though this may be overriden by a URI parameter.
    if (layer.isTimeSeries()) {
      // A time series may have at most one promoted sublayer, enforced here
      // because the AppState has no handle to the layer model.
      var sublayer = layer.getMostRecentSublayer();
      sublayer && this.promoteLayer(sublayer);
    } else {
      this.demoteSublayers(layer);
    }
  }, null, this);
  if (!mapModel.get('base_map_style')) {
    this.set('map_type_id',
             cm.MapView.MODEL_TO_MAPS_API_MAP_TYPES[mapModel.get('map_type')]);
  }
  this.set('layer_opacities', opacities);
};

/** @return {!goog.Uri} A URI that encodes all the application state. */
cm.AppState.prototype.getUri = function() {
  var viewport = /** @type cm.LatLonBox */(this.get('viewport'));
  var enabledIds = /** @type goog.structs.Set */(this.get('enabled_layer_ids'));
  var promotedIds = /** @type goog.structs.Set */(
      this.get('promoted_layer_ids'));

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
  uri.setParameterValue('t', this.get('map_type_id'));
  uri.setParameterValue('layers', this.getLayersParameter_());
  uri.setParameterValue('promoted', promotedIds.getValues().join(','));
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

  var mapTypeId = uri.getParameterValue('t');
  if (mapTypeId) {
    this.set('map_type_id', mapTypeId);
  }
  // TODO(romano): Needs error-checking to verify that the layer
  // ID lists in the 'layers' and 'promoted' parameters are valid,
  // and if not, default to valid values.
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
  var promotedLayerIds = uri.getParameterValue('promoted');
  if (goog.isDefAndNotNull(promotedLayerIds)) {
    this.set('promoted_layer_ids',
             new goog.structs.Set(promotedLayerIds.split(',')));
  }
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
