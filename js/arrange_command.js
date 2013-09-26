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
 * @fileoverview [MODULE: edit] Arrange layers command.
 * @author romano@google.com (Raquel Romano)
 */
goog.provide('cm.ArrangeCommand');

goog.require('cm.Command');

/**
 * A command to arrange the layers of a MapModel.
 * @param {Array.<Object>} oldOrdering The old ordered hierarchy of layer IDs.
 * @param {Array.<Object>} newOrdering The new ordered hierarchy of layer Ids.
 *    The new ordering should contain the same set of IDs as the old
 *    ordering; otherwise, the command will do nothing.
 * @constructor
 * @implements cm.Command
 */
cm.ArrangeCommand = function(oldOrdering, newOrdering) {
  /**
   * The original ordering of the layer IDs.
   * @type Array.<Object>
   * @private
   */
  this.oldOrdering_ = oldOrdering;

  /**
   * The new ordering of the layer IDs.
   * @type Array.<Object>
   * @private
   */
  this.newOrdering_ = newOrdering;
};

/**
 * @override
 */
cm.ArrangeCommand.prototype.execute = function(appState, mapModel) {
  this.arrange_(this.newOrdering_, appState, mapModel);
  return true;
};

/**
 * @override
 */
cm.ArrangeCommand.prototype.undo = function(appState, mapModel) {
  this.arrange_(this.oldOrdering_, appState, mapModel);
  return true;
};

/**
 * Rearrange the map model's layers to match the given list of layer IDs.
 * The layers panel and layer entry listeners will update the panel when the
 * map model 'layers' property is mutated.
 * @param {Array.<Object>} layerIds The new hierarchy of layer IDs.
 * @param {cm.AppState} appState The state of the application.
 * @param {cm.MapModel} mapModel The map model.
 * @private
 */
cm.ArrangeCommand.prototype.arrange_ = function(layerIds, appState, mapModel) {
  /**
   * Given a node in a layer ID tree, return a flat array of layer IDs.
   * @param {Object.<{
   *     id: string,
   *     sublayerIds: Array.<Object>}>} node
   * @return {Array.<string>} The flattened layer ID array.
   */
  function flattenIdTree(node) {
    var ids = [node.id];
    if (node.sublayerIds !== undefined) {
      goog.array.extend(ids, goog.array.map(node.sublayerIds, flattenIdTree));
    }
    return ids;
  }

  /**
   * @param {Array.<Object.<{
   *     id: string,
   *     sublayerIds: Array.<Object>}>>} ids The hierarchy of layerIds.
   * @param {cm.MapModel} mapModel The map model.
   * @return {boolean} True iff the set of IDs in the given layerId
   *     tree matches the set of IDs in the mapModel.
   */
  function validIdTree(ids, mapModel) {
    var allModelIds = new goog.structs.Set(mapModel.getAllLayerIds());
    var allTreeIds = new goog.structs.Set(
        goog.array.flatten(goog.array.map(ids, flattenIdTree)));
    return allModelIds.equals(allTreeIds);
  }

  /**
   * Recursively construct the map model's layer tree from the given
   * hierarchy of layer ids.
   * @param {Array.<Object.<{
   *     id: string,
   *     sublayerIds: Array.<Object>}>>} ids The new hierarchy
   *         of layerIds.
   * @param {cm.MapModel} mapModel The map model.
   * @param {cm.LayerModel=} opt_parent The parent of the specified layers.
   * @return {?google.maps.MVCArray} The layer or sublayer models.
   */
  function assembleLayers(ids, mapModel, opt_parent) {
    // Create a layer array corresponding to ids.
    var layers = new google.maps.MVCArray();
    goog.array.forEach(ids, function(node) {
      // Add each LayerModel to the layers array.
      var layer = mapModel.getLayer(node.id);
      layer.set('parent', opt_parent || undefined);
      layers.push(layer);
      // Recursively assemble this layer's sublayers array from this
      // node's sublayerIds. We explicitly set the 'sublayers' property
      // without removing ts previous layers so that no layers will be
      // unregistered from the map.
      layer.set('sublayers', node.sublayerIds === undefined ?
          new google.maps.MVCArray() :
              assembleLayers(node.sublayerIds, mapModel, layer));
    });
    return layers;
  }

  // Construct a new array of layer models from the hierarchy of layerIds
  if (validIdTree(layerIds, mapModel)) {
    var newLayerList = assembleLayers(layerIds, mapModel);
    var layers = mapModel.get('layers');
    // Remove all existing layer models from the map; this will
    // unregister all descendants.
    layers.clear();
    // Insert each new layer model; this will register all descendants.
    newLayerList.forEach(function(layer) {
      layers.push(layer);
    });
  }
  appState.updateSingleSelectFolders(mapModel);
};
