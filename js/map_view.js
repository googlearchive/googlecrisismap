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
 * @fileoverview The pannable, zoomable map view.
 */

goog.provide('cm.MapView');

goog.require('cm');
goog.require('cm.Analytics');
goog.require('cm.AppState');
goog.require('cm.Html');
goog.require('cm.LayerModel');
goog.require('cm.MapModel');
goog.require('cm.TileOverlay');
goog.require('cm.css');
goog.require('cm.util');
goog.require('goog.Uri');
goog.require('goog.array');
goog.require('goog.json');

/**
 * @param {Element} parentElem The DOM element in which to render the map.
 * @param {cm.MapModel} mapModel The map model.
 * @param {cm.AppState} appState The application state model.
 * @param {cm.MetadataModel} metadataModel The layer metadata model.
 * @param {boolean=} opt_touch True if the map is displayed on a touch device.
 * @param {?Object=} opt_config Configuration settings.  These fields are used:
 *     minimal_map_controls: Minimize controls (small zoom control, no scale
 *         control, no pegman)?
 *     panel_side: The side of the map the panel will be placed on,
 *         which dictates placement of the map controls.
 *     enable_osm_map_type: Show OSM as an option in the base map menu.  If the
 *         map's 'map_type' is OSM, we show OSM regardless of this setting.
 *     json_proxy_url: URL to the JSON proxy service.
 *     use_details_tab: Show feature details in the tabbed panel instead of an
 *         infowindow balloon on the map.
 *     wms_configure_url: URL to the WMS tileset configuration service.
 *     wms_tiles_url: URL to the WMS tile cache.
 * @param {boolean=} opt_preview True if this is a preview display of the map.
 * @param {boolean=} opt_embedded True if the map is being embedded in a page.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.MapView = function(parentElem, mapModel, appState, metadataModel,
                      opt_touch, opt_config, opt_preview, opt_embedded) {
  /**
   * @type cm.MapModel
   * @private
   */
  this.mapModel_ = mapModel;

  /**
   * @type cm.AppState
   * @private
   */
  this.appState_ = appState;

  /**
   * @type cm.MetadataModel
   * @private
   */
  this.metadataModel_ = metadataModel;

  /**
   * @type !google.maps.Map
   * @private
   */
  this.map_;

  /**
   * @type google.maps.InfoWindow
   * @private
   */
  this.infoWindow_;

  /**
   * The ID of the layer containing the currently selected feature.
   * @type ?string
   * @private
   */
  this.infoWindowLayerId_;

  /**
   * @type Object.<cm.MapView.Overlay>
   * @private
   */
  this.overlays_ = {};

  /**
   * @type Object.<Array.<cm.events.ListenerToken>>
   * @private
   */
  this.listenerTokens_ = {};

  /** @private {Element} A copyright notice to show on the map. */
  this.copyrightDiv_ = cm.ui.create('div', {'class': cm.css.MAP_COPYRIGHT});

  /** @private {Object} The configuration settings. */
  this.config_ = opt_config || {};

  /** @private {boolean} Allow OSM as a base map type. */
  this.osmEnabled_ = this.config_['enable_osm_map_type'];

  // The navigation controls must be moved (on non-touch devices) from TOP_LEFT
  // or the searchbox will be positioned to the left or right of it instead of
  // stacked vertically.  Placing the navigation controls in the LEFT_TOP allows
  // the search box to be positioned directly above it.
  var zoomControlPosition = google.maps.ControlPosition.LEFT_BOTTOM;
  var scaleControlPosition = google.maps.ControlPosition.RIGHT_BOTTOM;
  if (this.config_['panel_side'] === 'left') {
    zoomControlPosition = google.maps.ControlPosition.RIGHT_BOTTOM;
    scaleControlPosition = google.maps.ControlPosition.LEFT_BOTTOM;
  }
  var minimalMapControls =
      this.config_['minimal_map_controls'] || opt_touch || opt_preview ||
          this.config_['use_tab_panel'];
  var zoomControlStyle = minimalMapControls ?
      google.maps.ZoomControlStyle.SMALL :
      google.maps.ZoomControlStyle.DEFAULT;
  var mapOptions = /** @type google.maps.MapOptions */({
    'streetViewControl': !minimalMapControls,
    'panControl': false,
    'scaleControl': !minimalMapControls,
    'scaleControlOptions': {
      'position': scaleControlPosition
    },
    'zoomControlOptions': /** @type google.maps.ZoomControlOptions */({
      'position': zoomControlPosition,
      'style': zoomControlStyle
    }),
    'mapTypeControlOptions': {
      'mapTypeIds': [
        google.maps.MapTypeId.ROADMAP,
        google.maps.MapTypeId.SATELLITE
      ],
      'style': google.maps.MapTypeControlStyle.DROPDOWN_MENU
    },
    'mapTypeControl': !opt_preview,
    'scrollwheel': !opt_embedded
  });

  // The MapView has its own "mapTypeId", "center", and "zoom" properties so we
  // can set them while the google.maps.Map is still loading.  During loading,
  // google.maps.Map ignores setMapTypeId, setCenter, and setZoom, but if its
  // "mapTypeId", "center", and "zoom" properties are bound to the MapView,
  // it will pick up the proper settings when it finishes loading.
  this.set('mapTypeId', google.maps.MapTypeId.ROADMAP);
  this.set('center', new google.maps.LatLng(0, 0));
  this.set('zoom', 0);

  // Setting this flag tells the Maps API that we want the new look (the "Maps
  // API visual refresh"), as our map UI is styled to suit the new look.  When
  // the new look becomes the default (est. Nov 2013) we can remove this line.
  google.maps['visualRefresh'] = true;

  this.map_ = new google.maps.Map(parentElem, mapOptions);
  this.map_.bindTo('mapTypeId', this);
  this.map_.bindTo('center', this);
  this.map_.bindTo('zoom', this);
  this.map_.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(
      this.copyrightDiv_);

  // Translate between cm.MapModel.Type and google.maps.MapTypeId.
  cm.events.onChange(appState, 'map_type', function() {
    var mapType = appState.get('map_type') || cm.MapModel.Type.ROADMAP;
    this.set('mapTypeId', cm.MapView.MODEL_TO_MAPS_API_MAP_TYPES[mapType] ||
                          google.maps.MapTypeId.ROADMAP);
  }, this);

  // Expose the map's viewport as a property (see updateViewportProperty_ for
  // details on why we need a method rather than simply binding to 'bounds').
  // Note this property is read-only; don't set('viewport', ...) on a MapView.
  cm.events.onChange(this.map_, 'bounds', this.updateViewportProperty_, this);

  // We have to update the copyright if the map type changes to/from OSM.
  cm.events.onChange(this.map_, 'mapTypeId', this.updateMapCopyright, this);
  this.updateMapCopyright();

  // When the custom style changes, the map type menu may need updating.
  cm.events.onChange(this.mapModel_, ['base_map_style', 'base_map_style_name'],
                     this.updateMapTypeMenu, this);
  // When the map type changes to custom or OSM, the menu may need updating.
  cm.events.onChange(appState, 'map_type', this.updateMapTypeMenu, this);
  // Not sure if the "idle" event is ever delayed by a noticable amount.
  // If not this line can be deleted, since the "idle" listener will also call
  // updateMapTypeMenu())
  this.updateMapTypeMenu();

  // Expose our 'viewport' property as a property of the AppState.
  this.bindTo('viewport', appState);

  // Create an infowindow that closes when the user clicks on the map.
  // TODO(kpy): When the UI switches to the tabbed panel design, remove
  // this.infoWindow_ and rename infoWindowLayerId_ to selectedFeatureLayerId_.
  this.infoWindow_ = new google.maps.InfoWindow();
  cm.events.listen(this.map_, 'click', function() {
    // In the new tabbed panel world, selecting/deselecting a feature will emit
    // events that trigger UI changes in the TabPanelView.
    if (this.config_['use_details_tab']) {
      cm.events.emit(this, cm.events.DESELECT_FEATURE);
    } else {
      // The infowindow may not be open, but it's not a problem to call close()
      // on it multiple times.
      this.infoWindow_.close();
    }
  }, this);

  // Helper text for defining lat/lng values when editing a layer's viewport.
  var mouseLatLngElem = cm.ui.create('div', {'class': cm.css.LAT_LNG});
  mouseLatLngElem.style.display = 'none';
  cm.ui.append(parentElem, mouseLatLngElem);
  cm.events.listen(this.map_, 'mousemove', function(event) {
    cm.ui.setText(mouseLatLngElem, 'Latitude/Longitude: ' +
        cm.util.round(event.latLng.lat(), 4) + ', ' +
        cm.util.round(event.latLng.lng(), 4));
  });
  // Only show lat/lon coordinates when the inspector dialog is open.
  cm.events.listen(goog.global, cm.events.INSPECTOR_VISIBLE, function(e) {
    mouseLatLngElem.style.display = e.value ? '' : 'none';
  });

  // Add overlays for all the layers.
  cm.util.forLayersInMap(/** @type cm.MapModel */(mapModel),
    function(layer) { this.addOverlay_(layer); }, null, this);

  // Update layer visibility when layers are toggled or the zoom level changes.
  cm.events.onChange(appState, 'enabled_layer_ids',
                     this.updateVisibility_, this);
  cm.events.onChange(this, 'zoom', function() {
    var zoom = /** @type number */(this.get('zoom'));
    cm.Analytics.logAction(
        cm.Analytics.PassiveAction.MAP_ZOOM_CHANGED, null, zoom);
    this.updateVisibility_();
    cm.events.emit(goog.global, cm.events.ZOOM_CHANGED, {'zoom': zoom});
  }, this);

  cm.events.listen(this.mapModel_, cm.events.LAYERS_ADDED, function(e) {
    goog.array.forEach(e.layers, this.addOverlay_, this);
    this.updateVisibility_();
  }, this);
  cm.events.listen(this.mapModel_, cm.events.LAYERS_REMOVED, function(e) {
    goog.array.forEach(e.ids, this.removeOverlay_, this);
    this.updateVisibility_();
  }, this);

  // Initialize the layer visibility according to the AppState.
  this.updateVisibility_();

  this.listenerTokens_['post_load'] = cm.events.listen(
      this.map_, 'idle', this.postLoad_, this);
};
goog.inherits(cm.MapView, google.maps.MVCObject);

/** @typedef {google.maps.KmlLayer|google.maps.visualization.MapsEngineLayer|
              google.maps.FusionTablesLayer|
              cm.TileOverlay|
              google.maps.TrafficLayer|
              google.maps.TransitLayer|
              google.maps.weather.WeatherLayer|
              google.maps.weather.CloudLayer} */
cm.MapView.Overlay;

// Mappings from MapModel and LayerModel constants to constants used
// by the Google Maps API.

/** @type Object.<google.maps.MapTypeId> */
cm.MapView.MODEL_TO_MAPS_API_MAP_TYPES = goog.object.create(
  cm.MapModel.Type.ROADMAP, google.maps.MapTypeId.ROADMAP,
  cm.MapModel.Type.SATELLITE, google.maps.MapTypeId.SATELLITE,
  cm.MapModel.Type.HYBRID, google.maps.MapTypeId.HYBRID,
  cm.MapModel.Type.TERRAIN, google.maps.MapTypeId.TERRAIN,
  // These values must differ from the other google.maps.MapTypeId values.
  // They are added to the map type registry in MapView.updateMapTypeMenu().
  cm.MapModel.Type.CUSTOM, 'cm.custom',
  cm.MapModel.Type.OSM, 'cm.osm'
);

/** @type {Object.<google.maps.weather.LabelColor>} */
cm.MapView.MODEL_TO_MAPS_API_LABEL_COLORS = goog.object.create(
  cm.LayerModel.LabelColor.BLACK, google.maps.weather.LabelColor.BLACK,
  cm.LayerModel.LabelColor.WHITE, google.maps.weather.LabelColor.WHITE
);

/** @type {Object.<google.maps.weather.TemperatureUnit>} */
cm.MapView.MODEL_TO_MAPS_API_TEMPERATURE_UNITS = goog.object.create(
  cm.LayerModel.TemperatureUnit.CELSIUS,
  google.maps.weather.TemperatureUnit.CELSIUS,
  cm.LayerModel.TemperatureUnit.FAHRENHEIT,
  google.maps.weather.TemperatureUnit.FAHRENHEIT
);

/** @type {Object.<google.maps.weather.LabelColor>} */
cm.MapView.MODEL_TO_MAPS_API_WIND_SPEED_UNITS = goog.object.create(
  cm.LayerModel.WindSpeedUnit.KILOMETERS_PER_HOUR,
  google.maps.weather.WindSpeedUnit.KILOMETERS_PER_HOUR,
  cm.LayerModel.WindSpeedUnit.METERS_PER_SECOND,
  google.maps.weather.WindSpeedUnit.METERS_PER_SECOND,
  cm.LayerModel.WindSpeedUnit.MILES_PER_HOUR,
  google.maps.weather.WindSpeedUnit.MILES_PER_HOUR
);

/**
 * Called after the map has fully loaded; we take care of any initialization
 * that must wait until the map is funlly initialized here.
 * @private
 */
cm.MapView.prototype.postLoad_ = function() {
  cm.events.unlisten(this.listenerTokens_['post_load'], this);
  delete this.listenerTokens_['post_load'];

  // The menu needs an update just after initial load if the map type is OSM.
  this.updateMapTypeMenu();

  cm.events.onChange(this.map_, 'mapTypeId', function() {
    // Translate between cm.MapModel.Type and google.maps.MapTypeId.
    this.appState_.set('map_type', goog.object.transpose(
        cm.MapView.MODEL_TO_MAPS_API_MAP_TYPES)[this.get('mapTypeId')]);
    cm.Analytics.logAction(cm.Analytics.MapAction.BASE_MAP_SELECTED, null);
  }, this);
};

// TODO(kpy) Delete this method when the MapView is properly encapsulated.
/** @return {!google.maps.Map} The Maps API map object. */
cm.MapView.prototype.getMap = function() {
  return this.map_;
};

/**
 * Updates the 'viewport' property to reflect the map's viewport.  If the
 * google.maps.Map's 'bounds' property gave the right answer we could just bind
 * to that, but we need to add a bit of code to work around its shortcomings.
 * @private
 */
cm.MapView.prototype.updateViewportProperty_ = function() {
  var ne = this.map_.getBounds().getNorthEast();
  var sw = this.map_.getBounds().getSouthWest();
  var north = ne.lat(), south = sw.lat(), east = ne.lng(), west = sw.lng();

  // Keep north and south within the limits of Google Maps.
  north = Math.min(north, cm.LatLonBox.MAX_LATITUDE);
  south = Math.max(south, -cm.LatLonBox.MAX_LATITUDE);

  // google.maps.Map.getBounds() returns a misleading result if the viewport
  // is larger than 360 degrees wide, so we have to handle this separately.
  var widthPixels = this.map_.getDiv().offsetWidth;
  var entireMapWidth = 256 * Math.pow(2, this.map_.getZoom());
  if (widthPixels >= entireMapWidth) {
    // Return a box 360 degrees wide, centered on the center of the map.
    east = west = this.map_.getCenter().lng() + 180;
  }
  this.set('viewport', new cm.LatLonBox(north, south, east, west));
};

/** Updates the map types available in the menu, according to the model. */
cm.MapView.prototype.updateMapTypeMenu = function() {
  // Options to show in the map type menu.
  var mapTypeIds = [google.maps.MapTypeId.ROADMAP,
                    google.maps.MapTypeId.SATELLITE,
                    google.maps.MapTypeId.HYBRID,
                    google.maps.MapTypeId.TERRAIN];
  var currentMapType = this.appState_.get('map_type');
  var modelMapType = this.mapModel_.get('map_type');
  var id, styledMap;
  if (currentMapType === cm.MapModel.Type.CUSTOM ||
      modelMapType === cm.MapModel.Type.CUSTOM) {
    // Add the custom style to the map type registry and show it in the menu.
    id = /** @type string */(
        cm.MapView.MODEL_TO_MAPS_API_MAP_TYPES[cm.MapModel.Type.CUSTOM]);
    var name = this.mapModel_.get('base_map_style_name') || 'Custom';
    try {
      var styles = /** @type Array.<(google.maps.MapTypeStyle)> */(
          goog.json.parse(this.mapModel_.get('base_map_style')));
      styledMap = new google.maps.StyledMapType(styles, {'name': name});
    } catch (error) {
      // StyledMapType produces a styled version of the ROADMAP tiles.  If the
      // style definition is invalid, we show a normal, unstyled road map.
      styledMap = new google.maps.StyledMapType([], {'name': name});
    }
    this.setMapType_(id, styledMap);
    mapTypeIds.push(id);
  }
  if (this.osmEnabled_ || modelMapType === cm.MapModel.Type.OSM ||
      currentMapType === cm.MapModel.Type.OSM) {
    // Add the OSM map type to the map type registry and show it in the menu.
    id = /** @type string */(
        cm.MapView.MODEL_TO_MAPS_API_MAP_TYPES[cm.MapModel.Type.OSM]);
    var imageMapType = new google.maps.ImageMapType({
      'getTileUrl': function(coord, zoom) {
        return 'http://tile.openstreetmap.org/' + zoom + '/' +
            coord.x + '/' + coord.y + '.png';
      },
      'tileSize': new google.maps.Size(256, 256),
      'name': 'OpenStreetMap',
      'maxZoom': 18
    });
    this.setMapType_(id, imageMapType);
    mapTypeIds.push(id);
  }
  this.map_.setOptions({
    'mapTypeControlOptions': {
      'mapTypeIds': mapTypeIds,
      'style': google.maps.MapTypeControlStyle.DROPDOWN_MENU
    }
  });

  // Make the map type menu wide enough to contain the "OpenStreetMap" label,
  // if necessary.  setOptions() resets the menu to the narrower width, so we
  // apply this fix-up just after calling setOptions().
  var controls = this.map_.controls[google.maps.ControlPosition.TOP_RIGHT];
  var controlParent = (controls.getAt(0) || {}).parentNode;
  if (controlParent) {  // controls may be empty during initialization
    if (this.map_.mapTypes.get(/** @type string */(
        cm.MapView.MODEL_TO_MAPS_API_MAP_TYPES[cm.MapModel.Type.OSM]))) {
      controlParent.lastChild.style.width = '105px';
      // Trigger a layout update so the controls don't overlap.
      controls.push(cm.ui.create('div', {'index': -1}));
      controls.pop();
    }
  }
};

/** Updates the copyright notice based on the currently selected map type. */
cm.MapView.prototype.updateMapCopyright = function() {
  cm.ui.clear(this.copyrightDiv_);
  if (this.map_.get('mapTypeId') ===
      cm.MapView.MODEL_TO_MAPS_API_MAP_TYPES[cm.MapModel.Type.OSM]) {
    new cm.Html(cm.MSG_OSM_COPYRIGHT_HTML).pasteInto(this.copyrightDiv_);
  }
};

/**
 * Removes the overlay associated with the given layer ID from the map.
 * @param {string} id The layer ID.
 * @private
 */
cm.MapView.prototype.removeOverlay_ = function(id) {
  if (this.overlays_[id]) {
    this.overlays_[id].setMap(null);
    delete this.overlays_[id];
    delete this.listenerTokens_[id];
  }
};

/**
 * Adds an overlay to the map, and sets up a handler to update the overlay
 * when certain layer properties change.
 * @param {cm.LayerModel} layer The layer model for which to add an overlay.
 * @private
 */
cm.MapView.prototype.addOverlay_ = function(layer) {
  this.updateOverlay_(layer);
  var properties = ['type', 'url', 'url_is_tile_index', 'ft_select', 'ft_from',
                    'ft_where', 'maps_engine_map_id', 'maps_engine_layer_key',
                    'layer_id', 'temperature_unit', 'wind_speed_unit',
                    'label_color', 'wms_layers'];
  this.listenerTokens_[layer.get('id')] =
      /** @type Array.<cm.events.ListenerToken> */(cm.events.onChange(
          layer, properties, function() {
            this.updateOverlay_(layer);
            this.updateVisibility_();
          }, this));
};

/**
 * Updates the overlay for a layer on the map, with its properties determined
 * by the LayerModel.  Note that the layer will not be added to the map until
 * updateVisibility_ is called.  Also sets up a handler so that clicks on
 * features in the overlay will open an infowindow containing feature details.
 * @param {cm.LayerModel} layer The layer model for which to update the overlay.
 * @private
 */
cm.MapView.prototype.updateOverlay_ = function(layer) {
  var id = /** @type string */(layer.get('id'));
  if (this.overlays_[id]) {
    this.overlays_[id].setMap(null);
    delete this.overlays_[id];
  }

  // If you add more overlay types here, update the list of overlay classes
  // in MapViewTest.OVERLAY_CLASSES.
  switch (layer.get('type')) {
    case cm.LayerModel.Type.KML:
    case cm.LayerModel.Type.GEORSS:
      var url = /** @type string */(layer.get('url'));
      if (url) {
        url = this.maybeAddCacheBuster_(url);
        this.overlays_[id] = new google.maps.KmlLayer({
          'url': url,
          'preserveViewport': true,
          'suppressInfoWindows': true  // we handle InfoWindows, not Maps API
        });
      }
      break;

    case cm.LayerModel.Type.TILE:
      this.overlays_[id] = new cm.TileOverlay(
        layer, this.map_, this.appState_, this.metadataModel_, this.config_);
      break;

    case cm.LayerModel.Type.WMS:
      this.overlays_[id] = new cm.TileOverlay(
        layer, this.map_, this.appState_, this.metadataModel_, this.config_);
      break;

    case cm.LayerModel.Type.FUSION:
      this.overlays_[id] = new google.maps.FusionTablesLayer({
        'query': {
          'select': layer.get('ft_select'),
          'from': layer.get('ft_from'),
          'where': layer.get('ft_where')
        },
        'suppressInfoWindows': true  // we handle InfoWindows, not Maps API
      });
      break;

    case cm.LayerModel.Type.MAP_DATA:
      var options = {
        'suppressInfoWindows': true  // we handle InfoWindows, not Maps API
      };


      // Use the public interface to MapsEngineLayer to load the layer. This
      // only works for public layers.
      options['mapId'] = layer.get('maps_engine_map_id');

      // Legacy MapRoots store the layer key in the layerId field. If this is
      // set, use that, otherwise fall back to the correct key field.
      options['layerId'] = layer.get('maps_engine_layer_id') ||
          layer.get('maps_engine_layer_key');

      if (options['mapId'] && options['layerId']) {
        this.overlays_[id] =
            new google.maps.visualization.MapsEngineLayer(options);
      }
      break;

    case cm.LayerModel.Type.TRAFFIC:
      this.overlays_[id] = new google.maps.TrafficLayer();
      break;

    case cm.LayerModel.Type.TRANSIT:
      this.overlays_[id] = new google.maps.TransitLayer();
      break;

    case cm.LayerModel.Type.WEATHER:
      this.overlays_[id] = new google.maps.weather.WeatherLayer({
        'suppressInfoWindows': true,  // we handle InfoWindows, not Maps API
        'labelColor': cm.MapView.MODEL_TO_MAPS_API_LABEL_COLORS[
            layer.get('label_color')] ||
            google.maps.weather.LabelColor.BLACK,
        'temperatureUnits': cm.MapView.MODEL_TO_MAPS_API_TEMPERATURE_UNITS[
            layer.get('temperature_unit')] ||
            google.maps.weather.TemperatureUnit.CELSIUS,
        'windSpeedUnits': cm.MapView.MODEL_TO_MAPS_API_WIND_SPEED_UNITS[
            layer.get('wind_speed_unit')] ||
            google.maps.weather.WindSpeedUnit.KILOMETERS_PER_HOUR
      });
      break;

    case cm.LayerModel.Type.CLOUD:
      this.overlays_[id] = new google.maps.weather.CloudLayer();
      break;
  }

  // Handle clicks by popping up an appropriate InfoWindow.
  var overlay = this.overlays_[id];
  if (overlay && !layer.get('suppress_info_windows')) {
    cm.events.listen(overlay, 'click', function(event) {
      var featureData = cm.MapView.getFeatureData_(id, event);
      if (this.config_['use_details_tab']) {
        if (featureData) {
          cm.events.emit(this, cm.events.SELECT_FEATURE, featureData);
        } else {
          cm.events.emit(this, cm.events.DESELECT_FEATURE);
        }
      } else {
        this.infoWindow_.close();
        // Note that we can't pass in a DOM element; we must pass the content
        // as a string in order for the infowindow to scroll properly.
        if (featureData) {
          this.infoWindow_.setOptions(
              /** @type google.maps.InfoWindowOptions */({
                position: featureData.position,
                pixelOffset: featureData.pixelOffset,
                content: featureData.content.innerHTML
              }));
          this.infoWindow_.open(this.map_);
        }
      }
      this.infoWindowLayerId_ = featureData ? id : null;
    }, this);
  }
};

/**
 * Gathers information about a map feature into data for a SELECT_FEATURE event.
 * @param {string} layerId The ID of the layer containing the feature.
 * @param {google.maps.KmlMouseEvent|google.maps.FusionTablesMouseEvent} event
 *    A Maps API event containing details about a map feature.
 * @return {?cm.events.FeatureData} An object containing information about the
 *    feature, or null if the feature has no infowindow content.
 * @private
 */
cm.MapView.getFeatureData_ = function(layerId, event) {
  // FusionTablesLayer makes the infowindow content available in the event
  // itself, but KmlLayer hides it behind 'featureData'.
  var featureData = event['featureData'] || event;
  var htmlString = featureData['infoWindowHtml'] || '';
  var content = null;
  // Strip whitespace from content before checking if it has child nodes;
  // otherwise, whitespace (except in IE) becomes a node in the document
  // fragment, which defeats our attempt to suppress empty infowindows.
  // TODO(shakusa): htmlToDocumentFragment is somewhat convoluted.  Look for
  // another way to do this without using that function.
  var node = goog.dom.htmlToDocumentFragment(goog.string.trim(htmlString));
  if (node && node.childNodes && node.childNodes.length > 0) {
    if (node.nodeType === goog.dom.NodeType.ELEMENT) {
      content = node;
    } else {
      // node might be a DocumentFragment; wrap it to ensure we have an Element.
      content = cm.ui.create('div', {}, node);
    }
  } else {
    return null;
  }
  return {
    layerId: layerId,
    title: featureData['name'] || '',
    snippet: featureData['snippet'] || '',
    content: /** @type Element */(content),
    position: event['latLng'],
    pixelOffset: event['pixelOffset']
  };
};

/**
 * To defeat bad caching of KML sources, if a magic URL param 'cm.ttl' exists,
 * remove it and use integer ttl in seconds specified to add a cachebuster
 * param to the url named 'cm.cache_time'.
 *
 * TODO(shakusa) This behavior needs to be replaced with something formally
 * specified in Maproot.
 *
 * @param {string} url The URL to a KML or GeoRSS source file, optionally
 * with an extra 'cm.ttl' parameter.
 * @return {string} A possibly modified copy of the given URL.  If the given
 * URL included a 'cm.ttl' parameter, it is replaced with a 'cm.cache_time'
 * parameter in the result, set to a value that changes every 'cm.ttl' seconds.
 * Otherwise the URL is returned unchanged.
 * @private
 */
cm.MapView.prototype.maybeAddCacheBuster_ = function(url) {
  var ttlParam = 'cm.ttl';
  var uri = new goog.Uri(url);
  var ttlSeconds = uri.getParameterValue(ttlParam);
  if (!ttlSeconds) {
    return url;
  }
  uri.removeParameter(ttlParam);

  ttlSeconds = Math.max(parseInt(ttlSeconds, 10), 1);
  var cacheBuster = Math.floor(new Date().getTime() / (ttlSeconds * 1000));
  uri.setParameterValue('cm.cache_time', cacheBuster);
  return uri.toString();
};

/**
 * Updates the visibility of the overlays according to the view model and
 * the current map zoom level.
 * @private
 */
cm.MapView.prototype.updateVisibility_ = function() {
  var zoom = /** @type number */(this.get('zoom'));
  var visibleLayerIds = this.appState_.getVisibleLayerIds(this.mapModel_);
  for (var id in this.overlays_) {
    var layer = this.mapModel_.getLayer(id);
    var minZoom = layer.get('min_zoom'), maxZoom = layer.get('max_zoom');

    // Turn on the overlay if the layer is on and the zoom level is in range.
    var become_visible = visibleLayerIds.contains(id) &&
        !(goog.isNumber(minZoom) && zoom < minZoom) &&
        !(goog.isNumber(maxZoom) && zoom > maxZoom);
    var is_visible = this.overlays_[id].getMap() != null;
    if (become_visible && !is_visible) {
      this.overlays_[id].setMap(this.map_);
      cm.Analytics.logAction(cm.Analytics.PassiveAction.LAYER_DISPLAYED, id);
    } else if (!become_visible && is_visible) {
      this.overlays_[id].setMap(null);
      cm.Analytics.logAction(cm.Analytics.PassiveAction.LAYER_HIDDEN, id);
    }


    // Deselect the selected feature if its layer is turned off.
    if (!become_visible && this.infoWindowLayerId_ == id) {
      if (this.config_['use_details_tab']) {
        cm.events.emit(this, cm.events.DESELECT_FEATURE);
      } else {
        this.infoWindow_.close();
        this.infoWindowLayerId_ = null;
      }
    }
  }
};

/**
 * Adjust the map viewport based on the 'llbox', 'lat', 'lng', and 'z'
 * parameters in a URI.  'lat' and 'lng' set the center of the map without
 * changing the zoom level; 'z' sets the zoom level without changing the
 * center; and if 'llbox' is present it overrides all the other parameters.
 * @param {!goog.Uri|!Location|string} uriOrString The URI whose params to use.
 */
cm.MapView.prototype.adjustViewportFromUri = function(uriOrString) {
  var uri = new goog.Uri(uriOrString);

  // If 'llbox' is present and valid, use it and ignore the rest.
  var box = cm.LatLonBox.fromString('' + uri.getParameterValue('llbox'));
  if (box) {
    this.matchViewport(box);
    return;
  }

  // If 'lat' and 'lng' are both present, adjust the center.
  function toNumberOrNan(value) {
    return value ? value - 0 : NaN;
  }
  var lat = toNumberOrNan(uri.getParameterValue('lat'));
  var lng = toNumberOrNan(uri.getParameterValue('lng'));
  if (isFinite(lat) && isFinite(lng)) {
    this.set('center', new google.maps.LatLng(lat, lng));
  }

  // If 'zoom' is present, adjust the zoom level.
  var zoom = toNumberOrNan(uri.getParameterValue('z'));
  if (isFinite(zoom)) {
    this.set('zoom', zoom);
  }
};

/**
 * Adjusts the map viewport to approximately match a given box.
 * @param {cm.LatLonBox} box A latitude-longitude box.
 */
cm.MapView.prototype.matchViewport = function(box) {
  // The actual map <div> size might not have exactly the same aspect ratio
  // as the given box, and we don't want small changes in the window size
  // (e.g. width or height 1 pixel too small) to make the map zoom out by a
  // factor of 2.  So we implement "make the viewport approximately match the
  // box" as "make the viewport enclose >= 75% of the box's width and height".
  if (box) {
    // We don't call this.map_.fitBounds() directly because the map might still
    // be loading.  Instead we set the 'center' and 'zoom' properties; the map
    // is bound to those properties and will pick up the center and zoom values
    // whenever it's ready.
    this.set('center', box.getMercatorCenter(true));
    this.set('zoom', box.getZoomLevel(this.map_.getDiv().offsetWidth / 0.75,
                                      this.map_.getDiv().offsetHeight / 0.75,
                                      true));
  }
};

/**
 * Zooms the map to a layer, using the layer's viewport if it exists; otherwise,
 * use the layer's full extent if it exists; otherwise, use the overlay's
 * getDefaultViewport method.
 * @param {string} id A layer ID.
 */
cm.MapView.prototype.zoomToLayer = function(id) {
  var mapView = this;
  var overlay = this.overlays_[id];
  var layer = this.mapModel_.getLayer(id);
  var viewportBox = /** @type cm.LatLonBox */(layer.get('viewport'));
  var fullExtentBox = /** @type cm.LatLonBox */(layer.get('full_extent'));

  if (viewportBox) {
    // Make the viewport approximately match the model's recommended viewport.
    mapView.matchViewport(viewportBox);
  } else if (fullExtentBox) {
    // Make the viewport entirely enclose the layer's geometry.
    this.map_.fitBounds(fullExtentBox.toLatLngBounds());
  } else if (overlay && overlay.getDefaultViewport) {
    /** @return {boolean} True iff the map viewport was set. */
    var applyDefaultViewport = function() {
      var bounds = overlay.getDefaultViewport();
      if (bounds) {
        mapView.map_.fitBounds(bounds);
        return true;
      } else {
        return false;
      }
    };
    // Try to apply the default viewport. If unsuccessful, set up a listener
    // to apply it once it becomes available.
    if (!applyDefaultViewport()) {
      var token = cm.events.onChange(overlay, 'defaultViewport', function() {
        applyDefaultViewport() && cm.events.unlisten(token);
      });
    }
  }
};


/**
 * Add an ImageMapType or StyledMapType to the map's MapTypeRegistry.
 *
 * @param {string} id The string identifier of the MapType to add to the
 *     MapTypeRegistry.
 * @param {google.maps.StyledMapType|google.maps.ImageMapType} mapType The
 *     StyledMapType or ImageMapType that we want to add to the MapTypeRegistry.
 * @private
 * @suppress {invalidCasts}
 */
cm.MapView.prototype.setMapType_ = function(id, mapType) {
  this.map_.mapTypes.set(id, /** @type google.maps.MapType */(mapType));
};
