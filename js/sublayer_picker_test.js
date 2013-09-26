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

goog.require('cm.css');

/**
 * @fileoverview Tests for the SublayerPicker class.
 * @author romano@google.com (Raquel Romano)
 */

/**
 * @constructor
 */
function SublayerPickerTest() {
  cm.TestBase.call(this);
  var json = {
    type: 'FOLDER',
    tags: [cm.LayerModel.IS_TIME_SERIES_FOLDER],
    sublayers: [
      {type: 'KML', last_update: '1321671420'},
      {type: 'KML', last_update: '1321757820', title: 'Most Recent'},
      {type: 'KML', last_update: '1321498620', title: 'Least Recent',
       id: 'least-recent'}
  ]};
  this.layer_ = cm.LayerModel.newFromMapRoot(json);
}
SublayerPickerTest.prototype = new cm.TestBase();
registerTestSuite(SublayerPickerTest);

/** Tests that the menu was created with an option for each sublayer. */
SublayerPickerTest.prototype.testConstructor = function() {
  var parent = new FakeElement('div');
  var sublayerPicker = new cm.SublayerPicker(parent, this.layer_);
  var menu = expectDescendantOf(parent, withClass(cm.css.SUBLAYER_PICKER));
  this.layer_.get('sublayers').forEach(function(sublayer) {
    expectDescendantOf(menu, withText(sublayer.get('title')));
  });
  expectDescendantOf(menu, withText(MSG_MULTIPLE_DATES));
};

/**
 * Tests that the default menu option is the most recent sublayer.
 */
SublayerPickerTest.prototype.testDefaultOption = function() {
  var parent = new FakeElement('div');
  var sublayerPicker = new cm.SublayerPicker(parent, this.layer_);
  var selected = expectDescendantOf(parent, withText('Most Recent'));
  expectEq('selected', selected.className);
};

/**
 * Tests that the default menu option is the multiple dates optoins
 * when no sublayers have last update times.
 */
SublayerPickerTest.prototype.testDefaultOptionMultiple = function() {
  this.layer_.get('sublayers').forEach(function(sublayer) {
    sublayer.set('last_update', undefined);
  });
  var parent = new FakeElement('div');
  var sublayerPicker = new cm.SublayerPicker(parent, this.layer_);
  var selected = expectDescendantOf(parent, withText(MSG_MULTIPLE_DATES));
  expectEq('selected', selected.className);
};

/**
 * Tests the menu open/close listeners.
 */
SublayerPickerTest.prototype.testMenuVisibility = function() {
  var parent = new FakeElement('div');
  var sublayerPicker = new cm.SublayerPicker(parent, this.layer_);
  var button = expectDescendantOf(parent, withClass(cm.css.CALENDAR_BUTTON));
  var menu = expectDescendantOf(parent, withClass(cm.css.SUBLAYER_PICKER));

  expectEq('none', menu.style.display);
  cm.events.emit(button, 'click');
  expectEq('inline-block', menu.style.display);
  cm.events.emit(button, 'click');
  expectEq('none', menu.style.display);
};

/**
 * Tests the menu selection listeners.
 */
SublayerPickerTest.prototype.testMenuSelect = function() {
  var toggled = {};
  this.layer_.get('sublayers').forEach(function(sublayer) {
    toggled[sublayer.get('id')] = false;
    sublayer.set('last_update', undefined);
  });
  toggled[cm.LayerEntryView.MULTIPLE_DATES_OPTION] = false;

  var parent = new FakeElement('div');
  var sublayerPicker = new cm.SublayerPicker(parent, this.layer_);
  cm.events.listen(sublayerPicker, cm.events.SELECT_SUBLAYER,
    function(event) { toggled[event.id] = !toggled[event.id]; });

  var single = findDescendantOf(parent, withText('Least Recent'));
  var multiple = expectDescendantOf(parent, withText(MSG_MULTIPLE_DATES));

  // Click on a sublayer
  cm.events.emit(single, 'click');
  expectTrue(toggled['least-recent']);

  // Click on multiple dates option
  cm.events.emit(multiple, 'click');
  expectTrue(toggled[cm.LayerEntryView.MULTIPLE_DATES_OPTION]);

  // Click on a sublayer
  cm.events.emit(single, 'click');
  expectFalse(toggled['least-recent']);
};

