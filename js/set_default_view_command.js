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
 * @fileoverview [MODULE: edit] Sets the default view of the map model.
 * @author joeysilva@google.com (Joey Silva)
 */
goog.provide('cm.SetDefaultViewCommand');

goog.require('cm.Command');

/**
 * A command to update the relevant properties of the current map model based on
 * the current app state.
 * @constructor
 * @param {cm.AppState} oldDefault The previous app state to revert to on undo.
 * @param {cm.AppState} newDefault The app state that will be written to the
 *     map model.
 * @implements cm.Command
 */
cm.SetDefaultViewCommand = function(oldDefault, newDefault) {
  /**
   * The previous default view encoded in an AppState object, saved when this
   * command is executed and restored when this command is undone.
   * @type {cm.AppState}
   * @private
   */
  this.oldDefault_ = oldDefault;

  /**
   * The new default state, saved when this command is executed.
   * @type {cm.AppState}
   * @private
   */
  this.newDefault_ = newDefault;
};

/** @override */
cm.SetDefaultViewCommand.prototype.execute = function(appState, mapModel) {
  this.newDefault_.writeToMapModel(mapModel);
  cm.events.emit(goog.global, cm.events.RESET_VIEW, {model: mapModel});
  return true;
};

/** @override */
cm.SetDefaultViewCommand.prototype.undo = function(appState, mapModel) {
  this.oldDefault_.writeToMapModel(mapModel);
  cm.events.emit(goog.global, cm.events.RESET_VIEW, {model: mapModel});
  return true;
};
