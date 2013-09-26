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

  this.projection_ = createMockFunction();
  this.projection_.fromLatLngToPoint = createMockFunction('fromLatLngToPoint');
  this.projection_.fromPointToLatLng = createMockFunction('fromPointToLatLng');
  expectCall(this.map_.getProjection)().willRepeatedly(
      returnWith(this.projection_));
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
  expectCall(tileIndexFetcher.send)(null, _)
      .willRepeatedly(returnWith(requestDescriptor));
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

  var boundingBox = [new google.maps.LatLng(0, 0),
                     new google.maps.LatLng(0, 0),
                     new google.maps.LatLng(0, 0),
                     new google.maps.LatLng(0, 0),
                     new google.maps.LatLng(0, 0)];
  expectCall(this.projection_.fromLatLngToPoint)(_)
      .willRepeatedly(returnWith({}));
  var url = tileOverlay.getTileUrl_(boundingBox, false,
                                    new google.maps.Point(3, 6), 4);
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

  var boundingBox = [new google.maps.LatLng(0, 0),
                     new google.maps.LatLng(0, 0),
                     new google.maps.LatLng(0, 0),
                     new google.maps.LatLng(0, 0),
                     new google.maps.LatLng(0, 0)];
  expectCall(this.projection_.fromLatLngToPoint)(_)
      .willRepeatedly(returnWith({}));

  var url = tileOverlay.getTileUrl_(boundingBox, false,
                                    new google.maps.Point(3, 6), 4);
  expectEq('http://bing.tileset.url/0231', url);
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
 * @param {string} postArgs The POST arguments.
 * @param {string} tilesetId The unique tileset ID.
 * @private
 */
TileOverlayTest.prototype.expectWmsQuery_ = function(postArgs, tilesetId) {
  expectCall(goog.net.XhrIo.send)(_, _, 'POST', postArgs)
      .willOnce(function(url, callback) {
          callback({'target': {
            'isSuccess': function() { return true; },
            'getResponseJson': function() { return tilesetId; }
          }});
      });
};

/** Tests WMS tileset ID updates. */
TileOverlayTest.prototype.updateWmsTilesetId = function() {
  this.setForTest_('goog.net.XhrIo.send', createMockFunction());
  this.layer_.set('url', 'http://wms.service.url');
  this.layer_.set('wms_layers', ['wms_layer_1', 'wms_layer_2']);
  this.layer_.set('type', cm.LayerModel.Type.WMS);

  // When the TileOverlay is constructed, the server is queried to
  // ensure it is configured with the tilesetId.
  this.expectWmsQuery_('server_url=http%3A%2F%2Fwms.service.url' +
      '&projection=EPSG%3A3857&layers=wms_layer_1%2Cwms_layer_2',
      'c6df7a8fab3e8e170f92dec4b306780c');
  var tileOverlay = this.createTileOverlay_();
  expectEq('c6df7a8fab3e8e170f92dec4b306780c',
           tileOverlay.get('wms_tileset_id'));

  // When the WMS layers change, the server is configured with the new
  // tileset ID.
  this.expectWmsQuery_('server_url=http%3A%2F%2Fwms.service.url' +
      '&projection=EPSG%3A3857&layers=wms_layer_3%2Cwms_layer_4',
      '6bfc119f4a743a349dca77d684d34349');
  this.layer_.set('wms_layers', ['wms_layer_3', 'wms_layer_4']);
  expectEq('6bfc119f4a743a349dca77d684d34349',
           tileOverlay.get('wms_tileset_id'));
};
