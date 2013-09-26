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
 * @fileoverview Geometry functions for managing polygons and tile bounds.
 *     TODO(romano): Replace this file since there are known bugs in
 *     edgeTileOverlap_ (b/7979024).
 * @author giencke@google.com (Pete Giencke)
 */
goog.provide('cm.geometry');

goog.require('cm');
goog.require('cm.ui');
goog.require('goog.array');

/**
 * @type {Object}
 */
cm.geometry = {};

/**
 * Overlap types, used by TileOverlay to determine whether to fetch a tile, and
 * whether the request should be for a transparent tile.
 * @enum {number}
 */
cm.geometry.Overlap = {
  OUTSIDE: 0,
  INSIDE: 1,
  INTERSECTING: 2
};

/**
 * Tests whether the bounding boxes of the quad and the rectangle given by
 * low, high overlap.
 * @param {Array.<google.maps.Point>} quad The bounding box of a quadrangle.
 * @param {google.maps.Point} low The bottom-left of a rectangle.
 * @param {google.maps.Point} high The top-right of the rectangle.
 * @return {boolean} True if the boxes overlap.
 * @private
 */
cm.geometry.boundingBoxesOverlap_ = function(quad, low, high) {
  if (quad[0].x < low.x &&
      quad[1].x < low.x &&
      quad[2].x < low.x &&
      quad[3].x < low.x) {
    return false;
  }
  if (quad[0].y < low.y &&
      quad[1].y < low.y &&
      quad[2].y < low.y &&
      quad[3].y < low.y) {
    return false;
  }
  if (quad[0].x > high.x &&
      quad[1].x > high.x &&
      quad[2].x > high.x &&
      quad[3].x > high.x) {
    return false;
  }
  if (quad[0].y > high.y &&
      quad[1].y > high.y &&
      quad[2].y > high.y &&
      quad[3].y > high.y) {
    return false;
  }
  return true;
};

/**
 * Intersects the line segment (a, b) with the tile defined by the coordinates
 * low and high. It computes dot products with the normal of the line.
 * Returns the overlap type (see computeOverlap() for details).
 * @param {google.maps.Point} a First endpoint of the line.
 * @param {google.maps.Point} b Second endpoint of the line.
 * @param {google.maps.Point} low Tile corner with minimum lat/lng coordinates.
 * @param {google.maps.Point} high Tile corner with maximum lat/lng coordinates.
 * @return {cm.geometry.Overlap} The overlap type.
 * @private
 */
cm.geometry.edgeTileOverlap_ = function(a, b, low, high) {
  var nx = b.y - a.y;
  var ny = a.x - b.x;
  var d = nx * a.x + ny * a.y;
  var d_lo_lo = nx * low.x + ny * low.y - d;
  var d_lo_hi = nx * low.x + ny * high.y - d;
  var d_hi_lo = nx * high.x + ny * low.y - d;
  var d_hi_hi = nx * high.x + ny * high.y - d;
  if (d_lo_lo < 0 &&
      d_lo_hi < 0 &&
      d_hi_lo < 0 &&
      d_hi_hi < 0) {
    return cm.geometry.Overlap.OUTSIDE;
  } else if (d_lo_lo > 0 &&
             d_lo_hi > 0 &&
             d_hi_lo > 0 &&
             d_hi_hi > 0) {
    return cm.geometry.Overlap.INSIDE;
  } else {
    return cm.geometry.Overlap.INTERSECTING;
  }
};

/**
 * Returns the type of overlap between a convex quadrilateral and a tile with
 * the given tile corner coordinates. The quadrilateral vertices must be
 * specified in counter-clockwise order. See computeOverlap() for an
 * explanation of the return values.
 * @param {Array.<google.maps.Point>} quad The convex quadrilateral vertices
 *   in counter-clockwise order.
 * @param {google.maps.Point} low Tile corner with minimum lat/lng coordinates.
 * @param {google.maps.Point} high Tile corner with maximum lat/lng coordinates.
 * @return {cm.geometry.Overlap} The type of overlap.
 * @private
 */
cm.geometry.quadTileOverlap_ = function(quad, low, high) {
  if (!cm.geometry.boundingBoxesOverlap_(quad, low, high)) {
    return cm.geometry.Overlap.OUTSIDE;
  }
  var a = cm.geometry.edgeTileOverlap_(quad[0], quad[1], low, high);
  var b = cm.geometry.edgeTileOverlap_(quad[1], quad[2], low, high);
  var c = cm.geometry.edgeTileOverlap_(quad[2], quad[3], low, high);
  var d = cm.geometry.edgeTileOverlap_(quad[3], quad[0], low, high);
  if (a == cm.geometry.Overlap.OUTSIDE ||
      b == cm.geometry.Overlap.OUTSIDE ||
      c == cm.geometry.Overlap.OUTSIDE ||
      d == cm.geometry.Overlap.OUTSIDE) {
    return cm.geometry.Overlap.OUTSIDE;
  }
  if (a == cm.geometry.Overlap.INSIDE &&
      b == cm.geometry.Overlap.INSIDE &&
      c == cm.geometry.Overlap.INSIDE &&
      d == cm.geometry.Overlap.INSIDE) {
    return cm.geometry.Overlap.INSIDE;
  }
  return cm.geometry.Overlap.INTERSECTING;
};

/**
 * Applies the projection to the array of lat-lng coordinates.
 * @param {google.maps.Projection} projection The map projection.
 * @param {Array.<google.maps.LatLng>} latlngs An array of lat/lng
 *     coordinates to project.
 * @return {Array.<google.maps.Point>} The projected points.
 * @private
 */
cm.geometry.applyProjection_ = function(projection, latlngs) {
  return goog.array.map(latlngs, function(latlng) {
    return projection.fromLatLngToPoint(latlng);
  });
};

/**
 * Returns the type of overlap between a quadrilateral and a tile in world
 * coordinates, after applying the given projection to the quadrilateral
 * vertices. The quadrilateral is expected to be convex, and the vertices
 * given in counter-clockwise order.
 * The overlap types have the following meanings:
 *   OUTSIDE: The tile and quadrilateral areas do not overlap.
 *   INTERSECTING: The quadrilateral area overlaps with the tile area, including
 *     the case where the quadrilateral lies completely within the tile, but
 *     excluding the case where the tile lies completely within the
 *     quadrilateral.
 *   INSIDE: The tile lies completely within the quadrilateral (but not vice
 *     versa). When the quadrilateral is within the tile, the overlap is
 *     considered intersecting because this information is used to determine
 *     whether to request a transparent PNG tile.

 * @param {google.maps.Projection} projection The map projection.
 * @param {Array.<google.maps.LatLng>} latLngs An array of lat/lng
 *     coordinates to project.
 * @param {number} x The tile's x-coordinate.
 * @param {number} y The tile's y-coordinate.
 * @param {number} zoom The tile's zoom level.
 * @return {cm.geometry.Overlap} The overlap type.
 */
cm.geometry.computeOverlap = function(projection, latLngs, x, y, zoom) {
  // Compute the world coordinates of the tile's upper-left and
  // lower-right corners.
  var z = Math.pow(2, zoom);
  var low = new google.maps.Point(x * 256 / z, y * 256 / z);
  var high = new google.maps.Point((x + 1) * 256 / z, (y + 1) * 256 / z);
  return cm.geometry.quadTileOverlap_(cm.geometry.applyProjection_(
      projection, latLngs), low, high);
};
