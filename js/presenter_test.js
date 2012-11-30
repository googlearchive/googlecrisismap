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

/** An equality function for comparing test results. */
google.maps.LatLng.prototype.gjstestEquals =
    google.maps.LatLng.prototype.equals;

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

  var events = [];
  this.events_ = events;
  this.setForTest_('cm.Analytics.logEvent',
                   function(category, action, label, value) {
    events.push([category, action, label, value]);
  });
}
PresenterTest.prototype = new cm.TestBase();
registerTestSuite(PresenterTest);

/** Tests that opening/closing the panel logs the correct Analytics events. */
PresenterTest.prototype.openClosePanel = function() {
  cm.events.emit(this.panelElem_, 'panelopen');
  expectThat(this.events_, recursivelyEquals([
    ['panel', 'open', 'map1', 1]
  ]));

  this.events_.splice(0, this.events_.length);  // clear the array in place
  cm.events.emit(this.panelElem_, 'panelclose');
  expectThat(this.events_, recursivelyEquals([
    ['panel', 'close', 'map1', 0]
  ]));
};

/** Tests that the resetView method sends the correct Analytics events. */
PresenterTest.prototype.resetView = function() {
  expectCall(this.mapView_.matchViewport)(_);
  expectCall(this.mapView_.updateMapType)();
  this.presenter_.resetView(this.mapModel_);
  expectThat(this.events_, recursivelyEquals([
    ['layer', 'reset_on', 'map1.layer1', 1]
  ]));

  this.events_.splice(0, this.events_.length);  // clear the array in place
  this.appState_.setLayerEnabled('layer1', false);
  this.appState_.setLayerEnabled('layer2', true);
  expectCall(this.mapView_.matchViewport)(_);
  expectCall(this.mapView_.updateMapType)();
  this.presenter_.resetView(this.mapModel_);
  expectThat(this.events_, recursivelyEquals([
    ['layer', 'reset_on', 'map1.layer1', 1],
    ['layer', 'reset_off', 'map1.layer2', 0]
  ]));

  this.events_.splice(0, this.events_.length);  // clear the array in place
  expectCall(this.mapView_.matchViewport)(_);
  expectCall(this.mapView_.updateMapType)();
  this.presenter_.resetView(this.mapModel_, '', true);
  expectThat(this.events_, recursivelyEquals([
    ['layer', 'load_on', 'map1.layer1', 1]
  ]));
};

/** Tests that zoomToUserLocation sets the map view correctly. */
PresenterTest.prototype.zoomToUserLocation = function() {
  this.setForTest_('navigator', {geolocation: {getCurrentPosition: function(f) {
    f({coords: {latitude: 40, longitude: -75}});
  }}});
  expectCall(this.mapView_.set)('zoom', 12);
  expectCall(this.mapView_.set)('center', new google.maps.LatLng(40, -75));
  this.presenter_.zoomToUserLocation(12);
};
