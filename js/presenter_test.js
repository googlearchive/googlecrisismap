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

function PresenterTest() {
  cm.TestBase.call(this);

  this.mapModel_ = cm.MapModel.newFromMapRoot({
    title: 'title',
    layers: [{
      id: 'layer1',
      type: 'KML',
      title: 'one',
      visibility: 'DEFAULT_ON'
    }, {
      id: 'layer2',
      type: 'KML',
      title: 'two',
      visibility: 'DEFAULT_OFF'
    }]
  });
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

/* Tests that the map pans under the right conditions on a feature click. */
PresenterTest.prototype.selectFeature = function() {
  this.panelView_ = createMockInstance(cm.TabPanelView);
  this.presenter_ = new cm.Presenter(
      this.appState_, this.mapView_, this.panelView_, this.panelElem_, 'map1');

  var event = {position: new google.maps.LatLng(12, 34)};

  // Should pan when panel is below map and collapsed.
  stub(this.panelView_.isBelowMap)().is(true);
  stub(this.panelView_.isExpanded)().is(false);

  expectCall(this.panelView_.selectFeature)(_);
  expectCall(this.mapView_.focusOnPoint)(event.position);
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, event);

  // Should not pan when panel is floating.
  stub(this.panelView_.isBelowMap)().is(false);

  expectCall(this.panelView_.selectFeature)(_);
  this.mapView_.focusOnPoint = function() { throw new Error('Bad call'); };
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, event);

  // Should not pan when panel is below map and expanded.
  stub(this.panelView_.isBelowMap)().is(true);
  stub(this.panelView_.isExpanded)().is(true);

  expectCall(this.panelView_.selectFeature)(_);
  this.mapView_.focusOnPoint = function() { throw new Error('Bad call'); };
  cm.events.emit(this.mapView_, cm.events.SELECT_FEATURE, event);
};
