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
 * @fileoverview View for a layer entry in the panel's list of layers.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.LayerEntryView');

goog.require('cm');
goog.require('cm.AppState');
goog.require('cm.LayerModel');
goog.require('cm.MetadataModel');
goog.require('cm.SublayerPicker');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.date.relative');
goog.require('goog.dom.classes');
goog.require('goog.format');
goog.require('goog.i18n.DateTimeFormat');
goog.require('goog.ui.Slider');

/**
 * A layer view.
 * @param {Element} parentElem The DOM element in which to add a panel entry.
 * @param {cm.LayerModel} model The layer model for which to create an item.
 * @param {cm.MetadataModel} metadataModel The metadata model to track updates.
 * @param {cm.AppState} appState The application state model.
 * @param {Object=} opt_config Configuration settings.  These fields are used:
 *     enable_editing: Allow any editing at all?
 * @param {number} opt_index The index into the parent element's child list at
 *     which to insert the layer entry.
 * @constructor
 */
cm.LayerEntryView = function(parentElem, model, metadataModel,
                             appState, opt_config, opt_index) {
  /**
   * @type goog.i18n.DateTimeFormat
   * @private
   */
  this.dateFormatter_ = new goog.i18n.DateTimeFormat(
      goog.i18n.DateTimeFormat.Format.MEDIUM_DATE);

  /**
   * @type cm.LayerModel
   * @private
   */
  this.model_ = model;

  /**
   * @type cm.MetadataModel
   * @private
   */
  this.metadataModel_ = metadataModel;

  /**
   * @type cm.events.ListenerToken
   * @private
   */
  this.metadataListener_ = null;

  /**
   * @type cm.AppState
   * @private
   */
  this.appState_ = appState;

  /**
   * @type Object.<cm.LayerEntryView>
   * @private
   */
  this.layerEntryViews_ = {};

  /**
   * @type Element
   * @private
   */
  this.entryElem_;

  /**
   * @type Element
   * @private
   */
  this.headerElem_;

  /**
   * Container for checkbox and folder decoration.
   * @type Element
   * @private
   */
  this.checkboxContainer_;

  /**
   * @type Element
   * @private
   */
  this.checkboxElem_;

  /**
   * @type Element
   * @private
   */
  this.checkboxLabel_;

  /**
   * @type Element
   * @private
   */
  this.folderDecorator_;

  /**
   * @type Element
   * @private
   */
  this.titleElem_;

  /**
   * @type Element
   * @private
   */
  this.sublayerSelect_;

  /**
   * @type Element
   * @private
   */
  this.contentElem_;

  /**
   * @type Element
   * @private
   */
  this.zoomElem_;

  /**
   * @type Element
   * @private
   */
  this.downloadElem_;

  /**
   * @type Element
   * @private
   */
  this.sliderDiv_;

  /**
   * @type Element
   * @private
   */
  this.descriptionElem_;

  /**
   * @type Element
   * @private
   */
  this.legendBoxElem_;

  /**
   * @type Element
   * @private
   */
  this.legendElem_;

  /**
   * @type Element
   * @private
   */
  this.sublayersElem_;

  /**
   * @type Element
   * @private
   */
  this.warningElem_;

  /**
   * The opacity slider, or null if this is not a TILES layer.
   * @type {?goog.ui.Slider}
   * @private
   */
  this.slider_ = null;

  /**
   * @type Element
   * @private
   */
  this.sliderDot_;

  /**
   * Listener tokens for the slider control, or null if it does not exist.
   * @type {?Array.<cm.events.ListenerToken>}
   * @private
   */
  this.sliderListeners_ = null;

  /**
   * @type {number?}
   * @private
   */
  this.zoomLevel_ = null;  // initially unknown

  /**
   * @type Object
   * @private
   */
  this.config_ = opt_config || {};

  /**
   * The select menu for promoting a single sublayer of a folder, or null
   * if this layer is not a single-select folder.
   * @type cm.SublayerPicker
   * @private
   */
  this.sublayerPicker_ = null;

  // Extract information about the layer.
  var id = /** @type string */(model.get('id'));
  var layerType = model.get('type');

  // Figure out whether to enable editing.
  var enableEditing = this.config_['enable_editing'];

  // These links will be replaced by icons (e.g. pencil, rubbish bin). Mocks:
  // http://folder/nsavio/dotorg/crisis_response/crisis_maps/20120424&s
  var zoomLink = cm.ui.createLink(cm.MSG_ZOOM_TO_AREA_LINK);
  this.zoomElem_ = cm.ui.create('span', {},
      cm.ui.create('span', {}, cm.ui.SEPARATOR_DOT), zoomLink);
  var editLink = enableEditing ? cm.ui.createLink(cm.MSG_EDIT) : null;
  var deleteLink = enableEditing ? cm.ui.createLink(cm.MSG_DELETE) : null;
  this.downloadElem_ = cm.ui.create('span');
  var layerLinks = [editLink, enableEditing && cm.ui.SEPARATOR_DOT, deleteLink,
                    this.zoomElem_, this.downloadElem_];

  // Create the panel entry.
  this.entryElem_ = cm.ui.create('div', {'class': cm.css.LAYER_ENTRY},
      this.headerElem_ = cm.ui.create('div', {'class': cm.css.HEADER},
          this.checkboxContainer_ = cm.ui.create(
              'div', {'class': cm.css.CHECKBOX_CONTAINER},
              this.checkboxElem_ = cm.ui.create('input',
                  {'type': 'checkbox', 'id': 'checkbox' + id}),
              this.folderDecorator_ = cm.ui.create('div',
                  {'class': cm.css.CHECKBOX_FOLDER_DECORATION})),
          this.checkboxLabel_ = cm.ui.create('label', {'for': 'checkbox' + id},
              this.titleElem_ = cm.ui.create('span',
                  {'class': cm.css.LAYER_TITLE})),
          this.sublayerSelect_ = cm.ui.create('div',
              {'class': cm.css.SUBLAYER_SELECT})
      ),
      this.contentElem_ = cm.ui.create('div', {'class': cm.css.CONTENT},
          this.sliderDiv_ = cm.ui.create('div',
              {'title': cm.MSG_OPACITY_TOOLTIP, 'class': cm.css.SLIDER}),
          cm.ui.create('div', {}, layerLinks),
          this.warningElem_ = cm.ui.create('div', {'class': cm.css.WARNING}),
          this.legendBoxElem_ = cm.ui.create('div',
              {'class': cm.css.LAYER_LEGEND_BOX},
              cm.ui.create('fieldset', undefined,
                  cm.ui.create('legend', undefined, cm.MSG_LEGEND),
                  this.legendElem_ = cm.ui.create('div',
                      {'class': cm.css.LAYER_LEGEND}))),
          this.descriptionElem_ = cm.ui.create('div',
              {'class': cm.css.LAYER_DESCRIPTION}),
          this.timeElem_ = cm.ui.create('div', {'class': cm.css.TIMESTAMP})
      ),
      this.sublayersElem_ = cm.ui.create('div', {'class': cm.css.SUBLAYERS})
  );
  if (opt_index !== undefined && opt_index < parentElem.childNodes.length) {
    parentElem.insertBefore(this.entryElem_, parentElem.childNodes[opt_index]);
  } else {
    parentElem.appendChild(this.entryElem_);
  }

  // Add views for all the sublayers.
  var sublayers = /** @type google.maps.MVCArray */(model.get('sublayers'));
  goog.array.forEach(sublayers.getArray(), this.insertSublayer_, this);

  // Initialize the entry with the current values.
  this.updateTitle_();
  this.updateDescription_();
  this.updateLegend_();
  this.updateDownloadLink_();
  this.updateEnabled_();
  this.updateFolderDecorator_();
  this.updateSliderVisibility_();
  this.updateZoomLink_();
  this.updateTime_();
  this.updateWarning_();
  this.updateFade_();

  // Attach event handlers to ensure this view reflects changes in the
  // layer model, the metadata model, and the AppState.
  cm.events.onChange(model, ['title', 'folder_type'], this.updateTitle_, this);
  cm.events.onChange(model, 'description', this.updateDescription_, this);
  cm.events.onChange(model, 'legend', this.updateLegend_, this);
  cm.events.onChange(model,
                     ['suppress_download_link', 'type', 'url', 'ft_from'],
                     this.updateDownloadLink_, this);
  cm.events.onChange(model, ['viewport', 'type'], this.updateZoomLink_, this);
  cm.events.onChange(model, ['folder_type'], function() {
    this.updateFolderDecorator_();
    this.updateEnabled_();
  }, this);
  cm.events.onChange(model, 'type', this.updateSliderVisibility_, this);

  cm.events.onChange(appState, 'enabled_layer_ids', this.updateEnabled_, this);

  // When the source address changes, update which metadata entry we listen to.
  cm.events.onChange(model, ['type', 'url'],
                     this.updateMetadataListener_, this);
  this.updateMetadataListener_();

  // Add or remove each sublayer's LayerEntryView when layers are
  // added or removed.
  cm.events.listen(sublayers, 'insert_at', function(i) {
    this.insertSublayer_(sublayers.getAt(i), i);
  }, this);
  cm.events.listen(sublayers, 'remove_at', function(i, layer) {
    this.removeSublayer_(layer);
  }, this);

  // Attach event handlers to react to user actions.
  cm.events.listen(this.checkboxElem_, 'click', function() {
    // In the puppet test in IE 8, the .checked attribute is updated *after*
    // the 'click' event occurs, so we have to read .checked asynchronously.
    goog.global.setTimeout(goog.bind(function() {
      var value = this.checkboxElem_.checked;
      cm.events.emit(this, cm.events.TOGGLE_LAYER, {id: id, value: value});
    }, this), 0);
  }, this);

  // Attach event handler to change the visibility of panel entry view based on
  // the layer's min/max zoom levels and the map's current zoom level.
  cm.events.listen(
      goog.global, cm.events.ZOOM_CHANGED, this.handleZoomChange_, this);
  cm.events.onChange(
      model, ['min_zoom', 'max_zoom'], this.updateFade_, this);

  cm.events.forward(zoomLink, 'click', this,
                    cm.events.ZOOM_TO_LAYER, {id: id});
  if (editLink) {
    cm.events.forward(editLink, 'click', goog.global,
                      cm.events.INSPECT, {object: model});
  }
  if (deleteLink) {
    cm.events.forward(deleteLink, 'click', this,
                      cm.events.DELETE_LAYER, {id: id});
  }

};

/**
 * Accessor for the DOM element containing this layer's header information.
 * @return {Element} The header element.
 */
cm.LayerEntryView.prototype.getHeaderElement = function() {
  return this.headerElem_;
};

/**
 * Accessor for the checkbox container.
 * @return {Element} The checkbox container.
 */
cm.LayerEntryView.prototype.getCheckboxContainer = function() {
  return this.checkboxContainer_;
};

/**
 * Accessor for the checkbox label element.
 * @return {Element} The checkbox label.
 */
cm.LayerEntryView.prototype.getCheckboxLabel = function() {
  return this.checkboxLabel_;
};

/**
 * Accessor for the top level LayerEntryView DOM element.
 * @return {Element} The entry element.
 */
cm.LayerEntryView.prototype.getEntryElement = function() {
  return this.entryElem_;
};

/** @private Updates the panel entry to match the model. */
cm.LayerEntryView.prototype.updateTitle_ = function() {
  // We don't want any HTML code to be rendered other than word break related
  // ones.
  var title = goog.string.htmlEscape(
      /** @type string */(this.model_.get('title')) || '');
  // If a very long word appears and is left unbroken, it causes horizontal
  // scrollbars to appear. We use the basic version of word breaking method
  // because the full version has a large file size. After every ten characters
  // in a word, a word break is inserted.
  this.titleElem_.innerHTML = goog.format.insertWordBreaksBasic(title, 10);
};

/** @private Updates the panel entry's description to match the model. */
cm.LayerEntryView.prototype.updateDescription_ = function() {
  var description = /** @type cm.Html */(this.model_.get('description'));
  description && description.pasteInto(this.descriptionElem_);
};

/** @private Updates the panel entry's legend to match the model. */
cm.LayerEntryView.prototype.updateLegend_ = function() {
  var legend = /** @type cm.Html */(this.model_.get('legend'));
  legend && legend.pasteInto(this.legendElem_);
  goog.dom.classes.enable(this.legendBoxElem_, cm.css.HIDDEN,
      !legend || goog.string.isEmpty(legend.getHtml()));
};

/** @private Updates the warning label based on the layer metadata. */
cm.LayerEntryView.prototype.updateWarning_ = function() {
  var isEmpty = this.metadataModel_.isEmpty(this.model_);
  cm.ui.setText(this.warningElem_, isEmpty ? cm.MSG_NO_DATA_WARNING : '');
  goog.dom.classes.enable(this.warningElem_, cm.css.HIDDEN, !isEmpty);
};

/** @private Updates the panel entry to match the model. */
cm.LayerEntryView.prototype.updateDownloadLink_ = function() {
  var isFolder = this.model_.get('type') === cm.LayerModel.Type.FOLDER;
  var tip = '';
  cm.ui.clear(this.downloadElem_);
  if (!isFolder) {
    var type = /** @type cm.LayerModel.Type */(this.model_.get('type'));
    var hideLink = this.metadataModel_.fetchErrorOccurred(this.model_) ||
        this.model_.get('suppress_download_link');
    if (!hideLink) {
      var url = /** @type string */(this.model_.get('url'));
      var linkText = null;
      switch (type) {
        case cm.LayerModel.Type.KML:
          linkText = cm.MSG_DOWNLOAD_KML_LINK;
          break;
        case cm.LayerModel.Type.GEORSS:
          linkText = cm.MSG_DOWNLOAD_GEORSS_LINK;
          break;
        case cm.LayerModel.Type.FUSION:
          var value = this.model_.get('ft_from') + '';
          if (value) {
            url = 'http://www.google.com/fusiontables/DataSource?' +
                (value.match(/^\d{1,8}$/) ? 'dsrcid' : 'docid') + '=' + value;
            linkText = cm.MSG_VIEW_FUSION_TABLE_LABEL;
          }
          break;
      }
      if (linkText && url) {
        cm.ui.append(this.downloadElem_, cm.ui.SEPARATOR_DOT,
                     cm.ui.createLink(linkText, url));
      }
      // Show the file size in human-readable form in a tooltip.
      tip = cm.util.formatFileSize(this.metadataModel_.getLength(this.model_));
    }
  }
  this.downloadElem_.title = tip;
};

/** @private Updates the timestamp of this layer entry. */
cm.LayerEntryView.prototype.updateTime_ = function() {
  var message = '';
  var time = this.metadataModel_.getUpdateTime(this.model_);
  if (time) {
    // Convert time in seconds to time in milliseconds.
    var date = new Date(time * 1000);
    // For times more than 24 hours ago, we supply a custom string in the form
    // "Month Day, Year" instead of the getDateString "long" default, which
    // includes the day of the week as well.
    var dateMsg = this.dateFormatter_.format(date);
    message = cm.getMsgLastUpdatedTime(
        goog.date.relative.getDateString(date, undefined, dateMsg));
  }
  cm.ui.setText(this.timeElem_, message);
};

/** @private Updates the UI to reflect changes in this layer's metadata. */
cm.LayerEntryView.prototype.handleMetadataChange_ = function() {
  this.updateDownloadLink_();
  this.updateZoomLink_();
  this.updateTime_();
  this.updateWarning_();
  this.updateFade_();
};

/** @private Monitors the appropriate metadata entry for the layer. */
cm.LayerEntryView.prototype.updateMetadataListener_ = function() {
  // When a layer's source address changes, we have to listen to the metadata
  // entry for the new source and stop listening to the old one.
  if (this.metadataListener_) {
    cm.events.unlisten(this.metadataListener_);
  }
  this.metadataListener_ = this.metadataModel_.onChange(
      this.model_, this.handleMetadataChange_, this);
  this.handleMetadataChange_();
};

/**
 * Updates the entry based on changes in the map's current zoom level.
 * @param {Object} e The event payload.  e.zoom should contain the zoom level.
 * @private
 */
cm.LayerEntryView.prototype.handleZoomChange_ = function(e) {
  this.zoomLevel_ = /** @type number */(e.zoom);
  this.updateFade_();
};

/** @private Fades out the entry iff it is empty or out of zoom range. */
cm.LayerEntryView.prototype.updateFade_ = function() {
  if (this.metadataModel_.isEmpty(this.model_)) {
    this.setFade_(true, cm.MSG_NO_DATA_WARNING);
  } else if (this.zoomLevel_ !== null) {
    // If min_zoom or max_zoom are undefined, assume no lower or upper bound.
    var minZoom = this.model_.get('min_zoom');
    var maxZoom = this.model_.get('max_zoom');
    var outOfRange = goog.isNumber(minZoom) && this.zoomLevel_ < minZoom ||
                     goog.isNumber(maxZoom) && this.zoomLevel_ > maxZoom;
    this.setFade_(outOfRange, cm.MSG_OUT_OF_ZOOM_RANGE_TOOLTIP);
  }
};

/**
 * Changes the visibility of the view through opacity.
 * @param {boolean} faded If false, the view is shown normally. If true, the
 *     view is shown transparently.
 * @param {string} opt_fadeReason The message to show in the header's tooltip
 *     in case of transparency.
 * @private
 */
cm.LayerEntryView.prototype.setFade_ = function(faded, opt_fadeReason) {
  var opacity = !faded ? 1.0 : 0.5;
  var elements = [this.headerElem_, this.warningElem_, this.descriptionElem_,
      this.legendElem_, this.timeElem_, this.sliderDiv_, this.sublayersElem_];
  for (var key in elements) {
    elements[key] && goog.style.setOpacity(elements[key], opacity);
  }
  if (this.headerElem_) {
    this.headerElem_.title = faded && opt_fadeReason || '';
  }
};

/**
 * Hides or shows the zoom link depending on the layer's type and viewport.
 * @private
 */
cm.LayerEntryView.prototype.updateZoomLink_ = function() {
  // Do not display zoom link when viewport is not explicitly defined,
  // except for KMLLayer types, which have default viewports. TODO(romano):
  // if a folder's viewport is not defined, compute one from its
  // descendants and display a zoom link.
  var showZoomLink = !this.metadataModel_.isEmpty(this.model_) && (
      this.model_.get('viewport') ||
      this.model_.get('type') === cm.LayerModel.Type.KML ||
      this.model_.get('type') === cm.LayerModel.Type.GEORSS);
  goog.dom.classes.enable(this.zoomElem_, cm.css.HIDDEN, !showZoomLink);
  // Include a separator dot iff the zoom element has a previous sibling.
  cm.ui.setText(/** @type Element */(this.zoomElem_.firstChild),
    this.zoomElem_.previousSibling ? cm.ui.SEPARATOR_DOT : '');
};

/**
 * If the layer is a single-select folder, construct a sublayer menu with one
 * selected sublayer; otherwise dispose of the sublayer picker.
 * @private
 */
cm.LayerEntryView.prototype.updateSingleSelect_ = function() {
  if (this.sublayerPicker_) {
    this.sublayerPicker_.dispose();
    this.sublayerPicker_ = null;
  }
if (this.model_.isSingleSelect()) {
    this.sublayerPicker_ = new cm.SublayerPicker(
        this.sublayerSelect_, this.model_,
        this.appState_.getFirstEnabledSublayerId(this.model_) || '');
    cm.events.listen(this.sublayerPicker_, cm.events.SELECT_SUBLAYER,
      function(event) {
        cm.events.emit(this, cm.events.SELECT_SUBLAYER,
                       {id: event.id, model: this.model_});
      }, this);
  }
};

/**
 * Hides or shows the folder decorator depending on whether the layer is a
 * locked folder and the application has editing enabled.
 * @private
 */
cm.LayerEntryView.prototype.updateFolderDecorator_ = function() {
  // Show folder decorations except when the folder is locked and
  // editing is disabled.
  var folder = (this.model_.get('type') === cm.LayerModel.Type.FOLDER);
  var locked = (this.model_.get('folder_type') ===
      cm.LayerModel.FolderType.LOCKED);
  goog.dom.classes.enable(this.folderDecorator_, cm.css.HIDDEN,
      !folder || (locked && !this.config_['enable_editing']));
};

/**
 * Updates the state of the checkbox and layer details to match the
 * AppState's layer enabled state.
 * @private
 *
 * Use of goog.ui.Slider.handleRangeModelChange in this method violates
 * its @protected declaration, so the following warning type is suppressed
 * because it's being used on purpose.
 * @suppress {visibility}
 */
cm.LayerEntryView.prototype.updateEnabled_ = function() {
  var id = /** @type string */(this.model_.get('id'));
  var enabled = this.appState_.getLayerEnabled(id);
  this.checkboxElem_.checked = enabled;
  var selectedId = this.model_.isSingleSelect() &&
      this.appState_.getFirstEnabledSublayerId(this.model_) || null;
  goog.dom.classes.enable(this.entryElem_, cm.css.CONTAINS_PROMOTED_SUBLAYER,
                          selectedId !== null);
  if (selectedId) {
      goog.dom.classes.add(this.layerEntryViews_[selectedId].
          getEntryElement(), cm.css.PROMOTED_SUBLAYER);
      // Hide the selected sublayer's checkbox.
      goog.dom.classes.add(this.layerEntryViews_[selectedId].
          getCheckboxContainer(), cm.css.HIDDEN);
      // Hide the selected sublayer's title, except in edit mode, when the
      // editing links need a header.
      if (!this.config_['enable_editing']) {
        goog.dom.classes.add(this.layerEntryViews_[selectedId].
            getCheckboxLabel(), cm.css.HIDDEN);
      }
  }

  // Demote all sublayers except the selected one.
  goog.array.forEach(this.model_.getSublayerIds() || [],
                     function(sublayerId) {
      if (sublayerId !== selectedId) {
        goog.dom.classes.remove(this.layerEntryViews_[sublayerId].
            getEntryElement(), cm.css.PROMOTED_SUBLAYER);
        // Stop hiding the checkbox.
        goog.dom.classes.remove(this.layerEntryViews_[sublayerId].
            getCheckboxContainer(), cm.css.HIDDEN);
        // Stop hiding the title.
        goog.dom.classes.remove(this.layerEntryViews_[sublayerId].
            getCheckboxLabel(), cm.css.HIDDEN);
      }
    }, this);

  // Hide layer details of disabled layers and (if not editing) single-select
  // folders.
  goog.dom.classes.enable(this.contentElem_, cm.css.HIDDEN, !enabled ||
      (!this.config_['enable_editing'] && this.model_.isSingleSelect()));

  // Hide sublayers of disabled layers and locked folders.
  goog.dom.classes.enable(this.sublayersElem_, cm.css.HIDDEN, !enabled ||
      this.model_.get('folder_type') === cm.LayerModel.FolderType.LOCKED);

  // The opacity slider does not update properly when it's hidden, so we need
  // update it when it becomes visible.
  if (enabled && this.slider_) {
    this.slider_.handleRangeModelChange(null);  // force UI update
  }

  this.updateSingleSelect_();
};

/**
 * Creates or destroys the slider element if appropriate based on its current
 * existence and the layer type.
 * @private
 */
cm.LayerEntryView.prototype.updateSliderVisibility_ = function() {
  var type = this.model_.get('type');
  var enableOpacitySlider = type === cm.LayerModel.Type.TILE ||
      type === cm.LayerModel.Type.WMS;
  if (enableOpacitySlider && !this.slider_) {
    // Add an opacity slider (by default, a goog.ui.Slider goes from 0 to 100).
    this.slider_ = new goog.ui.Slider();
    this.slider_.setMoveToPointEnabled(true);
    this.slider_.render(this.sliderDiv_);
    this.sliderDot_ = cm.ui.create('div', {'class': cm.css.SLIDER_DOT});
    this.slider_.getValueThumb().appendChild(
        cm.ui.create('div', {'class': cm.css.SLIDER_CIRCLE}, this.sliderDot_));
    this.updateSliderValue_();

    this.sliderListeners_ = [
      // When the user moves the slider, forward a CHANGE_OPACITY event.
      cm.events.listen(
          this.slider_, goog.ui.Component.EventType.CHANGE, function() {
            cm.events.emit(
                goog.global, cm.events.CHANGE_OPACITY,
                {id: this.model_.get('id'), opacity: this.slider_.getValue()});
          }, this),
      // Keep the slider's value updated.
      cm.events.onChange(this.appState_, 'layer_opacities',
                         this.updateSliderValue_, this)
    ];
  } else if (!enableOpacitySlider && this.slider_) {
    this.slider_.dispose();
    this.slider_ = null;
    cm.events.unlisten(this.sliderListeners_);
    this.sliderListeners_ = null;
  }
};

/**
 * Updates the opacity slider to match the application state. This will do
 * nothing if the slider control does not exist (i.e. this is not a TILES
 * layer).
 * @private
 */
cm.LayerEntryView.prototype.updateSliderValue_ = function() {
  if (this.slider_) {
    var opacities =  /** @type Object.<number> */(
        this.appState_.get('layer_opacities') || {});
    var id = this.model_.get('id');
    var opacity = id in opacities ? opacities[id] : 100;
    this.slider_.setValue(opacity);
    this.sliderDot_.style.opacity = opacity / 100;
  }
};

/**
 * Adds a LayerEntryView for a sublayer.
 * @param {cm.LayerModel} sublayer The sublayer model for which to create a
 *   view.
 * @param {number} index The index into this sublayer entry's parent
 *   element's child list at which to insert the sublayer.
 * @private
 */
cm.LayerEntryView.prototype.insertSublayer_ = function(sublayer, index) {
  var id = /** @type string */(sublayer.get('id'));
  this.layerEntryViews_[id] = new cm.LayerEntryView(this.sublayersElem_,
      sublayer, this.metadataModel_, this.appState_, this.config_, index);
  cm.events.onChange(sublayer, 'title', this.updateSingleSelect_, this);
  cm.events.forward(this.layerEntryViews_[id],
                    [cm.events.DELETE_LAYER,
                     cm.events.TOGGLE_LAYER,
                     cm.events.SELECT_SUBLAYER,
                     cm.events.ZOOM_TO_LAYER], this);
};

/**
 * Removes an entry for a sublayer.
 * @param {cm.LayerModel} sublayer The sublayer model whose view to remove.
 * @private
 */
cm.LayerEntryView.prototype.removeSublayer_ = function(sublayer) {
  if (sublayer) {
    var id = /** @type string */(sublayer.get('id'));
    this.layerEntryViews_[id].dispose();
    delete this.layerEntryViews_[id];
  }
};

/** Removes this cm.LayerEntryView from the UI. */
cm.LayerEntryView.prototype.dispose = function() {
  for (var id in this.layerEntryViews_) {
    this.layerEntryViews_[id].dispose();
    delete this.layerEntryViews_[id];
  }
  cm.events.dispose(this);
  cm.ui.remove(this.entryElem_);
  if (this.metadataListener_) {
    cm.events.unlisten(this.metadataListener_);
  }
};
