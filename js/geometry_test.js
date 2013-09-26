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
 * @fileoverview Tests geometry.js.
 * @author romano@google.com (Raquel Romano)
 */

/** @constructor */
function GeometryTest() {
  cm.TestBase.call(this);

  // This is intended to mock the google.maps.Projection interface, but there
  // is no google.maps.Projection class so we just use a mock function.
  this.projection_ = createMockFunction();
  this.projection_.fromLatLngToPoint = createMockFunction('fromLatLngToPoint');
  this.projection_.fromPointToLatLng = createMockFunction('fromPointToLatLng');
}
GeometryTest.prototype = new cm.TestBase();
registerTestSuite(GeometryTest);

/** Tests the boundingBoxesOverlap() function. */
GeometryTest.prototype.testBoundingBoxesOverlap = function() {
  var quad = [new google.maps.Point(2, 1),
              new google.maps.Point(1, 2),
              new google.maps.Point(2, 4),
              new google.maps.Point(3, 3)];
  var low = new google.maps.Point(0, 0);
  var high = new google.maps.Point(0.9, 0.9);
  expectFalse(cm.geometry.boundingBoxesOverlap_(quad, low, high));

  low = new google.maps.Point(1, 1);
  high = new google.maps.Point(2, 2);
  expectTrue(cm.geometry.boundingBoxesOverlap_(quad, 74, 100));
};

/** Tests the edgeTileOverlap() function. */
GeometryTest.prototype.testIntersectEdgeAndTile = function() {
  var low = new google.maps.Point(0, 0);
  var high = new google.maps.Point(1, 1);

  // Test segments that do not intersect the bounding box.
  var a = new google.maps.Point(1.1, 0);
  var b = new google.maps.Point(1.1, 0.5);
  expectEq(cm.geometry.Overlap.OUTSIDE,
           cm.geometry.edgeTileOverlap_(a, b, low, high));

  // TODO(romano): fix line-clipping algorithm in edgeTileOverlap_
  // so that these pass
  //a = new google.maps.Point(0, 1.1);
  //b = new google.maps.Point(0.5, 1.1);
  //expectEq(cm.geometry.Overlap.OUTSIDE,
  //         cm.geometry.edgeTileOverlap_(a, b, low, high));

  // Test a segment whose endpoints are both inside the bounding box.
  //a = new google.maps.Point(0.1, 0.1);
  //b = new google.maps.Point(0.9, 0.9);
  //expectEq(cm.geometry.Overlap.INSIDE,
  //         cm.geometry.edgeTileOverlap_(a, b, low, high));

  // Test a segement with one endpoint inside and one endpoint outside the
  // bounding box.
  a = new google.maps.Point(0.5, 0.5);
  b = new google.maps.Point(1.1, 1.1);
  expectEq(cm.geometry.Overlap.INTERSECTING,
           cm.geometry.edgeTileOverlap_(a, b, low, high));

  // Test a segment that intersects the bounding box but with both
  // endpoints outside of the box.
  a = new google.maps.Point(-1, -1);
  b = new google.maps.Point(2, 2);
  expectEq(cm.geometry.Overlap.INTERSECTING,
           cm.geometry.edgeTileOverlap_(a, b, low, high));
};

/** Tests the quadTileOverlap() function. */
GeometryTest.prototype.testQuadTileOverlap = function() {
  var quad = [new google.maps.Point(2, 1),
              new google.maps.Point(1, 2),
              new google.maps.Point(2, 4),
              new google.maps.Point(3, 3)];
  var low = new google.maps.Point(0, 0);
  var high = new google.maps.Point(1, 1);
  expectEq(cm.geometry.Overlap.OUTSIDE,
           cm.geometry.quadTileOverlap_(quad, low, high));

  low = new google.maps.Point(2, 2);
  high = new google.maps.Point(2.2, 2.2);
  expectEq(cm.geometry.Overlap.INSIDE,
           cm.geometry.quadTileOverlap_(quad, low, high));

  low = new google.maps.Point(0, 0);
  high = new google.maps.Point(2, 2);
  expectEq(cm.geometry.Overlap.INTERSECTING,
           cm.geometry.quadTileOverlap_(quad, low, high));
};
