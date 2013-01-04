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
 *     NOTE(kpy): There are known bugs in intersectQuadAndTile, and nothing
 *     in this file is in the 'cm' namespace.  This file needs an overhaul.
 * @author giencke@google.com (Pete Giencke)
 * @author sraub@google.com (Susannah Raub)
 */

goog.provide('cm.geometry');

goog.require('cm');
goog.require('cm.ui');

/**
 * @enum {number}
 */
var Overlap = {
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
 */
function boundingBoxesOverlap(quad, low, high) {
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
}

/**
 * Intersects the line given by a, b with the rectangle given by low, high.
 * It computes dot products with the normal of the line.
 * Returns OUTSIDE, INSIDE, or INTERSECTING, which specifies the line's
 * relationship to the bounding box.
 * @param {google.maps.Point} a First endpoint of the line.
 * @param {google.maps.Point} b Second endpoint of the line.
 * @param {google.maps.Point} low Minimum (x, y) corner of the rectangle.
 * @param {google.maps.Point} high MAximum (x, y) corner of the rectangle.
 * @return {Overlap} The overlap status (INSIDE, OUTSIDE, or INTERSECTING).
 */
function intersectEdgeAndTile(a, b, low, high) {
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
    return Overlap.OUTSIDE;
  } else if (d_lo_lo > 0 &&
             d_lo_hi > 0 &&
             d_hi_lo > 0 &&
             d_hi_hi > 0) {
    return Overlap.INSIDE;
  } else {
    return Overlap.INTERSECTING;
  }
}

/**
 * Intersects the given quad with the rectangle given by low, high.
 * quad must be a convex, counter-clockwise quadrilateral.
 * Returns OUTSIDE, INSIDE, or INTERSECTING, which specifies the
 * quad's relationship to the bounding box.
 * @param {Array.<google.maps.Point>} quad The 4 vertices of the quadrilateral.
 * @param {google.maps.Point} low Minimum (x, y) corner of the rectangle.
 * @param {google.maps.Point} high Maximum (x, y) corner of the rectangle.
 * @return {Overlap} The overlap status (INSIDE, OUTSIDE, or INTERSECTING).
 */
function intersectQuadAndTile(quad, low, high) {
  if (!boundingBoxesOverlap(quad, low, high)) {
    return Overlap.OUTSIDE;
  }
  var a = intersectEdgeAndTile(quad[0], quad[1], low, high);
  var b = intersectEdgeAndTile(quad[1], quad[2], low, high);
  var c = intersectEdgeAndTile(quad[2], quad[3], low, high);
  var d = intersectEdgeAndTile(quad[3], quad[0], low, high);
  if (a == Overlap.OUTSIDE || b == Overlap.OUTSIDE || c == Overlap.OUTSIDE ||
      d == Overlap.OUTSIDE) {
    return Overlap.OUTSIDE;
  }
  if (a == Overlap.INSIDE && b == Overlap.INSIDE && c == Overlap.INSIDE &&
      d == Overlap.INSIDE) {
    return Overlap.INSIDE;
  }
  return Overlap.INTERSECTING;
}

/**
 * @param {google.maps.Projection} projection The projection to convert these
 *     LatLngs to points.
 * @param {Array.<google.maps.LatLng>} path An array of four LatLngs.
 * @return {Array.<google.maps.Point>} The four projected points.
 */
function getPolyPoints(projection, path) {
  return [
    projection.fromLatLngToPoint(path[0]),
    projection.fromLatLngToPoint(path[1]),
    projection.fromLatLngToPoint(path[2]),
    projection.fromLatLngToPoint(path[3])
  ];
}

/**
 * @param {number} x The tile x coordinate.
 * @param {number} y The tile y coordinate.
 * @param {number} zoom The zoom level.
 * @return {Array.<google.maps.Point>} The minimum and maximum (x, y) corners
 *     of the rectangular region covered by the specified tile.
 */
function getTileRange(x, y, zoom) {
  var z = Math.pow(2, zoom);

  /**
   * @param {number} dx An x offset in tile coordinates.
   * @param {number} dy A y offset in tile coordinates.
   * @return {google.maps.Point} The point at the given tile coordinates.
   */
  function p(dx, dy) {
    return new google.maps.Point((x + dx) * 256 / z,
                                 (y + dy) * 256 / z);
  }

  return [p(0, 0), p(1, 1)];
}

/**
 * Creates a rough bounding box based upon layer x, y, and z.
 * @param {google.maps.Projection} projection A projection.
 * @param {google.maps.LatLng} latLng The center of the box.
 * @param {number} zoom The zoom level.
 * @return {Array.<google.maps.LatLng>} The four corners of the box.
 */
function getBoundingBox(projection, latLng, zoom) {
  // A magical number which helps make the viewport a bit bigger
  var SCALE_FACTOR = 1.1;
  var w = cm.ui.document.body.offsetWidth;
  var h = cm.ui.document.body.offsetHeight;
  var xy = projection.fromLatLngToPoint(latLng);
  var scale = Math.pow(2, zoom * SCALE_FACTOR);
  var llx = xy.x - w / scale;
  var lly = xy.y + h / scale;
  var urx = xy.x + w / scale;
  var ury = xy.y - h / scale;
  var ll = projection.fromPointToLatLng(new google.maps.Point(llx, lly));
  var ur = projection.fromPointToLatLng(new google.maps.Point(urx, ury));

  var polyCoords = [
      new google.maps.LatLng(ll.lat(), ll.lng()),
      new google.maps.LatLng(ll.lat(), ur.lng()),
      new google.maps.LatLng(ur.lat(), ur.lng()),
      new google.maps.LatLng(ur.lat(), ll.lng()),
      new google.maps.LatLng(ll.lat(), ll.lng())
  ];
  return polyCoords;
}

/**
 * @param {google.maps.Polygon} poly A polygon.
 * @return {google.maps.LatLngBounds} A set of bounds enclosing the polygon.
 */
function getPolyBounds(poly) {
  var bounds = new google.maps.LatLngBounds();
  var paths = poly.getPaths();
  var path;
  for (var p = 0; p < paths.getLength(); p++) {
    path = paths.getAt(p);
    for (var i = 0; i < path.getLength(); i++) {
      bounds.extend(path.getAt(i));
    }
  }
  return bounds;
}
