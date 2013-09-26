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

goog.require('cm.css');

function LayersButtonTest() {
  cm.TestBase.call(this);

  this.map_ = createMockInstance(google.maps.Map);
  this.map_.controls = goog.object.create(
      google.maps.ControlPosition.TOP_RIGHT, []);
  this.layersButton_ = new cm.LayersButton(this.map_, {});
  this.button_ = this.map_.controls[google.maps.ControlPosition.TOP_RIGHT][0];
}
LayersButtonTest.prototype = new cm.TestBase();
registerTestSuite(LayersButtonTest);

/** Verifies button construction. */
LayersButtonTest.prototype.constructorTest = function() {
  expectEq(2, this.button_.index);
  expectThat(this.button_, isElement(
      'div', withClass(cm.css.MAPBUTTON), withClass(cm.css.PANEL_BUTTON),
      withText(cm.MSG_LAYER_BUTTON)));
};

/**
 * Indirectly verifies that a button click opens the panel by
 * verifying that the button class has changed to now be selected.
 */
LayersButtonTest.prototype.buttonClickOpensPanel = function() {
  this.expectLogAction(cm.Analytics.MapAction.LAYERS_PANEL_TOGGLED_ON, null);
  cm.events.emit(this.button_, 'click');
  expectThat(this.button_, isElement(withClass(cm.css.SELECTED)));
};

/**
 * Indirectly verifies that a button click closes the panel by
 * verifying that the button class has changed to now be unselected.
 */
LayersButtonTest.prototype.buttonClickClosesPanel = function() {
  this.button_.className =
      [cm.css.PANEL_BUTTON, cm.css.MAPBUTTON, cm.css.SELECTED].join(' ');
  this.expectLogAction(cm.Analytics.MapAction.LAYERS_PANEL_TOGGLED_OFF, null);
  cm.events.emit(this.button_, 'click');
  expectThat(this.button_, isElement(not(withClass(cm.css.SELECTED))));
};
