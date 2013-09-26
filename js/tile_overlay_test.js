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

// Author: romano@google.com (Raquel Romano)

function TileOverlayTest() {
  cm.TestBase.call(this);
  this.map_ = this.expectNew_('google.maps.Map');
  this.layer_ = new google.maps.MVCObject();
  this.layer_.set('id', 'layer0');
  this.layer_.getSourceAddress = function() { return 'XYZ:xyz'; };
  this.appState_ = new google.maps.MVCObject();
  this.metadataModel_ = new cm.MetadataModel();
  this.config_ = {
    json_proxy_url: '/root/.jsonp',
    wms_configure_url: '/root/.wms/configure',
    wms_tiles_url: '/root/.wms/tiles'
  };

  this.projection_ = {};
  stub(this.map_.getProjection)().is(this.projection_);
  this.setForTest_('cm.geometry.computeOverlap', createMockFunction());
}
TileOverlayTest.prototype = new cm.TestBase();
registerTestSuite(TileOverlayTest);

/**
 * Creates a cm.TileOverlay for testing.
 * @return {cm.TileOverlay} A new cm.TileOverlay.
 * @private
 */
TileOverlayTest.prototype.createTileOverlay_ = function() {
  return new cm.TileOverlay(this.layer_, this.map_, this.appState_,
                            this.metadataModel_, this.config_);
};

/** Tests the default constructor. */
TileOverlayTest.prototype.testConstructorDefault = function() {
  var tileOverlay = this.createTileOverlay_();
};

/** Tests the constructor for a tile index. */
TileOverlayTest.prototype.testConstructorTileIndex = function() {
  this.layer_.set('url_is_tile_index', true);
  var tileIndexFetcher = this.expectNew_('goog.net.Jsonp', _);
  var jsonCallback = null;
  tileIndexFetcher.send = function(_, callback) { jsonCallback = callback; };
  var tileOverlay = this.createTileOverlay_();

  // Simulate retrieval of the tile index JSON.
  jsonCallback({'active_tileset': {'update_time': 1234567890}});
  expectEq(1234567890, this.metadataModel_.getUpdateTime(this.layer_));
};

/** Tests whether opacity changes according to the application state model. */
TileOverlayTest.prototype.testOpacityChange = function() {
  this.layer_.set('id', 'layer0');
  this.appState_.set('layer_opacities', {'layer0': '77'});
  var tileOverlay = this.createTileOverlay_();

  // Initialize this.mapType_.
  tileOverlay.tileUrlPattern_ = 'abc.com';
  var imageMap = this.expectNew_('cm.ProxyTileMapType', _);
  expectCall(imageMap.set)('opacity', 0.77);
  cm.events.emit(this.map_, 'projection_changed');
};

/**
 * Verifies the fix for a bug in which a tile index layer that was toggled off
 * would reappear automatically when the underlying tile set was updated.  This
 * tests that the layer is not redrawn when the layer is not checked on.
 */
TileOverlayTest.prototype.redrawWhileLayerIsActiveOnly = function() {
  this.layer_.set('url_is_tile_index', true);

  var tileIndexFetcher = this.expectNew_('goog.net.Jsonp', _);
  expectCall(tileIndexFetcher.send)(null, _);

  var tileOverlay = this.createTileOverlay_();
  tileOverlay.tileUrlPattern_ = 'http://old.tileset.url';
  tileOverlay.nextTileUrlPattern_ = 'http://new.tileset.url';
  tileOverlay.lastTilesLoadedMs_ = 0;
  tileOverlay.onMap_ = false;

  var setMapCalled = false;
  tileOverlay.setMap = function(map) {
    setMapCalled = true;
  };

  tileOverlay.updateIndexedTileUrlPattern_();
  expectFalse(setMapCalled);

  tileOverlay.tileUrlPattern_ = 'http://old.tileset.url';
  tileOverlay.nextTileUrlPattern_ = 'http://new.tileset.url';
  tileOverlay.lastTilesLoadedMs_ = 0;
  tileOverlay.onMap_ = true;

  tileOverlay.updateIndexedTileUrlPattern_();
  expectTrue(setMapCalled);
};

/**
 * Tests the tile fetcher when the 'url_is_tile_index' property of the
 * layer is toggled.
 */
TileOverlayTest.prototype.toggleUrlIsTileIndex = function() {
  var tileOverlay = this.createTileOverlay_();

  // Turning on tile indexing should trigger the fetcher.
  var tileIndexFetcher = this.expectNew_('goog.net.Jsonp', _);
  var requestDescriptor = {};
  stub(tileIndexFetcher.send)(null, _).is(requestDescriptor);
  this.layer_.set('url_is_tile_index', true);

  // Turning it on again should do nothing.
  this.layer_.set('url_is_tile_index', true);

  // Turning off tile indexing should cancel the fetcher.
  expectCall(tileIndexFetcher.cancel)(requestDescriptor);
  this.layer_.set('url_is_tile_index', false);

  // Turning it off again should do nothing.
  this.layer_.set('url_is_tile_index', false);
};

/**
 * Tests addressing for Google tile coordinates.
 * Reference: https://developers.google.com/maps/documentation/javascript/
 *     maptypes#TileCoordinates
 */
TileOverlayTest.prototype.testGoogleTileAddressing = function() {
  this.layer_.set('url', 'http://google.tileset.url/{Z}/{X}/{Y}.png');
  var tileOverlay = this.createTileOverlay_();
  expectCall(cm.geometry.computeOverlap)(this.projection_, _, 3, 6, 4);
  var url = tileOverlay.getTileUrl_(new google.maps.Point(3, 6), 4);
  expectEq('http://google.tileset.url/4/3/6.png', url);
};

/**
 * Tests addressing for Bing tile coordinates.
 * Reference: http://msdn.microsoft.com/en-us/library/bb259689.aspx
 */
TileOverlayTest.prototype.testBingTileAddressing = function() {
  this.layer_.set('tile_coordinate_type',
                  cm.LayerModel.TileCoordinateType.BING);
  this.layer_.set('url', 'http://bing.tileset.url');
  var tileOverlay = this.createTileOverlay_();
  expectCall(cm.geometry.computeOverlap)(this.projection_, _, 3, 6, 4);
  var url = tileOverlay.getTileUrl_(new google.maps.Point(3, 6), 4);
  expectEq('http://bing.tileset.url/0231', url);
};

/**
 * Tests addressing for TMS tile coordinates.
 */
TileOverlayTest.prototype.testTMSTileAddressing = function() {
  this.layer_.set('url', 'http://tms.tileset.url/{Z}/{X}/{Y}');
  this.layer_.set('tile_coordinate_type',
                  cm.LayerModel.TileCoordinateType.TMS);
  var tileOverlay = this.createTileOverlay_();
  expectCall(cm.geometry.computeOverlap)(this.projection_, _, 3, 6, 4);
  var url = tileOverlay.getTileUrl_(new google.maps.Point(3, 6), 4);
  expectEq('http://tms.tileset.url/4/3/9', url);
};

/** Tests WMS tile url pattern updates. */
TileOverlayTest.prototype.updateWmsTileUrlPattern = function() {
  this.layer_.set('url', 'http://wms.service.url');
  this.layer_.set('type', cm.LayerModel.Type.WMS);
  var tileOverlay = this.createTileOverlay_();

  var newTilesetId = 'afd4b44574318c291c30160c9249ae99';
  tileOverlay.set('wms_tileset_id', newTilesetId);
  expectEq('/root/.wms/tiles/' + newTilesetId + '/{Z}/{X}/{Y}.png',
           tileOverlay.tileUrlPattern_);
};

/**
 * Sets up expectations for querying the WMS cache server.
 * @param {string} params The GET query parameters to expect.
 * @param {string} tilesetId The tileset ID to return.
 * @private
 */
TileOverlayTest.prototype.expectWmsQuery_ = function(params, tilesetId) {
  var jsonp = this.expectNew_('goog.net.Jsonp', '/root/.wms/configure');
  expectCall(jsonp.send)(params, _).willOnce(
      function(_, callback) { callback(tilesetId); });
};

/** Tests WMS tileset ID updates. */
TileOverlayTest.prototype.updateWmsTilesetId = function() {
  this.layer_.set('url', 'http://wms.service.url');
  this.layer_.set('wms_layers', ['wms_layer_1', 'wms_layer_2']);
  this.layer_.set('type', cm.LayerModel.Type.WMS);

  // When the TileOverlay is constructed, the server should be queried to
  // ensure it is configured with the tileset ID.
  this.expectWmsQuery_({
      'server_url': 'http://wms.service.url',
      'projection': 'EPSG:3857',
      'layers': 'wms_layer_1,wms_layer_2'
  }, 'deadbeef');
  var tileOverlay = this.createTileOverlay_();
  expectEq('deadbeef', tileOverlay.get('wms_tileset_id'));

  // When the WMS layers change, the server should be configured with the new
  // tileset ID.
  this.expectWmsQuery_({
      'server_url': 'http://wms.service.url',
      'projection': 'EPSG:3857',
      'layers': 'wms_layer_3,wms_layer_4'
  }, 'abad1dea');
  this.layer_.set('wms_layers', ['wms_layer_3', 'wms_layer_4']);
  expectEq('abad1dea', tileOverlay.get('wms_tileset_id'));
};

/** Tests tile fetching for WMS layers with bounding box metadata. */
TileOverlayTest.prototype.testWmsTileFetching = function() {
  this.layer_.set('type', cm.LayerModel.Type.WMS);
  this.layer_.getSourceAddress = function() {
    return 'WMS:http://wms.service.url';
  };
  this.layer_.set('wms_layers', ['wms_layer_1']);
  var tileOverlay = this.createTileOverlay_();
  tileOverlay.set('wms_tileset_id', 'abc');

  this.metadataModel_.set(
      'WMS:http://wms.service.url',
      {'wms_layers':
       {'wms_layer_1': {'minx': -110, 'maxx': -90, 'miny': 10, 'maxy': 30},
        'wms_layer_2': {'minx': -10, 'maxx': 10, 'miny': 50, 'maxy': 60}}});
  expectCall(cm.geometry.computeOverlap)(
      this.projection_, [new google.maps.LatLng(10, -110),
                         new google.maps.LatLng(10, -90),
                         new google.maps.LatLng(30, -90),
                         new google.maps.LatLng(30, -110),
                         new google.maps.LatLng(10, -110)],
      0, 1, 2);
  tileOverlay.getTileUrl_(new google.maps.Point(0, 1), 2);

  tileOverlay.set('wms_layers', ['wms_layer_2']);
  expectCall(cm.geometry.computeOverlap)(
      this.projection_, [new google.maps.LatLng(50, -10),
                         new google.maps.LatLng(50, 10),
                         new google.maps.LatLng(60, 10),
                         new google.maps.LatLng(60, -10),
                         new google.maps.LatLng(50, -10)],
      1, 1, 2);
  tileOverlay.getTileUrl_(new google.maps.Point(1, 1), 2);
};
