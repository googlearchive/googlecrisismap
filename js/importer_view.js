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
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.i18n.MessageFormat');
goog.require('goog.net.XhrIo');

/**
 * A dialog to import a clone of an existing layer as a new layer.
 * @param {string} apiMapsUrl URL from which to GET maps with layers to import.
 * @constructor
 */
cm.ImporterView = function(apiMapsUrl) {
  /**
   * @type {string}
   * @private
   */
  this.apiMapsUrl_ = apiMapsUrl;

  /**
   * Array of published maps loaded from the server. Cached and reused until
   * time equal to cm.ImporterView.MAPS_CACHE_TTL_MS_ has passed.
   * TODO(joeysilva): Add refresh button to importer.
   * @type {Array.<{maproot: Object, label: string}>|undefined}
   * @private
   */
  this.maps_;

  /**
   * Time when the maps were last loaded from the server, in UTC milliseconds.
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
   * Keeps track of how many layers are currently selected.
   * @type {number}
   */
  this.selectedLayersCount_;

  /**
   * @type Element
   * @private
   */
  this.selectedCountElem_;

  /**
   * @type Element
   * @private
   */
  this.submitBtn_;

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

  /**
   * Popup element displaying a map layer in an iframe, or null if there is
   * no preview visible.
   * @type {?Element}
   * @private
   */
   this.layerPreview_;

  /**
   * Listener tokens for 'mousedown' and 'click' events to close an open layer
   * preview, or null if there is no preview.
   * @type {?Array.<cm.events.ListenerToken>}
   * @private
   */
  this.closePreviewListeners_;

  /**
   * Flag to cancel the next preview link click. Set when an already active
   * preview link is clicked, and reset when it would have otherwise been
   * re-opened.
   * @type {boolean}
   * @private
   */
  this.cancelPreviewClick_ = false;

  var newLayerLink;
  var closeBtn;

  this.popup_ = cm.ui.create('div', {'class': [cm.css.IMPORTER, cm.css.POPUP]},
      this.headerElem_ = cm.ui.create('div', {'class': cm.css.IMPORTER_HEADER},
          cm.ui.create('h2', {}, cm.MSG_IMPORT_TITLE),
          newLayerLink = cm.ui.createLink(cm.MSG_CREATE_NEW_LAYER)),
      this.layerListElem_ = cm.ui.create('div',
          // 'tabIndex' makes element focusable
          {'class': cm.css.IMPORTER_LIST, 'tabIndex': 0}),
      this.selectedCountElem_ = cm.ui.create('div',
          {'class': cm.css.SELECTED_COUNT}),
      cm.ui.create('div', {'class': cm.css.BUTTON_AREA},
          this.submitBtn_ = cm.ui.create('button',
              {'class': [cm.css.BUTTON, cm.css.SUBMIT]},
              cm.MSG_IMPORTER_SUBMIT),
          closeBtn = cm.ui.create('button', {'class': cm.css.BUTTON},
              cm.MSG_IMPORTER_CANCEL)));

  cm.events.listen(newLayerLink, 'click', this.handleNewLayer_, this);
  cm.events.listen(this.submitBtn_, 'click', this.handleOk_, this);
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
 * The maximum width or height of layer previews. The larger dimension will be
 * equal to this, while the other dimension will depend on the aspect ratio
 * given by the viewport of the layer, or its map.
 * @const
 * @type {number}
 * @private
 */
cm.ImporterView.PREVIEW_MAX_LENGTH_PX_ = 300;

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
    12 +          // cm-select-count top margin
    11 + 29 + 5 + // cm-button-area top margin, height, and bottom margin
    20 + 1;       // cm-popup bottom padding and border, respectively

/**
 * Build and show an import layer dialog.
 */
cm.ImporterView.prototype.openImporter = function() {
  this.layerModels_ = [];
  this.selectedLayersCount_ = 0;
  cm.ui.setText(this.selectedCountElem_, cm.MSG_NONE_SELECTED_INITIAL);
  this.submitBtn_.setAttribute('disabled', 'disabled');

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
        cm.ui.create('div', {'class': cm.css.LAYER_TITLE}, cm.MSG_LOADING));
    goog.net.XhrIo.send(this.apiMapsUrl_, goog.bind(function(event) {
      if (!this.popup_.parentNode) {
        return;
      }
      if (event.target.isSuccess()) {
        this.maps_ = event.target.getResponseJson();
        if (this.maps_) {
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
 * @param {Array.<{maproot: Object, label: string}>} maps Array of maps with
 *     layers to display. Each item contains a maproot object and the label of
 *     the published map, used to access and display a preview.
 * @private
 */
cm.ImporterView.prototype.renderLayerList_ = function(maps) {
  cm.ui.clear(this.layerListElem_);
  goog.array.forEach(maps, function(map) {
    var model = cm.MapModel.newFromMapRoot(map['maproot']);
    var layers = model.get('layers');
    if (layers.getLength()) {
      cm.ui.append(this.layerListElem_,
          cm.ui.create('div', {'class': cm.css.MAP_TITLE},
              cm.ui.create('span', {},
                  /** @type {string} */(model.get('title'))),
              this.renderPreviewLink_(map['url'])));
      layers.forEach(goog.bind(function(layer) {
        this.renderLayerElem_(this.layerListElem_, layer, model, map['url']);
      }, this));
    }
  }, this);

  if (this.layerModels_.length) {
    this.layerListElem_.focus();
  } else {
    cm.ui.clear(this.layerListElem_);
    cm.ui.append(this.layerListElem_,
        cm.ui.create('div', {'class': cm.css.LAYER_TITLE},
        cm.MSG_NO_LAYERS));
  }
};

/**
 * Renders this row according to layerModel, and appends itself to the given
 * parent element. Will add the layerModel to this.layerModels_, and recursively
 * add sublayers as rows nested in folder divs.
 * @param {Element} parent Parent element to add the layer element to.
 * @param {cm.LayerModel} layerModel The LayerModel to render a row for.
 * @param {cm.MapModel} mapModel MapModel of the layer's map.
 * @param {string} mapUrl URL of the map (without query parameters).
 * @param {number=} opt_depth Depth level for sublayers, set recursively.
 *     Defaults to 0 (root level).
 * @private
 */
cm.ImporterView.prototype.renderLayerElem_ = function(
    parent, layerModel, mapModel, mapUrl, opt_depth) {
  var depth = opt_depth || 0;
  var index = this.layerModels_.length;
  this.layerModels_[index] = layerModel;

  var layerElem, expanderElem, previewLink, folderElem;
  cm.ui.append(parent,
      layerElem = cm.ui.create('div', {
          'data-index': index, 'class': cm.css.LAYER_ITEM,
          'style': 'padding-left: ' + (depth * 16) + 'px;'},
          expanderElem = cm.ui.create('div', {'class': cm.css.TRIANGLE}),
          cm.ui.create('span', {'class': cm.css.LAYER_TITLE},
              /** @type {string} */(layerModel.get('title'))),
          previewLink = this.renderPreviewLink_(
              mapUrl, layerModel, /** @type {cm.LatLonBox|undefined} */
              (layerModel.get('viewport') || mapModel.get('viewport')))),
      folderElem =
          cm.ui.create('div', {'class': cm.css.FOLDER_CONTAINER}));

  cm.events.listen(layerElem, 'click',
      goog.bind(this.handleLayerClick_, this, layerElem));

  var sublayers = layerModel.get('sublayers');
  if (sublayers.length > 0) {
    goog.style.setElementShown(folderElem, false);

    sublayers.forEach(goog.bind(function(sublayer) {
      this.renderLayerElem_(
          folderElem, sublayer, mapModel, mapUrl, depth + 1);
    }, this));

    cm.events.listen(expanderElem, 'click', goog.bind(
        this.handleExpanderClick_, this, expanderElem, folderElem));
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
  var selected = goog.dom.classes.toggle(layerElem, cm.css.LAYER_SELECTED);
  if (selected) {
    // Look for an ancestor folder to deselect.
    var removed = false;
    var parentFolder = this.getParentFolderElem_(layerElem);
    while (parentFolder && !removed) {
      removed = goog.dom.classes.remove(parentFolder, cm.css.LAYER_SELECTED);
      if (removed) {
        this.selectedLayersCount_--;
      }
      parentFolder = this.getParentFolderElem_(parentFolder);
    }
    // Look for sublayers to deselect.
    goog.array.forEach(
        cm.ui.getAllByClass(cm.css.LAYER_SELECTED,
        /** @type {Element} */(layerElem.nextSibling)), function(e) {
          goog.dom.classes.remove(e, cm.css.LAYER_SELECTED);
          this.selectedLayersCount_--;
        }, this);
  }

  this.selectedLayersCount_ += selected ? 1 : -1;
  cm.ui.setText(this.selectedCountElem_, new goog.i18n.MessageFormat(
      cm.MSG_LAYERS_SELECTED).format({'SELECTED': this.selectedLayersCount_}));
  if (this.selectedLayersCount_) {
    this.submitBtn_.removeAttribute('disabled');
  } else {
    this.submitBtn_.setAttribute('disabled', 'disabled');
  }
};

/**
 * Creates a link to preview either the given map in a new tab, or the given
 * layer in a preview box.
 * @param {string} mapUrl URL of the map (without query parameters).
 * @param {cm.LayerModel=} opt_layerModel If specified, this link will display a
 *     popup box previewing this layer. Otherwise the link will open a new
 *     window that previews the entire map.
 * @param {cm.LatLonBox=} opt_viewport The viewport used to determine the sizing
 *     of the preview box. Not used for the actual preview's viewport; for that,
 *     the layer model is accessed directly. Ignored if opt_layerModel is not
 *     provided.
 * @return {Element} The preview link.
 * @private
 */
cm.ImporterView.prototype.renderPreviewLink_ = function(
    mapUrl, opt_layerModel, opt_viewport) {
  var previewLink;
  if (opt_layerModel) {
    var ids = new goog.structs.Set();
    var foundVisibleLeaf = false;
    var isVisibleOrRoot = function(layer) {
      return /** @type {boolean}*/(layer.get('default_visibility')) ||
          layer === opt_layerModel;
    };
    cm.util.forLayerAndDescendants(opt_layerModel, function(layer) {
      if (isVisibleOrRoot(layer)) {
        ids.add(layer.get('id'));
        if (!layer.get('sublayers').length) {
          foundVisibleLeaf = true;
        }
      }
    }, isVisibleOrRoot);

    previewLink = cm.ui.create('div',
        {'class': cm.css.PREVIEW_LINK +
            (foundVisibleLeaf ? '' : ' cm-no-preview')});
    if (foundVisibleLeaf) {
      // Must add all of this layer's ancestors to the 'layers' URL parameter to
      // make sure it is shown.
      for (var layer = opt_layerModel; layer; layer = layer.get('parent')) {
        ids.add(layer.get('id'));
      }

      // Construct the iframe URL. Only set the viewport explicitly if the layer
      // model specifies a viewport.
      var layerViewport = opt_layerModel.get('viewport');
      var href = mapUrl + '?preview=1&layers=' + ids.getValues().join() +
          (layerViewport ? '&llbox=' + layerViewport.round(4) : '');

      cm.events.listen(previewLink, 'click', function(e) {
        e.stopPropagation ? e.stopPropagation() : (e.cancelBubble = true);
        this.closePreview_();
        if (this.cancelPreviewClick_) {
          this.cancelPreviewClick_ = false;
        } else {
          this.handlePreviewClick_(previewLink, href, opt_viewport);
        }
      }, this);
    } else {
      // No preview link.
      var tooltip = null;
      cm.events.listen(previewLink, 'click', function(e) {
        e.stopPropagation ? e.stopPropagation() : (e.cancelBubble = true);
      });
      cm.events.listen(previewLink, 'mousemove', function(e) {
        if (!tooltip) {
          tooltip = cm.ui.create('div', {'class': cm.css.TOOLTIP},
              cm.MSG_NO_PREVIEW);
          cm.ui.append(cm.ui.document.body, tooltip);
        }
        var pos = goog.style.getClientPosition(e);
        pos.x += 12;
        goog.style.setPosition(tooltip, pos);
      });
      cm.events.listen(previewLink, 'mouseout', function() {
        if (tooltip) {
          cm.ui.remove(tooltip);
          tooltip = null;
        }
      });
    }
  } else {
    previewLink = cm.ui.create('a',
        {'class': cm.css.PREVIEW_LINK, 'target': '_blank', 'href': mapUrl});
  }
  return previewLink;
};

/**
 * Renders and displays a new layer preview relative to the given preview link.
 * This preview is be cleared any time the user mousedowns or clicks outside of
 * the preview.
 * @param {Element} previewLink The clicked preview link.
 * @param {string} href Link to the layer preview.
 * @param {cm.LatLonBox=} opt_viewport The viewport that the preview box will be
 *     scaled according to. Defaults to cm.LatLonBox.ENTIRE_MAP.
 * @param {Element=} opt_container Parent container of the popup; defaults to
 *     cm.ui.document.body.
 * @private
 */
cm.ImporterView.prototype.handlePreviewClick_ = function(previewLink, href,
    opt_viewport, opt_container) {
  var viewport = opt_viewport || cm.LatLonBox.ENTIRE_MAP;
  var container = opt_container || cm.ui.document.body;

  var aspectRatio = viewport.getEastWestMeters() /
      viewport.getNorthSouthMeters();
  // Set height equal to the max preview length if this preview at least as tall
  // as it is wide. Otherwise, set the height relative to the max preview length
  // by using the aspect ratio. The height should never be more than the
  // container's height.
  var height = Math.min(
      container.offsetHeight,
      aspectRatio <= 1 ? cm.ImporterView.PREVIEW_MAX_LENGTH_PX_ :
          Math.round(cm.ImporterView.PREVIEW_MAX_LENGTH_PX_ / aspectRatio));
  // Simply set the width based off the height and the aspect ratio.
  var width = height * aspectRatio;

  var pos = goog.style.getRelativePosition(previewLink, container);
  pos.x += previewLink.offsetWidth + 10;
  pos.y -= 8;
  if (pos.y + height > container.offsetHeight) {
    // Preview is too low. Display it at the bottom of the screen with a 10px
    // margin (or at the top of the container, if it is too small for a margin).
    pos.y = Math.max(container.offsetHeight - height - 10, 0);
  }

  this.layerPreview_ = cm.ui.create('div', {
      'class': [cm.css.POPUP, cm.css.LAYER_PREVIEW],
      'style': goog.string.format('left:%dpx; top:%dpx', pos.x, pos.y)},
      cm.ui.create('iframe', {
          'src': href, 'width': width + 'px', 'height': height + 'px'}));
  cm.ui.append(container, this.layerPreview_);
  goog.dom.classes.add(previewLink, cm.css.PREVIEW_ACTIVE);

  cm.ui.createCloseButton(
      this.layerPreview_, goog.bind(this.closePreview_, this));
  this.closePreviewListeners_ = /** @type {Array.<cm.events.ListenerToken>} */ (
      cm.events.listen(container, ['click', 'mousedown'],
                       this.closePreview_, this));
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
      sublayerElem, cm.css.FOLDER_CONTAINER);
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
  // Stop this click from selecting the layer. Because we do this, we must
  // close any open previews since the document will not witness this click.
  e.stopPropagation ? e.stopPropagation() : (e.cancelBubble = true);
  this.closePreview_();
  var expanded = goog.dom.classes.toggle(expanderElem, cm.css.EXPANDED);
  goog.style.setElementShown(folderElem, expanded);
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
      this.headerElem_.offsetHeight - this.selectedCountElem_.offsetHeight;
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
 * Handler for the link that goes back to the "Create new layer" dialog.
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
      cm.css.LAYER_SELECTED, this.layerListElem_);
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
  this.closePreview_();
  cm.ui.remove(this.popup_);
  cm.ui.clear(this.layerListElem_);
};

/**
 * Disposes of the open layer preview, if it exists, and cleans up its close
 * listeners.
 * @param {Object=} opt_event DOM event, used to check if an already active
 *     preview link is being clicked, in order to cancel re-opening it.
 * @private
 */
cm.ImporterView.prototype.closePreview_ = function(opt_event) {
  if (this.layerPreview_) {
    cm.ui.remove(this.layerPreview_);
    this.layerPreview_ = null;
    if (this.closePreviewListeners_) {
      cm.events.unlisten(this.closePreviewListeners_, this);
    }
    this.closePreviewListeners_ = null;

    var activeLink = cm.ui.getByClass(cm.css.PREVIEW_ACTIVE, this.popup_);
    if (activeLink) {
      goog.dom.classes.remove(activeLink, cm.css.PREVIEW_ACTIVE);
      if (opt_event && opt_event.srcElement === activeLink) {
        this.cancelPreviewClick_ = true;
      }
    }
  }
};
