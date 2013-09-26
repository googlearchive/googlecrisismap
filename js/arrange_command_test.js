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

/**
 * @fileoverview Tests for the ArrangeCommand class.
 * @author romano@google.com (Raquel Romano)
 */

var FLAT_MAPROOT_JSON = {
  layers: [{id: 'layer1', type: cm.LayerModel.Type.KML},
           {id: 'layer2', type: cm.LayerModel.Type.KML},
           {id: 'layer3', type: cm.LayerModel.Type.KML}]};

var FOLDERS_MAPROOT_JSON = {
  layers: [{id: 'layer1', type: cm.LayerModel.Type.FOLDER,
            sublayers: [{id: 'layer2', type: cm.LayerModel.Type.KML}]},
           {id: 'layer3', type: cm.LayerModel.Type.FOLDER,
            sublayers: [{id: 'layer4', type: cm.LayerModel.Type.KML}]}
          ]};

function ArrangeCommandTest() {
  this.mapModel_ = cm.MapModel.newFromMapRoot(FLAT_MAPROOT_JSON);
  this.oldValue_ = [{id: 'layer1', sublayerIds: undefined},
                    {id: 'layer2', sublayerIds: undefined},
                    {id: 'layer3', sublayerIds: undefined}];
  this.newValue_ = [{id: 'layer2', sublayerIds: undefined},
                    {id: 'layer1', sublayerIds: undefined},
                    {id: 'layer3', sublayerIds: undefined}];
  this.appState_ = new cm.AppState();
}
registerTestSuite(ArrangeCommandTest);

/** Tests that execute() and undo() update the MapModel correctly. */
ArrangeCommandTest.prototype.testExecuteUndo = function() {
  var command = new cm.ArrangeCommand(this.oldValue_, this.newValue_);
  expectThat(this.mapModel_.getLayerIds(), elementsAre(
      ['layer1', 'layer2', 'layer3']));
  command.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(), elementsAre(
      ['layer2', 'layer1', 'layer3']));
  command.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(), elementsAre(
      ['layer1', 'layer2', 'layer3']));
};

/**
 * Nothing happens if the set of IDs in the map model differs from
 * the set in the command's new value.
 */
ArrangeCommandTest.prototype.testInvalidCommand = function() {
  expectThat(this.mapModel_.getLayerIds(), elementsAre(
      ['layer1', 'layer2', 'layer3']));
  this.newValue_.pop();
  var command = new cm.ArrangeCommand(this.oldValue_, this.newValue_);
  command.execute(this.appState_, this.mapModel_);
  // Map layers should not be updated.
  expectThat(this.mapModel_.getLayerIds(), elementsAre(
      ['layer1', 'layer2', 'layer3']));
};

/**
 * Test moving a folder into a folder.
 */
ArrangeCommandTest.prototype.moveToFromFolders = function() {
  this.mapModel_ = cm.MapModel.newFromMapRoot(FOLDERS_MAPROOT_JSON);
  this.oldValue_ = [{id: 'layer1', sublayerIds: [
                       {id: 'layer2', sublayerIds: undefined}]},
                    {id: 'layer3', sublayerIds: [
                       {id: 'layer4', sublayerIds: undefined}]}
                   ];
  this.newValue_ = [{id: 'layer1', sublayerIds: [
                       {id: 'layer2', sublayerIds: [
                          {id: 'layer3', sublayerIds: [
                             {id: 'layer4', sublayerIds: undefined}]}
                        ]}
                     ]}
                   ];
  var command = new cm.ArrangeCommand(this.oldValue_, this.newValue_);
  // Move layer3 into layer2
  command.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(), elementsAre(['layer1']));
  expectThat(this.mapModel_.getLayer('layer1').getSublayerIds(),
             elementsAre(['layer2']));
  expectThat(this.mapModel_.getLayer('layer2').getSublayerIds(),
             elementsAre(['layer3']));
  expectThat(this.mapModel_.getLayer('layer3').getSublayerIds(),
             elementsAre(['layer4']));
  expectEq(this.mapModel_.getLayer('layer2'),
           this.mapModel_.getLayer('layer3').get('parent'));
  // Move layer3 out of layer2
  command.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(), elementsAre(['layer1', 'layer3']));
  expectThat(this.mapModel_.getLayer('layer1').getSublayerIds(),
             elementsAre(['layer2']));
  expectEq(0, this.mapModel_.getLayer('layer2').getSublayerIds().length);
  expectThat(this.mapModel_.getLayer('layer3').getSublayerIds(),
             elementsAre(['layer4']));
  expectThat(this.mapModel_.getLayer('layer3').get('parent'), isUndefined);
};
