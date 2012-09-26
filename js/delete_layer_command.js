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
 * @fileoverview [MODULE: edit] Undoable command for deleting a layer.
 * @author romano@google.com (Raquel Romano)
 */
goog.provide('cm.DeleteLayerCommand');

goog.require('cm.Command');
goog.require('cm.LayerModel');
goog.require('cm.util');

/**
 * A command to delete a layer from a map.
 * @param {string} layerId The ID of the layer to delete.
 * @constructor
 * @implements cm.Command
 */
cm.DeleteLayerCommand = function(layerId) {
  /**
   * @type string
   * @private
   */
  this.parentLayerId_;

  /**
   * @type number
   * @private
   */
  this.index_;

  /**
   * @type Object
   * @private
   */
  this.layerMapRoot_;

  /**
   * @type Object
   * @private
   */
  this.visibility_ = {};

  this.layerMapRoot_ = {
    id: layerId
  };
};

/** @override */
cm.DeleteLayerCommand.prototype.execute = function(appState, mapModel) {
  var id = /** @type string */(this.layerMapRoot_['id']);
  var layer = mapModel.getLayer(id);
  this.layerMapRoot_ = layer.toMapRoot();

  cm.util.forLayerAndDescendants(layer, function(sublayer) {
    var sublayerId = /** @type string */(sublayer.get('id'));
    this.visibility_[sublayerId] = appState.getLayerEnabled(sublayerId);
    appState.setLayerEnabled(sublayerId, false);
  }, null, this);

  var parent = layer.get('parent');
  this.parentLayerId_ = parent && parent.get('id');
  var siblingIds = parent ? parent.getSublayerIds() : mapModel.getLayerIds();
  this.index_ = goog.array.indexOf(siblingIds, id);
  if (parent) {
    parent.get('sublayers').removeAt(this.index_);
    parent.notify('sublayers');
  } else {
    mapModel.get('layers').removeAt(this.index_);
    mapModel.notify('layers');
  }
  return true;
};

/** @override */
cm.DeleteLayerCommand.prototype.undo = function(appState, mapModel) {
  var layer = cm.LayerModel.newFromMapRoot(this.layerMapRoot_);
  if (this.parentLayerId_) {
    var parent = mapModel.getLayer(this.parentLayerId_);
    parent && parent.get('sublayers').insertAt(this.index_, layer) &&
        parent.notify('sublayers');
  } else {
    mapModel.get('layers').insertAt(this.index_, layer);
    mapModel.notify('layers');
  }
  cm.util.forLayerAndDescendants(layer, function(sublayer) {
    var sublayerId = /** @type string */(sublayer.get('id'));
    appState.setLayerEnabled(sublayerId, this.visibility_[sublayerId]);
  }, null, this);
  return true;
};
