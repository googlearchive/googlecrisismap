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
      {type: 'KML', id: 'sub0', title: 'Unselected 1'},
      {type: 'KML', id: 'sub1', title: 'Selected',
       default_visibility: 'CHECK'},
      {type: 'KML', id: 'sub2', title: 'Unselected 2'}
    ]};
  this.layer_ = cm.LayerModel.newFromMapRoot(json);

  this.parent_ = new FakeElement('div');
  this.sublayerPicker_ = new cm.SublayerPicker(
      this.parent_, this.layer_, 'sub1');
  this.select_ = this.sublayerPicker_.select_;
}
SublayerPickerTest.prototype = new cm.TestBase();
registerTestSuite(SublayerPickerTest);

/** Tests that the menu was created with the expected selection. */
SublayerPickerTest.prototype.testConstructor = function() {
  expectTrue(this.select_.options[1].selected);
};

/**
 * Tests the menu selection listener.
 */
SublayerPickerTest.prototype.testMenuSelect = function() {
  var selected = 'sub1';
  cm.events.listen(this.sublayerPicker_, cm.events.SELECT_SUBLAYER,
    function(event) { selected = event.id; });
  this.captureAnalyticsLogs_();

  // Select a new sublayer.
  this.select_.value = 'sub2';
  cm.events.emit(this.sublayerPicker_.select_, 'change');
  expectEq('sub2', selected);

  // Select the original sublayer.
  this.select_.value = 'sub1';
  cm.events.emit(this.sublayerPicker_.select_, 'change');
  expectEq('sub1', selected);

  var sublayer_logs = this.analyticsLogs_().filter(function(x) {
    return x.action === cm.Analytics.LayersPanelAction.SUBLAYER_SELECTED;
  });
  expectThat(
      goog.array.map(sublayer_logs, function(act) {return act.layerId;}),
      elementsAre(['sub2', 'sub1']));
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
