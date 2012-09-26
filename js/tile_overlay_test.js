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
  this.appState_ = new google.maps.MVCObject();
  expectCall(this.map_.getProjection)().willRepeatedly(returnWith({}));
}
TileOverlayTest.prototype = new cm.TestBase();
registerTestSuite(TileOverlayTest);

/** Tests the default constructor. */
TileOverlayTest.prototype.testConstructorDefault = function() {
  var tileOverlay = new cm.TileOverlay(this.layer_, this.map_, this.appState_);
};

/** Tests the constructor for an indexed tile. */
TileOverlayTest.prototype.testConstructorTileIndex = function() {
  this.layer_.set('url_is_tile_index', true);

  var tileIndexFetcher = this.expectNew_('goog.net.Jsonp', _);
  expectCall(tileIndexFetcher.send)(null, _);

  var tileOverlay = new cm.TileOverlay(this.layer_, this.map_, this.appState_);
};

/** Tests whether opacity changes according to the application state model. */
TileOverlayTest.prototype.testOpacityChange = function() {
  this.layer_.set('id', 'layer0');
  this.appState_.set('layer_opacities', {'layer0': '77'});
  var tileOverlay = new cm.TileOverlay(this.layer_, this.map_, this.appState_);

  // Initialize this.mapType_.
  tileOverlay.tileUrlPattern_ = 'abc.com';
  var imageMap = this.expectNew_('google.maps.ImageMapType', _);
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

  var tileOverlay = new cm.TileOverlay(this.layer_, this.map_, this.appState_);
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

/** Tests the tile fetcher when the 'url_is_tile_index' property of the
 *  layer is toggled.
 */
TileOverlayTest.prototype.toggleUrlIsTileIndex = function() {
  var tileOverlay = new cm.TileOverlay(this.layer_, this.map_, this.appState_);
  expectThat(this.layer_.get('time'), isNull);

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
