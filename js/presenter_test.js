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

goog.require('cm.Analytics');
goog.require('goog.testing.MockClock');

function PresenterTest() {
  cm.TestBase.call(this);

  this.appState_ = new cm.AppState();
  this.mapView_ = createMockInstance(cm.MapView);
  this.panelView_ = createMockInstance(cm.PanelView);
  this.panelElem_ = new FakeElement('div');
  this.presenter_ = new cm.Presenter(
      this.appState_, this.mapView_, this.panelView_, this.panelElem_, 'map1');
}
PresenterTest.prototype = new cm.TestBase();
registerTestSuite(PresenterTest);

/** Tests that zoomToUserLocation sets the map view correctly. */
PresenterTest.prototype.zoomToUserLocation = function() {
  this.setForTest_('navigator', {geolocation: {getCurrentPosition: function(f) {
    f({coords: {latitude: 40, longitude: -75}});
  }}});
  expectCall(this.mapView_.set)('zoom', 12);
  expectCall(this.mapView_.set)('center', new google.maps.LatLng(40, -75));
  this.presenter_.zoomToUserLocation(12);
};

/**
 * Tests that when the layer filter query changes, that change is reflected
 * in the app state.
 */
PresenterTest.prototype.filterQueryChanged = function() {
  var query = 'a query';
  this.appState_.setFilterQuery('');
  expectEq('', this.appState_.getFilterQuery());
  cm.events.emit(this.panelView_, cm.events.FILTER_QUERY_CHANGED,
    {query: query});
  expectEq(query, this.appState_.getFilterQuery());
};

/**
 * Tests that an analytics event is logged when a filter query is entered.
 */
PresenterTest.prototype.filterQueryChangeLogging = function() {
  var clock = new goog.testing.MockClock(true);
  this.expectLogAction(
      cm.Analytics.LayersTabAction.FILTER_QUERY_ENTERED, null, 1);

  // Log the action one second after last change event.
  cm.events.emit(this.panelView_, cm.events.FILTER_QUERY_CHANGED,
      {query: 'fo'});
  clock.tick(999);
  cm.events.emit(this.panelView_, cm.events.FILTER_QUERY_CHANGED,
      {query: 'foo'});
  clock.tick(1000);

  // Verify that no action is logged if there is no query.
  cm.events.emit(this.panelView_, cm.events.FILTER_QUERY_CHANGED, {query: ''});
  clock.tick(1000);
  cm.events.emit(this.panelView_, cm.events.FILTER_QUERY_CHANGED,
      {query: null});
  clock.tick(1000);
  cm.events.emit(this.panelView_, cm.events.FILTER_QUERY_CHANGED);
  clock.tick(1000);

  clock.uninstall();
};

/**
 * Helper function to mock feature selection in the tabbed UI.
 * @param {boolean} below Whether the tab panel is positioned below the map.
 * @param {boolean} expanded Whether the tab panel is expanded.
 * @private
 */
PresenterTest.prototype.setupFeatureSelection_ = function(below, expanded) {
  this.panelView_ = createMockInstance(cm.TabPanelView);
  this.presenter_ = new cm.Presenter(
      this.appState_, this.mapView_, this.panelView_, this.panelElem_, 'map1');
  stub(this.panelView_.isBelowMap)().is(below);
  stub(this.panelView_.isExpanded)().is(expanded);
};

/**
 * Tests that the map pans when a feature is clicked and the panel is
 * below the map and collapsed.
 */
PresenterTest.prototype.testFeatureClickPanelBelowCollapsed = function() {
  var event = {position: new google.maps.LatLng(12, 34)};
  this.setupFeatureSelection_(true, false);
  expectCall(this.panelView_.selectFeature)(_);
  expectCall(this.mapView_.focusOnPoint)(event.position);
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, event);
};

/**
 * Tests that the map does not pan when a feature is clicked and the
 * panel is below the map and expanded.
 */
PresenterTest.prototype.testFeatureClickPanelBelowExpanded = function() {
  this.setupFeatureSelection_(true, true);
  expectCall(this.panelView_.selectFeature)(_);
  this.mapView_.focusOnPoint = function() { throw new Error('Bad call'); };
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, {position: null});
};

/**
 * Tests that the map does not pan when a feature is clicked and the
 * panel is floating.
 */
PresenterTest.prototype.testFeatureClickPanelFloating = function() {
  this.setupFeatureSelection_(false, true);
  expectCall(this.panelView_.selectFeature)(_);
  this.mapView_.focusOnPoint = function() { throw new Error('Bad call'); };
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, {position: null});
};

/**
 * Tests that the map pans if a feature has been selected and is no longer
 * visible when the details tab is opened, with the tab panel below the map.
 */
PresenterTest.prototype.testFeatureClickMarkerNotVisible = function() {
  var event = {position: new google.maps.LatLng(12, 34)};
  this.setupFeatureSelection_(true, true);

  // Select a feature.
  expectCall(this.panelView_.selectFeature)(_);
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, event);

  // Set the viewport so that the clicked point is no longer visible.
  var viewport = new cm.LatLonBox(10, 0, 10, 0);
  expectCall(this.mapView_.get)('viewport').willOnce(returnWith(viewport));

  // Should pan when the details tab is opened.
  expectCall(this.mapView_.focusOnPoint)(event.position);
  cm.events.emit(cm.app, cm.events.DETAILS_TAB_OPENED);
};

/**
 * Tests that the map pans if a feature has been selected and is no longer
 * visible when the details tab is opened, with a floating tab panel.
 */
PresenterTest.prototype.testFeatureClickMarkerNotVisible2 = function() {
  var event = {position: new google.maps.LatLng(12, 34)};
  this.setupFeatureSelection_(false, true);

  // Select a feature.
  expectCall(this.panelView_.selectFeature)(_);
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, event);

  // Set the viewport so that the clicked point is no longer visible.
  var viewport = new cm.LatLonBox(10, 0, 10, 0);
  expectCall(this.mapView_.get)('viewport').willOnce(returnWith(viewport));

  // Should pan when the details tab is opened.
  expectCall(this.mapView_.focusOnPoint)(_);
  cm.events.emit(cm.app, cm.events.DETAILS_TAB_OPENED);
};

/*
 * Tests that on the map does not pan if a feature has been selected and is
 * still visible when the details tab is opened, with the tab panel below the
 * map.
 */
PresenterTest.prototype.testFeatureClickMarkerVisible = function() {
  var event = {position: new google.maps.LatLng(12, 34)};
  this.setupFeatureSelection_(true, true);

  // Select a feature.
  expectCall(this.panelView_.selectFeature)(_);
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, event);

  // Set the viewport so that the clicked point is still visible.
  viewport = new cm.LatLonBox(50, 0, 50, 0);
  expectCall(this.mapView_.get)('viewport').willOnce(returnWith(viewport));

  // Should not pan when the details tab is opened.
  this.mapView_.focusOnPoint = function() { throw new Error('Bad call'); };
  cm.events.emit(cm.app, cm.events.DETAILS_TAB_OPENED);
};

/*
 * Tests that on the map does not pan if a feature has been selected and is
 * still visible when the details tab is opened, with a floating tab panel.
 */
PresenterTest.prototype.testFeatureClickMarkerVisible2 = function() {
  var event = {position: new google.maps.LatLng(12, 34)};
  this.setupFeatureSelection_(false, true);

  // Select a feature.
  expectCall(this.panelView_.selectFeature)(_);
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, event);

  // Set the viewport so that the clicked point is still visible.
  viewport = new cm.LatLonBox(50, 0, 50, 0);
  expectCall(this.mapView_.get)('viewport').willOnce(returnWith(viewport));

  // Should not pan when the details tab is opened.
  this.mapView_.focusOnPoint = function() { throw new Error('Bad call'); };
  cm.events.emit(cm.app, cm.events.DETAILS_TAB_OPENED);
};
