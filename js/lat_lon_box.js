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
 * @fileoverview A box defined by a north/south latitude extent and an
 *     east/west longitude extent.  cm.LatLonBox can represent a zero-size box
 *     containing a single point, and can also represent a box that covers the
 *     full globe without losing track of the east/west extents.  Includes
 *     methods specialized for converting to/from the center and zoom values
 *     in Google Maps, which uses a spherical Mercator projection that scales
 *     the world to a 256-by-256-pixel square at zoom level 0.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.LatLonBox');

goog.require('cm');
goog.require('cm.util');
goog.require('goog.math');

// NOTE(kpy): The reason we aren't just using a google.maps.MVCObject or a
// google.maps.LatLngBounds is that this has to be immutable so it can be a
// listenable property of a MapModel or LayerModel.  google.maps.LatLngBounds
// also cannot represent 360-degree-wide boxes in a center-preserving fashion.

/**
 * An immutable representation of a box defined by a north/south latitude
 * extent and an east/west longitude extent.  The representation is normalized
 * so that two cm.LatLonBoxes are equal if and only if their extents are equal
 * and their longitude span (lonSpan) fields are equal.  The east and west
 * extents are normalized so that -180 <= west < 180 and -180 <= east <= 180.
 * lonSpan can range from 0 to 360 degrees:
 *   - If east = west, lonSpan can be 0 or 360.
 *   - If east != west, lonSpan is always equal to east - west.
 *   - If lonSpan = 360, either east = west or (east, west) = (180, -180).
 * @param {number} north The latitude of the north extent, in degrees.
 * @param {number} south The latitude of the south extent, in degrees.
 * @param {number} east The longitude of the east extent, in degrees.
 * @param {number} west The longitude of the west extent, in degrees.
 * @param {boolean=} opt_allowZeroLonSpan If true, interpret east = west as a
 *     0-degree-wide box.  Otherwise, east = west gives a 360-degree-wide box.
 * @constructor
 */
cm.LatLonBox = function(north, south, east, west, opt_allowZeroLonSpan) {
  /**
   * @type {number}
   * @private
   */
  this.north_ = goog.math.clamp(north, -90, 90);

  /**
   * @type {number}
   * @private
   */
  this.south_ = goog.math.clamp(south, -90, 90);

  /**
   * @type {number}
   * @private
   */
  this.east_ = east;

  /**
   * @type {number}
   * @private
   */
  this.west_ = west;

  /**
   * @type {number}
   * @private
   */
  this.lonSpan_;

  // Ensure that north >= south.
  if (north < south) {
    this.north_ = this.south_ = 0;
  }

  // To avoid rounding error, don't touch west if it's already in range.
  if (west < -180 || west >= 180) {
    this.west_ = west % 360;
    this.west_ += (this.west_ < -180 ? 360 : this.west_ >= 180 ? -360 : 0);
  }
  if (east === west && opt_allowZeroLonSpan) {
    // lonSpan can be zero only if east = west and zero is explicitly allowed.
    this.east_ = this.west_;
    this.lonSpan_ = 0;
  } else {
    // To avoid rounding error, don't touch east if it's already in range.
    if (east < -180 || east > 180) {
      this.east_ = east % 360;
      this.east_ += (this.east_ < -180 ? 360 : this.east_ > 180 ? -360 : 0);
    }
    this.lonSpan_ = this.east_ - this.west_;
    this.lonSpan_ += (this.lonSpan_ <= 0) ? 360 : 0;  // zero is not allowed

    // We make a special case for a box 360 degrees wide with extents on the
    // 180-degree meridian, just because it's so common.  We always normalize
    // it to (east, west) = (180, -180), never (-180, -180) or (180, 180).
    if (this.lonSpan_ === 360 && this.west_ === -180) {
      this.east_ = 180;
    }
  }
};

/** The Earth's radius in meters, assuming a spherical Earth. */
cm.LatLonBox.EARTH_RADIUS_M = 6378137;

/**
 * The latitude at the north edge of a square that's 360 degrees wide and
 * centered on the equator in a Mercator projection.  This is the maximum
 * latitude visible on Google Maps tiles, which is 128 pixels north of the
 * equator on Google Maps at zoom level 0.  (We subtract 1e-14 to compensate
 * for numerical error that causes cm.util.latToY(cm.LatLonBox.MAX_LATITUDE) to
 * exceed 128; we'd rather have it be just slightly less than 128 so that the
 * level-0 tile fits in 256 x 256, rather than being bigger than 256 x 256.)
 */
cm.LatLonBox.MAX_LATITUDE = cm.util.yToLat(128) - 1e-14;  // about 85.051128

/** A box containing the entire map surface that's visible in Google Maps. */
cm.LatLonBox.ENTIRE_MAP = new cm.LatLonBox(
    cm.LatLonBox.MAX_LATITUDE, -cm.LatLonBox.MAX_LATITUDE, 180, -180);

/**
 * @param {google.maps.LatLngBounds} latLngBounds A LatLngBounds object.
 * @return {cm.LatLonBox} The bounds converted to a cm.LatLonBox object.
 */
cm.LatLonBox.fromLatLngBounds = function(latLngBounds) {
  var ne = latLngBounds.getNorthEast();
  var sw = latLngBounds.getSouthWest();
  // We set opt_allowZeroLonSpan to true because a LatLngBounds can represent
  // a box 0 degrees wide.  LatLngBounds can also represent a box with
  // (east, west) at (180, -180), but no other boxes 360 degrees wide.
  return new cm.LatLonBox(ne.lat(), sw.lat(), ne.lng(), sw.lng(), true);
};

/**
 * @param {google.maps.LatLng} mercatorCenter A center point.
 * @param {number} zoom A Google Maps zoom level (an integer).
 * @param {number} width A box width in pixels.
 * @param {number} height A box height in pixels.
 * @return {cm.LatLonBox} The geographic boundaries of a box of the specified
 *     size at the specified zoom level with mercatorCenter at its center,
 *     or null if mercatorCenter or zoom contained a NaN.
 */
cm.LatLonBox.fromCenterAndZoom = function(mercatorCenter, zoom, width, height) {
  var widthAtZoom0 = Math.min(Math.pow(2, -zoom) * width, 256);
  var heightAtZoom0 = Math.pow(2, -zoom) * height;

  var yCenter = cm.util.latToY(mercatorCenter.lat());
  var lonCenter = mercatorCenter.lng();
  if (isNaN(widthAtZoom0 + heightAtZoom0 + yCenter + lonCenter)) {
    return null;
  }
  return new cm.LatLonBox(cm.util.yToLat(yCenter + heightAtZoom0 / 2),
                          cm.util.yToLat(yCenter - heightAtZoom0 / 2),
                          lonCenter + (360 * widthAtZoom0 / 256) / 2,
                          lonCenter - (360 * widthAtZoom0 / 256) / 2);
};

/**
 * @param {string} str A string of 4 numbers in the form "north,south,east,west"
 *     for a positive-width box or "north,south,east,west,0" for a 0-width box.
 * @return {cm.LatLonBox} A box constructed from the given numbers, or null
 *     if the string was not correctly formatted.
 */
cm.LatLonBox.fromString = function(str) {
  var p = str.split(',');
  var north = p[0] - 0, south = p[1] - 0, east = p[2] - 0, west = p[3] - 0;
  if (isFinite(north + south + east + west)) {
    return new cm.LatLonBox(north, south, east, west, p[4] === '0');
  }
  return null;
};

/**
 * @param {Object} box A MapRoot LatLonAltBox.
 * @return {cm.LatLonBox} The box converted to a cm.LatLonBox object, or null
 *     if the box didn't contain numeric north, south, east, west fields.
 */
cm.LatLonBox.fromMapRoot = function(box) {
  box = box || {};
  if (!isFinite(box['north'] + box['south'] + box['east'] + box['west'])) {
    return null;
  }
  // In MapRoot, a box with east = west is 360 degrees wide, so we don't
  // set opt_allowZeroLonSpan.
  return new cm.LatLonBox(box['north'], box['south'], box['east'], box['west']);
};

/**
 * @param {cm.LatLonBox} other A cm.LatLonBox to compare this one to.
 * @return {boolean} True if the two boxes are identical.
 */
cm.LatLonBox.prototype.equals = function(other) {
  return this.north_ === other.north_ && this.south_ === other.south_ &&
      this.east_ === other.east_ && this.west_ === other.west_ &&
      this.lonSpan_ === other.lonSpan_;
};

/** @return {number} Latitude of the north extent, always >= -90 and <= 90. */
cm.LatLonBox.prototype.getNorth = function() {
  return this.north_;
};

/** @return {number} Latitude of the south extent, always >= -90 and <= 90. */
cm.LatLonBox.prototype.getSouth = function() {
  return this.south_;
};

/** @return {number} Longitude of the east extent, always >= -180 and <= 180. */
cm.LatLonBox.prototype.getEast = function() {
  return this.east_;
};

/** @return {number} Longitude of the west extent, always >= -180 and < 180. */
cm.LatLonBox.prototype.getWest = function() {
  return this.west_;
};

/**
 * @return {number} Span between east and west, always >= 0 and <= 360.
 *     east = west implies lonSpan = 0 or 360; lonSpan = 0 implies east = west.
 *     However, due to FP error, lonSpan = 360 does not imply east = west.
 */
cm.LatLonBox.prototype.getLonSpan = function() {
  return this.lonSpan_;
};

/**
 * Converts this box to a string of comma-separated numbers.
 * @return {string} A string of 4 numbers in the form "north,south,east,west"
 *     for a positive-width box or "north,south,east,west,0" for a 0-width box.
 */
cm.LatLonBox.prototype.toString = function() {
  return [this.north_, this.south_, this.east_, this.west_].join(',') +
      (this.lonSpan_ === 0 ? ',0' : '');
};

/** @return {google.maps.LatLngBounds} This box converted to a LatLngBounds. */
cm.LatLonBox.prototype.toLatLngBounds = function() {
  var sw = new google.maps.LatLng(this.south_, this.west_);
  var ne = new google.maps.LatLng(this.north_, this.east_);
  if (this.east_ === this.west_ && this.lonSpan_ > 0) {
    // 360-degree-wide boxes (except for -180, 180) are not representable by
    // LatLngBounds; the best we can do is to search for the LatLngBounds with
    // the maximum possible width.  Alas, setting east to the floating-point
    // number just less than west will not do, because LatLngBounds thinks the
    // interval (east, west) = (0, 1e-14) has size 0 even though east < west!
    for (var epsilon = 1; true; epsilon /= 2) {
      var candidate = new google.maps.LatLng(this.north_, this.east_ - epsilon);
      if (candidate.lng() === this.west_) {  // epsilon is too small
        break;
      }
      ne = candidate;
    }
  }
  return new google.maps.LatLngBounds(sw, ne);
};

/**
 * Converts this box to its MapRoot representation.
 * @return {Object} This box as a MapRoot LatLonAltBox (with no altitude).
 */
cm.LatLonBox.prototype.toMapRoot = function() {
  var east = this.east_;
  if (this.lonSpan_ === 0) {
    // 0-degree-wide boxes are not representable in MapRoot; the best we can
    // do is to find the floating-point number just larger than east.
    for (var epsilon = 1; east + epsilon / 2 > east; epsilon /= 2) {}
    east += epsilon;
  }
  return {
    'north': this.north_,
    'south': this.south_,
    'east': east,
    'west': this.west_
  };
};

/**
 * @param {boolean} opt_clampLat If this is set, the center will be computed
 *     using north and south extents adjusted to lie within +/- MAX_LATITUDE.
 * @return {google.maps.LatLng} The point that would appear at the center
 *     of this box in a Mercator projection (e.g. in Google Maps).
 */
cm.LatLonBox.prototype.getMercatorCenter = function(opt_clampLat) {
  var lonCenter = this.west_ + this.lonSpan_ / 2;
  var maxLat = opt_clampLat ? cm.LatLonBox.MAX_LATITUDE : 90;
  var north = goog.math.clamp(this.north_, -maxLat, maxLat);
  var south = goog.math.clamp(this.south_, -maxLat, maxLat);
  if (north === maxLat && south === -maxLat) {
    var latCenter = 0;  // halfway between y = Infinity and y = -Infinity
  } else {
    var latCenter = cm.util.yToLat(
        (cm.util.latToY(north) + cm.util.latToY(south)) / 2);
  }
  return new google.maps.LatLng(latCenter, lonCenter);
};

/**
 * Finds the maximum Google Maps zoom level at which a given box would fit in
 * a window of the specified pixel size.  The result is always at least 0, even
 * if the box is too large to fit in the window at zoom level 0, but the result
 * can be arbitrarily large if the box is arbitrarily small.
 * @param {number} windowWidth A window width in pixels.
 * @param {number} windowHeight A window height in pixels.
 * @param {boolean} opt_clampLat If this is set, the zoom level will be found
 *     using north and south extents adjusted to lie within +/- MAX_LATITUDE.
 * @return {number} The Google Maps zoom level (see details above).
 */
cm.LatLonBox.prototype.getZoomLevel = function(
    windowWidth, windowHeight, opt_clampLat) {
  // Width of this box in pixels if displayed at zoom level 0.
  // At zoom level 0, a 360-degree longitude span fits in a 256-pixel square.
  var boxWidthAtZoom0 = 256 * this.lonSpan_ / 360;

  // Height of this box in pixels if displayed at zoom level 0.
  var maxLat = opt_clampLat ? cm.LatLonBox.MAX_LATITUDE : 90;
  var north = goog.math.clamp(this.north_, -maxLat, maxLat);
  var south = goog.math.clamp(this.south_, -maxLat, maxLat);
  var boxHeightAtZoom0 = cm.util.latToY(north) - cm.util.latToY(south);

  // Magnification factor at which the box would just fit in the window.
  var scaleFactor = Math.min(windowWidth / boxWidthAtZoom0,
                             windowHeight / boxHeightAtZoom0);

  // Maximum zoom level is measured in powers of 2.
  return Math.max(0, Math.floor(Math.log(scaleFactor) / Math.log(2)));
};

/**
 * Rounds the extents of this box to a given number of digits of precision.
 * @param {number} precision The number of digits of precision to use.
 * @return {cm.LatLonBox} Another box with rounded values for the extents.
 */
cm.LatLonBox.prototype.round = function(precision) {
  var span = Math.min(this.north_ - this.south_, this.lonSpan_);
  var decimals = precision - 1 - Math.floor(Math.log(span) / Math.log(10));
  if (decimals < -1) {
    // It doesn't make sense to round any coarser than multiples of ten,
    // because 100 does not divide evenly into a 360-degree circle.
    decimals = -1;
  }
  return new cm.LatLonBox(cm.util.round(this.north_, decimals),
                          cm.util.round(this.south_, decimals),
                          cm.util.round(this.east_, decimals),
                          cm.util.round(this.west_, decimals));
};

/** @return {number} The approximate north-south span of the box in meters. */
cm.LatLonBox.prototype.getNorthSouthMeters = function() {
  var PI = Math.PI;
  return cm.LatLonBox.EARTH_RADIUS_M * (this.north_ - this.south_) * PI / 180;
};

/**
 * @return {number} The approximate east-west span of the box in meters,
 *     measured at the latitude halfway between the north and south edges.
 */
cm.LatLonBox.prototype.getEastWestMeters = function() {
  var PI = Math.PI;
  var latCenter = (this.north_ + this.south_) / 2;
  var radius = cm.LatLonBox.EARTH_RADIUS_M * Math.cos(latCenter * PI / 180);
  return radius * (this.lonSpan_ * PI / 180);
};
