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
 * @fileoverview Model for a crisis map.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.MapModel');

goog.require('cm');
goog.require('cm.Html');
goog.require('cm.LatLonBox');
goog.require('cm.LayerModel');
goog.require('cm.events');
goog.require('cm.util');
goog.require('goog.array');

/**
 * Model for a map.  Clients are free to get and set properties of this
 * MVCObject and insert or remove elements of the 'layers' property.
 * Inserting a layer into the 'layers' property will populate the layer's
 * 'id' property if it is missing, or change the layer's 'id' property if
 * necessary to ensure that all layer IDs in a map are unique.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.MapModel = function() {
  google.maps.MVCObject.call(this);

  /**
   * A dictionary of layer models in the map, keyed by layer ID.
   * @type Object
   * @private
   */
  this.layersById_ = {};

  /**
   * A dictionary of listener tokens for the insertion/deletion of layers.
   * @type Object.<Array.<cm.events.ListenerToken>>
   * @private
   */
  this.listenerTokens_ = {};
};
goog.inherits(cm.MapModel, google.maps.MVCObject);

/** @enum {string} */
cm.MapModel.Type = {
  ROADMAP: 'ROADMAP',
  SATELLITE: 'SATELLITE',
  HYBRID: 'HYBRID',
  TERRAIN: 'TERRAIN',
  CUSTOM: 'CUSTOM',
  OSM: 'OSM'
};

/** @type Object.<cm.MapModel.Type> */
cm.MapModel.MAPROOT_TO_MODEL_MAP_TYPES = {
  'GOOGLE_ROADMAP': cm.MapModel.Type.ROADMAP,
  'GOOGLE_SATELLITE': cm.MapModel.Type.SATELLITE,
  'GOOGLE_HYBRID': cm.MapModel.Type.HYBRID,
  'GOOGLE_TERRAIN': cm.MapModel.Type.TERRAIN,
  'OSM': cm.MapModel.Type.OSM
};

/**
 * @param {Object} maproot A MapRoot JS object.
 * @return {cm.MapModel} A newly constructed MapModel.
 */
cm.MapModel.newFromMapRoot = function(maproot) {
  var model = new cm.MapModel();
  model.set('id', maproot['id'] || '');
  model.set('title', maproot['title'] || '');
  model.set('description', new cm.Html(maproot['description'] || ''));
  model.set('footer', new cm.Html(maproot['footer'] || ''));
  model.set('languages', maproot['languages'] || []);
  model.set('region', maproot['region'] || '');
  model.set('thumbnail_url', maproot['thumbnail_url'] || '');
  model.set('viewport', cm.LatLonBox.fromMapRoot(
      (maproot['viewport'] || {})['lat_lon_alt_box']));
  model.set('full_extent', cm.LatLonBox.fromMapRoot(
      (maproot['full_extent'] || {})['lat_lon_alt_box']));
  model.set('base_map_style',
            (maproot['base_map_style'] || {})['definition'] || '');
  model.set('base_map_style_name',
            (maproot['base_map_style'] || {})['name'] || '');
  // MapRoot doesn't have a CUSTOM map type; the presence or absence of
  // base_map_style determines whether the base map is in CUSTOM mode.
  model.set('map_type',
            model.get('base_map_style') ? cm.MapModel.Type.CUSTOM :
            cm.MapModel.MAPROOT_TO_MODEL_MAP_TYPES[
                maproot['base_map_type']] || cm.MapModel.Type.ROADMAP);

  var layers = new google.maps.MVCArray();
  model.set('layers', layers);
  cm.events.listen(layers, 'insert_at', function(i) {
    this.handleInsertLayer_(layers.getAt(i));
  }, model);
  cm.events.listen(layers, 'remove_at', function(i, layer) {
    this.handleRemoveLayer_(layer);
  }, model);
  goog.array.forEach(maproot['layers'] || [], function(layerMapRoot) {
    var layer = cm.LayerModel.newFromMapRoot(layerMapRoot);
    layer && layers.push(layer);
  });

  return model;
};

/** @override */
cm.MapModel.prototype.changed = function(key) {
  cm.events.emit(this, cm.events.MODEL_CHANGED);
};

// Export this method so it can be called by the MVCObject machinery.
goog.exportProperty(cm.MapModel.prototype, 'changed',
                    cm.MapModel.prototype.changed);

/**
 * Gets a layer by its ID.
 * @param {string} id A layer ID.
 * @return {cm.LayerModel} A layer model.
 */
cm.MapModel.prototype.getLayer = function(id) {
  return this.layersById_[id];
};

/**
 * Returns a flat array of all layer IDs in the map.
 * @return {Array.<string>} The array of layer IDs.
 */
cm.MapModel.prototype.getAllLayerIds = function() {
  var allIds = [];
  for (var id in this.layersById_) {
    allIds.push(id);
  }
  return allIds;
};

/**
 * Returns an array of the map's top-level layer IDs.
 * @return {Array.<string>} The array of layer IDs.
 *   The layer ID hierarchy.
 */
cm.MapModel.prototype.getLayerIds = function() {
  return goog.array.map(this.get('layers').getArray(), function(layer) {
    return layer.get('id');
  });
};

/**
 * Register the given layer and its descendants with the map.
 * @param {cm.LayerModel} layer The layer model.
 * @private
 */
cm.MapModel.prototype.handleInsertLayer_ = function(layer) {
  var layers = [];
  cm.util.forLayerAndDescendants(layer, function(descendant) {
    this.registerLayer_(descendant);
    layers.push(descendant);
  }, null, this);
  cm.events.emit(this, cm.events.LAYERS_ADDED, {layers: layers});
};

/**
 * Unregisters the given layer and its descendants from the map.
 * @param {cm.LayerModel} layer The layer model.
 * @private
 */
cm.MapModel.prototype.handleRemoveLayer_ = function(layer) {
  var ids = [];
  cm.util.forLayerAndDescendants(layer, function(descendant) {
    var id = /** @type string */(descendant.get('id'));
    this.unregisterLayer_(id);
    ids.push(id);
  }, null, this);
  cm.events.emit(this, cm.events.LAYERS_REMOVED, {ids: ids});
};

/**
 * Registers a single LayerModel with this map, and enforces that the layer ID
 * is unique in this map.  If the layer has no ID or an ID that collides with
 * another layer in this map, the layer ID will be changed to a unique value.
 * @param {cm.LayerModel} layer The layer to register.
 * @private
 */
cm.MapModel.prototype.registerLayer_ = function(layer) {
  var id = /** @type string */(layer.get('id'));
  if (this.layersById_[id] === layer) {  // layer is already registered
    return;
  }
  if (!id || id in this.layersById_) {
    // The layer doesn't have a valid ID; use the first available numeric ID.
    for (id = 1; id in this.layersById_; id++) {}
    layer.set('id', '' + id);
  }
  this.layersById_[id] = layer;

  // Listen for changes in this layer, as well as add/delete events on the
  // layer's list of sublayers.
  var sublayers = /** @type google.maps.MVCArray */(layer.get('sublayers'));
  this.listenerTokens_[id] = [
    /** @type cm.events.ListenerToken */(
      cm.events.forward(layer, cm.events.MODEL_CHANGED, this)),
    /** @type cm.events.ListenerToken */(
      cm.events.listen(sublayers, 'insert_at', function(i) {
        this.handleInsertLayer_(sublayers.getAt(i));
      }, this)),
    /** @type cm.events.ListenerToken */(
      cm.events.listen(sublayers, 'remove_at', function(i, layer) {
        this.handleRemoveLayer_(layer);
      }, this))
  ];
};

/**
 * Unregister a single LayerModel from the map.
 * @param {string} id The layer id of the layer to unregister.
 * @private
 */
cm.MapModel.prototype.unregisterLayer_ = function(id) {
  var tokens = this.listenerTokens_[id];
  tokens && cm.events.unlisten(tokens);
  delete this.layersById_[id];
};

/** @return {Object} This map as a MapRoot JS object. */
cm.MapModel.prototype.toMapRoot = function() {
  var languages = /** @type Array.<string> */(this.get('languages'));
  var baseMapStyleName = this.get('base_map_style_name');
  // MapRoot doesn't have a CUSTOM map type; the presence or absence of
  // base_map_style determines whether the base map is in CUSTOM mode.
  var baseMapStyle = this.get('map_type') === cm.MapModel.Type.CUSTOM ?
      this.get('base_map_style') : null;
  var mapType = this.get('map_type');
  mapType = mapType && mapType !== cm.MapModel.Type.CUSTOM ? mapType : null;
  var box = /** @type cm.LatLonBox */(this.get('viewport'));
  var viewport = box ? {'lat_lon_alt_box': box.round(4).toMapRoot()} : null;
  box = /** @type cm.LatLonBox */(this.get('full_extent'));
  var fullExtent = box ? {'lat_lon_alt_box': box.round(4).toMapRoot()} : null;
  return /** @type Object */(cm.util.removeNulls({
    'id': this.get('id'),
    'title': this.get('title') || null,
    'description': this.get('description').getUnsanitizedHtml() || null,
    'footer': this.get('footer').getUnsanitizedHtml() || null,
    'languages': languages && languages.length ? languages : null,
    'region': this.get('region') || null,
    'thumbnail_url': this.get('thumbnail_url') || null,
    'viewport': viewport,
    'full_extent': fullExtent,
    'base_map_style': baseMapStyle ?
        {'definition': baseMapStyle, 'name': baseMapStyleName} : null,
    'base_map_type': goog.object.transpose(
        cm.MapModel.MAPROOT_TO_MODEL_MAP_TYPES)[mapType],
    'layers': goog.array.map(
        this.get('layers').getArray(),
        function(layer) { return layer.toMapRoot(); })
  }));
};
