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
 * @fileoverview [MODULE: edit] Nested layer arranger.
 * @author romano@google.com (Raquel Romano)
 */
goog.provide('cm.ArrangeView');

goog.require('cm');
goog.require('cm.AppState');
goog.require('cm.LayerModel');
goog.require('cm.MapModel');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.array');

/**
 * A list of draggable layers and folders. When the user requests to arrange
 * layers, this replaces the layers panel with a DOM element tree matching the
 * current MapModel hierarchy. The draggable elements in the the arranger
 * have element IDs matching the MapModel's layer IDs. On clicking OK, the
 * reordered ID hierarchy is extracted and added to an ARRANGE event payload
 * for the ArrangeCommand to apply to the MapModel. On clicking
 * cancel, the MapModel is left unmodified and the tree of draggable
 * elements is removed from the DOM.
 * @param {Element} arrangerElem The DOM element in which to create the
 *     draggable layers.
 * @param {Element} panelElem The layers panel element, which will be replaced
 *     by the arranger element and vice versa.
 * @param {cm.AppState} appState The application state model.
 * @param {cm.MapModel} mapModel The map's model.
 * @constructor
 */
cm.ArrangeView = function(arrangerElem, panelElem, appState, mapModel) {
  /**
   * The parent element for the list of draggable elements.
   * @type Element
   * @private
   */
  this.arrangerElem_ = arrangerElem;

  /**
   * The layers panel element which should be replaced by the arranger
   * element, and vice versa.
   * @type Element
   * @private
   */
  this.panelElem_ = panelElem;

  /**
   * @type cm.AppState
   * @private
   */
  this.appState_ = appState;

  /**
   * @type google.maps.MVCArray
   * @private
   */
  this.layers_ = /** @type google.maps.MVCArray}*/(
      mapModel.get('layers'));

  /**
   * @type Element
   * @private
   */
  this.okBtn_;

  /**
   * @type Element
   * @private
   */
  this.cancelBtn_;

  /**
   * The element holding the list of draggable layer elements.
   * @type Element
   * @private
   */
  this.layerListElem_;

  /**
   * A flat list of the draggable layer elements in arbitrary order.
   * @type Array.<Element>
   * @private
   */
  this.draggableElements_ = [];

  /**
   * @type cm.LayerDragHandler
   * @private
   */
  this.layerDragHandler_ = null;

  // Fill the arranger element with 'OK' and 'Cancel' buttons and an empty
  // top-level layer list.
  cm.ui.append(arrangerElem,
      cm.ui.create('div', {'class': cm.css.BUTTON_AREA},
          this.okBtn_ = cm.ui.create(
              'button', {'class': [cm.css.BUTTON, cm.css.SUBMIT]},
               cm.MSG_OK),
          this.cancelBtn_ = cm.ui.create(
              'button', {'class': cm.css.BUTTON}, cm.MSG_CANCEL)),
      this.layerListElem_ = cm.ui.create(
          'div', {'class': cm.css.ARRANGER_INNER}));
  cm.events.listen(this.okBtn_, 'click', this.handleOk_, this);
  cm.events.listen(this.cancelBtn_, 'click', this.handleCancel_, this);

  // Listen to the open/close events triggered on the layers panel container.
  cm.events.listen(panelElem, 'panelopen', function() {
    goog.dom.classes.add(arrangerElem, cm.css.OPEN);
    // Copy arranger position from panel position.
    arrangerElem.style.left = panelElem.style.left;
  });
  cm.events.listen(panelElem, 'panelclose', function() {
    goog.dom.classes.remove(arrangerElem, cm.css.OPEN);
    arrangerElem.style.left = 'auto';
  });
};

/**
 * Populates the arranger element with the layers to be arranged, replaces
 * the layers panel with the arranger, and sets up the drag and drop handler.
 */
cm.ArrangeView.prototype.open = function() {
  goog.array.forEach(this.layers_.getArray(), function(layer) {
    this.addLayer_(this.layerListElem_, layer);
  }, this);
  this.layerDragHandler_ = new cm.LayerDragHandler(
      this.layerListElem_, this.draggableElements_);
  goog.dom.classes.add(this.panelElem_, cm.css.HIDDEN);
  goog.dom.classes.remove(this.arrangerElem_, cm.css.HIDDEN);
};

/**
 * Handler for "OK" button: executes the command and cleans up the drag handler.
 * @private
 */
cm.ArrangeView.prototype.handleOk_ = function() {
  goog.dom.classes.add(this.arrangerElem_, cm.css.HIDDEN);
  goog.dom.classes.remove(this.panelElem_, cm.css.HIDDEN);
  // Extract a hierarchy of layer IDs from the map's current LayerModel tree.
  var oldOrdering = goog.array.map(this.layers_.getArray(),
                                   this.layerIdTreeFromLayerModel_, this);
  // Extract a hierarchy of layer IDs from the tree of dragged layer elements.
  var newOrdering = goog.array.map(this.layerListElem_.childNodes,
                                   this.layerIdTreeFromDraggableLayer_, this);
  cm.ui.clear(this.layerListElem_);
  goog.array.clear(this.draggableElements_);
  cm.events.emit(goog.global, cm.events.LAYERS_ARRANGED,
                 {oldValue: oldOrdering, newValue: newOrdering});
  this.layerDragHandler_.dispose();
  cm.events.emit(goog.global, 'resize');
};

/**
 * Handler for "Cancel" button.
 * @private
 */
cm.ArrangeView.prototype.handleCancel_ = function() {
  goog.dom.classes.add(this.arrangerElem_, cm.css.HIDDEN);
  goog.dom.classes.remove(this.panelElem_, cm.css.HIDDEN);
  cm.ui.clear(this.layerListElem_);
  goog.array.clear(this.draggableElements_);
  this.layerDragHandler_.dispose();
  cm.events.emit(goog.global, 'resize');
};

/**
 * Add a draggable node corresponding to the given layer. Each DOM element's
 * ID is identical to its corresponding layer model's ID.
 *
 * DOM structure for a draggable folder:
 * <div class='cm-draggable-layer'>
 *   <div class='cm-draggable-layer-title cm-draggable-folder-bg' id=id>
 *         Layer Title</div>
 *     <div class='cm-draggable-sublayer-container'>
 *     <div class='cm-draggable-layer'>...</div>
 *     <div class='cm-draggable-layer'>...</div>
 *   </div>
 * </div>
 *
 * @param {Element} parentElem The parent node to which to add the
 *     draggable element.
 * @param {cm.LayerModel} layer The layer model for which to add a node.
 * @private
 */
cm.ArrangeView.prototype.addLayer_ = function(parentElem, layer) {
  var titleElem;
  var id = /** @type string */(layer.get('id'));
  var draggableLayerElem =
      cm.ui.create('div', {'class': cm.css.DRAGGABLE_LAYER, 'id': id},
          titleElem = cm.ui.create('span',
                                   {'class': cm.css.DRAGGABLE_LAYER_TITLE},
                                   /** @type string */(layer.get('title'))));
  this.draggableElements_.push(draggableLayerElem);
  cm.ui.append(parentElem, draggableLayerElem);

  // If the layer is a folder, recursively add its draggable sublayer elements.
  if (layer.get('type') === cm.LayerModel.Type.FOLDER) {
    goog.dom.classes.add(titleElem, cm.css.DRAGGABLE_FOLDER_BG);
    var sublayerListElem = cm.ui.create('div',
       {'class': cm.css.DRAGGABLE_SUBLAYER_CONTAINER});
    var sublayers = /** @type google.maps.MVCArray */(layer.get('sublayers'));
    goog.array.forEach(sublayers.getArray(), function(sublayer, i) {
        this.addLayer_(sublayerListElem, sublayer);
    }, this);
    cm.ui.append(draggableLayerElem, sublayerListElem);
  } else {
    goog.dom.classes.add(titleElem, cm.css.DRAGGABLE_LAYER_BG);
  }
};

/**
 * Recursively consruct a layer ID tree from a draggable layer element.
 * See addLayer_() for the expected structure of the element.
 * @param {Element} element The draggable layer elememnt.
 * @return {Object.<{id: string, sublayerIds: Array.<Object>}>} The extracted
 *    layer ID hierarchy.
 * @private
 */
cm.ArrangeView.prototype.layerIdTreeFromDraggableLayer_ = function(
    element) {
  var idTree = { id: element.id, sublayerIds: [] };
  if (element.childNodes && element.childNodes.length >= 2) {
    var sublayers = element.childNodes[1].childNodes;
    if (sublayers && sublayers.length > 0) {
      idTree.sublayerIds = goog.array.map(
          sublayers, this.layerIdTreeFromDraggableLayer_, this);
    } else {
      idTree.sublayerIds = [];
    }
  }
  return idTree;
};

/**
 * Recursively consruct a layer ID tree from a LayerModel object.
 * @param {cm.LayerModel} layer The layer model.
 * @return {Object.<{id: string, sublayerIds: Array.<Object>}>} The extracted
 *     layer ID hierarchy.
 * @private
 */
cm.ArrangeView.prototype.layerIdTreeFromLayerModel_ = function(layer) {
  return {id: layer.get('id'), sublayerIds: goog.array.map(
      layer.get('sublayers').getArray(), this.layerIdTreeFromLayerModel_,
      this)};
};
