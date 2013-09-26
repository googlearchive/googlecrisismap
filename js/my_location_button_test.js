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

// Author: Steven Hakusa (shakusa@googel.com)

goog.require('cm.css');

function MyLocationButtonTest() {
  cm.TestBase.call(this);

  this.map_ = createMockInstance(google.maps.Map);
  this.map_.controls = goog.object.create(
      google.maps.ControlPosition.TOP_RIGHT, []);
  this.myLocationButton_ = new cm.MyLocationButton(this.map_, {});
  this.button_ = this.map_.controls[google.maps.ControlPosition.TOP_RIGHT][0];
}
MyLocationButtonTest.prototype = new cm.TestBase();
registerTestSuite(MyLocationButtonTest);

/** Verifies button construction. */
MyLocationButtonTest.prototype.constructorTest = function() {
  expectThat(this.button_, isElement('div',
                                     withClass(cm.css.MAPBUTTON),
                                     withClass(cm.css.MY_LOCATION_BUTTON)));
};

/** Verifies that clicking emits a GO_TO_MY_LOCATION event. */
MyLocationButtonTest.prototype.clickTest = function() {
  var handler = createMockFunction('handler');
  cm.events.listen(goog.global, cm.events.GO_TO_MY_LOCATION, handler);
  expectCall(handler)(_);
  this.expectLogAction(cm.Analytics.MapAction.MY_LOCATION_CLICKED, null);
  cm.events.emit(this.button_, 'click');
};
