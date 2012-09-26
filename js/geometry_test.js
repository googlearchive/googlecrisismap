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

/** An equality function for comparing test results. */
google.maps.LatLng.prototype.gjstestEquals =
    google.maps.LatLng.prototype.equals;

/** An equality function for comparing test results. */
google.maps.LatLngBounds.prototype.gjstestEquals =
    google.maps.LatLngBounds.prototype.equals;

/** An equality function for comparing test results. */
google.maps.Point.prototype.gjstestEquals =
    google.maps.Point.prototype.equals;

function GeometryTest() {
  // This is intended to mock the google.maps.Projection interface, but there
  // is no google.maps.Projection class so we just use a mock function.
  this.projection_ = createMockFunction();
  this.projection_.fromLatLngToPoint = createMockFunction('fromLatLngToPoint');
  this.projection_.fromPointToLatLng = createMockFunction('fromPointToLatLng');
}
registerTestSuite(GeometryTest);

/** Tests the boundingBoxesOverlap() function. */
GeometryTest.prototype.testBoundingBoxesOverlap = function() {
  var quadBox = [new google.maps.Point(2, 1),
                 new google.maps.Point(1, 2),
                 new google.maps.Point(2, 4),
                 new google.maps.Point(3, 3)];
  var low = new google.maps.Point(0, 0);
  var high = new google.maps.Point(0.9, 0.9);
  expectFalse(boundingBoxesOverlap(quadBox, low, high));

  low = new google.maps.Point(1, 1);
  high = new google.maps.Point(2, 2);
  expectTrue(boundingBoxesOverlap(quadBox, 74, 100));
};

/** Tests the intersectEdgeAndTile() function. */
GeometryTest.prototype.testIntersectEdgeAndTile = function() {
  var low = new google.maps.Point(0, 0);
  var high = new google.maps.Point(1, 1);

  // Test segments that do not intersect the bounding box.
  var a = new google.maps.Point(1.1, 0);
  var b = new google.maps.Point(1.1, 0.5);
  expectEq(Overlap.OUTSIDE, intersectEdgeAndTile(a, b, low, high));

  // TODO(romano): fix line-clipping algorithm in intersectEdgeAndTile()
  // so that these pass
  //a = new google.maps.Point(0, 1.1);
  //b = new google.maps.Point(0.5, 1.1);
  //expectEq(Overlap.OUTSIDE, intersectEdgeAndTile(a, b, low, high));

  // Test a segment whose endpoints are both inside the bounding box.
  //a = new google.maps.Point(0.1, 0.1);
  //b = new google.maps.Point(0.9, 0.9);
  //expectEq(Overlap.INSIDE, intersectEdgeAndTile(a, b, low, high));

  // Test a segement with one endpoint inside and one endpoint outside the
  // bounding box.
  a = new google.maps.Point(0.5, 0.5);
  b = new google.maps.Point(1.1, 1.1);
  expectEq(Overlap.INTERSECTING, intersectEdgeAndTile(a, b, low, high));

  // Test a segment that intersects the bounding box but with both
  // endpoints outside of the box.
  a = new google.maps.Point(-1, -1);
  b = new google.maps.Point(2, 2);
  expectEq(Overlap.INTERSECTING, intersectEdgeAndTile(a, b, low, high));
};

/** Tests the intersectQuadAndTile() function. */
GeometryTest.prototype.testIntersectQuadAndTile = function() {
  var quadBox = [new google.maps.Point(2, 1),
                 new google.maps.Point(1, 2),
                 new google.maps.Point(2, 4),
                 new google.maps.Point(3, 3)];
  var low = new google.maps.Point(0, 0);
  var high = new google.maps.Point(1, 1);
  expectEq(Overlap.OUTSIDE, intersectQuadAndTile(quadBox, low, high));

  low = new google.maps.Point(2, 2);
  high = new google.maps.Point(2.2, 2.2);
  expectEq(Overlap.INSIDE, intersectQuadAndTile(quadBox, low, high));

  low = new google.maps.Point(0, 0);
  high = new google.maps.Point(2, 2);
  expectEq(Overlap.INTERSECTING, intersectQuadAndTile(quadBox, low, high));
};

/** Tests the getPolyPoints() function. */
GeometryTest.prototype.testGetPolyPoints = function() {
  var latLngCoords = [new google.maps.LatLng(70, 90),
                      new google.maps.LatLng(72, 90),
                      new google.maps.LatLng(72, 92),
                      new google.maps.LatLng(70, 92)];
  var expectedPointCoords = [new google.maps.Point(192, 57.292825),
                             new google.maps.Point(192, 52.920424),
                             new google.maps.Point(193.422222, 52.920424),
                             new google.maps.Point(193.422222, 57.292825)];
  expectCall(this.projection_.fromLatLngToPoint)(latLngCoords[0])
      .willOnce(returnWith(expectedPointCoords[0]));
  expectCall(this.projection_.fromLatLngToPoint)(latLngCoords[1])
      .willOnce(returnWith(expectedPointCoords[1]));
  expectCall(this.projection_.fromLatLngToPoint)(latLngCoords[2])
      .willOnce(returnWith(expectedPointCoords[2]));
  expectCall(this.projection_.fromLatLngToPoint)(latLngCoords[3])
      .willOnce(returnWith(expectedPointCoords[3]));

  var pointCoords = getPolyPoints(this.projection_, latLngCoords);
  expectThat(pointCoords, elementsAre(expectedPointCoords));
};

/** Tests the getTileRange() function. */
GeometryTest.prototype.testGetTileRange = function() {
  var tileCoord = new google.maps.Point(0, 1);
  var range = getTileRange(tileCoord, 4);
  var expectedRange = [new google.maps.Point(0, 16),
                       new google.maps.Point(16, 32)];
  expectThat(range, elementsAre(expectedRange));
};

/** Tests the getBoundingBox() function. */
GeometryTest.prototype.testGetBoundingBox = function() {
  cm.ui.document = {
    'body': {'offsetWidth': 1000, 'offsetHeight': 1000}
  };
  var latLng = new google.maps.LatLng(50, 50);
  var projectedLatLng = new google.maps.Point(100, 100);
  expectCall(this.projection_.fromLatLngToPoint)(latLng)
      .willOnce(returnWith(projectedLatLng));

  var latLng1 = new google.maps.LatLng(0, 0);
  var latLng2 = new google.maps.LatLng(1, 1);
  expectCall(this.projection_.fromPointToLatLng)(_)
      .willOnce(returnWith(latLng1))
      .willOnce(returnWith(latLng2));
  var boxCoords = getBoundingBox(this.projection_, latLng, 4);
  expectedBoxCoords = [new google.maps.LatLng(0, 0),
                       new google.maps.LatLng(0, 1),
                       new google.maps.LatLng(1, 1),
                       new google.maps.LatLng(1, 0),
                       new google.maps.LatLng(0, 0)];
  expectThat(boxCoords, elementsAre(expectedBoxCoords));
};

/** Tests the getPolyBounds() function. */
GeometryTest.prototype.testGetPolyBounds = function() {
  var coords = [new google.maps.LatLng(0, 0),
                new google.maps.LatLng(0.5, 1),
                new google.maps.LatLng(1, 0.5),
                new google.maps.LatLng(0, 0)];
  var poly = new google.maps.Polygon({paths: coords});
  var bounds = getPolyBounds(poly);
  expectTrue(bounds.contains(new google.maps.LatLng(1, 1)));
  expectFalse(bounds.contains(new google.maps.LatLng(1.1, 1.1)));
};
