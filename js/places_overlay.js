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
 * @fileoverview A custom map overlay rendered from the Google Places API.
 *
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.PlacesOverlay');

goog.require('cm');
goog.require('cm.Analytics');
goog.require('cm.AppState');
goog.require('cm.LayerModel');
goog.require('cm.events');
goog.require('goog.Uri');
goog.require('goog.array');
goog.require('goog.string');

/**
 * A map overlay for displaying places from Google Places API.
 * @param {cm.LayerModel} layer The layer model.
 * @param {google.maps.Map} map The map on which to display this places layer.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.PlacesOverlay = function(layer, map) {
  google.maps.MVCObject.call(this);

  /**
   * Google Places API service instance that's shared between different
   * places layer. Having separate service per layer causes duplicate
   * listing attributions in the bottom right corner of the map.
   */
  if (!cm.PlacesOverlay.placesService) {
    cm.PlacesOverlay.placesService = new google.maps.places.PlacesService(map);
  }

  /**
   * @type {cm.LayerModel}
   * @private
   */
  this.layer_ = layer;

  /**
   * @type {google.maps.Map}
   * @private
   */
  this.map_ = map;

  /**
   * @type {Array.<google.maps.Marker>}
   * @private
   */
  this.markers_ = null;

  /**
   * @type {boolean}
   * @private
   */
  this.onMap_ = false;

  /**
   * @type {google.maps.places.RadarSearchRequest}
   * @private
   */
  this.currentRequest_ = null;

  /**
   * @type {Array.<google.maps.places.PlaceResult>}
   * @private
   */
  this.currentResults_ = null;

  // When the map becomes idle, update the set of places displayed
  cm.events.listen(this.map_, 'idle', this.updatePlacesIfNecessary_, this);
};
goog.inherits(cm.PlacesOverlay, google.maps.MVCObject);

/**
 * @param {google.maps.Map} map The map on which to display this overlay.
 */
cm.PlacesOverlay.prototype.setMap = function(map) {
  this.onMap_ = !!map;
  // Hide/show markers depending on the layer visibility change. Since the
  // places results don't change in that scenario, remember the list of markers,
  // and just flip the visibility bit
  if (!this.onMap_) {
    this.hideMarkers_();
  } else if (this.markers_) {
    this.showMarkers_();
  }

  // Query Places API for the POIs that match the criteria and show new
  // markers on the map
  this.updatePlacesIfNecessary_();
};

/**
 * @return {google.maps.Map} Returns the map on which this PlacesOverlay is
 *     displayed, or null if it is not showing.
 */
cm.PlacesOverlay.prototype.getMap = function() {
  return this.onMap_ ? this.map_ : null;
};

/**
 * Updates places layer by querying Places API for the results in the current
 * map bounds. Displays the markers corresponding to the place results.
 * @private
 */
cm.PlacesOverlay.prototype.updatePlacesIfNecessary_ = function() {
  if (!this.onMap_) {
    // Layer is hidden, so don't issue any new requests to the Places API
    return;
  }
  // Build google.maps.places.RadarSearchRequest
  var request = {
    // Note the maximum allowed radius is 50km as per Places API external
    // documentation. If the map bounds are larger, the search is performed as
    // a 50km circle from the center point.
    bounds: this.map_.getBounds()
  };
  if (this.layer_.get('places_keyword')) {
    request.keyword = this.layer_.get('places_keyword');
  }
  if (this.layer_.get('places_name')) {
    request.name = this.layer_.get('places_name');
  }
  if (this.layer_.get('places_types')) {
    var types = this.layer_.get('places_types');
    request.types = types ? types.split('|') : [];
  }

  // Check if the new request is for the same parameters as the currently
  // displayed one. If all parameters are the same bounds differ by a small
  // delta, don't issue a new call to Places API. This is done to avoid extra
  // API calls to Places if user scrolls the map just a little bit.
  if (this.currentRequest_ != null &&
      this.currentRequest_.keyword === request.keyword &&
      this.currentRequest_.name === request.name &&
      this.arrayEquals_(this.currentRequest_.types, request.types) &&
      this.checkIfBoundsSimilar_(this.currentRequest_.bounds, request.bounds)) {
    // Don't refetch places
    return;
  }

  // Radar search requires bounds and at least one of keyword, name, types
  // params. Don't issue a request that violates these rules
  if (request.bounds && (request.keyword || request.name || request.types)) {
    cm.PlacesOverlay.placesService.radarSearch(request,
        goog.bind(this.placesCallback_, this, request));
  }
};

/**
 * Checks if two bounds are very close to each other (within a certain
 * threshold).
 * @param {google.maps.LatLngBounds} a
 * @param {google.maps.LatLngBounds} b
 * @return {boolean} true if two bounds sets represent pretty much the same area
 * @private
 */
cm.PlacesOverlay.prototype.checkIfBoundsSimilar_ = function(a, b) {
  var aSpan = a.toSpan();
  var bSpan = b.toSpan();
  var uSpan = a.union(b).toSpan();
  return uSpan.lat() * uSpan.lng() / (aSpan.lat() * aSpan.lng()) < 1.05 &&
      uSpan.lat() * uSpan.lng() / (bSpan.lat() * bSpan.lng()) < 1.05;
};

/**
 * Handles the result of the places API search request.
 * @param {google.maps.places.RadarSearchRequest} request Places API request
 *     used to get these results
 * @param {Array.<google.maps.places.PlaceResult>} results Place search result
 * @param {google.maps.places.PlacesServiceStatus} status Status of the Places
 *     API request
 * @private
 */
cm.PlacesOverlay.prototype.placesCallback_ = function(request, results,
    status) {
  if (status != google.maps.places.PlacesServiceStatus.OK) {
    // Places API call failed
    return;
  }

  if (this.arrayEquals_(this.currentResults_, results,
      function(placeResult1, placeResult2) {
        return placeResult1.reference === placeResult2.reference;
      })) {
    // Results are identical to the ones already displayed, so no need to
    // update the map markers
    return;
  }

  this.clearMarkers_();
  this.markers_ = [];

  for (var i = 0, result; result = results[i]; i++) {
    var markerOpts = /** @type google.maps.MarkerOptions */({
      position: result.geometry.location,
      map: this.getMap()
    });
    if (this.layer_.get('places_icon_url')) {
      // TODO(user): scale icon images to a small size
      markerOpts['icon'] = this.layer_.get('places_icon_url');
    }
    var marker = new google.maps.Marker(markerOpts);
    marker.set('_placereference', result.reference);
    marker.set('_clickeventtoken',
        cm.events.listen(marker, 'click',
            goog.bind(this.getPlaceDetails_, this, marker), this));
    this.markers_.push(marker);
  }
  this.currentResults_ = results;
  this.currentRequest_ = request;
};

/**
 * Retrieves place details (like name, address, phone number, etc.) using
 * Places API.
 * @param {google.maps.Marker} marker Place marker that user has clicked
 * @private
 */
cm.PlacesOverlay.prototype.getPlaceDetails_ = function(marker) {
  var request = /** @type google.maps.places.PlaceDetailsRequest */({
    reference: marker.get('_placereference')
  });
  cm.PlacesOverlay.placesService.getDetails(request,
      goog.bind(this.placeDetailsCallback_, this));
};

/**
 * Handles the result of the places API request for single place details.
 * @param {google.maps.places.PlaceResult} result Place details
 * @param {google.maps.places.PlacesServiceStatus} status Status of the Places
 *     API request
 * @private
 */
cm.PlacesOverlay.prototype.placeDetailsCallback_ = function(result, status) {
  if (status != google.maps.places.PlacesServiceStatus.OK) {
    // Places API call to get place details has failed
    return;
  }

  // TODO(user): update the UI once we have mocks for Places on maps
  var resultUri = new goog.Uri(result.website);
  var contentHtml = goog.string.subs(
      '<div id="content">' +
         '<span style="font-weight: bold; font-size:123%">%s</span> ' +
         '<a href="%s" target="_blank">%s</a>' +
         '<div>%s</div>' +
         '<div>%s</div>' +
         '<div><a href="%s" target="_blank">%s</a></div>' +
         '<div>%s</div>' +
      '</div>',
      result.name || '',
      result.url || '',
      result.url ? 'more info' : '',
      result.formatted_address || '',
      result.formatted_phone_number || '',
      result.website || '',
      result.website ? resultUri.getDomain() : '',
      result.html_attributions ? result.html_attributions.join(' ') : '');

  var event = {};
  event['latLng'] = result.geometry.location;
  event['pixelOffset'] = new google.maps.Size(0, 0);
  event['featureData'] = {
    'name': result.name,
    'snippet': result.formatted_address,
    'infoWindowHtml': contentHtml
  };

  // Publish an event to trigger the display of the place details
  cm.events.emit(this, 'click', event);
};

/**
 * Shows all the current place markers on the map.
 * @private
 */
cm.PlacesOverlay.prototype.showMarkers_ = function() {
  var markers = this.markers_ || [];
  for (var i = 0, marker; marker = markers[i]; i++) {
    marker.setMap(this.map_);
  }
};

/**
 * Hides all the current place markers on the map.
 * @private
 */
cm.PlacesOverlay.prototype.hideMarkers_ = function() {
  var markers = this.markers_ || [];
  for (var i = 0, marker; marker = markers[i]; i++) {
    marker.setMap(null);
  }
};

/**
 * Removes all the current place markers from the map.
 * @private
 */
cm.PlacesOverlay.prototype.clearMarkers_ = function() {
  var markers = this.markers_ || [];
  for (var i = 0, marker; marker = markers[i]; i++) {
    cm.events.unlisten(marker.get('_clickeventtoken'), this);
    marker.setMap(null);
  }
  this.markers_ = null;
};

/**
 * Checks if two array are the same. Arrays are the same if they are both
 * undefined or they contain the exact same elements in the same order.
 * @param {Array.<?>} arrayOne
 * @param {Array.<?>} arrayTwo
 * @param {Function=} opt_equalsFn Function for comparing elements
 * @return {boolean} true if arrays are both undefined / empty or have the same
 *     elements
 * @private
 */
cm.PlacesOverlay.prototype.arrayEquals_ = function(arrayOne, arrayTwo,
    opt_equalsFn) {
  return (arrayOne == undefined && arrayTwo == undefined) ||
      goog.array.equals(arrayOne, arrayTwo, opt_equalsFn);
};
