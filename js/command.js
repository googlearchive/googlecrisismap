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
 * @fileoverview [MODULE: edit] The interface for all undoable commands.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.Command');

goog.require('cm.AppState');
goog.require('cm.MapModel');

/**
 * A Command is an object that encapsulates an undoable user action.
 * Instances of Command should contain all the information they need to
 * carry out the action, undo the action, and redo the action.
 * @interface
 */
cm.Command = function() {};

/**
 * @param {cm.AppState} appState The state of the application.
 * @param {cm.MapModel} mapModel The map model.
 * @return {boolean} True if the execution of the command succeeded.
 */
cm.Command.prototype.execute = function(appState, mapModel) {};

/**
 * @param {cm.AppState} appState The state of the application.
 * @param {cm.MapModel} mapModel The map model.
 * @return {boolean} True if the undo of the command succeeded.
 */
cm.Command.prototype.undo = function(appState, mapModel) {};
