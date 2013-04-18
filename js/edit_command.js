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
 * @fileoverview [MODULE: edit] Edit command.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.EditCommand');

goog.require('cm.Command');

/**
 * A command to edit the properties of the current MapModel or of a LayerModel
 * in the current MapModel.
 * @param {Object} oldValues Keys and values of properties before editing.
 *     A value of null means the property was previously not present (i.e.
 *     undoing should remove the property).  A value of undefined means the
 *     property was unaffected (i.e. undoing will not touch the property).
 * @param {Object} newValues Keys and values of properties after editing.
 *     A value of null means the property is to be deleted (i.e. performing
 *     the edit should remove the property).  A value of undefined means the
 *     property was unaffected (i.e. redoing will not touch the property).
 * @param {string} opt_layerId The layer ID, if the object being
 *     edited is a layer. The opt_layerId should be specified if and only
 *     if the object being edited is the MapModel.
 * @constructor
 * @implements cm.Command
 */
cm.EditCommand = function(oldValues, newValues, opt_layerId) {
  /**
   * @type Object
   * @private
   */
  this.oldValues_ = oldValues;

  /**
   * @type Object
   * @private
   */
  this.newValues_ = newValues;

  /**
   * @type ?string
   * @private
   */
  this.layerId_ = opt_layerId || null;
};

/** @override */
cm.EditCommand.prototype.execute = function(appState, mapModel) {
  var object = this.layerId_ ? mapModel.getLayer(this.layerId_) : mapModel;
  for (var key in this.newValues_) {
    if (this.newValues_[key] !== undefined) {
      object.set(key, this.newValues_[key]);
    }
  }
  // When the user edits the map's default type, also update the currently
  // visible map type to reflect the change.  This is a special case of a
  // model update that should also result in an AppState update.
  if (object === mapModel) {
    appState.set('map_type', mapModel.get('map_type'));
  }
  return true;
};

/** @override */
cm.EditCommand.prototype.undo = function(appState, mapModel) {
  var object = this.layerId_ ? mapModel.getLayer(this.layerId_) : mapModel;
  for (var key in this.oldValues_) {
    if (this.oldValues_[key] !== undefined) {
      object.set(key, this.oldValues_[key]);
    }
  }
  // When the user edits the map's default type, also update the currently
  // visible map type to reflect the change.  This is a special case of a
  // model update that should also result in an AppState update.
  if (object === mapModel) {
    appState.set('map_type', mapModel.get('map_type'));
  }
  return true;
};
