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

// Author: kpy@google.com (Ka-Ping Yee)

function LatLonBoxTest() {
  cm.TestBase.call(this);
}
LatLonBoxTest.prototype = new cm.TestBase();
registerTestSuite(LatLonBoxTest);


/**
 * A matcher for the five internal components of a cm.LatLonBox.
 * @param {number} north The expected north latitude.
 * @param {number} south The expected north latitude.
 * @param {number} east The expected east longitude.
 * @param {number} west The expected west longitude.
 * @param {number} opt_lonSpan The expected longitude span.  If unspecified,
 *     the expectation is that lonSpan == east - west.
 * @param {number} opt_tolerance The amount of numerical deviation to allow.
 *     If not specified, requires an exact match.
 * @return {gjstest.Matcher} A cm.LatLonBox matcher that matches the four
 *     extents of the box within a tolerance of opt_tolerance.
 */
function isBox(north, south, east, west, opt_lonSpan, opt_tolerance) {
  var tolerance = opt_tolerance || 0;
  var lonSpan = goog.isNumber(opt_lonSpan) ? opt_lonSpan : east - west;
  var description = [north, south, east, west, lonSpan] +
      (tolerance > 0 ? ' within ' + tolerance : '');
  return new gjstest.Matcher(
    'north, south, east, west, lonSpan == ' + description,
    'north, south, east, west, lonSpan != ' + description,
    function(box) {
      return Math.abs(box.getNorth() - north) <= tolerance &&
          Math.abs(box.getSouth() - south) <= tolerance &&
          Math.abs(box.getEast() - east) <= tolerance &&
          Math.abs(box.getWest() - west) <= tolerance &&
          Math.abs(box.getLonSpan() - lonSpan) <= tolerance;
    }
  );
}

/**
 * A matcher for the four internal components of a google.maps.LatLngBounds.
 * google.maps.LatLngBounds.prototype.equals is not safe to use in tests
 * because it does an approximate comparison and is non-transitive.
 * @param {number} south The expected north latitude.
 * @param {number} west The expected west longitude.
 * @param {number} north The expected north latitude.
 * @param {number} east The expected east longitude.
 * @return {gjstest.Matcher} A google.maps.LatLngBounds matcher.
 */
function isBounds(south, west, north, east) {
  var description = [south, west, north, east];
  return new gjstest.Matcher(
    'south, west, north, east == ' + description,
    'south, west, north, east != ' + description,
    function(bounds) {
      var sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
      return sw.lat() === south && sw.lng() === west &&
          ne.lat() === north && ne.lng() === east;
    }
  );
}

/** Tests that the LatLonBox constructor correctly handles its edge cases. */
LatLonBoxTest.prototype.testConstructor = function() {
  // A couple of typical examples
  expectThat(new cm.LatLonBox(38.905, 37.781, -77.007, -122.505),
             isBox(38.905, 37.781, -77.007, -122.505));
  expectThat(new cm.LatLonBox(7.625, -3.625, 98.125, 86.875),
             isBox(7.625, -3.625, 98.125, 86.875));

  // Boxes containing a single point
  expectThat(new cm.LatLonBox(0, 0, 0, 0, true), isBox(0, 0, 0, 0, 0));
  expectThat(new cm.LatLonBox(-7, -7, 27, 27, true), isBox(-7, -7, 27, 27, 0));
  expectThat(new cm.LatLonBox(90, 90, 90, 90, true), isBox(90, 90, 90, 90, 0));

  // North or south out of range
  expectThat(new cm.LatLonBox(92, 91, 1, 0), isBox(90, 90, 1, 0));
  expectThat(new cm.LatLonBox(-91, -92, 1, 0), isBox(-90, -90, 1, 0));

  // North less than south
  expectThat(new cm.LatLonBox(5, 6, 1, 0), isBox(0, 0, 1, 0));

  // Boxes that don't cross the 180-degree meridian
  expectThat(new cm.LatLonBox(0, 0, 1, 0), isBox(0, 0, 1, 0));
  expectThat(new cm.LatLonBox(0, 0, 1, -1), isBox(0, 0, 1, -1));
  expectThat(new cm.LatLonBox(0, 0, 179, -179), isBox(0, 0, 179, -179, 358));
  expectThat(new cm.LatLonBox(0, 0, 179, 181), isBox(0, 0, 179, -179, 358));

  // Boxes that cross the 180-degree meridian
  expectThat(new cm.LatLonBox(0, 0, 0, 1), isBox(0, 0, 0, 1, 359));
  expectThat(new cm.LatLonBox(0, 0, -1, 1), isBox(0, 0, -1, 1, 358));
  expectThat(new cm.LatLonBox(0, 0, -179, 179), isBox(0, 0, -179, 179, 2));
  expectThat(new cm.LatLonBox(0, 0, 181, 179), isBox(0, 0, -179, 179, 2));

  // Boxes that are 0 degrees wide
  expectThat(new cm.LatLonBox(0, 0, 1, 1, true), isBox(0, 0, 1, 1, 0));
  expectThat(
      new cm.LatLonBox(0, 0, 180, 180, true), isBox(0, 0, -180, -180, 0));
  expectThat(new cm.LatLonBox(0, 0, 360, 360, true), isBox(0, 0, 0, 0, 0));
  expectThat(
      new cm.LatLonBox(0, 0, -180, -180, true), isBox(0, 0, -180, -180, 0));
  expectThat(new cm.LatLonBox(0, 0, -360, -360, true), isBox(0, 0, 0, 0, 0));

  // Various ways of constructing the special case (east, west) == (180, -180).
  expectThat(new cm.LatLonBox(0, 0, 180, 180), isBox(0, 0, 180, -180, 360));
  expectThat(new cm.LatLonBox(0, 0, -180, -180), isBox(0, 0, 180, -180, 360));
  expectThat(new cm.LatLonBox(0, 0, 180, -180), isBox(0, 0, 180, -180, 360));
  expectThat(
      new cm.LatLonBox(0, 0, 180, -180, true), isBox(0, 0, 180, -180, 360));
  expectThat(
      new cm.LatLonBox(0, 0, -180, 180, true), isBox(0, 0, 180, -180, 360));
  expectThat(new cm.LatLonBox(0, 0, 180, 540), isBox(0, 0, 180, -180, 360));
  expectThat(new cm.LatLonBox(0, 0, -180, -540), isBox(0, 0, 180, -180, 360));
  expectThat(new cm.LatLonBox(0, 0, -180, 180), isBox(0, 0, 180, -180, 360));

  // Other boxes that are 360 degrees wide
  expectThat(new cm.LatLonBox(0, 0, 1, 1), isBox(0, 0, 1, 1, 360));
  expectThat(new cm.LatLonBox(0, 0, 360, 360), isBox(0, 0, 0, 0, 360));
  expectThat(new cm.LatLonBox(0, 0, -360, -360), isBox(0, 0, 0, 0, 360));
  expectThat(new cm.LatLonBox(0, 0, -359, 1), isBox(0, 0, 1, 1, 360));
  expectThat(new cm.LatLonBox(0, 0, 0, -360), isBox(0, 0, 0, 0, 360));
  expectThat(new cm.LatLonBox(0, 0, 0, 360), isBox(0, 0, 0, 0, 360));
  expectThat(new cm.LatLonBox(0, 0, -360, 0), isBox(0, 0, 0, 0, 360));
  expectThat(new cm.LatLonBox(0, 0, 360, 0), isBox(0, 0, 0, 0, 360));
};

/** Tests construction from a LatLngBounds object. */
LatLonBoxTest.prototype.testFromLatLngBounds = function() {
  var b = new google.maps.LatLngBounds(
    new google.maps.LatLng(1, 2),  // southwest
    new google.maps.LatLng(3, 4)  // northeast
  );
  expectThat(cm.LatLonBox.fromLatLngBounds(b), isBox(3, 1, 4, 2));

  var b = new google.maps.LatLngBounds(
    new google.maps.LatLng(1, 2),  // southwest
    new google.maps.LatLng(1, 2)  // northeast
  );
  expectThat(cm.LatLonBox.fromLatLngBounds(b), isBox(1, 1, 2, 2, 0));

  var b = new google.maps.LatLngBounds(
    new google.maps.LatLng(1, -180),  // southwest
    new google.maps.LatLng(2, 180)  // northeast
  );
  expectThat(cm.LatLonBox.fromLatLngBounds(b), isBox(2, 1, 180, -180, 360));
};

/** Tests construction from a center point and zoom level. */
LatLonBoxTest.prototype.testFromCenterAndZoom = function() {
  // At zoom level 0, a 256 x 256 box should just fit the entire map.
  expectThat(cm.LatLonBox.fromCenterAndZoom(
      new google.maps.LatLng(0, 0), 0, 256, 256),
      isBox(85.051128, -85.051128, 180, -180, 360, 1e-6));

  // A box larger than 256 x 256 produces latitudes beyond MAX_LATITUDE.
  expectThat(cm.LatLonBox.fromCenterAndZoom(
      new google.maps.LatLng(0, 0), 0, 600, 600),
      isBox(89.927323, -89.927323, 180, -180, 360, 1e-6));

  // A real example from Google Maps.
  expectThat(cm.LatLonBox.fromCenterAndZoom(
      new google.maps.LatLng(43.653, -79.383), 10, 600, 600),
      isBox(43.950347, 43.354174, -78.971013, -79.794987, 0.823974, 1e-6));
};

/** Tests construction from a query parameter string. */
LatLonBoxTest.prototype.testFromString = function() {
  expectThat(cm.LatLonBox.fromString(''), isNull);
  expectThat(cm.LatLonBox.fromString('4,3,2,x'), isNull);
  expectThat(cm.LatLonBox.fromString('4,3,2'), isNull);
  expectThat(cm.LatLonBox.fromString('4,3,2,1'), isBox(4, 3, 2, 1));
  expectThat(cm.LatLonBox.fromString('   1.5, -7 , 9e1\n, 92 '),
             isBox(1.5, -7, 90, 92, 358));
  expectThat(cm.LatLonBox.fromString('4,3,1,1'), isBox(4, 3, 1, 1, 360));
  expectThat(cm.LatLonBox.fromString('4,3,1,1,0'), isBox(4, 3, 1, 1, 0));
};

/** Tests construction from a MapRoot LatLonAltBox object. */
LatLonBoxTest.prototype.testFromMapRoot = function() {
  // A less-than-360-degree box.
  expectThat(cm.LatLonBox.fromMapRoot(
      {'north': 4, 'south': 3, 'east': 2, 'west': 1}),
      isBox(4, 3, 2, 1));

  // A 360-degree box.
  expectThat(cm.LatLonBox.fromMapRoot(
      {'north': 4, 'south': 3, 'east': 8, 'west': 8}),
      isBox(4, 3, 8, 8, 360));

  // A 360-degree box whose MapRoot representation uses the same extent values
  // as the LatLonBox representation.
  expectThat(cm.LatLonBox.fromMapRoot(
      {'north': 0, 'south': 0, 'east': 180, 'west': -180}),
      isBox(0, 0, 180, -180, 360));
};

/** Tests the equals() method. */
LatLonBoxTest.prototype.testEquals = function() {
  var a = new cm.LatLonBox(4, 3, 2, 1);
  var b = new cm.LatLonBox(4, 3, 2, 1);  // different object, same value
  var c = new cm.LatLonBox(4, 3, -358, 1);  // same value expressed differently
  var d = new cm.LatLonBox(8, 7, 6, 5);  // different value
  expectTrue(a.equals(b));
  expectTrue(a.equals(c));
  expectTrue(b.equals(c));
  expectFalse(a.equals(d));
};

/** Tests the toString() method. */
LatLonBoxTest.prototype.testToString = function() {
  var box = new cm.LatLonBox(43.950347, 43.354174, -78.971013, -79.794987);
  expectEq('43.950347,43.354174,-78.971013,-79.794987', box.toString());
};

/** Tests the toLatLngBounds() method. */
LatLonBoxTest.prototype.testToLatLngBounds = function() {
  expectThat((new cm.LatLonBox(3, 1, 4, 2)).toLatLngBounds(),
      isBounds(1, 2, 3, 4));
  expectThat((new cm.LatLonBox(1, 1, 2, 2, true)).toLatLngBounds(),
      isBounds(1, 2, 1, 2));

  // LatLngBounds can't handle a 360-degree box; toLatLngBounds approximates.
  // The east extent should be the largest representable longitude less than 2.
  // Note that unfortunately this is not the same as the largest representable
  // IEEE 754 double-precision floating-point number less than 2, because
  // google.maps.LatLngBounds loses precision.
  var bounds = (new cm.LatLonBox(1, 1, 2, 2, false)).toLatLngBounds();
  expectThat(bounds, isBounds(1, 2, 1, 2 - 1.137e-13));

  // Check that LatLng can't represent a larger east that's still less than 2.
  var east = bounds.getNorthEast().lng();
  expectTrue(east < 2);
  var between = new google.maps.LatLng(1, (east + 2) / 2).lng();
  expectTrue(between === east || between === 2);
};

/** Tests the toMapRoot() method. */
LatLonBoxTest.prototype.testToMapRoot = function() {
  // A less-than-360-degree box whose MapRoot representation uses the same
  // extent values as the LatLonBox representation.
  expectEq({'north': 4, 'south': 3, 'east': 2, 'west': 1},
           (new cm.LatLonBox(4, 3, 2, 1)).toMapRoot());

  // A less-than-360-degree box whose MapRoot representation uses different
  // extent values from the LatLonBox representation.
  expectEq({'north': 0, 'south': 0, 'east': -179, 'west': 179},
           (new cm.LatLonBox(0, 0, 181, 179)).toMapRoot());

  // MapRoot cannot represent a box of zero width; toMapRoot approximates.
  // The east extent should be the smallest representable longitude greater
  // than 30 in IEEE 754 double-precision floating-point numbers.
  var box = (new cm.LatLonBox(0, 0, 30, 30, true)).toMapRoot();
  expectEq({'north': 0, 'south': 0, 'east': 30 + 4e-15, 'west': 30}, box);

  // Check that there's no smaller value for east that's still greater than 30.
  var east = box['east'];
  expectTrue(east > 30);
  var between = (east + 30) / 2;
  expectTrue(between === 30 || between === east);

  // When east equals west in MapRoot, the box is 360 degrees wide.
  expectEq({'north': 0, 'south': 0, 'east': 30, 'west': 30},
           (new cm.LatLonBox(0, 0, 30, 30)).toMapRoot());
  expectEq({'north': 0, 'south': 0, 'east': 30, 'west': 30},
           (new cm.LatLonBox(0, 0, 30, 390)).toMapRoot());

  // A 360-degree box whose MapRoot representation uses the same extent values
  // as the LatLonBox representation.
  expectEq({'north': 0, 'south': 0, 'east': 180, 'west': -180},
           (new cm.LatLonBox(0, 0, 180, -180)).toMapRoot());
};

/** Tests the getMercatorCenter() method. */
LatLonBoxTest.prototype.testGetMercatorCenter = function() {
  // The latitude of the Mercator center usually doesn't match the average
  // latitude, depending where the box is on the globe.
  expectEq(0, (new cm.LatLonBox(30, -30, 0, 0)).getMercatorCenter().lat());
  expectThat((new cm.LatLonBox(60, 0, 0, 0)).getMercatorCenter().lat(),
             isNearNumber(35.264390, 1e-6));
  expectThat((new cm.LatLonBox(-40, -80, 0, 0)).getMercatorCenter().lat(),
             isNearNumber(-67.161859, 1e-6));

  // Ensure that the north and south poles are handled correctly.
  expectEq(90, (new cm.LatLonBox(90, 0, 0, 0)).getMercatorCenter().lat());
  expectEq(0, (new cm.LatLonBox(90, -90, 0, 0)).getMercatorCenter().lat());
  expectEq(-90, (new cm.LatLonBox(0, -90, 0, 0)).getMercatorCenter().lat());
  expectEq(-90, (new cm.LatLonBox(89.99, -90, 0, 0)).getMercatorCenter().lat());

  // Ensure that the opt_clampLat parameter limits the latitude of the result.
  expectThat((new cm.LatLonBox(90, 0, 0, 0)).getMercatorCenter(true).lat(),
             isNearNumber(66.513, 1e-3));
  expectThat((new cm.LatLonBox(0, -90, 0, 0)).getMercatorCenter(true).lat(),
             isNearNumber(-66.513, 1e-3));
  expectEq(0, (new cm.LatLonBox(90, -90, 0, 0)).getMercatorCenter(true).lat());

  // Ensure that the longitude center reflects which side is east/west.
  expectEq(-170, (new cm.LatLonBox(0, 0, 210, 170)).getMercatorCenter().lng());
  expectEq(10, (new cm.LatLonBox(0, 0, 170, 210)).getMercatorCenter().lng());
  expectEq(0, (new cm.LatLonBox(0, 0, 1, -1)).getMercatorCenter().lng());
  expectEq(180, (new cm.LatLonBox(0, 0, -1, 1)).getMercatorCenter().lng());
};

/** Tests the getZoomLevel() method. */
LatLonBoxTest.prototype.testGetZoomLevel = function() {
  // The entire map fits in 256 x 256 at zoom level 0.
  expectEq(0, cm.LatLonBox.ENTIRE_MAP.getZoomLevel(256, 256));

  // The entire map fits in 512 x 512 at zoom level 1.
  expectEq(0, cm.LatLonBox.ENTIRE_MAP.getZoomLevel(511, 511));
  expectEq(1, cm.LatLonBox.ENTIRE_MAP.getZoomLevel(512, 512));

  // The entire map fits in 1024 x 1024 at zoom level 2.
  expectEq(1, cm.LatLonBox.ENTIRE_MAP.getZoomLevel(1023, 1023));
  expectEq(2, cm.LatLonBox.ENTIRE_MAP.getZoomLevel(1024, 1024));

  // Colorado just barely fits in 638 x 470 at zoom level 7.
  var colorado = new cm.LatLonBox(41, 37, -102.05, -109.05);
  expectEq(7, colorado.getZoomLevel(638, 470));
  expectEq(6, colorado.getZoomLevel(636, 470));  // insufficient width
  expectEq(6, colorado.getZoomLevel(638, 468));  // insufficient height

  // getZoomLevel() should always be nonnegative even if level 0 is too high.
  expectEq(0, cm.LatLonBox.ENTIRE_MAP.getZoomLevel(10, 10));

  // Extreme case: an infinitely tall map.
  var tallBox = new cm.LatLonBox(90, -90, 180, -180);
  expectEq(0, tallBox.getZoomLevel(1024, 1024));

  // If opt_clampLat is set, even an infinitely tall map should be treated as
  // spanning -85 to 85 latitude, and be zoomed in when the window is big.
  expectEq(2, tallBox.getZoomLevel(1024, 1024, true));
};

/** Tests the round() method. */
LatLonBoxTest.prototype.testRound = function() {
  // Try a box that spans a bit less than 1 degree N-S and 1 degree E-W.
  var box = new cm.LatLonBox(43.950347, 43.354174, -78.971013, -79.794987);
  expectThat(box.round(10),
             isBox(43.950347, 43.354174, -78.971013, -79.794987));
  expectThat(box.round(6),
             isBox(43.950347, 43.354174, -78.971013, -79.794987));
  expectThat(box.round(5), isBox(43.95035, 43.35417, -78.97101, -79.79499));
  expectThat(box.round(4), isBox(43.9503, 43.3542, -78.971, -79.795));
  expectThat(box.round(3), isBox(43.95, 43.354, -78.971, -79.795));
  expectThat(box.round(2), isBox(43.95, 43.35, -78.97, -79.79));
  expectThat(box.round(1), isBox(44, 43.4, -79, -79.8));

  // Try a box that spans a bit more than 1 degree N-S and 1 degree E-W.
  box = new cm.LatLonBox(43.950347, 42.354174, -77.971013, -79.794987);
  expectThat(box.round(6), isBox(43.95035, 42.35417, -77.97101, -79.79499));
  expectThat(box.round(4), isBox(43.95, 42.354, -77.971, -79.795));
  expectThat(box.round(2), isBox(44, 42.4, -78, -79.8));

  // Try a box that spans more than 10 degrees N-S and 100 degrees E-W.
  box = new cm.LatLonBox(49, -37, 121, -162);
  expectThat(box.round(6), isBox(49, -37, 121, -162));
  expectThat(box.round(2), isBox(49, -37, 121, -162));
  expectThat(box.round(1), isBox(50, -40, 120, -160));

  // round() shouldn't ever round coarser than to multiples of ten degrees.
  expectThat(box.round(0), isBox(50, -40, 120, -160));
};
