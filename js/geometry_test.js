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
  var ul = new google.maps.Point(0, 0);
  var lr = new google.maps.Point(0.9, 0.9);
  expectFalse(boundingBoxesOverlap(quad, ul, lr));

  ul = new google.maps.Point(1, 1);
  lr = new google.maps.Point(2, 2);
  expectTrue(boundingBoxesOverlap(quad, 74, 100));
};

/** Tests the edgeTileOverlap() function. */
GeometryTest.prototype.testIntersectEdgeAndTile = function() {
  var ul = new google.maps.Point(0, 0);
  var lr = new google.maps.Point(1, 1);

  // Test segments that do not intersect the bounding box.
  var a = new google.maps.Point(1.1, 0);
  var b = new google.maps.Point(1.1, 0.5);
  expectEq(Overlap.OUTSIDE, edgeTileOverlap(a, b, ul, lr));

  // TODO(romano): fix line-clipping algorithm in edgeTileOverlap()
  // so that these pass
  //a = new google.maps.Point(0, 1.1);
  //b = new google.maps.Point(0.5, 1.1);
  //expectEq(Overlap.OUTSIDE, edgeTileOverlap(a, b, ul, lr));

  // Test a segment whose endpoints are both inside the bounding box.
  //a = new google.maps.Point(0.1, 0.1);
  //b = new google.maps.Point(0.9, 0.9);
  //expectEq(Overlap.INSIDE, edgeTileOverlap(a, b, ul, lr));

  // Test a segement with one endpoint inside and one endpoint outside the
  // bounding box.
  a = new google.maps.Point(0.5, 0.5);
  b = new google.maps.Point(1.1, 1.1);
  expectEq(Overlap.INTERSECTING, edgeTileOverlap(a, b, ul, lr));

  // Test a segment that intersects the bounding box but with both
  // endpoints outside of the box.
  a = new google.maps.Point(-1, -1);
  b = new google.maps.Point(2, 2);
  expectEq(Overlap.INTERSECTING, edgeTileOverlap(a, b, ul, lr));
};

/** Tests the quadTileOverlap() function. */
GeometryTest.prototype.testQuadTileOverlap = function() {
  var quad = [new google.maps.Point(2, 1),
              new google.maps.Point(1, 2),
              new google.maps.Point(2, 4),
              new google.maps.Point(3, 3)];
  var ul = new google.maps.Point(0, 0);
  var lr = new google.maps.Point(1, 1);
  expectEq(Overlap.OUTSIDE, quadTileOverlap(quad, ul, lr));

  ul = new google.maps.Point(2, 2);
  lr = new google.maps.Point(2.2, 2.2);
  expectEq(Overlap.INSIDE, quadTileOverlap(quad, ul, lr));

  ul = new google.maps.Point(0, 0);
  lr = new google.maps.Point(2, 2);
  expectEq(Overlap.INTERSECTING, quadTileOverlap(quad, ul, lr));
};

/** Tests the applyProjection() function. */
GeometryTest.prototype.testapplyProjection = function() {
  var latLngCoords = [new google.maps.LatLng(70, 90),
                      new google.maps.LatLng(72, 90),
                      new google.maps.LatLng(72, 92),
                      new google.maps.LatLng(70, 92)];
  var expected = [new google.maps.Point(192, 57.292825),
                  new google.maps.Point(192, 52.920424),
                  new google.maps.Point(193.422222, 52.920424),
                  new google.maps.Point(193.422222, 57.292825)];
  goog.array.forEach(latLngCoords, function(latLng, index) {
    expectCall(this.projection_.fromLatLngToPoint)(latLng)
        .willOnce(returnWith(expected[index]));
  }, this);
  expectThat(applyProjection(this.projection_, latLngCoords),
             elementsAre(expected));
};

/** Tests the getTileRange() function. */
GeometryTest.prototype.testGetTileRange = function() {
  var range = getTileRange(0, 1, 4);
  expectThat(range, elementsAre([new google.maps.Point(0, 16),
                                 new google.maps.Point(16, 32)]));
};

/** Tests the getBoundingBox() function. */
GeometryTest.prototype.testGetBoundingBox = function() {
  this.setForTest_('cm.ui.document', {
    'body': {'offsetWidth': 1000, 'offsetHeight': 1000}
  });
  var latLng = new google.maps.LatLng(50, 50);
  expectCall(this.projection_.fromLatLngToPoint)(latLng)
      .willOnce(returnWith(new google.maps.Point(100, 100)));
  expectCall(this.projection_.fromPointToLatLng)(_)
      .willOnce(returnWith(new google.maps.LatLng(0, 0)))
      .willOnce(returnWith(new google.maps.LatLng(1, 1)));

  var boxCoords = getBoundingBox(this.projection_, latLng, 4);
  expectThat(boxCoords, elementsAre([new google.maps.LatLng(0, 0),
                                     new google.maps.LatLng(0, 1),
                                     new google.maps.LatLng(1, 1),
                                     new google.maps.LatLng(1, 0),
                                     new google.maps.LatLng(0, 0)]));
};
