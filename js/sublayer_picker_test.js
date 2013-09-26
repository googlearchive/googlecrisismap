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

function SublayerPickerTest() {
  cm.TestBase.call(this);
  var json = {
    type: 'FOLDER',
    title: 'Parent Folder',
    sublayers: [
      {type: 'KML', id: 'unselected1', title: 'Unselected 1'},
      {type: 'KML', id: 'selected', title: 'Selected',
       default_visibility: 'CHECK'},
      {type: 'KML', id: 'unselected2', title: 'Unselected 2'}
    ]};
  this.layer_ = cm.LayerModel.newFromMapRoot(json);

  this.parent_ = new FakeElement('div');
  this.sublayerPicker_ = new cm.SublayerPicker(
      this.parent_, this.layer_, 'selected');
}
SublayerPickerTest.prototype = new cm.TestBase();
registerTestSuite(SublayerPickerTest);

/** Tests that the menu was created with an option for each sublayer. */
SublayerPickerTest.prototype.testConstructor = function() {
  expectDescendantOf(this.parent_, withText('Selected'));
  this.layer_.get('sublayers').forEach(goog.bind(function(sublayer) {
    if (sublayer.get('id') !== 'selected') {
      expectNoDescendantOf(this.parent_, withText(sublayer.get('title')));
    }
  }, this));
};

/**
 * Tests the menu selection listener.
 */
SublayerPickerTest.prototype.testMenuSelect = function() {
  var selected = 'selected';
  cm.events.listen(this.sublayerPicker_, cm.events.SELECT_SUBLAYER,
    function(event) { selected = event.id; });

  // Select a new sublayer.
  this.sublayerPicker_.select_.setSelectedIndex(2);
  cm.events.emit(this.sublayerPicker_, goog.ui.Component.EventType.CHANGE);
  expectEq('unselected2', selected);

  // Select the original sublayer.
  this.sublayerPicker_.select_.setSelectedIndex(1);
  cm.events.emit(this.sublayerPicker_, goog.ui.Component.EventType.CHANGE);
  expectEq('selected', selected);
};

/**
 * Tests that the picker can be constructed for empty folders.
 */
SublayerPickerTest.prototype.testEmptyFolder = function() {
  var json = {
    type: 'FOLDER',
    title: 'Empty Folder',
    sublayers: []};
  var layer = cm.LayerModel.newFromMapRoot(json);
  var sublayerPicker = new cm.SublayerPicker(this.parent_, layer, '');
};
