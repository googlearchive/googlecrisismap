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
 * @fileoverview An image map type that retries on error.
 * TODO(arb): find a name that doesn't suck...
 */
goog.provide('cm.ProxyTileMapType');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.style');

// How many retries of a tile fetch.
var MAX_RETRIES = 10;

var TRANSPARENT_TILE_REGEXP = /maps\.gstatic\.com\/mapfiles\/transparent\.png/;

/**
 * @class This class implements the MapType interface and
 * is provided for rendering image tiles. Unlike the Maps API ImageMapType,
 * this maptype retries images on error. The WMS/ESRI tile proxying code
 * signals that a tile isn't ready yet with a 417.
 *
 * @param {Object} opts Options for the layer.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.ProxyTileMapType = function(opts) {
  google.maps.MVCObject.call(this);
  this.getTileUrl = /** @type function(google.maps.Point, number):string */(
      opts['getTileUrl']);

  /**
   * A map of tile id: tile div, where 'id' is 'z,x,y'
   * @type Object.<Element>
   * @private
   */
  this.tiles_ = {};

  cm.events.onChange(this, 'opacity', this.updateOpacity_, this);

  /**
   * Maximum zoom of tiles for this maptype.
   * @type number
   * @private
   */
  this.maxZoom_ = opts['maxZoom'] || 19;
  /**
   * Minimum zoom of tiles for this maptype.
   * @type number
   * @private
   */
  this.minZoom_ = opts['minZoom'] || 0;
  /**
   * The tile size of this maptype. (Part of the MapType interface)
   * @type google.maps.Size
   */
  this.tileSize = opts['tileSize'] || new google.maps.Size(256, 256);

};
goog.inherits(cm.ProxyTileMapType, google.maps.MVCObject);


/**
 * Fetch a tile with the given coordinates. We create a div then set up
 * handlers to refresh the tile until it is successfully loaded.
 *
 * @param {google.maps.Point} coord The tile coordinates.
 * @param {number} zoom The zoom level.
 * @param {Document} ownerDocument The document.
 *
 * @return {Element} The freshly painted new div.
 */
cm.ProxyTileMapType.prototype.getTile = function(coord, zoom, ownerDocument) {
  // Create an empty tile div to paint later.
  var tileDiv = cm.ui.create('div');
  // Set tile width and height before painting it.
  tileDiv.style.width = this.tileSize.width + 'px';
  tileDiv.style.height = this.tileSize.height + 'px';

  var tileSrcUrl = this.getTileUrl(coord, zoom);
  if (!tileSrcUrl) {
    return tileDiv;
  }
  var tileCoords = zoom + ',' + coord.x + ',' + coord.y;
  this.tiles_[tileCoords] = tileDiv;

  var tileImg = cm.ui.create('img');
  goog.style.setOpacity(
      tileDiv, /** @type number */(this.get('opacity')));
  tileDiv.appendChild(tileImg);

  tileDiv.tileData = {
    tileSrc: tileSrcUrl,
    tileCoords: tileCoords,
    tilesetId: tileSrcUrl.replace(/^.*\/\.wms\//, '').split('/')[1],
    retries: 0,
    retryTimeout: null,
    startTime: new Date().getTime()
  };


  // TODO(arb): Create an "outstanding tiles" counter, and trigger the loading
  // spinner (b/8755787)

  // Now set up the event handlers.
  cm.events.listen(tileImg, 'load', function(e) {
    // Race condition here - we could be invoked after the tile has been
    // cleaned up. When the tile is painted, getTile() will be called before
    // a 'load' or 'error' event is fired, so we always expect the tile div's
    // data to be valid unless the tile has already been released.
    var tileData = tileDiv.tileData;
    if (!tileData) return;
    // Only log a succesful fetch if the loaded image is not a transparent tile.
    if (!TRANSPARENT_TILE_REGEXP.test(tileImg.src)) {
      cm.Analytics.logTime('wms_tile_fetch', 'retry_' + tileData.retries,
                           new Date().getTime() - tileData.startTime,
                           tileData.tilesetId);
    }
    // TODO(arb): decrement the outstanding tile counter.
    tileData.retryTimeout = null;
  }, this);
  // Set up an error handler
  cm.events.listen(tileImg, 'error', function(e) {
    var tileData = tileDiv.tileData;
    // Race condition here, too.
    if (!tileData) return;
    var retries = tileData.retries;
    if (retries >= MAX_RETRIES) {
      // Set back to an empty tile to avoid the nasty broken image icon.
      tileDiv.firstChild.setAttribute(
          'src', '//maps.gstatic.com/mapfiles/transparent.png');
      return;
    }
    tileData.retries = retries + 1;
    // Set back to an empty tile to avoid the nasty broken image icon.
    tileDiv.firstChild.setAttribute(
        'src', '//maps.gstatic.com/mapfiles/transparent.png');
    // TODO(arb): work out a reasonable retry approach.
    var retryDelay = Math.random() * 1000 * Math.pow(1.5, 2 + retries);
    tileData.retryTimeout = goog.global.setTimeout(function() {
      // You are in a twisty little maze of race conditions, all alike.
      if (!tileData) return;
      // Try to fetch the tile again.
      tileImg.removeAttribute('src');
      tileImg.setAttribute('src', tileData.tileSrc);
    }, retryDelay);
  }, this);

  // Finally, paint the tile.
  // TODO(arb): increment the outstanding tile counter.
  tileImg.setAttribute('src', tileSrcUrl);
  return tileDiv;
};

/**
 * This tile is no longer needed.
 * @param {Element} tileDiv The no-longer needed tile.
 */
cm.ProxyTileMapType.prototype.releaseTile = function(tileDiv) {
  if (tileDiv.tileData) {
    // Only bother with cleanup if we painted the tile.
    if (tileDiv.tileData.retryTimeout) {
      goog.global.clearTimeout(tileDiv.tileData.retryTimeout);
    }
    delete this.tiles_[tileDiv.tileData.tileCoords];
    tileDiv.tileData = null;
    while (tileDiv.firstChild) {
      cm.events.dispose(tileDiv.firstChild);
      tileDiv.removeChild(tileDiv.firstChild);
    }
  }
};

/**
 * Event handler invoked when the 'opacity' attribute is changed.
 * @private
 */
cm.ProxyTileMapType.prototype.updateOpacity_ = function() {
  var opacity = /** @type number */(this.get('opacity'));
  for (var tileCoords in this.tiles_) {
    var tile = /** @type {!Element} */(this.tiles_[tileCoords]);
    goog.style.setOpacity(tile, opacity);
  }
};

// For some reason saying 'implements google.maps.MapType' in the class
// makes jscompiler choke on the constructor. This is b/7395824
goog.exportProperty(cm.ProxyTileMapType.prototype, 'getTile',
                    cm.ProxyTileMapType.prototype.getTile);
goog.exportProperty(cm.ProxyTileMapType.prototype, 'releaseTile',
                    cm.ProxyTileMapType.prototype.releaseTile);
