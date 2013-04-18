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

// Author: joeysilva@google.com (Joey Silva)

function SetDefaultViewCommandTest() {
  this.mapModel_ = cm.MapModel.newFromMapRoot({
    id: 'map', layers: [
      {id: 'a', type: cm.LayerModel.Type.KML},
      {id: 'b', type: cm.LayerModel.Type.KML},
      {id: 'c', type: cm.LayerModel.Type.KML}
    ]
  });

  // Use distinct old default instead of setting from default map model to
  // ensure the command is respecting this parameter, and not the map model.
  this.oldDefault_ = new cm.AppState('fr');
  this.oldDefault_.set('enabled_layer_ids', new goog.structs.Set(['a', 'b']));
  this.oldDefault_.set('layer_opacities', {a: 25, b: 75, c: 1});
  this.oldDefault_.set('viewport', new cm.LatLonBox(20, -20, 10, 10));
  this.oldDefault_.set('map_type', cm.MapModel.Type.ROADMAP);

  this.newDefault_ = new cm.AppState('es');
  this.newDefault_.set('enabled_layer_ids', new goog.structs.Set(['a', 'c']));
  this.newDefault_.set('layer_opacities', {a: 0, b: 50, c: 100});
  this.newDefault_.set('viewport', new cm.LatLonBox(10, -10, 20, 20));
  this.newDefault_.set('map_type', cm.MapModel.Type.SATELLITE);

  this.resetFired_ = false;
  this.resetMapModel_ = undefined;
  cm.events.listen(goog.global, cm.events.RESET_VIEW, function(e) {
    this.resetFired_ = true;
    this.resetMapModel_ = e.model;
  }, this);
}
registerTestSuite(SetDefaultViewCommandTest);

/**
 * Checks that the given mapModel corresponds to the given appState.
 * @param {cm.AppState} appState Expectation of the map model.
 * @param {cm.MapModel} mapModel Map model to check.
 * @private
 */
SetDefaultViewCommandTest.prototype.assertMapModel_ = function(appState,
    mapModel) {
  expectEq(appState.get('viewport'), mapModel.get('viewport'));
  expectEq(appState.get('map_type'), mapModel.get('map_type'));
  var opacities = appState.get('layer_opacities');
  var enabledLayerIds = appState.get('enabled_layer_ids');
  cm.util.forLayersInMap(mapModel, function(layer) {
    var id = /** @type {string} */ (layer.get('id'));
    var opacity = layer.get('opacity');
    var matchers = [equals(opacity * 100)];
    if (opacity === 1) {
      matchers.push(isUndefined);
    }
    expectThat(opacities[id], anyOf(matchers),
               'Unexpected opacity for layer id ' + id);
    expectEq(enabledLayerIds.contains(id), layer.get('default_visibility'),
             'Unexpected visibility for layer id ' + id);
  });
};

/** Tests execute() when setting the default view. */
SetDefaultViewCommandTest.prototype.testExecute = function() {
  var command = new cm.SetDefaultViewCommand(
      this.oldDefault_, this.newDefault_);
  command.execute(null, this.mapModel_);

  this.assertMapModel_(this.newDefault_, this.mapModel_);
  expectTrue(this.resetFired_);
  expectEq(this.mapModel_, this.resetMapModel_);
};

/** Tests undo() */
SetDefaultViewCommandTest.prototype.testUndo = function() {
  var command = new cm.SetDefaultViewCommand(
      this.oldDefault_, this.newDefault_);
  command.execute(null, this.mapModel_);
  command.undo(null, this.mapModel_);

  this.assertMapModel_(this.oldDefault_, this.mapModel_);
  expectTrue(this.resetFired_);
  expectEq(this.mapModel_, this.resetMapModel_);
};
