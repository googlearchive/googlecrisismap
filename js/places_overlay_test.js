// Copyright 2014 Google Inc. All Rights Reserved.
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
 * @constructor
 */
function PlacesOverlayTest() {
  cm.TestBase.call(this);
  this.map_ = this.expectNew_('google.maps.Map');
  this.layerModel_ = new google.maps.MVCObject();
  this.layerModel_.set('places_name', 'cvs');

  // Clear the static variable
  cm.PlacesOverlay.placesService = null;
  this.placesService_ =
      this.expectNew_('google.maps.places.PlacesService', this.map_);
  this.mapBounds_ = new google.maps.LatLngBounds(
      new google.maps.LatLng(34, 100),
      new google.maps.LatLng(44, 110));
  expectCall(this.map_.getBounds)().willRepeatedly(returnWith(this.mapBounds_));

}
PlacesOverlayTest.prototype = new cm.TestBase();
registerTestSuite(PlacesOverlayTest);

/**
 * Creates a place result with some geometry and reference parameters.
 * @private
 */
PlacesOverlayTest.prototype.createPlaceResult_ = function() {
  return /** @type google.maps.places.PlaceResult */({
    geometry: /** @type google.maps.places.PlaceGeometry */({
      location: new google.maps.LatLng(37, 105)
    }),
    reference: 'somePlaceReference'
  });
};

/**
 * Sets up placesService mock to expect a call to radarSearch.
 * @param {Array.<google.maps.places.PlaceResult>} results Places search results
 * @param {google.maps.places.PlacesServiceStatus} status Status of the Places
 *     API request
 * @private
 */
PlacesOverlayTest.prototype.expectRadarSearch_ = function(results, status) {
  var expectedRequest = /** @type google.maps.places.RadarSearchRequest */({
    bounds: this.mapBounds_,
    name: this.layerModel_.get('places_name')
  });
  expectCall(this.placesService_.radarSearch)(expectedRequest, _)
      .willOnce(function(request, callback) {
        callback(results, status);
      });
};

/**
 * Sets up a mock for a new marker corresponding to a Places API search result.
 * @param {google.maps.places.PlaceResult} placeResult Place search result
 * @return {google.maps.Marker} Marker mock object
 * @private
 */
PlacesOverlayTest.prototype.expectNewMarker_ = function(placeResult) {
  // Mock out the Marker, b/c using a real Marker causes errors with gjstest
  var marker = this.expectNew_('google.maps.Marker',
      /** @type google.maps.MarkerOptions */({
        position: placeResult.geometry.location,
        map: this.map_
      }));
  expectCall(marker.set)('_placereference', placeResult.reference).times(1);
  expectCall(marker.set)('_clickeventtoken', _).times(1);
  return marker;
};

/**
 * Sets up placesService mock to expect a call to getDetails.
 * @param {string} placeReference Reference of the place to look up details for
 * @param {google.maps.places.PlaceResult} result Place result
 * @param {google.maps.places.PlacesServiceStatus} status Status of the Places
 *     API request
 * @private
 */
PlacesOverlayTest.prototype.expectGetDetails_ = function(placeReference,
    result, status) {
  var expectedRequest = /** @type google.maps.places.PlaceDetailsRequest */({
    reference: placeReference
  });
  expectCall(this.placesService_.getDetails)(expectedRequest, _)
      .willOnce(function(request, callback) {
        callback(result, status);
      });
};


/** Tests two places layer reuse the same Places service. */
PlacesOverlayTest.prototype.testPlacesServiceSharedBetweenOverlays =
    function() {
  // Create the first overlay
  var placesOverlay = new cm.PlacesOverlay(this.layerModel_, this.map_);

  // Create the second overlay and make sure no new calls to PlacesService
  // are issued
  this.expectNoCalls_('google.maps.places.PlacesService');
  var placesOverlayTwo = new cm.PlacesOverlay(this.layerModel_, this.map_);
};


/** Tests places layer updates on setMap. */
PlacesOverlayTest.prototype.testPlacesSearchOnSetMap = function() {
  var placeResult = this.createPlaceResult_();
  this.expectRadarSearch_(
      [placeResult],
      google.maps.places.PlacesServiceStatus.OK);
  var marker = this.expectNewMarker_(placeResult);

  var placesOverlay = new cm.PlacesOverlay(this.layerModel_, this.map_);
  placesOverlay.setMap(this.map_);
  expectEq(1, placesOverlay.markers_.length);

  // Make sure the markers are cleared on null map
  expectCall(marker.setMap)(null);
  placesOverlay.setMap(null);
  expectEq(1, placesOverlay.markers_.length);

  // Reset the map and make sure the markers come back
  expectCall(marker.setMap)(this.map_);
  placesOverlay.setMap(this.map_);
  expectEq(1, placesOverlay.markers_.length);
};

/** Tests places layer updates when 'types' layer parameter is set. */
PlacesOverlayTest.prototype.testPlacesSearchWithKeywordAndTypes = function() {
  var expectedRequest = /** @type google.maps.places.RadarSearchRequest */({
    bounds: this.mapBounds_,
    keyword: 'duane',
    types: ['pharmacy', 'store']
  });
  expectCall(this.placesService_.radarSearch)(expectedRequest, _);

  this.layerModel_ = new google.maps.MVCObject();
  this.layerModel_.set('places_keyword', 'duane');
  this.layerModel_.set('places_types', 'pharmacy|store');
  var placesOverlay = new cm.PlacesOverlay(this.layerModel_, this.map_);
  placesOverlay.setMap(this.map_);
};

/**
 * Tests places layer update where required params (keyword/name/types) are
 * missing.
 */
PlacesOverlayTest.prototype.testNoSearchQueryOnEmptyRequiredParams =
    function() {
  expectCall(this.placesService_.radarSearch)(_, _).times(0);
  this.expectNoCalls_('google.maps.Marker');

  // Create a new Places layer from layerModel that has none of the places
  // layer params set
  this.layerModel_ = new google.maps.MVCObject();
  var placesOverlay = new cm.PlacesOverlay(this.layerModel_, this.map_);
  placesOverlay.setMap(this.map_);
};

/** Tests places layer update fails on Places API call. */
PlacesOverlayTest.prototype.testPlacesSearchFails = function() {
  this.expectRadarSearch_(
      [],
      google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR);
  this.expectNoCalls_('google.maps.Marker');

  var placesOverlay = new cm.PlacesOverlay(this.layerModel_, this.map_);
  placesOverlay.setMap(this.map_);
};

/**
 * Tests functionality for clicking on a placemarker that should load place
 * details in the info window.
 */
PlacesOverlayTest.prototype.testGetPlaceDetails = function() {
  // Mock setup for the radar search
  var placeResult = this.createPlaceResult_();
  this.expectRadarSearch_(
      [placeResult],
      google.maps.places.PlacesServiceStatus.OK);
  var marker = this.expectNewMarker_(placeResult);

  // Create a new Places layer
  var placesOverlay = new cm.PlacesOverlay(this.layerModel_, this.map_);
  placesOverlay.setMap(this.map_);
  expectEq(1, placesOverlay.markers_.length);

  // Mock setup for place getDetails call
  expectCall(marker.get)('_placereference').
      willOnce(returnWith(placeResult.reference));
  placeResult = {
    geometry: placeResult.geometry,
    reference: placeResult.reference,
    name: 'SomePlaceName',
    html_attributions: ['SomeHtmlAttributions']
  };
  this.expectGetDetails_(placeResult.reference, placeResult,
      google.maps.places.PlacesServiceStatus.OK);
  // Set up expectations for a click event on the layer with info window content
  this.expectEvent(placesOverlay, 'click', 1, function(eventProperties) {
    var contentHtml = eventProperties.featureData.infoWindowHtml;
    return eventProperties.featureData.name === placeResult.name &&
        goog.string.contains(contentHtml, placeResult.name) &&
        goog.string.contains(contentHtml, placeResult.html_attributions) &&
        !goog.string.contains(contentHtml, 'undefined');
  });

  // Click on the place marker
  cm.events.emit(placesOverlay.markers_[0], 'click');
};

/** Tests scenario where loading place details from Places API fails. */
PlacesOverlayTest.prototype.testGetPlaceDetailsFails = function() {
  // Mock setup for the radar search
  var placeResult = this.createPlaceResult_();
  this.expectRadarSearch_(
      [placeResult],
      google.maps.places.PlacesServiceStatus.OK);
  var marker = this.expectNewMarker_(placeResult);

  // Create a new Places layer
  var placesOverlay = new cm.PlacesOverlay(this.layerModel_, this.map_);
  placesOverlay.setMap(this.map_);
  expectEq(1, placesOverlay.markers_.length);

  // Mock setup for place getDetails call
  expectCall(marker.get)('_placereference').
      willOnce(returnWith(placeResult.reference));
  this.expectGetDetails_(placeResult.reference, placeResult,
      google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR);
  // Set up expectations for a click event on the layer with info window content
  this.expectEvent(placesOverlay, 'click', 0);

  // Click on the place marker
  cm.events.emit(placesOverlay.markers_[0], 'click');
};
