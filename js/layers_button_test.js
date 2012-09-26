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

// Author: romano@google.com (Raquel Romano)

function LayersButtonTest() {
  cm.ui.create = createMockFunction('ui.create');

  this.button_ = expectCreate(
      'BUTTON', 'div', {'class': 'cm-panel-button cm-mapbutton'},
      cm.LayersButton.MSG_LAYER_BUTTON_);
  this.button_.index = 0;

  this.map_ = gjstest.createMockInstance(google.maps.Map);
  this.map_.controls = {};
  this.map_.controls[google.maps.ControlPosition.TOP_RIGHT] = [];

  this.layersButton_ = new cm.LayersButton(this.map_, {});
}
registerTestSuite(LayersButtonTest);

/**
 * Verifies constructor adds button to map.
 */
LayersButtonTest.prototype.constructorTest = function() {
  expectEq(2, this.button_.index);
  expectEq(this.button_,
           this.map_.controls[google.maps.ControlPosition.TOP_RIGHT][0]);
};

/**
 * Indirectly verifies that a button click opens the panel by
 * verifying that the button class has changed to now be selected.
 */
LayersButtonTest.prototype.buttonClickOpensPanel = function() {
  this.button_.className = 'cm-panel-button cm-mapbutton';
  cm.events.emit(this.button_, 'click');
  expectEq('cm-panel-button cm-mapbutton cm-selected',
           this.button_.className);
};

/**
 * Indirectly verifies that a button click closes the panel by
 * verifying that the button class has changed to now be unselected.
 */
LayersButtonTest.prototype.buttonClickClosesPanel = function() {
  this.button_.className = 'cm-panel-button cm-mapbutton cm-selected';
  cm.events.emit(this.button_, 'click');
  expectEq('cm-panel-button cm-mapbutton', this.button_.className);
};
