// Copyright 2014 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

// @author shakusa@google.com (Steve Hakusa)

function LayerMenuEditorTest() {
  cm.TestBase.call(this);
  this.mapModel_ = cm.MapModel.newFromMapRoot({
    'id': 'map1',
    'layers': [
      {'id': 'layer1', title: 'Layer One', type: 'KML'},
      {'id': 'folder1', title: 'Folder One', type: 'FOLDER',
       'sublayers': [
         {'id': 'sublayer1', title: 'Sublayer One', type: 'KML'}
       ]}
    ]
  });
}
LayerMenuEditorTest.prototype = new cm.TestBase();
registerTestSuite(LayerMenuEditorTest);

/**
 * Constructs the LayerMenuEditor.
 * @param {boolean=} opt_multi If true, create a multi-select menu editor.
 * @return {Element} An element containing the new LayerMenuEditor.
 * @private
 */
LayerMenuEditorTest.prototype.createEditor_ = function(opt_multi) {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.LayerMenuEditor(
      parent, 'layer_editor',
      {choices: [], multiple: opt_multi, map_model: this.mapModel_});
  expectDescendantOf(parent, 'option', withText('Layer One'));
  expectDescendantOf(parent, 'option', withText('Folder One'));
  expectDescendantOf(parent, 'option', withText('Sublayer One'));
  return parent;
};

/**
 * Expect the given select input's options to have the given values.
 * @param {Array.<boolean>} selected The expected values.
 * @private
 */
LayerMenuEditorTest.prototype.expectSelected_ = function(selected) {
  goog.array.forEach(selected, function(s, i) {
    expectEq(s, this.editor_.selectElem.options[i].selected);
  }, this);
};

/** Tests construction of the editor. */
LayerMenuEditorTest.prototype.testConstructor = function() {
  this.createEditor_();
  expectEq('layer1', this.editor_.get('value'));
  this.expectSelected_([true, false, false]);
};

/** Tests construction of a multi-select editor. */
LayerMenuEditorTest.prototype.testConstructorMulti = function() {
  this.createEditor_(true);
  expectThat(this.editor_.get('value'), elementsAre([]));
  this.expectSelected_([false, false, false]);
};

/** Tests menu updates when layers in the model change. */
LayerMenuEditorTest.prototype.testLayerUpdate = function() {
  var parent = this.createEditor_(true);
  this.mapModel_.get('layers').removeAt(1);
  expectDescendantOf(parent, 'option', withText('Layer One'));
  expectNoDescendantOf(parent, 'option', withText('Folder One'));
  expectNoDescendantOf(parent, 'option', withText('Sublayer One'));
  this.expectSelected_([false]);
};

/** Tests menu updates when sublayers in the model change. */
LayerMenuEditorTest.prototype.testSublayerUpdate = function() {
  var parent = this.createEditor_(true);
  this.editor_.set('value', ['layer1', 'sublayer1']);
  this.expectSelected_([true, false, true]);
  this.mapModel_.getLayer('folder1').get('sublayers').push(
    cm.LayerModel.newFromMapRoot(
      {'id': 'sublayer2', title: 'Sublayer Two', type: 'KML'}));
  expectDescendantOf(parent, 'option', withText('Sublayer Two'));
  this.expectSelected_([true, false, true, false]);
};
