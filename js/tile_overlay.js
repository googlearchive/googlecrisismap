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
 * @fileoverview A custom map overlay rendered from image tiles.
 * @author giencke@google.com (Pete Giencke)
 * @author sraub@google.com (Susannah Raub)
 */
goog.provide('cm.TileOverlay');

goog.require('cm');
goog.require('cm.AppState');
goog.require('cm.LatLonBox');
goog.require('cm.LayerModel');
goog.require('cm.events');
goog.require('cm.geometry');
goog.require('goog.Uri');
goog.require('goog.net.Jsonp');

var JSON_PROXY_URL = '/crisismap/jsonp';

// Period to refresh the dynamic tile index json.
var INDEX_REFRESH_PERIOD_MS = 180000; // 3 min

// Period to wait for tiles to load before swapping in a new tile url.
var MAX_TILE_LOAD_MS = 2000; // 2s

/**
 * A map overlay which displays tiles and a bounding box.  It wraps an
 * ImageMapType and defines the same interface as KmlLayer, namely setMap.
 * @param {cm.LayerModel} layer The layer model.
 * @param {google.maps.Map} map The map on which to display this tile layer.
 * @param {cm.AppState} appState The application state model.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.TileOverlay = function(layer, map, appState) {
  google.maps.MVCObject.call(this);

  /**
   * @type {cm.AppState}
   * @private
   */
  this.appState_ = appState;

  /**
   * @type {google.maps.Map}
   * @private
   */
  this.map_ = map;

  /**
   * @type {google.maps.ImageMapType}
   * @private
   */
  this.mapType_ = null;

  /**
   * Tracks whether or not this layer is currently displayed on the map.
   * @type {boolean}
   * @private
   */
  this.onMap_ = false;

  /**
   * Tracks the last time tiles were loaded for the current viewport.
   * @type {number}
   * @private
   */
  this.lastTilesLoadedMs_ = 0;

  /**
   * The bounds of this map.  Initialized in init_().
   * @type {google.maps.LatLngBounds}
   * @private
   */
  this.bounds_ = new google.maps.LatLngBounds();

  /**
   * The URL pattern for requesting tiles.
   * Convention is for a URL like http://foo/{X}_{Y}_{Z}.jpg
   * where {X}, {Y}, and {Z} are replaced dynamically.
   * @type {?string}
   * @private
   */
  this.tileUrlPattern_ = null;

  /**
   * The new tile url pattern to use when the current set of tiles
   * has finished loading.  This helps prevent a viewport from containing
   * tiles from tile sets at different epochs.
   * @type {?string}
   * @private
   */
  this.nextTileUrlPattern_ = null;

  /**
   * If the url is a tile index, this is the cross-domain channel from
   * which to fetch tile index updates for periodic refreshing.
   * @type {?goog.net.Jsonp}
   * @private
   */
  this.tileIndexFetcher_ = null;

  /**
   * Interval ID for canceling the tile index refresh.
   * @type {?number}
   * @private
   */
  this.intervalId_ = null;

  /**
   * The object used to cancel the tile index request.
   * @type {?Object}
   * @private
   */
  this.requestDescriptor_ = null;

  /**
   * @type {cm.LayerModel}
   * @private
   */
  this.layerModel_ = layer;

  var isHybrid = /** @type boolean */(layer.get('is_hybrid'));
  this.bindTo('url', layer);
  this.bindTo('url_is_tile_index', layer);

  var viewport = /** @type cm.LatLonBox */(layer.get('viewport')) ||
      cm.LatLonBox.ENTIRE_MAP;

  // To be populated if bounds are specified
  var bounds = null;
  var minZoom = NaN;
  var maxZoom = NaN;

  var layerBounds = layer.get('bounds');
  if (layerBounds) {
    bounds = /** @type {string} */(layerBounds['coords']);
    minZoom = parseInt(layerBounds['min_zoom'], 10);
    maxZoom = parseInt(layerBounds['max_zoom'], 10);

    if (layerBounds['display_bounds']) {
      /**
       * A polygon that is rendered around the imagery for better
       * discoverability.
       * @type {google.maps.Polygon}
       * @private
       */
      this.outline_ = new google.maps.Polygon(
          /** @type {google.maps.PolygonOptions} */({
        fillOpacity: 0,
        strokeColor: '#ff0000',
        strokeWeight: 1,
        clickable: false
      }));
    }
  }

  cm.events.onChange(this, 'url_is_tile_index', this.updateTileUrlPattern_);
  this.updateTileUrlPattern_();

  var me = this;
  // Wait for the map's projection object to be ready and then finish
  // initialization.
  /**
   * @return {boolean} Returns true if initialization was completed.
   * @this {cm.TileOverlay}
   * @private
   */
  this.finishInitialization_ = function() {
    // NOTE(user): We only support the initial map's projection.  If the map's
    // projection changes, we would need to refresh everything - including the
    // imagery.
    var projection = map.getProjection();
    // We can finish init if we have a both a projection and a tile url pattern.
    // We may not have a tile url pattern if we have a url index not yet loaded.
    var canFinish = !!projection && !!this.tileUrlPattern_;
    if (canFinish) {
       me.init_(projection, viewport, bounds, minZoom, maxZoom, isHybrid);
      // Check if setMap(map) has been called before initialization, and add the
      // map type to the map at this time.
      if (me.onMap_) {
        me.map_.overlayMapTypes.push(me.mapType_);
      }
    }
    return canFinish;
  };

  if (!this.finishInitialization_()) {
    var token = cm.events.listen(map, 'projection_changed', function() {
      // We may still not be able to finish at this point if we don't
      // have a tile url, but in that case we can stop listening for projection
      // changes and finish init in refreshTileIndex_.
      if (this.finishInitialization_() || !this.tileUrlPattern_) {
        cm.events.unlisten(token, this);
      }
    }, this);
  }
};
goog.inherits(cm.TileOverlay, google.maps.MVCObject);

/**
 * @param {google.maps.Projection} projection The map's projection object.
 * @param {cm.LatLonBox} viewport The layer's viewport.
 * @param {?string} bounds The layer's bounds, as a string.
 * @param {number} minZoom The minimum zoom level at which tiles are available.
 * @param {number} maxZoom The maximum zoom level at which tiles are available.
 * @param {boolean} isHybrid If true, transparent tiles should be loaded around
 *     the border of this tile layer.
 * @private
 */
cm.TileOverlay.prototype.init_ = function(projection, viewport, bounds,
      minZoom, maxZoom, isHybrid) {
  // The polygon coordinates that define the default viewport to zoom to,
  // the optional outline to draw on the map for discoverability, and
  // the region to intersect with the tile coordinates when determining
  // what tiles to fetch.
  var polyCoords;
  if (bounds) {
    polyCoords = cm.TileOverlay.normalizeCoords(bounds);
    for (var i = 0; i < polyCoords.length; ++i) {
      this.bounds_.extend(polyCoords[i]);
    }
  } else {
    // Until MapRoot layers include something akin to a 'bounds' field,
    // use the viewport as a poor approximation for avoiding unnecessary
    // tile requests. Since we still use the intersect functions in
    // geometry.js, the polygon coordinates must be provided in
    // counter-clockwise order.
    polyCoords = [
      new google.maps.LatLng(viewport.getSouth(), viewport.getWest()),
      new google.maps.LatLng(viewport.getSouth(), viewport.getEast()),
      new google.maps.LatLng(viewport.getNorth(), viewport.getEast()),
      new google.maps.LatLng(viewport.getNorth(), viewport.getWest()),
      new google.maps.LatLng(viewport.getSouth(), viewport.getWest())
    ];
    // For tile layers with no explicit bounds, set this to null so
    // that getDefaultViewport() returns null.
    this.bounds_ = null;
  }

  this.mapType_ = this.initializeImageMapType_(
      projection, polyCoords, minZoom, maxZoom, isHybrid);
  cm.events.onChange(this.appState_, 'layer_opacities', this.updateOpacity_,
                     this);
  this.updateOpacity_();
  if (this.outline_) {
    this.outline_.setPath(polyCoords);
  }
};

/**
 * Updates the layer opacity according to the application state model.
 * @private
 */
cm.TileOverlay.prototype.updateOpacity_ = function() {
  var opacities = this.appState_.get('layer_opacities') || {};
  var id = this.layerModel_.get('id');
  this.mapType_.set('opacity', id in opacities ? opacities[id] / 100 : 1.0);
};

/**
 * Converts the coordinates string into an array of LatLngs.
 * @param {string} coordString String in the format "lng1,lat1 lng2,lat2".
 * @return {Array.<google.maps.LatLng>} An array of LatLngs.
 */
cm.TileOverlay.normalizeCoords = function(coordString) {
  var outputCoordArray = [];
  var splitSpaces = String(coordString).split(' ');
  var splitSpace;
  for (splitSpace in splitSpaces) {
    var splitCommas = splitSpaces[splitSpace].split(',');
    var lng = splitCommas[0];
    var lat = splitCommas[1];
    if (lat != undefined && lng != undefined) {
      outputCoordArray.push(new google.maps.LatLng(parseFloat(lat),
                                                   parseFloat(lng)));
    }
  }
  return outputCoordArray;
};

/**
 * @param {google.maps.Projection} projection The map's projection for computing
 *     point coordinates to LatLngs.
 * @param {Array.<google.maps.LatLng>} polyCoords The coordinates of the poly
 *     for detecting what's inside and outside the imagery.
 * @param {number} minZoom The minimum zoom level at which tiles are available.
 * @param {number} maxZoom The maximum zoom level at which tiles are available.
 * @param {boolean} isHybrid If true, the file extension is replaced with .png
 *     along the edge and .jpg inside so that the border tiles are transparent
 *     and the inside tiles are compressed well.
 * @return {google.maps.ImageMapType} The image map type object.
 * @private
 */
cm.TileOverlay.prototype.initializeImageMapType_ = function(
    projection, polyCoords, minZoom, maxZoom, isHybrid) {
  var me = this;
  var mapTypeOptions = {
    getTileUrl: function(coord, zoom) {
      me.lastTilesLoadedMs_ = new Date().getTime();
      var tileUrl = me.tileUrlPattern_;
      if (!tileUrl) return null;

      if (!isNaN(minZoom) && zoom < minZoom ||
          !isNaN(maxZoom) && zoom > maxZoom) {
        return null;
      }

      var corners = getTileRange(coord, zoom);
      var low = corners[0];
      var high = corners[1];
      var polyVertices = getPolyPoints(projection, polyCoords);
      var intersect = intersectQuadAndTile(polyVertices, low, high);
      if (intersect == Overlap.OUTSIDE) {
        // Returning null will cause no tile to be displayed.
        return null;
      }

      var newUrl = tileUrl;
      // convention is that a maptile url of type:
      // http://foo/{X}_{Y}_{Z}.jpg will be provided
      // replace with actual values for each request
      newUrl = newUrl.replace(/{X}/, coord.x);
      newUrl = newUrl.replace(/{Y}/, coord.y);
      newUrl = newUrl.replace(/{Z}/, zoom);
      if (isHybrid) {
        newUrl = newUrl.replace(
            /\.\w*$/, intersect == Overlap.INTERSECTING ? '.png' : '.jpg');
      }
      if (coord.x % 2 == 1) {
        newUrl = newUrl.replace('mw1.google.com', 'mw2.google.com');
      }
      return newUrl;
    },
    tileSize: new google.maps.Size(256, 256)
  };

  return new google.maps.ImageMapType(mapTypeOptions);
};

/**
 * Handles refreshing the tile index url.
 * @private
 */
cm.TileOverlay.prototype.refreshTileIndex_ = function() {
  if (!this.tileIndexFetcher_) {
    return;
  }
  this.requestDescriptor_ = this.tileIndexFetcher_.send(
      null, goog.bind(this.handleTileIndex_, this));
};

/**
 * Handles the callback that results from loading the tile index url in
 * refreshTileIndex_.
 * @param {Object} indexJson The new index JSON.
 * @private
 */
cm.TileOverlay.prototype.handleTileIndex_ = function(indexJson) {
  // Throw away any responses lingering after the layer has been changed
  // to a tile index.
  if (!this.get('url_is_tile_index')) {
    return;
  }

  var activeTileset = indexJson ? indexJson['active_tileset'] : null;
  if (!activeTileset) {
    return;
  }

  var updateTime = activeTileset['update_time'];
  this.layerModel_.set('time', updateTime);

  var newTilesetUrl = activeTileset['url'];
  if (!this.tileUrlPattern_) {
    // First time loading, check if we need to finish init
    this.tileUrlPattern_ = newTilesetUrl;
    this.finishInitialization_();
  } else {
    this.nextTileUrlPattern_ = newTilesetUrl;
    this.updateIndexedTileUrlPattern_();
  }
};

/**
 * Updates tileUrlPattern_ depending on whether the URL is a tile index.
 * @private
 */
cm.TileOverlay.prototype.updateTileUrlPattern_ = function() {
  if (this.get('url_is_tile_index')) {
    var uri = new goog.Uri(JSON_PROXY_URL);
    uri.setParameterValue('url', this.get('url'));
   this.tileIndexFetcher_ = new goog.net.Jsonp(uri);

    // Refresh the tile index every so often to pick up changes
    this.intervalId_ = goog.global.setInterval(
        goog.bind(this.refreshTileIndex_, this), INDEX_REFRESH_PERIOD_MS);
    // Refresh the first time
    this.refreshTileIndex_();
  } else {
    goog.global.clearInterval(this.intervalId_);
    this.intervalId_ = null;
    if (this.requestDescriptor_) {
      this.tileIndexFetcher_.cancel(this.requestDescriptor_);
    }
    this.tileIndexFetcher_ = null;
    this.requestDescriptor_ = null;
    this.nextTileUrlPattern_ = null;
    this.layerModel_.set('time', null);
    this.tileUrlPattern_ = /** @type string */(this.get('url'));
  }
};

/**
 * Updates tileUrlPattern_, redrawing the layer if there is an update.
 * @private
 */
cm.TileOverlay.prototype.updateIndexedTileUrlPattern_ = function() {
  if (!this.nextTileUrlPattern_) {
    return;
  }

  if (new Date().getTime() - this.lastTilesLoadedMs_ < MAX_TILE_LOAD_MS) {
    // Tiles are loading, wait until activity stops to swap in a new tile url.
    // Note we do this rather than listening for the map's tilesloaded event
    // because tilesloaded does not fire when only image overlay tiles change.
    goog.global.setTimeout(goog.bind(this.updateIndexedTileUrlPattern_, this),
                           MAX_TILE_LOAD_MS);
  } else {
    var isUpdate = this.nextTileUrlPattern_ != this.tileUrlPattern_;
    this.tileUrlPattern_ = this.nextTileUrlPattern_;
    this.nextTileUrlPattern_ = null;
    // Only redraw the layer if it's toggled on and there is an update.
    if (isUpdate && this.onMap_) {
      this.setMap(null);
      this.setMap(this.map_);
    }
  }
};

/**
 * @param {google.maps.Map} map The map to show this tile layer on.  This
 *     parameter is actually ignored, as a TileOverlay can only be shown on the
 *     map on which it was initialized.
 */
cm.TileOverlay.prototype.setMap = function(map) {
  var mapType = this.mapType_;
  if (map && !this.onMap_) {
    this.map_.overlayMapTypes.push(mapType);
  } else if (!map && this.onMap_) {
    var index = null;
    this.map_.overlayMapTypes.forEach(function(overlay, i) {
      if (overlay == mapType) {
        index = i;
      }
    });
    if (index != null) {
      this.map_.overlayMapTypes.removeAt(
          /** @type {number} */ (index));
    }
  }
  if (this.outline_) {
    this.outline_.setMap(map);
  }
  this.onMap_ = !!map;
};

/**
 * @return {google.maps.Map} Returns the map on which this TileOverlay is
 *     displayed, or null if it is not showing.
 */
cm.TileOverlay.prototype.getMap = function() {
  return this.onMap_ ? this.map_ : null;
};

/**
 * Returns the LatLngBounds object that shows the entire tile layer.  When the
 * user clicks on the "Zoom to" link, the map is fit to this bounds.
 * @return {google.maps.LatLngBounds} The layer's bounds.
 */
cm.TileOverlay.prototype.getDefaultViewport = function() {
  return this.bounds_;
};
