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
 * @fileoverview [MODULE: edit] An import layer dialog.
 * @author joeysilva@google.com (Joey Silva)
 */
goog.provide('cm.ImporterView');

goog.require('cm.LayerModel');
goog.require('cm.MapModel');
goog.require('cm.events');
goog.require('cm.ui');

// TODO(joeysilva): These messages will be moved (see b/7232521)
/** @desc Label for the OK button on a dialog with OK and Cancel buttons. */
var MSG_IMPORTER_OK = goog.getMsg('OK');

/** @desc Label for the Cancel button on a dialog with OK and Cancel buttons. */
var MSG_IMPORTER_CANCEL = goog.getMsg('Cancel');

/** @desc Link to create new, blank layer. */
var MSG_CREATE_NEW_LAYER = goog.getMsg('Create new layer');

/** @desc Title text for import dialog. */
var MSG_IMPORT_TITLE = goog.getMsg('Select layers to import');

/**
 * A dialog to import a clone of an existing layer as a new layer.
 * @constructor
 */
cm.ImporterView = function() {
  /**
   * Array of JSON maps loaded from the server. Cached and used until time equal
   * to cm.ImporterView.MAPS_CACHE_TTL_MS_ has passed.
   * TODO(joeysilva): Add refresh button to importer.
   * @type {Array.<cm.MapModel>|undefined}
   * @private
   */
  this.maps_;

  /**
   * Timestamp recording when the maps were last loaded from the server, in
   * UTC milliseconds.
   * @type {number|undefined}
   * @private
   */
  this.mapsLoadedTimestampMs_;

  /**
   * @type Element
   * @private
   */
  this.popup_;

  /**
   * @type Element
   * @private
   */
  this.headerElem_;

  /**
   * @type Element
   * @private
   */
  this.layerListElem_;

  /**
   * Listener token for the window's 'resize' event.
   * @type {cm.events.ListenerToken}
   * @private
   */
  this.windowResizeListener_;

  /**
   * Array of LayerModels corresponding to layer items in the list, indexed by
   * their corresponding element's 'data-index' property. This list is
   * flattened, with sublayers following directly after their folders, and
   * therefore is in the same order as the items in the fully expanded list, top
   * to bottom.
   * @type {Array.<cm.LayerModel>}
   * @private
   */
  this.layerModels_;

  var newLayerLink;
  var okBtn;
  var closeBtn;

  this.popup_ = cm.ui.create('div', {'class': 'cm-importer cm-popup'},
      this.headerElem_ = cm.ui.create('div', {'class': 'cm-importer-header'},
          cm.ui.create('h2', {}, MSG_IMPORT_TITLE),
          newLayerLink = cm.ui.createLink(MSG_CREATE_NEW_LAYER)),
      this.layerListElem_ = cm.ui.create('div',
          // 'tabIndex' makes element focusable
          {'class': 'cm-importer-list', 'tabIndex': 0}),
      cm.ui.create('div', {'class': 'cm-button-area'},
          okBtn = cm.ui.create('button', {'class': 'cm-button cm-submit'},
              MSG_IMPORTER_OK),
          closeBtn = cm.ui.create('button', {'class': 'cm-button'},
              MSG_IMPORTER_CANCEL)));

  cm.events.listen(newLayerLink, 'click', this.handleNewLayer_, this);
  cm.events.listen(okBtn, 'click', this.handleOk_, this);
  cm.events.listen(closeBtn, 'click', this.handleCancel_, this);
  cm.events.listen(this.layerListElem_, 'selectstart', function(e) {
    e.preventDefault();
  });
};

/**
 * Number of milliseconds to keep cached maps for before refreshing.
 * @const
 * @type {number}
 * @private
 */
cm.ImporterView.MAPS_CACHE_TTL_MS_ = 15 * 60 * 1000; // 15 minutes

/**
 * Fraction of the window size that the importer expand to, at maximum.
 * @const
 * @type {number}
 * @private
 */
cm.ImporterView.MAX_HEIGHT_ = 0.9;

/**
 * Total number of pixels from element CSS properties that contribute to the
 * popup's total height.
 * @const
 * @type {number}
 * @private
 */
cm.ImporterView.TOTAL_EXTRA_HEIGHT_ =
    1 + 20 +      // cm-popup top border and padding, respectively
    8 +           // cm-importer-header bottom margin
    21 + 29 + 5 + // cm-button-area top margin, height, and bottom margin
    20 + 1;       // cm-popup bottom padding and border, respectively

/**
 * Build and show an import layer dialog.
 */
cm.ImporterView.prototype.openImporter = function() {
  this.layerModels_ = [];
  cm.ui.showPopup(this.popup_);
  this.handleResize_();
  this.windowResizeListener_ = /** @type {cm.events.ListenerToken} */
      (cm.events.listen(window, 'resize',
          goog.bind(this.handleResize_, this, cm.ui.document.body)));

  if (this.maps_ &&
      (new Date()).getTime() - this.mapsLoadedTimestampMs_ <
          cm.ImporterView.MAPS_CACHE_TTL_MS_) {
    this.renderLayerList_(this.maps_);
  } else {
    cm.ui.clear(this.layerListElem_);
    cm.ui.append(this.layerListElem_,
        cm.ui.create('span', {}, 'Loading...'));
    goog.net.XhrIo.send('/crisismap/api/maps', goog.bind(function(event) {
      if (!this.popup_.parentNode) {
        return;
      }
      if (event.target.isSuccess()) {
        var maps = event.target.getResponseJson();
        if (maps) {
          this.maps_ = goog.array.map(maps,
              cm.MapModel.newFromMapRoot);
          this.mapsLoadedTimestampMs_ = (new Date()).getTime();
          this.renderLayerList_(this.maps_);
        }
      }
    }, this));
  }
};

/**
 * Constructs the layer list from the given list of maps, also constructing the
 * flat list of layer models (this.layerModels_).
 * @param {Array.<cm.MapModel>} maps Array of maps with layers to display.
 * @private
 */
cm.ImporterView.prototype.renderLayerList_ = function(maps) {
  cm.ui.clear(this.layerListElem_);
  goog.array.forEach(maps, function(map) {
    var layers = map.get('layers');
    if (layers.getLength()) {
      cm.ui.append(this.layerListElem_,
          cm.ui.create('div', {'class': 'cm-map-title'},
              /** @type {string} */(map.get('title'))));
      layers.forEach(goog.bind(function(layer) {
        this.renderLayerElem_(layer, this.layerListElem_);
      }, this));
    }
  }, this);
  this.layerListElem_.focus();
};

/**
 * Renders this row according to layerModel, and appends itself to the given
 * parent element. Will add the layerModel to this.layerModels_, and recursively
 * add sublayers as rows nested in folder divs.
 * @param {cm.LayerModel} layerModel The LayerModel for which to render a row.
 * @param {Element} parent Parent element to add the layer element to.
 * @param {number=} opt_depth Depth level for sublayers, set recursively.
 *     Defaults to 0 (root level).
 * @private
 */
cm.ImporterView.prototype.renderLayerElem_ = function(layerModel, parent,
    opt_depth) {
  var depth = opt_depth || 0;
  var index = this.layerModels_.length;
  this.layerModels_[index] = layerModel;

  var layerElem, expanderElem, containerElem;
  cm.ui.append(parent,
      layerElem = cm.ui.create('div', {
          'data-index': index, 'class': 'cm-layer-item',
          'style': 'padding-left: ' + (depth * 16) + 'px;'},
          expanderElem = cm.ui.create('div', {'class': 'cm-triangle'}),
          cm.ui.create('span', {'class': 'cm-layer-title'},
              /** @type {string} */(layerModel.get('title')))),
      containerElem = cm.ui.create('div', {'class': 'cm-folder-container'}));

  cm.events.listen(layerElem, 'click',
      goog.bind(this.handleLayerClick_, this, layerElem));

  var sublayers = layerModel.get('sublayers');
  if (sublayers.length > 0) {
    goog.style.showElement(containerElem, false);

    sublayers.forEach(goog.bind(function(sublayer) {
      this.renderLayerElem_(sublayer, containerElem, depth + 1);
    }, this));

    cm.events.listen(expanderElem, 'click', goog.bind(
        this.handleExpanderClick_, this, expanderElem, containerElem));
  } else {
    cm.ui.remove(expanderElem);
  }
};

/**
 * Toggles the selection of the given row, and deselects a selected ancestor
 * or descendants.
 * @param {Element} layerElem The clicked layer element.
 * @private
 */
cm.ImporterView.prototype.handleLayerClick_ = function(layerElem) {
  var selected = goog.dom.classes.toggle(layerElem, 'cm-layer-selected');
  if (selected) {
    // Look for an ancestor folder to deselect.
    var removed = false;
    var parentFolder = this.getParentFolderElem_(layerElem);
    while (parentFolder && !removed) {
      removed = goog.dom.classes.remove(parentFolder, 'cm-layer-selected');
      parentFolder = this.getParentFolderElem_(parentFolder);
    }
    // Look for sublayers to deselect.
    goog.array.forEach(
        cm.ui.getAllByClass('cm-layer-selected',
            /** @type {Element} */(layerElem.nextSibling)),
        function(e) { goog.dom.classes.remove(e, 'cm-layer-selected') });
  }
};

/**
 * Returns the folder element (with class cm-layer-item) of the given layer
 * element, or null if it has no parent folder.
 * @param {Element} sublayerElem The layer element whose parent folder will be
 *     retrieve.
 * @return {Element} The parent folder of the given element, or null if the
 *     given layer was not a sublayer of a folder.
 * @private
 */
cm.ImporterView.prototype.getParentFolderElem_ = function(sublayerElem) {
  var folderContainer = goog.dom.getAncestorByClass(
      sublayerElem, 'cm-folder-container');
  return /** @type {Element} */(folderContainer ?
      folderContainer.previousSibling : null);
};

/**
 * Shows or hides a folder's sublayers.
 * @param {Element} expanderElem The expander element that was clicked.
 * @param {Element} folderElem The folder element containing sublayers.
 * @param {Object} e The click event object.
 * @private
 */
cm.ImporterView.prototype.handleExpanderClick_ = function(
    expanderElem, folderElem, e) {
  e.stopPropagation ? e.stopPropagation() : (e.cancelBubble = true);
  var expanded = goog.dom.classes.toggle(expanderElem, 'cm-expanded');
  goog.style.showElement(folderElem, expanded);
};

/**
 * Updates the maximum height of the layer list based on the defined maximum
 * height of the popup (cm.ImporterView.MAX_HEIGHT_), and repositions the popup
 * to center it, assuming it is its maximum size.
 * Should be called whenever the size of the popup's container has changed,
 * or dynamic elements of the popup have changed (this.headerElem_).
 * @param {Element=} opt_container Parent container of the popup; defaults to
 *     cm.ui.document.body.
 * @private
 */
cm.ImporterView.prototype.handleResize_ = function(opt_container) {
  var container = opt_container || cm.ui.document.body;
  var maxPopupHeight = Math.round(
      container.offsetHeight * cm.ImporterView.MAX_HEIGHT_);

  // Calculate the maximum height the list may be.
  var maxListHeight = maxPopupHeight - cm.ImporterView.TOTAL_EXTRA_HEIGHT_ -
      this.headerElem_.offsetHeight;
  this.layerListElem_.style.maxHeight = maxListHeight + 'px';

  // Anchor popup such that it is centered in the case of maximum
  // width and height. This is so that may grow to this size without going
  // offscreen.
  this.popup_.style.top = Math.round((container.offsetHeight -
      maxPopupHeight) / 2) + 'px';
  this.popup_.style.left = Math.round((container.offsetWidth -
      this.popup_.offsetWidth) / 2) + 'px'; // width == max-width for importer
};

/**
 * Handler for the "Create new layer" link.
 * @private
 */
cm.ImporterView.prototype.handleNewLayer_ = function() {
  this.close_();
  cm.events.emit(goog.global, cm.events.INSPECT);
};

/**
 * Copy the selected layers, and close the dialog.
 * @private
 */
cm.ImporterView.prototype.handleOk_ = function() {
  var layers = [];
  var selectedElems = cm.ui.getAllByClass(
      'cm-layer-selected', this.layerListElem_);
  goog.array.forEach(selectedElems, function(layerElem) {
    var index = parseInt(layerElem.getAttribute('data-index'), 10);
    layers.push(this.layerModels_[index].toMapRoot());
  }, this);

  this.close_();
  cm.events.emit(goog.global, cm.events.ADD_LAYERS, {layers: layers});
};

/**
 * Closes the dialog.
 * @private
 */
cm.ImporterView.prototype.handleCancel_ = function() {
  this.close_();
};

/**
 * Disposes of the popup by clearing the layersRequest_ listener token, and
 * closing the popup.
 * @private
 */
cm.ImporterView.prototype.close_ = function() {
  cm.events.unlisten(this.windowResizeListener_, this);
  cm.ui.remove(this.popup_);
  cm.ui.clear(this.layerListElem_);
};
