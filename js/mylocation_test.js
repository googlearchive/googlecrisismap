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

function MyLocationButtonTest() {
  cm.ui.create = createMockFunction('ui.create');

  this.button_ = expectCreate(
      'BUTTON', 'div', {'class': 'cm-mapbutton cm-mylocation-button',
                        'index': -1});

  this.map_ = gjstest.createMockInstance(google.maps.Map);
  this.map_.controls = {};
  this.map_.controls[google.maps.ControlPosition.TOP_RIGHT] = [];

  this.myLocationButton_ = new cm.MyLocationButton(this.map_, {});
}
registerTestSuite(MyLocationButtonTest);

/** Tests button construction. */
MyLocationButtonTest.prototype.constructorTest = function() {
  // Position to the outside of the default maptype controls
  expectEq(this.button_,
           this.map_.controls[google.maps.ControlPosition.TOP_RIGHT][0]);
};

/** Tests click emits a GO_TO_MY_LOCATION event. */
MyLocationButtonTest.prototype.clickTest = function() {
  var handler = gjstest.createMockFunction('handler');
  cm.events.listen(goog.global, cm.events.GO_TO_MY_LOCATION, handler);
  expectCall(handler)(_);
  cm.events.emit(this.button_, 'click');
};
