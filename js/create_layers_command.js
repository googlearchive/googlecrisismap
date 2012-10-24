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
 * @fileoverview [MODULE: edit] Undoable command for creating a variable number
 *     of layers, from one or more MapRoot objects.
 * @author romano@google.com (Raquel Romano)
 * @author joeysilva@google.com (Joey Silva)
 */
goog.provide('cm.CreateLayersCommand');

goog.require('cm.Command');
goog.require('cm.LayerModel');
goog.require('cm.util');

/**
 * A command to create new layers from MapRoot objects and add them to a map.
 * @param {Object|Array.<Object>} layerMapRoots One or more layer objects in
 *     MapRoot format, specifying the layers to create. These are created in
 *     order, as well as positioned in the map model in the same order.
 * @constructor
 * @implements cm.Command
 */
cm.CreateLayersCommand = function(layerMapRoots) {
  /**
   * @type {Array.<Object>}
   * @private
   */
  this.layerMapRoots_ = /** @type {Array.<Object>} */
      (goog.isArray(layerMapRoots) ? layerMapRoots : [layerMapRoots]);
};

/** @override */
cm.CreateLayersCommand.prototype.execute = function(appState, mapModel) {
  goog.array.forEach(this.layerMapRoots_, function(layerMapRoot, i) {
    // The layer's ID is auto-assigned the first time execute() is called.
    var layer = cm.LayerModel.newFromMapRoot(layerMapRoot);
    mapModel.get('layers').insertAt(i, layer);
    // Inserting the layer into the map causes it and its sublayers' 'id'
    // property to be populated. We save the ID so that redo() will create the
    // layer again with the same ID.
    var recursivelySetIDs = function(layerMapRoot, layer) {
      layerMapRoot.id = /** @type string */(layer.get('id'));
      if (layerMapRoot.sublayers) {
        for (var i = 0; i < layerMapRoot.sublayers.length; i++) {
          recursivelySetIDs(layerMapRoot.sublayers[i],
                            layer.get('sublayers').getAt(i));
        }
      }
    };
    recursivelySetIDs(layerMapRoot, layer);

    // Set the visibility of layers in the app state based on their default
    // visibility. The default visibility of the top level layers are set to
    // true when adding them.
    layer.set('default_visibility', true);
    cm.util.forLayerAndDescendants(layer, function(sublayer) {
      appState.setLayerEnabled(/** @type string */(sublayer.get('id')),
          /** @type boolean */ (sublayer.get('default_visibility')));
    });
    mapModel.notify('layers');
  }, this);
  return true;
};

/** @override */
cm.CreateLayersCommand.prototype.undo = function(appState, mapModel) {
  for (var i = this.layerMapRoots_.length - 1; i >= 0; i--) {
    appState.setLayerEnabled(this.layerMapRoots_[i].id, false);
    mapModel.get('layers').removeAt(i);
    mapModel.notify('layers');
  }
  return true;
};
