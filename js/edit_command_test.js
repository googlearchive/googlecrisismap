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

// Author: kpy@google.com (Ka-Ping Yee)

function EditCommandTest() {
  this.appState_ = new google.maps.MVCObject();
  this.mapModel_ = cm.MapModel.newFromMapRoot(
      {layers: [{id: 'layer0', type: 'KML'}]});
  this.mapModel_.setValues({x: 4, y: 5, z: 6});
  this.mapModel_.layers.getAt(0).setValues({x: 4, y: 5, z: 6});
  this.oldValues_ = {x: 1, y: null, z: undefined, map_type: 'ROADMAP'};
  this.newValues_ = {x: 7, y: null, z: undefined, map_type: 'SATELLITE'};
}
registerTestSuite(EditCommandTest);

/** Tests execute() when editing a map object. */
EditCommandTest.prototype.testExecuteMap = function() {
  var command = new cm.EditCommand(this.oldValues_, this.newValues_);
  command.execute(this.appState_, this.mapModel_);
  expectEq(7, this.mapModel_.x);
  expectEq(null, this.mapModel_.y);  // null means set to null
  expectEq(6, this.mapModel_.z);  // undefined means don't touch
  expectEq('SATELLITE', this.appState_.get('map_type'));
};

/** Tests undo() when editing a map object. */
EditCommandTest.prototype.testUndoMap = function() {
  var command = new cm.EditCommand(this.oldValues_, this.newValues_);
  command.execute(this.appState_, this.mapModel_);
  command.undo(this.appState_, this.mapModel_);
  expectEq(1, this.mapModel_.x);
  expectEq(null, this.mapModel_.y);  // null means set to null
  expectEq(6, this.mapModel_.z);  // undefined means don't touch
  expectEq('ROADMAP', this.appState_.get('map_type'));
};

/** Tests execute() when editing a layer object. */
EditCommandTest.prototype.testExecuteLayer = function() {
  var command = new cm.EditCommand(this.oldValues_, this.newValues_, 'layer0');
  var layer = this.mapModel_.layers.getAt(0);
  command.execute(this.appState_, this.mapModel_);
  expectEq(7, layer.x);
  expectEq(null, layer.y);
  expectEq(6, layer.z);
};

/** Tests undo() when editing a layer object. */
EditCommandTest.prototype.testUndoLayer = function() {
  var command = new cm.EditCommand(this.oldValues_, this.newValues_, 'layer0');
  var layer = this.mapModel_.layers.getAt(0);
  command.execute(this.appState_, this.mapModel_);
  command.undo(this.appState_, this.mapModel_);
  expectEq(1, layer.x);
  expectEq(null, layer.y);
  expectEq(6, layer.z);
};
