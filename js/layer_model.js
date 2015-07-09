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
goog.require('goog.Uri');
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
  GEOJSON: 'GEOJSON',
  GEORSS: 'GEORSS',
  TILE: 'TILE',
  CSV: 'CSV',
  GOOGLE_SPREADSHEET: 'GOOGLE_SPREADSHEET',
  FUSION: 'FUSION',
  MAPS_ENGINE: 'MAPS_ENGINE',
  TRAFFIC: 'TRAFFIC',
  TRANSIT: 'TRANSIT',
  WEATHER: 'WEATHER',
  CLOUD: 'CLOUD',
  PLACES: 'PLACES',
  WMS: 'WMS',
  GOOGLE_MAPS_ENGINE_LITE_OR_PRO: 'GOOGLE_MAPS_ENGINE_LITE_OR_PRO'
};

/** @enum {string} */
cm.LayerModel.FolderType = {
  UNLOCKED: 'UNLOCKED',
  LOCKED: 'LOCKED',
  SINGLE_SELECT: 'SINGLE_SELECT'
};

/** @type Object.<cm.LayerModel.Type> */
cm.LayerModel.MAPROOT_TO_MODEL_LAYER_TYPES = {
  'FOLDER': cm.LayerModel.Type.FOLDER,
  'KML': cm.LayerModel.Type.KML,
  'GEOJSON': cm.LayerModel.Type.GEOJSON,
  'GEORSS': cm.LayerModel.Type.GEORSS,
  'GOOGLE_MAP_TILES': cm.LayerModel.Type.TILE,
  'TILE': cm.LayerModel.Type.TILE,
  'CSV': cm.LayerModel.Type.CSV,
  'GOOGLE_SPREADSHEET': cm.LayerModel.Type.GOOGLE_SPREADSHEET,
  'GOOGLE_FUSION_TABLES': cm.LayerModel.Type.FUSION,
  'GOOGLE_MAP_DATA': cm.LayerModel.Type.MAPS_ENGINE,
  'GOOGLE_MAPS_ENGINE': cm.LayerModel.Type.MAPS_ENGINE,
  'GOOGLE_TRAFFIC': cm.LayerModel.Type.TRAFFIC,
  'GOOGLE_TRANSIT': cm.LayerModel.Type.TRANSIT,
  'GOOGLE_WEATHER': cm.LayerModel.Type.WEATHER,
  'GOOGLE_CLOUD_IMAGERY': cm.LayerModel.Type.CLOUD,
  'WMS': cm.LayerModel.Type.WMS,
  'GOOGLE_MAPS_ENGINE_LITE_OR_PRO':
      cm.LayerModel.Type.GOOGLE_MAPS_ENGINE_LITE_OR_PRO,
  'GOOGLE_PLACES': cm.LayerModel.Type.PLACES
};

/**
 * Mapping from layer type to attribution information that should always be
 * displayed for this layer.
 * @type Object.<string>
 */
cm.LayerModel.LAYER_TYPE_TO_ATTRIBUTION = goog.object.create(
  cm.LayerModel.Type.PLACES, cm.getMsgSource(cm.MSG_GOOGLE_MAPS)
);

/** @enum {string} */
cm.LayerModel.TileCoordinateType = {
  GOOGLE: 'GOOGLE',
  BING: 'BING',
  TMS: 'TMS'
};

/** @type Object.<cm.LayerModel.Type> */
cm.LayerModel.MAPROOT_TO_MODEL_TILE_COORDINATE_TYPES = {
  'GOOGLE': cm.LayerModel.TileCoordinateType.GOOGLE,
  'BING': cm.LayerModel.TileCoordinateType.BING,
  'TMS': cm.LayerModel.TileCoordinateType.TMS
};

/** @type Object.<string> */
cm.LayerModel.MODEL_TO_MAPROOT_TILE_COORDINATE_TYPES = goog.object.create(
  cm.LayerModel.TileCoordinateType.GOOGLE, 'GOOGLE',
  cm.LayerModel.TileCoordinateType.BING, 'BING',
  cm.LayerModel.TileCoordinateType.TMS, 'TMS'
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

/** @type Object.<cm.LayerModel.FolderType> */
cm.LayerModel.MAPROOT_TO_MODEL_FOLDER_TYPES = {
  'CHECK': cm.LayerModel.FolderType.UNLOCKED,
  'CHECK_HIDE_CHILDREN': cm.LayerModel.FolderType.LOCKED,
  'RADIO_FOLDER': cm.LayerModel.FolderType.SINGLE_SELECT
};

/**
 * @param {Object} maproot A MapRoot JS layer object.
 * @return {cm.LayerModel} A newly constructed LayerModel, or null if the
 *     'type' member was not a recognized type name.
 */
cm.LayerModel.newFromMapRoot = function(maproot) {
  var type = cm.LayerModel.MAPROOT_TO_MODEL_LAYER_TYPES[maproot['type']];
  if (!type) {
    return null;
  }
  var source = maproot['source'] || {};
  var model = new cm.LayerModel();
  // If the ID is empty, it will be set by cm.MapModel.registerLayer_.
  model.set('id', maproot['id'] || '');
  model.set('type', type);
  model.set('title', maproot['title'] || '');
  model.set('description', new cm.Html(maproot['description'] || ''));
  model.set('attribution', new cm.Html(maproot['attribution'] || ''));
  model.set('legend', new cm.Html(maproot['legend'] || ''));
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

  switch (type) {
    case cm.LayerModel.Type.KML:
      var kml = source['kml'] || {};
      model.set('url', kml['url']);
      break;
    case cm.LayerModel.Type.GEORSS:
      var georss = source['georss'] || {};
      model.set('url', georss['url']);
      break;
    case cm.LayerModel.Type.GOOGLE_MAPS_ENGINE_LITE_OR_PRO:
      var mapsEngine = source['google_maps_engine_lite_or_pro'] || {};
      var mapsEngineUrl = mapsEngine['maps_engine_url'];
      model.set('maps_engine_url', mapsEngineUrl);
      model.set('url', mapsEngine['url'] ||
          cm.LayerModel.getKmlUrlFromMapsEngineLiteOrProUrl_(mapsEngineUrl));
      break;
    case cm.LayerModel.Type.TILE:
      var tile = source['tile'] || source['google_map_tiles'] || {};
      model.set('url', tile['url']);
      model.set('url_is_tile_index', tile['url_is_tile_index']);
      model.set('tile_coordinate_type',
          cm.LayerModel.MODEL_TO_MAPROOT_TILE_COORDINATE_TYPES[
            tile['tile_coordinate_type']] ||
            cm.LayerModel.TileCoordinateType.GOOGLE);
      break;
    case cm.LayerModel.Type.GEOJSON:
    case cm.LayerModel.Type.CSV:
    case cm.LayerModel.Type.GOOGLE_SPREADSHEET:
      var params = source[type.toLowerCase()] || {};
      model.set('url', params['url'] || '');
      model.set('title_template', params['title_template'] || '');
      model.set('description_template',
                new cm.Html(params['description_template'] || ''));
      model.set('latitude_field', params['latitude_field'] || '');
      model.set('longitude_field', params['longitude_field'] || '');
      model.set('icon_url_template', params['icon_url_template'] || '');
      model.set('color_template', params['color_template'] || '');
      model.set('hotspot_template', params['hotspot_template'] || '');
      var conditions = params['conditions'] || ['', '', ''];
      model.set('condition0', conditions[0] || '');
      model.set('condition1', conditions[1] || '');
      model.set('condition2', conditions[2] || '');
      break;
    case cm.LayerModel.Type.FUSION:
      var fusion = source['google_fusion_tables'] || {};
      model.set('ft_select', fusion['select']);
      model.set('ft_from', fusion['from']);
      model.set('ft_where', fusion['where']);
      model.set('ft_heatmap', fusion['heatmap_enabled'] || null);
      break;
    case cm.LayerModel.Type.MAPS_ENGINE:
      var maps_engine = source['google_maps_engine'] ||
          source['google_map_data'] || {};
      model.set('maps_engine_map_id', maps_engine['map_id']);
      model.set('maps_engine_layer_id', maps_engine['layer_id']);
      model.set('maps_engine_layer_key', maps_engine['layer_key']);

      break;
    case cm.LayerModel.Type.WEATHER:
      var weather = source['google_weather'] || source['weather'] || {};
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
      model.set('folder_type', cm.LayerModel.MAPROOT_TO_MODEL_FOLDER_TYPES[
          maproot['list_item_type']]);
      break;
    case cm.LayerModel.Type.WMS:
      var wms = source['wms'] || {};
      model.set('url', wms['url']);
      model.set('wms_layers', wms['layer_names']);
      break;
    case cm.LayerModel.Type.PLACES:
      var places = source['google_places'] || source['places'] || {};
      model.set('places_icon_url', places['icon_url']);
      model.set('places_keyword', places['keyword']);
      model.set('places_name', places['name']);
      model.set('places_types', places['types']);
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

  cm.events.onChange(model, 'type', function() {
    if (model.get('type') !== cm.LayerModel.Type.FOLDER) {
      model.set('folder_type', null);
    }
  });
  cm.events.onChange(model, 'maps_engine_url', function() {
    if (model.get('type') ===
        cm.LayerModel.Type.GOOGLE_MAPS_ENGINE_LITE_OR_PRO) {
      var url = /** @type string */(model.get('maps_engine_url'));
      model.set('maps_engine_url', url);
      model.set('url', cm.LayerModel.getKmlUrlFromMapsEngineLiteOrProUrl_(url));
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
    case cm.LayerModel.Type.GOOGLE_MAPS_ENGINE_LITE_OR_PRO:
      source['google_maps_engine_lite_or_pro'] = {
        'maps_engine_url': this.get('maps_engine_url'),
        'url': this.get('url')
      };
      break;
    case cm.LayerModel.Type.TILE:
      source['tile'] = {
        'url': this.get('url'),
        'url_is_tile_index': this.get('url_is_tile_index'),
        'tile_coordinate_type':
          cm.LayerModel.MODEL_TO_MAPROOT_TILE_COORDINATE_TYPES[
            this.get('tile_coordinate_type')]
      };
      break;
    case cm.LayerModel.Type.GEOJSON:
    case cm.LayerModel.Type.CSV:
    case cm.LayerModel.Type.GOOGLE_SPREADSHEET:
      var description = this.get('description_template') || cm.Html.EMPTY;
      var conditions = [];
      if (this.get('condition0')) conditions.push(this.get('condition0'));
      if (this.get('condition1')) conditions.push(this.get('condition1'));
      if (this.get('condition2')) conditions.push(this.get('condition2'));
      source[type.toLowerCase()] = {
        'url': this.get('url'),
        'title_template': this.get('title_template'),
        'description_template': description.getUnsanitizedHtml(),
        'latitude_field': this.get('latitude_field'),
        'longitude_field': this.get('longitude_field'),
        'icon_url_template': this.get('icon_url_template'),
        'color_template': this.get('color_template'),
        'hotspot_template': this.get('hotspot_template'),
        'conditions': conditions
      };
      break;
    case cm.LayerModel.Type.FUSION:
      source['google_fusion_tables'] = {
        'select': this.get('ft_select'),
        'from': this.get('ft_from'),
        'where': this.get('ft_where'),
        'heatmap_enabled': this.get('ft_heatmap')
      };
      break;
    case cm.LayerModel.Type.MAPS_ENGINE:
      source['google_maps_engine'] = {
        'layer_id': this.get('maps_engine_layer_id'),
        'layer_key': this.get('maps_engine_layer_key'),
        'map_id': this.get('maps_engine_map_id')
      };
      break;
    case cm.LayerModel.Type.WEATHER:
      source['google_weather'] = {
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
    case cm.LayerModel.Type.WMS:
      // The layer model represents WMS layers as objects, but the
      // maproot only stores the stirngs.
      var layers = /** @type Array.<string> */(this.get('wms_layers')) || [];
      source['wms'] = {
        'url': this.get('url'),
        'layer_names': layers
      };
      break;
    case cm.LayerModel.Type.PLACES:
      source['google_places'] = {
        'icon_url': this.get('places_icon_url'),
        'keyword': this.get('places_keyword'),
        'name': this.get('places_name'),
        'types': this.get('places_types')
      };
      break;
  }

  // Null fields will be removed from the maproot object by cm.util.removeNulls.
  var viewport = /** @type cm.LatLonBox */(this.get('viewport'));
  var extent = /** @type cm.LatLonBox */(this.get('full_extent'));
  var opacity = Math.round(/** @type number */(this.get('opacity')) * 100);
  var maproot = {
    'id': this.get('id'),
    'title': this.get('title'),
    'description': this.get('description').getUnsanitizedHtml(),
    'attribution': this.get('attribution').getUnsanitizedHtml(),
    'legend': this.get('legend').getUnsanitizedHtml(),
    'visibility': this.get('default_visibility') ? 'DEFAULT_ON' : 'DEFAULT_OFF',
    'viewport': viewport && {'lat_lon_alt_box': viewport.round(4).toMapRoot()},
    'full_extent': extent && {'lat_lon_alt_box': extent.round(4).toMapRoot()},
    'type': goog.object.transpose(
        cm.LayerModel.MAPROOT_TO_MODEL_LAYER_TYPES)[type],
    'min_zoom': this.get('min_zoom'),
    'max_zoom': this.get('max_zoom'),
    'opacity': opacity < 100 ? opacity : null,
    'suppress_download_link': this.get('suppress_download_link'),
    'suppress_info_windows': this.get('suppress_info_windows'),
    'clip_to_viewport': this.get('clip_to_viewport'),
    'list_item_type': goog.object.transpose(cm.LayerModel.
        MAPROOT_TO_MODEL_FOLDER_TYPES)[this.get('folder_type')]
  };
  if (type === cm.LayerModel.Type.FOLDER) {
    maproot['sublayers'] = sublayers;
  } else {
    maproot['source'] = source;
  }
  return /** @type Object */(cm.util.removeNulls(maproot));
};

/**
 * Transforms a Maps Engine Lite/Pro (My Maps) URL into a URL where we can
 * fetch KML.
 * @param {string} url the MEL/MEP URL to transform.
 * @return {string} A URL to fetch KML for the MEL/MEP layer, or empty string
 *     if the given URL was empty or null.
 * @private
 */
cm.LayerModel.getKmlUrlFromMapsEngineLiteOrProUrl_ = function(url) {
  // Supports mapsengine.google.com/map/viewer or google.com/maps/d/viewer
  var regex = new RegExp('(/map/|/maps/\\w+/)(.*?\\?)');
  return url ? url.replace(regex, '$1kml?') : '';
};

/** @override */
cm.LayerModel.prototype.changed = function(key) {
  if (key === 'folder_type') {
    cm.events.emit(this, cm.events.MODEL_CHANGED, {model: this});
  } else {
    cm.events.emit(this, cm.events.MODEL_CHANGED);
  }
};

// Export this method so it can be called by the MVCObject machinery.
goog.exportProperty(cm.LayerModel.prototype, 'changed',
                    cm.LayerModel.prototype.changed);

/**
 * Returns a string that represents the address of a layer. The format of the
 * string depends on the type of the layer.
 * NOTE: This method should be in sync with maproot.py.
 * TODO(cimamoglu): Implement this for other layer types.
 * @return {string} The address string if it's found, empty string otherwise.
 */
cm.LayerModel.prototype.getSourceAddress = function() {
  var type = this.get('type');
  switch (type) {
    case cm.LayerModel.Type.KML:
    case cm.LayerModel.Type.GEOJSON:
    case cm.LayerModel.Type.GEORSS:
    case cm.LayerModel.Type.TILE:
    case cm.LayerModel.Type.CSV:
    case cm.LayerModel.Type.WMS:
    case cm.LayerModel.Type.GOOGLE_MAPS_ENGINE_LITE_OR_PRO:
      var url = /** @type string */(this.get('url') || '');
      if (type === cm.LayerModel.Type.WMS) {
        url = new goog.Uri(url, true)
            .removeParameter('service')
            .removeParameter('version')
            .removeParameter('request')
            .toString();
      }
      return goog.object.transpose(
          cm.LayerModel.MAPROOT_TO_MODEL_LAYER_TYPES)[type] +
              ':' + url;
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
 * Convenience function for testing whether a layer is a single-select folder.
 * @return {boolean} True if the layer is a single-select folder.
 */
cm.LayerModel.prototype.isSingleSelect = function() {
  return this.get('folder_type') === cm.LayerModel.FolderType.SINGLE_SELECT;
};

/**
 * Convenience for figuring out if a given zoom level is inside the min/max zoom
 * levels for the layer.
 * @param {?number} zoomLevel The current zoom level; null or undefined is
 *   considered "unknown zoom level", and this function will return true.
 * @return {boolean} True if the zoom level is within the layer's acceptable
     zoom range; false otherwise.
 */
cm.LayerModel.prototype.insideZoomBounds = function(zoomLevel) {
  if (!goog.isNumber(zoomLevel)) return true;

  var minZoom = this.get('min_zoom');
  if (goog.isNumber(minZoom) && zoomLevel < minZoom) return false;

  var maxZoom = this.get('max_zoom');
  if (goog.isNumber(maxZoom) && zoomLevel > maxZoom) return false;

  return true;
};
