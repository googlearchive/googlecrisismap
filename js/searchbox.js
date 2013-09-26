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
 * @fileoverview A search box for the crisis map.
 * @author arb@google.com (Anthony Baxter)
 */
goog.provide('cm.SearchBox');

goog.require('cm');
goog.require('cm.Analytics');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.ui.BidiInput');

/**
 * @param {google.maps.Map} map Map to insert the search bar into.
 * @param {goog.dom.DomHelper=} opt_domHelper The (optional) DOM helper.
 * @constructor
 */
cm.SearchBox = function(map, opt_domHelper) {
  /**
   * @type {Element}
   * @private
   */
  var span = this.span_ = cm.ui.create('span',
                                       {'class': [cm.css.MAPBUTTON,
                                                  cm.css.SEARCHBOX]});
  span.style.padding = '0';
  span.style.textAlign = 'left';
  span.style.zIndex = 1000;
  // Anchors the box on the left.
  span.style.borderLeftWidth = '8px';
  // Webkit has a funny extra pixel if the top and left border radius are set to
  // 2px and the border width is greater than 2px.
  span.style.webkitBorderRadius = '1px 2px 2px 1px';

  var input = cm.ui.create('input');
  var bidi = new goog.ui.BidiInput(opt_domHelper);
  bidi.decorate(input);
  span.appendChild(input);

  map.controls[google.maps.ControlPosition.TOP_LEFT].push(span);

  var autocomplete = this.autocomplete_ = new google.maps.places.Autocomplete(
      /** @type {HTMLInputElement} */(input), {'types': ['geocode']});
  autocomplete.bindTo('bounds', map);

  this.map_ = map;
  this.geocoder_ = new google.maps.Geocoder();
  this.marker_ = new google.maps.Marker();

  cm.events.listen(autocomplete, 'place_changed', this.handlePlace_, this);
};

/**
 * Centers the map on the place specified by the autocomplete widget.
 * @private
 */
cm.SearchBox.prototype.handlePlace_ = function() {
  this.marker_.setMap(null);

  var place = this.autocomplete_.getPlace();
  if (place.geometry) {
    var addMarker = cm.SearchBox.isStreetAddress_(place);
    this.goToPlace_(place.geometry, addMarker);
  } else if (place.name) {
    // No geometry specified by the Autocomplete Widget. Run a geocode
    // instead. This happens if you hit 'return' rather than selecting a
    // result. TODO(arb): should we instead use the autocomplete service
    // to get the first response?
    this.geocoder_.geocode({
      'address': place.name,
      'bounds': this.map_.getBounds()
    }, goog.bind(function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        // NOTE(user): We naively take the first result in the set. We could
        // alternatively implement some sort of "did you mean?" feature.
        var addMarker = false;
        if (results[0].location_type ===
                google.maps.GeocoderLocationType.ROOFTOP) {
          addMarker = true;
        } else {
          addMarker = cm.SearchBox.isStreetAddress_(results[0]);
        }
        this.goToPlace_(results[0].geometry, addMarker);
      }
    }, this));
  }
};

/**
 * Is this result a street address?
 * @param {google.maps.places.PlaceResult|google.maps.GeocoderResult} result
 *     A geocoder result.
 * @return {boolean} yes or no.
 * @private
 */
cm.SearchBox.isStreetAddress_ = function(result) {
  for (var i = 0; result.types && i < result.types.length; ++i) {
    if (result.types[i] == 'street_address') {
      return true;
    }
  }
  return false;
};

/**
 * Moves the map to the place specified in the geomtry object. Also adds a
 * marker to the map if addMarker is true.
 * @param {google.maps.GeocoderGeometry|google.maps.places.PlaceGeometry}
 *     geometry The object containing information about the location or
 *     viewport to show on the map. NOTE(user): Despite being different types,
 *     both geometry types define viewport and location.
 * @param {boolean} addMarker True if a marker should be added at the specified
 *      location.
 * @private
 */
cm.SearchBox.prototype.goToPlace_ = function(geometry, addMarker) {
  cm.Analytics.logAction(
      cm.Analytics.MapAction.SEARCH_QUERY_ENTERED, null, addMarker ? 1 : 0);

  if (geometry.viewport) {
    this.map_.fitBounds(geometry.viewport);
  } else {
    this.map_.setCenter(geometry.location);
    this.map_.setZoom(15);
  }

  if (addMarker && goog.isDef(geometry.location)) {
    this.marker_.setOptions({
      position: geometry.location,
      map: this.map_
    });
    // TODO(arb): add an infowindow with the sharing doohickies.
  }
};

/**
 * Hides the searchbox.
 */
cm.SearchBox.prototype.hide = function() {
  this.span_.style.display = 'none';
  cm.events.emit(this.span_, 'resize');
};

/**
 * Shows the searchbox.
 */
cm.SearchBox.prototype.show = function() {
  this.span_.style.display = 'block';
  cm.events.emit(this.span_, 'resize');
};
