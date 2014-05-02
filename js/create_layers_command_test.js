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

function CreateLayersCommandTest() {
  this.mapModel_ = cm.MapModel.newFromMapRoot(
      {layers: [{id: 'a', type: 'KML'},
                {id: 'b', type: 'KML'}]});
  this.appState_ = new cm.AppState();
  this.singleCommand_ = new cm.CreateLayersCommand({
    title: 'Single Layer', type: 'KML'
  });
  this.multipleCommand_ = new cm.CreateLayersCommand([
    {title: 'Layer One', type: 'KML'},
    {title: 'Layer Two', type: 'KML'}
  ]);
}
registerTestSuite(CreateLayersCommandTest);

/**
 * Tests that execute() updates the MapModel and AppState correctly for a
 * single layer.
 */
CreateLayersCommandTest.prototype.testExecuteSingle = function() {
  this.singleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayer('1'), not(isUndefined));
  expectTrue(this.appState_.getLayerEnabled('1'));
};

/**
 * Tests that execute() updates the MapModel and AppState correctly for multiple
 * layers.
 */
CreateLayersCommandTest.prototype.testExecuteMultiple = function() {
  this.multipleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayer('1'), not(isUndefined));
  expectTrue(this.appState_.getLayerEnabled('1'));
  expectThat(this.mapModel_.getLayer('2'), not(isUndefined));
  expectTrue(this.appState_.getLayerEnabled('2'));
};

/**
 * Tests that undo() updates the MapModel and AppState correctly for a single
 * layer.
 */
CreateLayersCommandTest.prototype.testUndoSingle = function() {
  this.singleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayer('1'), not(isUndefined));
  expectTrue(this.appState_.getLayerEnabled('1'));

  this.singleCommand_.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayer('1'), isUndefined);
  expectFalse(this.appState_.getLayerEnabled('1'));
};

/**
 * Tests that undo() updates the MapModel and AppState correctly for multiple
 * layer.
 */
CreateLayersCommandTest.prototype.testUndoMultiple = function() {
  this.multipleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayer('1'), not(isUndefined));
  expectTrue(this.appState_.getLayerEnabled('1'));
  expectThat(this.mapModel_.getLayer('2'), not(isUndefined));
  expectTrue(this.appState_.getLayerEnabled('2'));

  this.multipleCommand_.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayer('1'), isUndefined);
  expectFalse(this.appState_.getLayerEnabled('1'));
  expectThat(this.mapModel_.getLayer('2'), isUndefined);
  expectFalse(this.appState_.getLayerEnabled('2'));
};

/**
 * Tests that the layer ID is preserved by an execute-undo-execute
 * sequence (when the user requests to undo and redo the command),
 * for a single layer.
 */
CreateLayersCommandTest.prototype.redoPreservesLayerId = function() {
  this.singleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(),
      elementsAre(['1', 'a', 'b']));

  this.singleCommand_.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(),
      elementsAre(['a', 'b']));

  this.singleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(),
      elementsAre(['1', 'a', 'b']));
};

/**
 * Tests that the layer ID is preserved by an execute-undo-execute
 * sequence (when the user requests to undo and redo the command),
 * for multiple layers.
 */
CreateLayersCommandTest.prototype.redoPreservesLayerIdMultiple = function() {
  this.multipleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(),
             whenSorted(elementsAre(['1', '2', 'a', 'b'])));

  this.multipleCommand_.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(),
             whenSorted(elementsAre(['a', 'b'])));

  this.multipleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getLayerIds(),
             whenSorted(elementsAre(['1', '2', 'a', 'b'])));
};

/** Tests that we can create a folder with sublayers, and undo and redo it. */
CreateLayersCommandTest.prototype.testCreateFolder = function() {
  this.multipleCommand_ = new cm.CreateLayersCommand([
    {title: 'Folder A', type: cm.LayerModel.Type.FOLDER, sublayers: [
        {title: 'Sublayer A', type: 'KML'},
        {title: 'Sublayer B', type: 'KML'}]},
    {title: 'Folder B', type: cm.LayerModel.Type.FOLDER}
  ]);
  this.multipleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getAllLayerIds(),
             whenSorted(elementsAre(['1', '2', '3', '4', 'a', 'b'])));
  expectEq(cm.LayerModel.Type.FOLDER,
           this.mapModel_.getLayer('1').get('type'));
  expectEq(cm.LayerModel.Type.FOLDER,
           this.mapModel_.getLayer('4').get('type'));

  this.multipleCommand_.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getAllLayerIds(),
             whenSorted(elementsAre(['a', 'b'])));

  this.multipleCommand_.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getAllLayerIds(),
             whenSorted(elementsAre(['1', '2', '3', '4', 'a', 'b'])));
};
