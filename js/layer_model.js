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
 * @fileoverview Model for a map layer.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.LayerModel');

goog.require('cm');
goog.require('cm.Html');
goog.require('cm.LatLonBox');
goog.require('goog.functions');
goog.require('goog.math');
goog.require('goog.object');
goog.require('goog.structs.Set');

/**
 * Model for a layer.  Clients are free to get and set properties of this
 * MVCObject and insert or remove elements of the 'sublayers' property.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.LayerModel = function() {
  google.maps.MVCObject.call(this);
};
goog.inherits(cm.LayerModel, google.maps.MVCObject);

/** @enum {string} */
cm.LayerModel.Type = {
  FOLDER: 'FOLDER',
  KML: 'KML',
  GEORSS: 'GEORSS',
  TILE: 'TILE',
  FUSION: 'FUSION',
  MAP_DATA: 'MAP_DATA',
  TRAFFIC: 'TRAFFIC',
  TRANSIT: 'TRANSIT',
  WEATHER: 'WEATHER',
  CLOUD: 'CLOUD'
};

/** @type Object.<cm.LayerModel.Type> */
cm.LayerModel.LAYER_TYPES_BY_SOURCE_TYPE = {
  'FOLDER': cm.LayerModel.Type.FOLDER,
  'KML': cm.LayerModel.Type.KML,
  'GEORSS': cm.LayerModel.Type.GEORSS,
  'GOOGLE_MAP_TILES': cm.LayerModel.Type.TILE,
  'GOOGLE_FUSION_TABLES': cm.LayerModel.Type.FUSION,
  'GOOGLE_MAP_DATA': cm.LayerModel.Type.MAP_DATA,
  'GOOGLE_TRAFFIC': cm.LayerModel.Type.TRAFFIC,
  'GOOGLE_TRANSIT': cm.LayerModel.Type.TRANSIT,
  'GOOGLE_WEATHER': cm.LayerModel.Type.WEATHER,
  'GOOGLE_CLOUD_IMAGERY': cm.LayerModel.Type.CLOUD
};

/** @type Object.<string> */
cm.LayerModel.SOURCE_TYPES_BY_LAYER_TYPE = goog.object.create(
  cm.LayerModel.Type.FOLDER, 'FOLDER',
  cm.LayerModel.Type.KML, 'KML',
  cm.LayerModel.Type.GEORSS, 'GEORSS',
  cm.LayerModel.Type.TILE, 'GOOGLE_MAP_TILES',
  cm.LayerModel.Type.FUSION, 'GOOGLE_FUSION_TABLES',
  cm.LayerModel.Type.MAP_DATA, 'GOOGLE_MAP_DATA',
  cm.LayerModel.Type.TRAFFIC, 'GOOGLE_TRAFFIC',
  cm.LayerModel.Type.TRANSIT, 'GOOGLE_TRANSIT',
  cm.LayerModel.Type.WEATHER, 'GOOGLE_WEATHER',
  cm.LayerModel.Type.CLOUD, 'GOOGLE_CLOUD_IMAGERY'
);

/** @enum {string} */
cm.LayerModel.LabelColor = {
  BLACK: 'BLACK',
  WHITE: 'WHITE'
};

/** @enum {string} */
cm.LayerModel.TemperatureUnit = {
  CELSIUS: 'CELSIUS',
  FAHRENHEIT: 'FAHRENHEIT'
};

/** @enum {string} */
cm.LayerModel.WindSpeedUnit = {
  KILOMETERS_PER_HOUR: 'KILOMETERS_PER_HOUR',
  METERS_PER_SECOND: 'METERS_PER_SECOND',
  MILES_PER_HOUR: 'MILES_PER_HOUR'
};

/** @type Object.<cm.LayerModel.LabelColor> */
cm.LayerModel.MAPROOT_TO_MODEL_LABEL_COLORS = {
  'BLACK': cm.LayerModel.LabelColor.BLACK,
  'WHITE': cm.LayerModel.LabelColor.WHITE
};

/** @type Object.<string> */
cm.LayerModel.MODEL_TO_MAPROOT_LABEL_COLORS = goog.object.create(
  cm.LayerModel.LabelColor.BLACK, 'BLACK',
  cm.LayerModel.LabelColor.WHITE, 'WHITE'
);

/** @type Object.<cm.LayerModel.TemperatureUnit> */
cm.LayerModel.MAPROOT_TO_MODEL_TEMPERATURE_UNITS = {
  'CELSIUS': cm.LayerModel.TemperatureUnit.CELSIUS,
  'FAHRENHEIT': cm.LayerModel.TemperatureUnit.FAHRENHEIT
};

/** @type Object.<string> */
cm.LayerModel.MODEL_TO_MAPROOT_TEMPERATURE_UNITS = goog.object.create(
  cm.LayerModel.TemperatureUnit.CELSIUS, 'CELSIUS',
  cm.LayerModel.TemperatureUnit.FAHRENHEIT, 'FAHRENHEIT'
);

/** @type Object.<cm.LayerModel.WindSpeedUnit> */
cm.LayerModel.MAPROOT_TO_MODEL_WIND_SPEED_UNITS = {
  'KILOMETERS_PER_HOUR': cm.LayerModel.WindSpeedUnit.KILOMETERS_PER_HOUR,
  'METERS_PER_SECOND': cm.LayerModel.WindSpeedUnit.METERS_PER_SECOND,
  'MILES_PER_HOUR': cm.LayerModel.WindSpeedUnit.MILES_PER_HOUR
};

/** @type Object.<string> */
cm.LayerModel.MODEL_TO_MAPROOT_WIND_SPEED_UNITS = goog.object.create(
  cm.LayerModel.WindSpeedUnit.KILOMETERS_PER_HOUR, 'KILOMETERS_PER_HOUR',
  cm.LayerModel.WindSpeedUnit.METERS_PER_SECOND, 'METERS_PER_SECOND',
  cm.LayerModel.WindSpeedUnit.MILES_PER_HOUR, 'MILES_PER_HOUR'
);

/**
 * Unique tag to indicate that this layer has sublayers that should be
 * treated as samples of a time series.
 */
cm.LayerModel.IS_TIME_SERIES_FOLDER = 'IS_TIME_SERIES_FOLDER';
/**
 * An internal counter used to generate unique IDs.
 * @type number
 * @private
 */
cm.LayerModel.nextId_ = 0;

/**
 * @param {Object} maproot A MapRoot JS layer object.
 * @return {cm.LayerModel} A newly constructed LayerModel, or null if the
 *     'type' member was not a recognized type name.
 */
cm.LayerModel.newFromMapRoot = function(maproot) {
  var type = cm.LayerModel.LAYER_TYPES_BY_SOURCE_TYPE[maproot['type']];
  if (!type) {
    return null;
  }
  var source = maproot['source'] || {};
  var model = new cm.LayerModel();
  model.set('id', maproot['id'] || ('layer' + cm.LayerModel.nextId_++));
  model.set('type', type);
  model.set('title', maproot['title'] || '');
  // NOTE(kpy): Trusting the server to provide safe HTML!
  model.set('description', cm.Html.fromSanitizedHtml(maproot['description']));
  model.set('legend', maproot['legend'] ?
      cm.Html.fromSanitizedHtml(maproot['legend']) : null);
  model.set('viewport', cm.LatLonBox.fromMapRoot(
      (maproot['viewport'] || {})['lat_lon_alt_box']));
  model.set('full_extent', cm.LatLonBox.fromMapRoot(
      (maproot['full_extent'] || {})['lat_lon_alt_box']));
  model.set('default_visibility', maproot['visibility'] === 'DEFAULT_ON' ||
                                 maproot['visibility'] === 'ALWAYS_ON');
  model.set('min_zoom', maproot['min_zoom'] || null);
  model.set('max_zoom', maproot['max_zoom'] || null);
  model.set('opacity', 'opacity' in maproot ?
      goog.math.clamp(maproot['opacity'] / 100, 0, 1) : 1);
  model.set('suppress_download_link',
            maproot['suppress_download_link'] || null);
  model.set('suppress_info_windows', maproot['suppress_info_windows'] || null);
  model.set('clip_to_viewport', maproot['clip_to_viewport'] || null);
  model.set('last_update', maproot['last_update'] || '');

  switch (type) {
    case cm.LayerModel.Type.KML:
      var kml = source['kml'] || {};
      model.set('url', kml['url']);
      break;
    case cm.LayerModel.Type.GEORSS:
      var georss = source['georss'] || {};
      model.set('url', georss['url']);
      break;
    case cm.LayerModel.Type.TILE:
      var tile = source['google_map_tiles'] || {};
      model.set('url', tile['url']);
      model.set('url_is_tile_index', tile['url_is_tile_index']);
      break;
    case cm.LayerModel.Type.FUSION:
      var fusion = source['google_fusion_tables'] || {};
      model.set('ft_select', fusion['select']);
      model.set('ft_from', fusion['from']);
      model.set('ft_where', fusion['where']);
      break;
    case cm.LayerModel.Type.MAP_DATA:
      var map_data = source['google_map_data'] || {};
      model.set('maps_engine_map_id', map_data['map_id']);
      model.set('maps_engine_layer_id', map_data['layer_id']);
      model.set('maps_engine_layer_key', map_data['layer_key']);

      break;
    case cm.LayerModel.Type.WEATHER:
      var weather = source['weather'] || {};
      model.set('label_color',
          cm.LayerModel.MAPROOT_TO_MODEL_LABEL_COLORS[
              weather['label_color']] ||
          cm.LayerModel.LabelColor.BLACK);
      model.set('temperature_unit',
          cm.LayerModel.MAPROOT_TO_MODEL_TEMPERATURE_UNITS[
              weather['temperature_unit']] ||
          cm.LayerModel.TemperatureUnit.CELSIUS);
      model.set('wind_speed_unit',
          cm.LayerModel.MAPROOT_TO_MODEL_WIND_SPEED_UNITS[
              weather['wind_speed_unit']] ||
          cm.LayerModel.WindSpeedUnit.KILOMETERS_PER_HOUR);
      break;
    case cm.LayerModel.Type.FOLDER:
      model.set('locked', maproot['list_item_type'] === 'CHECK_HIDE_CHILDREN');
      break;
  }

  // Construct sublayer models.
  var sublayers = new google.maps.MVCArray();
  model.set('sublayers', sublayers);
  cm.events.listen(sublayers, 'insert_at', function(i) {
    sublayers.getAt(i).set('parent', this);
  }, model);
  goog.array.forEach(maproot['sublayers'] || [], function(layerMapRoot) {
    var layer = cm.LayerModel.newFromMapRoot(layerMapRoot);
    layer && sublayers.push(layer);
  });

  // A time series without an explicit lastUpdate field inherits the
  // lastUpdate of its most recently updated sublayer.
  model.set('tags', new goog.structs.Set(maproot['tags'] || []));
  if (model.isTimeSeries() && !model.get('last_update')) {
    var mostRecentSublayer = model.getMostRecentSublayer();
    if (mostRecentSublayer) {
      model.set('last_update', mostRecentSublayer.get('last_update'));
    }
  }

  // Non-folder layers should always be unlocked.
  cm.events.onChange(model, 'type', function() {
    if (model.get('type') !== cm.LayerModel.Type.FOLDER) {
      model.set('locked', false);
    }
  });

  return model;
};

/** @return {Object} This layer as a MapRoot JS layer object. */
cm.LayerModel.prototype.toMapRoot = function() {
  var type = this.get('type');
  var source = {};
  var sublayers = [];
  switch (type) {
    case cm.LayerModel.Type.KML:
      source['kml'] = {'url': this.get('url')};
      break;
    case cm.LayerModel.Type.GEORSS:
      source['georss'] = {'url': this.get('url')};
      break;
    case cm.LayerModel.Type.TILE:
      source['google_map_tiles'] = {
        'url': this.get('url'),
        'url_is_tile_index': this.get('url_is_tile_index')};
      break;
    case cm.LayerModel.Type.FUSION:
      source['google_fusion_tables'] = {
        'select': this.get('ft_select'),
        'from': this.get('ft_from'),
        'where': this.get('ft_where')
      };
      break;
    case cm.LayerModel.Type.MAP_DATA:
      if (this.get('layer_type')) {
        // This is an internal MapDataLayer.
        source['google_map_data'] = {
          'sub_type': this.get('layer_type'),
          'asset_id': this.get('asset_id'),
          'table_id': this.get('table_id'),
          'style_id': this.get('style_id'),
          'balloon_template_id': this.get('template_id'),
          'tile_auth_token': {
            'token': this.get('ft_token')
          }
        };
      } else {
        source['google_map_data'] = {
          'layer_id': this.get('maps_engine_layer_id'),
          'layer_key': this.get('maps_engine_layer_key'),
          'map_id': this.get('maps_engine_map_id')
        };
      }
      break;
    case cm.LayerModel.Type.WEATHER:
      source['weather'] = {
        'label_color': cm.LayerModel.MODEL_TO_MAPROOT_LABEL_COLORS[
            this.get('label_color')] || 'BLACK',
        'temperature_unit': cm.LayerModel.MODEL_TO_MAPROOT_TEMPERATURE_UNITS[
            this.get('temperature_unit')] || 'CELSIUS',
        'wind_speed_unit': cm.LayerModel.MODEL_TO_MAPROOT_WIND_SPEED_UNITS[
            this.get('wind_speed_unit')] || 'KILOMETERS_PER_HOUR'
      };
      break;
    case cm.LayerModel.Type.FOLDER:
      this.get('sublayers').forEach(
          function(sublayer) { sublayers.push(sublayer.toMapRoot()); });
      break;
  }

  // In this MapRoot object, we set values to null for missing fields.
  var box = /** @type cm.LatLonBox */(this.get('viewport'));
  var viewport = box ? {'lat_lon_alt_box': box.round(4).toMapRoot()} : null;
  box = /** @type cm.LatLonBox */(this.get('full_extent'));
  var fullExtent = box ? {'lat_lon_alt_box': box.round(4).toMapRoot()} : null;
  var opacity = Math.round(/** @type number */(this.get('opacity')) * 100);
  var maproot = {
    'id': this.get('id'),
    'title': this.get('title'),
    'description':
        /** @type cm.Html */(this.get('description')).getUnsanitizedHtml(),
    'legend': this.get('legend') ?
        /** @type cm.Html */(this.get('legend')).getUnsanitizedHtml() : null,
    'visibility': this.get('default_visibility') ? 'DEFAULT_ON' : 'DEFAULT_OFF',
    'viewport': viewport,
    'full_extent': fullExtent,
    'type': cm.LayerModel.SOURCE_TYPES_BY_LAYER_TYPE[type],
    'min_zoom': this.get('min_zoom'),
    'max_zoom': this.get('max_zoom'),
    'opacity': opacity < 100 ? opacity : null,
    'suppress_download_link': this.get('suppress_download_link'),
    'suppress_info_windows': this.get('suppress_info_windows'),
    'clip_to_viewport': this.get('clip_to_viewport'),
    'list_item_type': this.get('locked') ? 'CHECK_HIDE_CHILDREN' : null
  };
  if (type === cm.LayerModel.Type.FOLDER) {
    maproot['sublayers'] = sublayers;
  } else {
    maproot['source'] = source;
  }
  return /** @type Object */(cm.util.removeNulls(maproot));
};

/** @override */
cm.LayerModel.prototype.changed = function(key) {
  cm.events.emit(this, cm.events.MODEL_CHANGED);
};

// Export this method so it can be called by the MVCObject machinery.
goog.exportProperty(cm.LayerModel.prototype, 'changed',
                    cm.LayerModel.prototype.changed);

/**
 * Returns a string that represents the address of a layer. The format of the
 * string depends on the type of the layer.
 * NOTE: This method should be in sync with maproot.py.
 * TODO(cimamoglu): Implement this for other layer types.
 * @return {string}  The address string if it's found, empty string otherwise.
 */
cm.LayerModel.prototype.getSourceAddress = function() {
  var type = this.get('type');
  switch (type) {
    case cm.LayerModel.Type.KML:
    case cm.LayerModel.Type.GEORSS:
      return /** @type {string} */(this.get('url'));
    default:
      return '';
  }
};

/**
 * Returns a set of all IDs of this layer's sublayer.
 * @return {Array.<string>} The array of sublayer IDs.
 */
cm.LayerModel.prototype.getSublayerIds = function() {
  return goog.array.map(this.get('sublayers').getArray(), function(sublayer) {
    return sublayer.get('id'); });
};

/**
 * Returns the layer model for the given sublayer's ID.
 * @param {string} layerId The sublayer's ID.
 * @return {?cm.LayerModel} The sublayer model if it exists.
 */
cm.LayerModel.prototype.getSublayer = function(layerId) {
  var sublayer = null;
  this.get('sublayers').forEach(function(layer) {
    if (layerId === layer.get('id')) {
      sublayer = layer;
    }
  });
  return sublayer;
};

/**
 * Convenience function for testing whether a layer is a time series.
 * @return {boolean} True if the layer is a time series.
 */
cm.LayerModel.prototype.isTimeSeries = function() {
  var tags = this.get('tags');
  return this.get('type') === cm.LayerModel.Type.FOLDER &&
      tags && tags.contains(cm.LayerModel.IS_TIME_SERIES_FOLDER);
};

/**
 * Returns the most recently updated sublayer. If the sublayers
 * all have empty timestamps, return the first sublayer's id.
 * @return {?cm.LayerModel} The most recently updated layer model, or
 *   null if the folder has no sublayers.
 */
cm.LayerModel.prototype.getMostRecentSublayer = function() {
  var mostRecentDate = 0;
  var mostRecentSublayer = null;
  this.get('sublayers').forEach(function(sublayer) {
    var lastUpdate = sublayer.get('last_update');
    if (!mostRecentDate || lastUpdate > mostRecentDate) {
      mostRecentSublayer = sublayer;
      mostRecentDate = lastUpdate;
    }
  });
  return mostRecentSublayer;
};
