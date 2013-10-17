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


// TODO(kpy): Move the actual constant to a shared location between MapView
// and initialization and then remove this.
goog.require('cm.css');

MIN_MAP_WIDTH_FOR_SEARCHBOX = 570;

DEFAULT_MAP_TYPE_IDS = [google.maps.MapTypeId.ROADMAP,
                        google.maps.MapTypeId.SATELLITE,
                        google.maps.MapTypeId.HYBRID,
                        google.maps.MapTypeId.TERRAIN];

// TODO(rew): This file needs a refactor - there are repeated calls
// to set up a layer and add it to a map (see e.g. addOverlayKml), and
// the endless expectations set for setMap() and getMap() just introduce
// fragility.  The repeated code should be extracted to a helper function,
// and the fragility should be removed by creating a map fake that just
// tracks what the current correct value for set/getMap is.

function MapViewTest() {
  cm.TestBase.call(this);

  this.elem_ = new FakeElement('div');
  this.mapModel_ = createMockInstance(cm.MapModel);
  this.appState_ = createMockInstance(cm.AppState);
  this.metadataModel_ = createMockInstance(cm.MetadataModel);
  this.config_ = {
    json_proxy_url: '/root/.jsonp',
    wms_configure_url: '/root/.wms/configure',
    wms_tiles_url: '/root/.wms/tiles'
  };
  this.stubVisibleLayerIds_([]);

  this.setForTest_('goog.dom.htmlToDocumentFragment', createMockFunction());
  stub(this.appState_.get)('viewport').is(cm.LatLonBox.ENTIRE_MAP);

  // Constructor expectations that will not change per test.
  // Adjust this.expectedMapOptions_ per test to check different expectations.
  this.expectedMapOptions_ = {
    streetViewControl: true,
    panControl: false,
    scaleControl: true,
    scaleControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM
    },
    zoomControlOptions: {
      position: google.maps.ControlPosition.LEFT_BOTTOM,
      style: google.maps.ZoomControlStyle.DEFAULT
    },
    mapTypeControlOptions: {
      mapTypeIds: [
        google.maps.MapTypeId.ROADMAP,
        google.maps.MapTypeId.SATELLITE
      ],
     style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
    },
    mapTypeControl: true,
    scrollwheel: true
  };
  // Tests can adjust expectedMapTypeControlOptions_ for different expectations.
  this.expectedMapTypeControlOptions_ = {
    mapTypeControlOptions: {
      mapTypeIds: DEFAULT_MAP_TYPE_IDS,
      style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
    }
  };

  this.map_ = this.expectNew_(
      'google.maps.Map', this.elem_, this.expectedMapOptions_);
  stub(this.map_.getDiv)().is({offsetWidth: 600, offsetHeight: 600});
  expectCall(this.map_.bindTo)('mapTypeId', _);
  expectCall(this.map_.bindTo)('center', _);
  expectCall(this.map_.bindTo)('zoom', _);
  expectCall(this.map_.setOptions)(this.expectedMapTypeControlOptions_)
      .willOnce(returnWith(null))  // require at least one call
      .willRepeatedly(returnWith(null));

  this.map_.controls = [];
  for (var i = 0; i < 13; i++) {
    this.map_.controls.push({getAt: function() { }, push: function() { }});
  }
  this.map_.mapTypes = createMockInstance(google.maps.MapTypeRegistry);

  this.infoWindow_ = this.expectNew_('google.maps.InfoWindow');

  // Individual tests should modify this.layers_ to set up their expectations.
  this.layers_ = new google.maps.MVCArray();
  stub(this.mapModel_.get)('layers').is(this.layers_);
  // Maps are not styled for tests by default.
  stub(this.mapModel_.get)('base_map_style').is(null);
  // Default base map type is roadmap.
  stub(this.mapModel_.get)('map_type').is(cm.MapModel.Type.ROADMAP);
  stub(this.appState_.get)('map_type').is(cm.MapModel.Type.ROADMAP);
  stub(this.map_.get)('mapTypeId').is(google.maps.MapTypeId.ROADMAP);
}
MapViewTest.prototype = new cm.TestBase();
registerTestSuite(MapViewTest);

/** Fully qualified names of all types of overlays that we put on the map. */
MapViewTest.OVERLAY_CLASSES = [
  'cm.TileOverlay',
  'google.maps.FusionTablesLayer',
  'google.maps.KmlLayer',
  'google.maps.visualization.MapsEngineLayer',
  'google.maps.TrafficLayer',
  'google.maps.TransitLayer',
  'google.maps.weather.WeatherLayer',
  'google.maps.weather.CloudLayer'
];

/**
 * Creates an MVCObject from a bunch of keys and values.
 * @param {Object} properties The key-value pairs.
 * @return {google.maps.MVCObject} The MVCObject.
 * @private
 */
MapViewTest.newMVCObject_ = function(properties) {
  var o = new google.maps.MVCObject();
  for (var key in properties) {
    o.set(key, properties[key]);
  }
  return o;
};

/**
 * Sets expectations when an InfoWindow is opened.
 * @param {string|Node} content The InfoWindow content.
 * @param {google.maps.LatLng} position Where the InfoWindow is placed.
 * @param {google.maps.Size} pixelOffset The offset from the
 *   InfoWindow's anchor coordinates to its tip (see docs for
 *   google.maps.InfoWindowOptions).
 * @private
 */
MapViewTest.prototype.expectInfoWindowOpen_ = function(
    content, position, pixelOffset) {
  // Simulate the conversion of a string of HTML into a DOM node.
  var node = {nodeType: goog.dom.NodeType.ELEMENT,
              innerHTML: content, childNodes: ['x']};

  expectCall(this.infoWindow_.close)();
  expectCall(goog.dom.htmlToDocumentFragment)(content)
      .willOnce(returnWith(node));
  expectCall(this.infoWindow_.setOptions)({
    position: position, pixelOffset: pixelOffset, content: content
  });
  expectCall(this.infoWindow_.open)(this.map_);
};

/**
 * Stubs out AppState.getVisibleLayerIds() to return the given set of IDs.
 * @param {Array.<string>} ids The array of IDs.
 * @private
 */
MapViewTest.prototype.stubVisibleLayerIds_ = function(ids) {
  stub(this.appState_.getVisibleLayerIds)(_).is(new goog.structs.Set(ids));
};

/**
 * Adds a layer to the model and sets up expectations for getLayer.
 * @param {Object} properties The properties to give the layer.
 * @return {google.maps.MVCObject} The fake layer model.
 * @private
 */
MapViewTest.prototype.addLayer_ = function(properties) {
  var layerModel = MapViewTest.newMVCObject_(properties);
  this.layers_.push(layerModel);
  stub(this.mapModel_.getLayer)(properties['id']).is(layerModel);
  return layerModel;
};

/**
 * Creates and returns a new map view using the receiver's internal state for
 * the parent, map model, app state, etc.  Takes care of triggering
 * initialization that waits for the map to load.  All arguments are passed
 * directly through to the cm.MapView constructor argument of the same name.
 * @param {boolean=} opt_touch True if the map is displayed on a touch device.
 * @param {?Object=} opt_config Configuration settings; see cm.MapView
 *     constructor for full details.
 * @param {boolean=} opt_preview True if this is a preview display of the map.
 * @param {boolean=} opt_embedded True if the map is being embedded in a page.
 * @return {cm.MapView} The newly created MapView.
 * @private
 */
MapViewTest.prototype.newMapView_ = function(
    opt_touch, opt_config, opt_preview, opt_embedded) {
  var mapView = new cm.MapView(
      this.elem_, this.mapModel_, this.appState_, this.metadataModel_,
      opt_touch, opt_config, opt_preview, opt_embedded);
  // Trigger postLoad_()
  cm.events.emit(this.map_, 'idle');
  return mapView;
};

/** Tests map controls for non-touch browsers. */
MapViewTest.prototype.controlPositionNotTouch = function() {
  this.newMapView_(false);
};

/** Tests map controls for touch browsers. */
MapViewTest.prototype.controlPositionTouch = function() {
  this.expectedMapOptions_.scaleControl = false;
  this.expectedMapOptions_.streetViewControl = false;
  this.expectedMapOptions_.zoomControlOptions.style =
      google.maps.ZoomControlStyle.SMALL;
  this.newMapView_(true);
};

/** Tests map controls when the panel is on the left of the map. */
MapViewTest.prototype.controlPositionLeftPanel = function() {
  this.expectedMapOptions_.zoomControlOptions.position =
      google.maps.ControlPosition.RIGHT_BOTTOM;
  this.expectedMapOptions_.scaleControlOptions.position =
      google.maps.ControlPosition.LEFT_BOTTOM;
  this.newMapView_(false, {'panel_side': 'left'});
};

/** Tests minimal map controls. */
MapViewTest.prototype.minimalControls = function() {
  this.expectedMapOptions_.scaleControl = false;
  this.expectedMapOptions_.streetViewControl = false;
  this.expectedMapOptions_.zoomControlOptions.style =
      google.maps.ZoomControlStyle.SMALL;
  this.newMapView_(false, {'minimal_map_controls': true});
};

/** Scroll wheel zoom should be disabled in embedded mode. */
MapViewTest.prototype.embeddedMode = function() {
  this.expectedMapOptions_.scrollwheel = false;
  this.newMapView_(false, undefined, false, true);
};

/** Tests preview view. */
MapViewTest.prototype.previewView = function() {
  this.expectedMapOptions_.scaleControl = false;
  this.expectedMapOptions_.streetViewControl = false;
  this.expectedMapOptions_.zoomControlOptions.style =
      google.maps.ZoomControlStyle.SMALL;
  this.expectedMapOptions_.mapTypeControl = false;
  this.newMapView_(false, undefined, true);
};

/** Tests that clicking on the map closes the open InfoWindow. */
MapViewTest.prototype.mapClickClosesInfoWindow = function() {
  this.newMapView_(false);
  expectCall(this.infoWindow_.close)();
  cm.events.emit(this.map_, 'click');
};

/**
 * Tests that opening/closing the inspector displays/hides mouse
 * lat/long coordinates.
 */
MapViewTest.prototype.mouseLatLonCoordinates = function() {
  this.newMapView_(false);
  var latLonElem = expectDescendantOf(this.elem_, withClass(cm.css.LAT_LNG));
  expectEq('none', latLonElem.style.display);
  cm.events.emit(goog.global, cm.events.INSPECTOR_VISIBLE, {value: true});
  expectEq('', latLonElem.style.display);
  cm.events.emit(goog.global, cm.events.INSPECTOR_VISIBLE, {value: false});
  expectEq('none', latLonElem.style.display);
};

/** Tests that the AppState's map_type and Map's mapTypeId are kept in sync. */
MapViewTest.prototype.appStateMapType = function() {
  var mapView = this.newMapView_(false);

  // An Analytics log should be sent and AppState should get map_type TERRAIN...
  expectCall(this.appState_.set)('map_type', cm.MapModel.Type.TERRAIN);
  this.expectLogAction(cm.Analytics.MapAction.BASE_MAP_SELECTED, null);

  // ...when the map is switched to TERRAIN.
  mapView.set('mapTypeId', google.maps.MapTypeId.TERRAIN);
  cm.events.emit(this.map_, 'maptypeid_changed');

  // When the AppState map_type is switched to SATELLITE...
  stub(this.appState_.get)('map_type').is(cm.MapModel.Type.SATELLITE);
  cm.events.emit(this.appState_, 'map_type_changed');

  // ...the map should switch to SATELLITE.
  expectEq(google.maps.MapTypeId.SATELLITE, mapView.get('mapTypeId'));

  // When the AppState map_type is switched to something invalid...
  stub(this.appState_.get)('map_type').is('wxyz');
  cm.events.emit(this.appState_, 'map_type_changed');

  // ...the map should default to ROADMAP.
  expectEq(google.maps.MapTypeId.ROADMAP, mapView.get('mapTypeId'));
};

/** Tests adding a KML overlay. */
MapViewTest.prototype.addOverlayKml = function() {
  this.addLayer_({
    id: 'chocolate', type: cm.LayerModel.Type.KML, url: 'http://chocolate.com'
  });
  this.stubVisibleLayerIds_(['chocolate']);

  var overlay = this.expectNew_('google.maps.KmlLayer', {
      url: 'http://chocolate.com',
      preserveViewport: true,
      suppressInfoWindows: true
  });
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/** Tests adding a GeoRSS overlay. */
MapViewTest.prototype.addOverlayGeoRss = function() {
  this.addLayer_({
    id: 'vanilla', type: cm.LayerModel.Type.GEORSS, url: 'http://vanilla.com.au'
  });
  this.stubVisibleLayerIds_(['vanilla']);

  var overlay = this.expectNew_('google.maps.KmlLayer', {
      url: 'http://vanilla.com.au',
      preserveViewport: true,
      suppressInfoWindows: true
  });
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/** Tests adding a Fusion Tables overlay. */
MapViewTest.prototype.addOverlayFusionTables = function() {
  this.addLayer_({
    id: 'mint-chip', type: cm.LayerModel.Type.FUSION,
    ft_select: 'icecream', ft_from: 123, ft_where: ''
  });
  this.stubVisibleLayerIds_(['mint-chip']);

  var overlay = this.expectNew_('google.maps.FusionTablesLayer', {
    query: {select: 'icecream', from: 123, where: ''},
    suppressInfoWindows: true
  });
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/** Tests adding a Tile overlay. */
MapViewTest.prototype.addOverlayTile = function() {
  var layerModel = this.addLayer_(
      {id: 'choc-chip', type: cm.LayerModel.Type.TILE});
  this.stubVisibleLayerIds_(['choc-chip']);

  var overlay = this.expectNew_(
      'cm.TileOverlay', layerModel, this.map_,
      this.appState_, this.metadataModel_, this.config_);
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false, this.config_);
};

/** Tests adding a Traffic overlay. */
MapViewTest.prototype.addOverlayTraffic = function() {
  this.addLayer_({id: 'x', type: cm.LayerModel.Type.TRAFFIC});
  this.stubVisibleLayerIds_(['x']);

  var overlay = this.expectNew_('google.maps.TrafficLayer');
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/** Tests adding a Transit overlay. */
MapViewTest.prototype.addOverlayTransit = function() {
  this.addLayer_({id: 'x', type: cm.LayerModel.Type.TRANSIT});
  this.stubVisibleLayerIds_(['x']);

  var overlay = this.expectNew_('google.maps.TransitLayer');
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/** Tests adding a Weather overlay. */
MapViewTest.prototype.addOverlayWeather = function() {
  this.addLayer_({id: 'x', type: cm.LayerModel.Type.WEATHER});
  this.stubVisibleLayerIds_(['x']);

  var overlay = this.expectNew_('google.maps.weather.WeatherLayer', {
    'labelColor': 'black',
    'suppressInfoWindows': true,
    'temperatureUnits': 'c',
    'windSpeedUnits': 'kph'
  });
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/** Tests adding a Cloud overlay. */
MapViewTest.prototype.addOverlayCloud = function() {
  this.addLayer_({id: 'x', type: cm.LayerModel.Type.CLOUD});
  this.stubVisibleLayerIds_(['x']);

  var overlay = this.expectNew_('google.maps.weather.CloudLayer');
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/** Tests adding a KML overlay with no URL. */
MapViewTest.prototype.addOverlayKmlWithoutUrl = function() {
  // Given KML and GeoRSS layers with no 'url' property...
  this.layers_.push(MapViewTest.newMVCObject_({
    id: 'salted-caramel', type: cm.LayerModel.Type.KML
  }));
  this.layers_.push(MapViewTest.newMVCObject_({
    id: 'rum-raisin', type: cm.LayerModel.Type.GEORSS
  }));
  this.stubVisibleLayerIds_([]);

  // ...expect no overlays to be created...
  for (var i = 0; i < MapViewTest.OVERLAY_CLASSES.length; i++) {
    this.expectNoCalls_(MapViewTest.OVERLAY_CLASSES[i]);
  }

  // ...when a new cm.MapView is created.
  this.newMapView_(false);
};

/** Tests adding an overlay of GME layer using the public interface. */
MapViewTest.prototype.addOverlayMapsEngineExternal = function() {
  this.addLayer_({
    'id': 'rockyroad',
    'type': cm.LayerModel.Type.MAP_DATA,
    'maps_engine_map_id': 'frotz',
    'maps_engine_layer_key': 'igram',
    'suppress_info_windows': true
  });
  this.stubVisibleLayerIds_(['rockyroad']);

  var overlay = this.expectNew_('google.maps.visualization.MapsEngineLayer', {
    mapId: 'frotz',
    layerId: 'igram',
    suppressInfoWindows: true
  });
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/**
 * Tests adding a GME layer overlay using the public interface, using the
 * layer_id field rather than the key field from the maproot. This interface
 * is used by older maproot files.
 * */
MapViewTest.prototype.addOverlayMapsEngineExternalLegacyIdScheme = function() {
  this.addLayer_({
    'id': 'rockyroad',
    'type': cm.LayerModel.Type.MAP_DATA,
    'maps_engine_map_id': 'frotz',
    'maps_engine_layer_id': 'word',
    'suppress_info_windows': true
  });
  this.stubVisibleLayerIds_(['rockyroad']);

  var overlay = this.expectNew_('google.maps.visualization.MapsEngineLayer', {
    mapId: 'frotz',
    layerId: 'word',
    suppressInfoWindows: true
  });
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
};

/** Tests adding an overlay with no type. */
MapViewTest.prototype.addOverlayOther = function() {
  // Given a layer with no valid type...
  this.layers_.push(MapViewTest.newMVCObject_({type: ''}));
  this.stubVisibleLayerIds_([]);

  // ...expect no overlays to be created...
  for (var i = 0; i < MapViewTest.OVERLAY_CLASSES.length; i++) {
    this.expectNoCalls_(MapViewTest.OVERLAY_CLASSES[i]);
  }

  // ...when a new cm.MapView is created.
  this.newMapView_(false);
};

/** Tests that the cache buster is added properly. */
MapViewTest.prototype.addCacheBuster = function() {
  var model = this.addLayer_(
      {id: 'cotton-candy', type: cm.LayerModel.Type.KML,
       url: 'http://example.com?foo=bar&baz=123&cm.ttl=300'});

  var date = this.expectNew_('Date');
  date.getTime = function() { return 1500000; };

  var overlay = this.expectNew_('google.maps.KmlLayer', {
      url: 'http://example.com?foo=bar&baz=123&cm.cache_time=5',
      preserveViewport: _,
      suppressInfoWindows: _
  });
  stub(overlay.getMap)().is(this.map_);
  expectCall(overlay.setMap)(null);
  this.newMapView_(false);
};

/** Tests that the cache buster is only added when cm.ttl is specified. */
MapViewTest.prototype.doNotAddCacheBuster = function() {
  var model = this.addLayer_(
      {id: 'cotton-candy', type: cm.LayerModel.Type.KML,
       url: 'http://example.com?foo=bar'});

  var date = this.expectNew_('Date');
  date.getTime = function() { return 1500000; };

  var overlay = this.expectNew_('google.maps.KmlLayer', {
      url: 'http://example.com?foo=bar',
      preserveViewport: _,
      suppressInfoWindows: _
  });
  stub(overlay.getMap)().is(this.map_);
  expectCall(overlay.setMap)(null);
  this.newMapView_(false);
};

/** Tests that overlays are updated when layer properties change. */
MapViewTest.prototype.propertiesChanged = function() {
  var model = this.addLayer_(
      {id: 'cotton-candy', type: cm.LayerModel.Type.KML, url: 'url'});
  var overlay = this.expectNew_('google.maps.KmlLayer', _);
  stub(overlay.getMap)().is(this.map_);
  expectCall(overlay.setMap)(null);
  this.newMapView_(false);

  // Change the URL
  stub(overlay.getMap)().is(this.map_);
  expectCall(overlay.setMap)(null).times(2);
  model.set('url', 'newurl');

  // Change the layer type to a tile
  expectCall(overlay.setMap)(null);
  overlay = this.expectNew_('cm.TileOverlay', _, _, _, _, _);
  stub(overlay.getMap)().is(this.map_);
  expectCall(overlay.setMap)(null);
  model.set('type', cm.LayerModel.Type.TILE);

  // Change whether the URL is a tile index.
  stub(overlay.getMap)().is(this.map_);
  expectCall(overlay.setMap)(null).times(2);
  model.set('url_is_tile_index', true);

  // Change the layer type to fusion.
  expectCall(overlay.setMap)(null);
  overlay = this.expectNew_('google.maps.FusionTablesLayer', _);
  stub(overlay.getMap)().is(null);
  model.set('type', cm.LayerModel.Type.FUSION);

  // Change an FT query parameter.
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(null);
  model.set('ft_select', 'geometry');

  // Change the layer type to WEATHER.
  expectCall(overlay.setMap)(null);
  overlay = this.expectNew_('google.maps.weather.WeatherLayer', {
    'labelColor': 'black',
    'suppressInfoWindows': true,
    'temperatureUnits': 'c',
    'windSpeedUnits': 'kph'
  });
  stub(overlay.getMap)().is(null);
  model.set('type', cm.LayerModel.Type.WEATHER);

  // Change the label color.
  expectCall(overlay.setMap)(null);
  overlay = this.expectNew_('google.maps.weather.WeatherLayer', {
    'labelColor': 'white',
    'suppressInfoWindows': true,
    'temperatureUnits': 'c',
    'windSpeedUnits': 'kph'
  });
  stub(overlay.getMap)().is(null);
  model.set('label_color', cm.LayerModel.LabelColor.WHITE);

  // Change the temperature unit.
  expectCall(overlay.setMap)(null);
  overlay = this.expectNew_('google.maps.weather.WeatherLayer', {
    'labelColor': 'white',
    'suppressInfoWindows': true,
    'temperatureUnits': 'f',
    'windSpeedUnits': 'kph'
  });
  stub(overlay.getMap)().is(null);
  model.set('temperature_unit', cm.LayerModel.TemperatureUnit.FAHRENHEIT);

  // Change the wind speed unit.
  expectCall(overlay.setMap)(null);
  overlay = this.expectNew_('google.maps.weather.WeatherLayer', {
    'labelColor': 'white',
    'suppressInfoWindows': true,
    'temperatureUnits': 'f',
    'windSpeedUnits': 'ms'
  });
  stub(overlay.getMap)().is(null);
  model.set('wind_speed_unit', cm.LayerModel.WindSpeedUnit.METERS_PER_SECOND);
};

/** Tests that the LAYERS_ADDED event results in overlays being added
 *  to the map.
 */
MapViewTest.prototype.layersAddedEvent = function() {
  this.newMapView_(false);

  // Emit a LAYERS_ADDED event with 2 layers
  var layer1 = this.addLayer_({id: 'mango',
                              type: cm.LayerModel.Type.KML, url: 'url'});
  var overlay1 = this.expectNew_('google.maps.KmlLayer', _);
  stub(overlay1.getMap)().is(null);
  expectCall(overlay1.setMap)(this.map_);
  var layer2 = this.addLayer_({id: 'banana',
                              type: cm.LayerModel.Type.TILE});
  var overlay2 = this.expectNew_('cm.TileOverlay', _, _, _, _, _);
  stub(overlay2.getMap)().is(null);
  expectCall(overlay2.setMap)(this.map_);
  this.stubVisibleLayerIds_(['banana', 'mango']);

  cm.events.emit(this.mapModel_, cm.events.LAYERS_ADDED,
                 {layers: [layer1, layer2]});
};

/**
 * Tests that the LAYERS_REMOVED event results in overlays being
 * removed from the map.
 */
MapViewTest.prototype.layersRemovedEvent = function() {
  var layer1 = this.addLayer_({id: 'mango',
                              type: cm.LayerModel.Type.KML, url: 'url'});
  var overlay1 = this.expectNew_('google.maps.KmlLayer', _);
  stub(overlay1.getMap)().is(null);
  expectCall(overlay1.setMap)(this.map_);
  var layer2 = this.addLayer_({id: 'banana',
                              type: cm.LayerModel.Type.TILE});
  var overlay2 = this.expectNew_('cm.TileOverlay', _, _, _, _, _);
  stub(overlay2.getMap)().is(null);
  expectCall(overlay2.setMap)(this.map_);
  this.stubVisibleLayerIds_(['banana', 'mango']);

  this.newMapView_(false);

  // Emit a LAYERS_REMOVED event
  expectCall(overlay1.setMap)(null);
  expectCall(overlay2.setMap)(null);
  cm.events.emit(this.mapModel_, cm.events.LAYERS_REMOVED,
                 {ids: ['banana', 'mango']});
};

/** Tests that clicking on an overlay opens its InfoWindow. */
MapViewTest.prototype.clickingOverlayOpensInfoWindow = function() {
  this.addLayer_({id: 'bubble-gum', type: cm.LayerModel.Type.KML, url: 'url'});
  this.stubVisibleLayerIds_(['bubble-gum']);

  var overlay = this.expectNew_('google.maps.KmlLayer', _);
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);
  // featureData is defined in KML events.
  var kmlEvent = {
    featureData: {infoWindowHtml: 'grossest ice cream ever'},
    latLng: {},
    pixelOffset: {}
  };
  this.expectInfoWindowOpen_(kmlEvent.featureData.infoWindowHtml,
                             kmlEvent.latLng, kmlEvent.pixelOffset);
  cm.events.emit(overlay, 'click', kmlEvent);

  // Make sure leading and trailing whitespace is trimmed
  kmlEvent = {
    featureData: {infoWindowHtml: '\r\n grossest ice cream ever\n\t  '},
    latLng: {},
    pixelOffset: {}
  };
  this.expectInfoWindowOpen_('grossest ice cream ever',
                             kmlEvent.latLng, kmlEvent.pixelOffset);
  cm.events.emit(overlay, 'click', kmlEvent);

  // featureData is NOT defined in Fusion Tables events.
  var ftEvent = {
    infoWindowHtml: '<u>grossest</u> ice cream ever',
    latLng: {},
    pixelOffset: {}
  };
  this.expectInfoWindowOpen_(ftEvent.infoWindowHtml, ftEvent.latLng,
                             ftEvent.pixelOffset);
  cm.events.emit(overlay, 'click', ftEvent);
};

/**
 * Tests that clicking on an overlay with empty info window does not
 * open the info window.
 */
MapViewTest.prototype.clickingEmptyOverlayDoesNotOpensInfoWindow = function() {
  this.addLayer_({id: 'bubble-gum', type: cm.LayerModel.Type.KML, url: 'url'});
  this.stubVisibleLayerIds_(['bubble-gum']);

  var overlay = this.expectNew_('google.maps.KmlLayer', _);
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  this.newMapView_(false);

  // Make sure a single empty element is ignored
  var kmlEvent = {
    featureData: {infoWindowHtml: '<div style="foo"></div>'},
    latLng: {},
    pixelOffset: {}
  };
  expectCall(this.infoWindow_.close)();
  expectCall(goog.dom.htmlToDocumentFragment)('<div style="foo"></div>')
      .willOnce(returnWith({childNodes: []}));
  expectCall(this.infoWindow_.open)().times(0);
  cm.events.emit(overlay, 'click', kmlEvent);
};

/**
 * Tests that changes to the layer visibility in the AppState cause
 * layers to be added to or removed from the map.
 */
MapViewTest.prototype.updateVisibility = function() {
  // Given two visible layers...
  this.addLayer_({'id': 'hazelnut', 'type': cm.LayerModel.Type.KML,
                  'url': 'url'});
  this.addLayer_({'id': 'gianduia', 'type': cm.LayerModel.Type.TRAFFIC});
  this.stubVisibleLayerIds_(['hazelnut', 'gianduia']);

  // ...expect two layers to be created and added to the map...
  var overlay1 = this.expectNew_('google.maps.KmlLayer', _);
  var overlay2 = this.expectNew_('google.maps.TrafficLayer');
  stub(overlay1.getMap)().is(null);
  expectCall(overlay1.setMap)(this.map_);
  stub(overlay2.getMap)().is(null);
  expectCall(overlay2.setMap)(this.map_);

  // ...when a new cm.MapView is created.
  this.newMapView_(false);

  // Then expect both layers to be removed from the map...
  stub(overlay1.getMap)().is(this.map_);
  expectCall(overlay1.setMap)(null);
  stub(overlay2.getMap)().is(this.map_);
  expectCall(overlay2.setMap)(null);

  // ...when both layers are turned off.
  this.stubVisibleLayerIds_([]);
  cm.events.emit(this.appState_, 'enabled_layer_ids_changed');
};

/**
 * Tests that turning off a layer's visibility will close its
 * InfoWindow and no other layer's InfoWindow.
 */
MapViewTest.prototype.infoWindowClosesWhenLayerTurnedOff = function() {
  // Given two visible layers...
  this.addLayer_({'id': 'chocolate-fondante', 'type': cm.LayerModel.Type.KML,
                  'url': 'http://example.com/foo.kml'});
  this.addLayer_({'id': 'cookies-and-cream', 'type': cm.LayerModel.Type.TILE});
  this.stubVisibleLayerIds_(['chocolate-fondante', 'cookies-and-cream']);

  // ...expect two layers to be created and added to the map...
  var overlay1 = this.expectNew_('google.maps.KmlLayer', _);
  var overlay2 = this.expectNew_('cm.TileOverlay', _, _, _, _, _);
  stub(overlay1.getMap)().is(null);
  stub(overlay2.getMap)().is(null);
  expectCall(overlay1.setMap)(this.map_);
  expectCall(overlay2.setMap)(this.map_);

  // ...when a new cm.MapView is created.
  this.newMapView_(false);

  // Then expect an InfoWindow to open...
  this.expectInfoWindowOpen_(_, _, _);

  // ...when there is a click on the chocolate-fondante layer.
  cm.events.emit(overlay1, 'click', {'featureData': {'infoWindowHtml': 'foo'}});

  // Expect cookies-and-cream to disappear from the map, but do not expect
  // the InfoWindow to be closed...
  stub(overlay1.getMap)().is(this.map_);
  stub(overlay2.getMap)().is(this.map_);
  expectCall(overlay2.setMap)(null);

  // ...when cookies-and-cream is turned off.
  this.stubVisibleLayerIds_(['chocolate-fondante']);
  cm.events.emit(this.appState_, 'enabled_layer_ids_changed');

  // Expect neither layer to be shown on the map, and expect the InfoWindow
  // to be closed...
  expectCall(overlay1.setMap)(null);
  expectCall(overlay2.setMap)(null);
  expectCall(this.infoWindow_.close)();

  // ...when its associated layer, chocolate-fondante, is turned off.
  this.stubVisibleLayerIds_([]);
  cm.events.emit(this.appState_, 'enabled_layer_ids_changed');
};

/** Tests getMap(). */
MapViewTest.prototype.getMap = function() {
  var mapView = this.newMapView_(false);
  expectEq(this.map_, mapView.getMap());
};


/**
 * When a KML layer's 'viewport' property is defined, zoomToLayer
 * should use it, regardless of whether defaultViewport is present.
 */
MapViewTest.prototype.zoomToKMLLayerModelViewport = function() {
  this.addLayer_({
    id: 'green-tea', type: cm.LayerModel.Type.KML, url: 'http://green-tea.com'
  });
  this.stubVisibleLayerIds_(['green-tea']);

  var overlay = this.expectNew_('google.maps.KmlLayer', {
    url: 'http://green-tea.com',
    preserveViewport: true,
    suppressInfoWindows: true
  });
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  var mapView = this.newMapView_(false);

  // Define the 'viewport' property.
  this.mapModel_.getLayer('green-tea').set(
      'viewport', new cm.LatLonBox(40, 30, -100, -120));
  // Return a non-null defaultViewport.
  var defaultViewport = new google.maps.LatLngBounds();
  stub(overlay.getDefaultViewport)().is(defaultViewport);

  // There is no expected call to fitBounds() since the 'viewport'
  // properties are used.
  expectCall(overlay.setMap)(this.map_);
  mapView.zoomToLayer('green-tea');
};

/**
 * When a GeoRSS layer's 'viewport' property is defined, zoomToLayer
 * should use it, regardless of whether defaultViewport is present.
 */
MapViewTest.prototype.zoomToGeoRSSLayerModelViewport = function() {
  this.addLayer_({
    id: 'guava', type: cm.LayerModel.Type.GEORSS, url: 'http://vanilla.com.au'
  });
  this.stubVisibleLayerIds_(['guava']);

  var overlay = this.expectNew_('google.maps.KmlLayer', _);
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  var mapView = this.newMapView_(false);

  // Define the 'viewport' property.
  this.mapModel_.getLayer('guava').set(
      'viewport', new cm.LatLonBox(30, 40, -80, -100));
  // Return a non-null defaultViewport.
  var defaultViewport = new google.maps.LatLngBounds();
  stub(overlay.getDefaultViewport)().is(defaultViewport);

  // There is no expected call to fitBounds() since the 'viewport'
  // properties are used.
  expectCall(overlay.setMap)(this.map_);
  mapView.zoomToLayer('guava');
};

/**
 * When a layer's 'viewport' property is undefined and defaultViewport is
 * present, zoomToLayer should use it.
 */
MapViewTest.prototype.zoomToLayerDefaultViewport = function() {
  this.addLayer_({
    id: 'chocolate', type: cm.LayerModel.Type.KML, url: 'http://chocolate.com'
  });
  this.stubVisibleLayerIds_(['chocolate']);

  var overlay = this.expectNew_('google.maps.KmlLayer', _);
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  var mapView = this.newMapView_(false);

  // Return non-null defaultViewport for both layers and do not define
  // their 'viewport' properties.
  var defaultViewport = new google.maps.LatLngBounds();
  stub(overlay.getDefaultViewport)().is(defaultViewport);

  // The defaultViewport should be applied.
  expectCall(this.map_.fitBounds)(defaultViewport);
  mapView.zoomToLayer('chocolate');
};

/**
 * When a KML or GeoRSS layer's 'viewport' property is undefined and there is no
 * defaultViewport, test that a listener is set up to apply the defaultViewport
 * when it becomes available.
 */
MapViewTest.prototype.zoomToLayerDefaultViewportNotInitialized =
    function() {
  // Given one visible layer...
  this.addLayer_({
    id: 'vanilla', type: cm.LayerModel.Type.GEORSS, url: 'http://vanilla.com.au'
  });
  this.stubVisibleLayerIds_(['vanilla']);

  // Expect one overlay to be created and added to the map...
  var overlay = this.expectNew_('google.maps.KmlLayer', _);
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);

  // When a new cm.MapView is created.
  var mapView = this.newMapView_(false);

  // If the viewport is undefined and getDefaultViewport returns null,
  // no call to fitBounds is made and a change listener for defaultViewport
  // should be set up on the overlay.
  stub(overlay.getDefaultViewport)().is(null);
  mapView.zoomToLayer('vanilla');

  // If defaultViewport is still null, no call to fitBounds is made.
  cm.events.emit(overlay, 'defaultviewport_changed');

  // Once defaultViewport is not-null, fitBounds is called and the change
  // listener is removed.
  var defaultViewport = new google.maps.LatLngBounds();
  stub(overlay.getDefaultViewport)().is(defaultViewport);
  expectCall(this.map_.fitBounds)(defaultViewport);
  cm.events.emit(overlay, 'defaultviewport_changed');
};

/**
 * For a layer that doesn't support getDefaultViewport, if its model's
 * 'viewport' property is defined, zoomToLayer should use it.
 */
MapViewTest.prototype.zoomToLayerModelViewport = function() {
  this.addLayer_({id: 'chocolate', type: cm.LayerModel.Type.TRAFFIC});
  this.stubVisibleLayerIds_(['chocolate']);

  var overlay = this.expectNew_('google.maps.TrafficLayer');
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  var mapView = this.newMapView_(false);

  // This box just fits in a 800 x 800 window at zoom level 7.
  this.mapModel_.getLayer('chocolate').set(
      'viewport', new cm.LatLonBox(42, 37, -106.5, -115));
  expectCall(overlay.setMap)(this.map_);
  mapView.zoomToLayer('chocolate');
  expectEq(
      new google.maps.LatLng(39.545010848, -110.75), mapView.get('center'));
  expectEq(7, mapView.get('zoom'));

  // This box is just a bit too big for a 800 x 800 window at zoom level 7.
  this.mapModel_.getLayer('chocolate').set(
      'viewport', new cm.LatLonBox(42, 37, -106, -115.5));
  expectCall(overlay.setMap)(this.map_);
  mapView.zoomToLayer('chocolate');
  expectEq(
      new google.maps.LatLng(39.545010848, -110.75), mapView.get('center'));
  expectEq(6, mapView.get('zoom'));
};

/**
 * For a layer that doesn't support getDefaultViewport with an undefined
 * 'viewport' property, zoomToLayer should fall back to the 'full_extent'
 * property.
 */
MapViewTest.prototype.zoomToLayerFullExtent = function() {
  this.addLayer_({id: 'chocolate', type: cm.LayerModel.Type.TRAFFIC});
  this.stubVisibleLayerIds_(['chocolate']);

  var overlay = this.expectNew_('google.maps.TrafficLayer');
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  var mapView = this.newMapView_(false);

  var fullExtent = new cm.LatLonBox(42, 37, -106.5, -115);
  this.mapModel_.getLayer('chocolate').set('full_extent', fullExtent);
  expectCall(this.map_.fitBounds)(fullExtent.toLatLngBounds());
  mapView.zoomToLayer('chocolate');
};

/**
 * Tests visibility of a layer with min and max zoom levels specified
 * when zooming.
 */
MapViewTest.prototype.layerMinMaxZoom = function() {
  this.addLayer_({id: 'chocolate', type: cm.LayerModel.Type.TRAFFIC,
                  min_zoom: 5, max_zoom: 8});
  this.stubVisibleLayerIds_(['chocolate']);

  // The map initializes at zoom level 0, at which the layer isn't visible.
  var overlay = this.expectNew_('google.maps.TrafficLayer');
  stub(overlay.getMap)().is(null);

  var mapView = this.newMapView_(false);

  // The layer should be visible at zoom level 5.
  expectCall(overlay.setMap)(this.map_);
  mapView.set('zoom', 5);

  // Zoom out to level 4.  The overlay should disappear.
  stub(overlay.getMap)().is(this.map_);
  expectCall(overlay.setMap)(null);
  mapView.set('zoom', 4);

  // Zoom in to level 8.  The overlay should appear.
  stub(overlay.getMap)().is(null);
  expectCall(overlay.setMap)(this.map_);
  mapView.set('zoom', 8);

  // Zoom in to level 9.  The overlay should disappear.
  stub(overlay.getMap)().is(this.map_);
  expectCall(overlay.setMap)(null);
  mapView.set('zoom', 9);
};

/** Tests setting the viewport for extreme north/south extents. */
MapViewTest.prototype.matchViewportNorthSouthOutOfRange = function() {
  var mapView = this.newMapView_(false);

  // +Infinity and -Infinity should average to zero.
  mapView.matchViewport(new cm.LatLonBox(90, -90, 180, -180));
  expectEq(0, mapView.get('center').lat());

  // Even though one end is at Infinity, latitude should be clamped.
  mapView.matchViewport(new cm.LatLonBox(90, 0, 180, -180));
  expectThat(mapView.get('center').lat(), isNearNumber(66.513, 1e-3));
};

/** Tests adjusting the viewport based on URI params. */
MapViewTest.prototype.testAdjustViewportFromUri = function() {
  var mapView = this.newMapView_(false);

  // If lat is specified without a valid lng, the viewport should not be set.
  var uri = new goog.Uri('');
  uri.setParameterValue('lat', '20');
  mapView.adjustViewportFromUri(uri);
  expectEq(new google.maps.LatLng(0, 0), mapView.get('center'));
  expectEq(0, mapView.get('zoom'));

  // Center should not update if lat or lng is not a number.
  uri.setParameterValue('lng', 'alpha');
  mapView.adjustViewportFromUri(uri);
  expectEq(new google.maps.LatLng(0, 0), mapView.get('center'));
  expectEq(0, mapView.get('zoom'));

  // With valid lat and lng but no zoom, only the center should be set.
  uri.setParameterValue('lng', '10');
  mapView.adjustViewportFromUri(uri);
  expectEq(new google.maps.LatLng(20, 10), mapView.get('center'));
  expectEq(0, mapView.get('zoom'));

  // Viewport shouldn't be zoomed in if z is not a number.
  uri.setParameterValue('z', 'a');
  mapView.adjustViewportFromUri(uri);
  expectEq(0, mapView.get('zoom'));

  // Viewport should be zoomed in if z is not a number.
  uri.setParameterValue('z', 4);
  mapView.adjustViewportFromUri(uri);
  expectEq(4, mapView.get('zoom'));

  // When llbox does not have four coordinates, viewport should not be set.
  var uri = new goog.Uri('');
  uri.setParameterValue('llbox', '3,2,1');
  mapView.adjustViewportFromUri(uri);
  expectEq(new google.maps.LatLng(20, 10), mapView.get('center'));
  expectEq(4, mapView.get('zoom'));

  // When llbox has non-numeric coordinates, viewport should be untouched.
  uri.setParameterValue('llbox', '3,2,1,a');
  mapView.adjustViewportFromUri(uri);
  expectEq(new google.maps.LatLng(20, 10), mapView.get('center'));
  expectEq(4, mapView.get('zoom'));

  // When llbox has four numeric coordinates, center and zoom should be set.
  uri.setParameterValue('llbox', '3,2,1,0');
  mapView.adjustViewportFromUri(uri);
  expectEq(new google.maps.LatLng(2.50009525643, 0.5), mapView.get('center'));
  expectEq(10, mapView.get('zoom'));
};

/** Test that changing the map's zoom level fires the relevant event. */
MapViewTest.prototype.testZoomChanged = function() {
  var mapView = this.newMapView_(false);
  var eventFiredCorrectly = false;
  cm.events.listen(goog.global, cm.events.ZOOM_CHANGED, function(e) {
    eventFiredCorrectly = goog.isDefAndNotNull(e.zoom);
  });
  mapView.set('zoom', 3);
  expectTrue(eventFiredCorrectly);
};

/** A map with invalid custom style JSON should fall back to an empty style. */
MapViewTest.prototype.testInvalidCustomStyle = function() {
  var mapView = this.newMapView_(false);
  stub(this.mapModel_.get)('base_map_style_name').is('foostylea');

  expectCall(this.map_.setOptions)({mapTypeControlOptions: {
    mapTypeIds: DEFAULT_MAP_TYPE_IDS.concat(['cm.custom']),
    style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
  }});
  var styledMap = this.expectNew_('google.maps.StyledMapType',
      [], {name: 'foostylea'});
  expectCall(this.map_.mapTypes.set)('cm.custom', styledMap);

  stub(this.appState_.get)('map_type').is(cm.MapModel.Type.CUSTOM);
  stub(this.mapModel_.get)('base_map_style').is('{\"invalid\": \"json');
  cm.events.emit(this.mapModel_, 'base_map_style_changed');
};

/** A map with valid custom style JSON should use the custom style. */
MapViewTest.prototype.testValidCustomStyle = function() {
  var mapView = this.newMapView_(false);
  expectCall(this.mapModel_.get)('base_map_style_name')
      .willRepeatedly(returnWith('foostylea'));

  expectCall(this.map_.setOptions)({mapTypeControlOptions: {
    mapTypeIds: DEFAULT_MAP_TYPE_IDS.concat(['cm.custom']),
    style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
  }});
  var styledMap = this.expectNew_('google.maps.StyledMapType',
      [{featureType: 'all', stylers: [{saturation: 10}]}],
      {name: 'foostylea'});
  expectCall(this.map_.mapTypes.set)('cm.custom', styledMap);

  stub(this.appState_.get)('map_type').is(cm.MapModel.Type.CUSTOM);
  stub(this.mapModel_.get)('base_map_style')
      .is('[{"featureType": "all", "stylers": [{"saturation": 10}]}]');
  cm.events.emit(this.appState_, 'map_type_changed');
};

/**
 * A map with custom style JSON, but something other than Type.CUSTOM as the
 * map type, should use the specified map type and ignore the custom styling.
 */
MapViewTest.prototype.testCustomStyleNotActive = function() {
  var mapView = this.newMapView_(false);
  expectCall(this.mapModel_.get)('base_map_style_name')
      .willRepeatedly(returnWith('foostylea'));

  expectEq('foostylea', this.mapModel_.get('base_map_style_name'));
  expectCall(this.map_.setOptions)({mapTypeControlOptions: {
    mapTypeIds: DEFAULT_MAP_TYPE_IDS,
    style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
  }});

  stub(this.appState_.get)('map_type').is(cm.MapModel.Type.SATELLITE);
  cm.events.emit(this.appState_, 'map_type_changed');
};

/** Verifies that the OSM base map option appears when OSM is enabled. */
MapViewTest.prototype.testOsmMapTypeWhenEnabled = function() {
  // The OSM option should be present in the menu...
  var imageMapType = this.expectNew_('google.maps.ImageMapType', _);
  expectCall(this.map_.mapTypes.set)('cm.osm', imageMapType)
      .willOnce(returnWith(null))  // require at least one call
      .willRepeatedly(returnWith(null));
  this.expectedMapTypeControlOptions_.mapTypeControlOptions.mapTypeIds =
      DEFAULT_MAP_TYPE_IDS.concat(['cm.osm']);

  // ...when 'enable_osm_map_type' is set in the cm_config.
  var mapView = this.newMapView_(false, {'enable_osm_map_type': true});

  // When the map_type in the AppState is OSM...
  stub(this.appState_.get)('map_type').is(cm.MapModel.Type.OSM);
  cm.events.emit(this.appState_, 'map_type_changed');

  // ...the map should show the OSM base map.
  expectEq('cm.osm', mapView.get('mapTypeId'));
};

/**
 * Verifies that the OSM option doesn't appear when OSM is not enabled,
 * unless the map's map_type is OSM.
 */
MapViewTest.prototype.testOsmMapTypeWhenDisabled = function() {
  // When OSM is not enabled, OSM should not appear in the map type menu
  // (the default expectedMapTypeControlOptions don't include OSM).
  var mapView = this.newMapView_(false);

  // Then, OSM should appear in the map type menu...
  var imageMapType = this.expectNew_('google.maps.ImageMapType', _);
  expectCall(this.map_.mapTypes.set)('cm.osm', imageMapType);
  expectCall(this.map_.setOptions)({
    mapTypeControlOptions: {
      mapTypeIds: DEFAULT_MAP_TYPE_IDS.concat(['cm.osm']),
      style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
    }
  });

  // ...when the map_type in the AppState is OSM.
  stub(this.appState_.get)('map_type').is(cm.MapModel.Type.OSM);
  cm.events.emit(this.appState_, 'map_type_changed');
};

