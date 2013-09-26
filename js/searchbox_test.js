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

// Author: arb@google.com (Anthony Baxter)

goog.require('cm.css');

function SearchboxTest() {
  cm.TestBase.call(this);

  this.map_ = createMockInstance(google.maps.Map);
  this.map_.controls = goog.object.create(
      google.maps.ControlPosition.TOP_LEFT, []);

  this.autocomplete_ = this.expectNew_('google.maps.places.Autocomplete',
      isElement('input'), {'types': ['geocode']});
  expectCall(this.autocomplete_.bindTo)('bounds', this.map_);

  this.geocoder_ = this.expectNew_('google.maps.Geocoder');
  this.marker_ = this.expectNew_('google.maps.Marker');

  this.searchbox_ = new cm.SearchBox(this.map_);
  this.span_ = this.map_.controls[google.maps.ControlPosition.TOP_LEFT][0];
  this.input_ = expectDescendantOf(this.span_, 'input');
}
SearchboxTest.prototype = new cm.TestBase();
registerTestSuite(SearchboxTest);

/** Tests the constructor. */
SearchboxTest.prototype.constructorTest = function() {
  expectThat(this.span_, isElement(
      'span', withClass(cm.css.MAPBUTTON), withClass(cm.css.SEARCHBOX)));
};

/** Tests the case when the autocomplete widget fires with a viewport. */
SearchboxTest.prototype.autocompletePlaceChangedViewport = function() {
  var viewport = 'aabbccddee';
  var place = {geometry: {viewport: viewport}};
  stub(this.autocomplete_.getPlace)().is(place);

  expectCall(this.marker_.setMap)(null);
  expectCall(this.map_.fitBounds)(viewport);

  this.expectLogAction(cm.Analytics.MapAction.SEARCH_QUERY_ENTERED, null);

  cm.events.emit(this.autocomplete_, 'place_changed', place);
};

/** Tests the case when the autocomplete widget fires with a location. */
SearchboxTest.prototype.autocompletePlaceChangedLocation = function() {
  var location = 'aabbccddee';
  var place = {geometry: {location: location},
               types: ['banana', 'street_address']};
  stub(this.autocomplete_.getPlace)().is(place);

  expectCall(this.marker_.setMap)(null);
  expectCall(this.map_.setCenter)(location);
  expectCall(this.map_.setZoom)(15);
  expectCall(this.marker_.setOptions)({'position': location, 'map': this.map_});

  cm.events.emit(this.autocomplete_, 'place_changed', place);
};

/**
 * Tests the case when the autocomplete widget fires without geometry
 * information and the geocoder returns a viewport.
 */
SearchboxTest.prototype.autocompleteNoGeometryViewport = function() {
  var name = 'Trousers, DE';
  var bounds = 'Fake Bounds';
  var place = {name: name, types: ['banana', 'street_address']};
  var viewport = 'geocoded';
  var geocode = {geometry: {viewport: viewport}};
  stub(this.map_.getBounds)().is(bounds);
  stub(this.autocomplete_.getPlace)().is(place);

  expectCall(this.marker_.setMap)(null);
  expectCall(this.geocoder_.geocode)({address: name, bounds: bounds}, _)
      .willOnce(function(request, callback) {
          callback([geocode], google.maps.GeocoderStatus.OK);
      });
  expectCall(this.map_.fitBounds)(viewport);

  cm.events.emit(this.autocomplete_, 'place_changed', place);
};

/**
 * Tests the case when the autocomplete widget fires without geometry
 * information and the geocoder returns a location.
 */
SearchboxTest.prototype.autocompleteNoGeometryLocation = function() {
  var name = 'Trousers, DE';
  var bounds = 'Fake Bounds';
  var place = {name: name, types: ['banana', 'street_address']};
  var location = 'geocoded';
  var geocode = {geometry: {location: location},
                 location_type: google.maps.GeocoderLocationType.ROOFTOP};
  stub(this.map_.getBounds)().is(bounds);
  stub(this.autocomplete_.getPlace)().is(place);

  expectCall(this.marker_.setMap)(null);
  expectCall(this.geocoder_.geocode)({address: name, bounds: bounds}, _)
      .willOnce(function(request, callback) {
        callback([geocode], google.maps.GeocoderStatus.OK);
      });
  expectCall(this.map_.setCenter)(location);
  expectCall(this.map_.setZoom)(15);
  expectCall(this.marker_.setOptions)({position: location, map: this.map_});

  cm.events.emit(this.autocomplete_, 'place_changed', place);
};

/** Verifies that the searchbox shows correctly. */
SearchboxTest.prototype.show = function() {
  var resize = createMockFunction('resize');
  cm.events.listen(this.span_, 'resize', resize);
  expectCall(resize)(_);

  this.searchbox_.show();
  expectEq('block', this.span_.style.display);
};

/** Verifies that the searchbox hides correctly. */
SearchboxTest.prototype.hide = function() {
  var resize = createMockFunction('resize');
  cm.events.listen(this.span_, 'resize', resize);
  expectCall(resize)(_);

  this.searchbox_.hide();
  expectEq('none', this.span_.style.display);
};
