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
   * The ID of the deleted layer's parent folder, if it isn't a root layer.
   * @type string
   * @private
   */
  this.parentLayerId_ = '';

  /**
   * Index into the ordered list of the deleted layer's sibling layers.
   * @type number
   * @private
   */
  this.index_;

  /**
   * The deleted layer's MapRoot representation.
   * @type Object
   * @private
   */
  this.layerMapRoot_;

  /**
   * Snapshot of the visibilities of all of the deleted layer's sublayers.
   * @type goog.structs.Set
   * @private
   */
  this.enabledSublayers_ = new goog.structs.Set();

  this.layerMapRoot_ = {
    id: layerId
  };

  /**
   * True if the layer being deleted is the selected sublayer of a single-select
   * folder, stored so that when the command is undone, it will be enabled and
   * its sibling layers disabled.
   * @type boolean
   * @private
   */
  this.enabled_;
};

/** @override */
cm.DeleteLayerCommand.prototype.execute = function(appState, mapModel) {
  var id = /** @type string */(this.layerMapRoot_['id']);
  var layer = mapModel.getLayer(id);
  this.layerMapRoot_ = layer.toMapRoot();
  var parent = layer.get('parent');
  this.parentLayerId_ = parent && parent.get('id') || null;

  // Save layer visibilities and disable all layers in this tree.
  cm.util.forLayerAndDescendants(layer, function(sublayer) {
    var sublayerId = /** @type string */(sublayer.get('id'));
    if (appState.getLayerEnabled(sublayerId)) {
      this.enabledSublayers_.add(sublayerId);
    }
    appState.setLayerEnabled(sublayerId, false);
  }, null, this);

  // Remove the layer from the model.
  if (parent) {
    this.index_ = goog.array.indexOf(parent.getSublayerIds(), id);
    parent.get('sublayers').removeAt(this.index_);
    parent.notify('sublayers');
    appState.updateSingleSelectFolders(mapModel);
  } else {
    this.index_ = goog.array.indexOf(mapModel.getLayerIds(), id);
    mapModel.get('layers').removeAt(this.index_);
    mapModel.notify('layers');
  }
  return true;
};

/** @override */
cm.DeleteLayerCommand.prototype.undo = function(appState, mapModel) {
  var layer = cm.LayerModel.newFromMapRoot(this.layerMapRoot_);
  var parent = this.parentLayerId_ ?
      mapModel.getLayer(this.parentLayerId_) : null;
  if (parent) {
    parent.get('sublayers').insertAt(this.index_, layer);
    parent.notify('sublayers');
  } else {
    mapModel.get('layers').insertAt(this.index_, layer);
    mapModel.notify('layers');
  }
  cm.util.forLayerAndDescendants(layer, function(sublayer) {
    var sublayerId = /** @type string */(sublayer.get('id'));
    if (this.enabledSublayers_.contains(sublayerId)) {
      appState.setLayerEnabled(sublayerId, true);
    }
  }, null, this);

  // If the deleted layer's parent is a single-select folder, this was
  // the selected sublayer, so disable its siblings.
  if (parent && parent.isSingleSelect()) {
    var siblingIds = mapModel.getLayer(this.parentLayerId_).getSublayerIds();
    goog.array.forEach(siblingIds, function(siblingId) {
      if (siblingId !== layer.get('id')) {
        appState.setLayerEnabled(siblingId, false);
      }
    });
  }
  return true;
};
