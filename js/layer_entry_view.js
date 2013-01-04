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
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.date.relative');
goog.require('goog.dom.classes');
goog.require('goog.format');
goog.require('goog.i18n.DateTimeFormat');
goog.require('goog.ui.Slider');

/** @desc Label for a link that zooms the map to fit the layer's area. */
var MSG_ZOOM_TO_AREA_LINK = goog.getMsg('Zoom to area');

/** @desc Label for a link that lets the user edit a layer. */
var MSG_EDIT_LINK = goog.getMsg('Edit');

/** @desc Alternate text for a button for deleting a layer. */
var MSG_DELETE = goog.getMsg('Delete');

/** @desc Label for a link to download a KML file. */
var MSG_DOWNLOAD_KML_LINK = goog.getMsg('Download KML');

/** @desc Label for a link to download a GeoRSS file. */
var MSG_DOWNLOAD_GEORSS_LINK = goog.getMsg('Download GeoRSS');

/** @desc Label for a link to view data from a Fusion table. */
var MSG_VIEW_FUSION_TABLE_LABEL = goog.getMsg('View data');

/** @desc Label for a link to download a GeoRSS file. */
var MSG_OPACITY_TOOLTIP = goog.getMsg('Adjust layer transparency');

/** @desc Label for a select option to show multiple sublayers/dates
 *  in a time series folder.
 */
var MSG_MULTIPLE_DATES = goog.getMsg('Multiple dates');

/** @desc Warning message for data sources that have unsupported features. */
var MSG_UNSUPPORTED_KML_WARNING = goog.getMsg(
    'This layer may include some unsupported features.');

/** @desc Warning message when the data file is empty or contains no
 * features.
 */
var MSG_NO_DATA_WARNING = goog.getMsg(
    'This layer currently contains nothing to show on the map.');

/** @desc Label for faded out layer entry when layer is not visible at the
 * current zoom level. */
var MSG_OUT_OF_ZOOM_RANGE_TOOLTIP =
    goog.getMsg('Data not available at current zoom level.');

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
   * @type ?string
   * @private
   */
  this.lastPromotedId_ = null;

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
  this.dateElem_;

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
   * @type Object
   * @private
   */
  this.config_ = opt_config || {};

  // Extract information about the layer.
  var id = /** @type string */(model.get('id'));
  var layerType = model.get('type');
  var isTimeSeries = model.isTimeSeries();

  // Figure out whether to enable editing.
  var enableEditing = this.config_['enable_editing'];

  // These links will be replaced by icons (e.g. pencil, rubbish bin). Mocks:
  // http://folder/nsavio/dotorg/crisis_response/crisis_maps/20120424&s
  var zoomLink = cm.ui.createLink(MSG_ZOOM_TO_AREA_LINK);
  this.zoomElem_ = cm.ui.create('span', {},
      cm.ui.create('span', {}, cm.ui.SEPARATOR_DOT), zoomLink);
  var editLink = enableEditing ? cm.ui.createLink(MSG_EDIT_LINK) : null;
  var deleteLink = enableEditing ? cm.ui.createLink(MSG_DELETE) : null;
  this.downloadElem_ = cm.ui.create('span');
  var layerLinks = [editLink, enableEditing && cm.ui.SEPARATOR_DOT, deleteLink,
                    this.zoomElem_, this.downloadElem_];

  // Create the panel entry.
  this.entryElem_ = cm.ui.create('div', {'class': 'cm-layer-entry'},
      this.headerElem_ = cm.ui.create('div', {'class': 'cm-header'},
          cm.ui.create('div', {'class': 'cm-checkbox-container'},
              this.checkboxElem_ = cm.ui.create('input',
                  {'type': 'checkbox', 'id': 'checkbox' + id}),
              this.folderDecorator_ = cm.ui.create('span',
                  {'class': 'cm-checkbox-folder-decoration'})),
          this.checkboxLabel_ = cm.ui.create('label', {'for': 'checkbox' + id},
              this.titleElem_ = cm.ui.create('span',
                  {'class': 'cm-layer-title'}),
              this.dateElem_ = isTimeSeries ?
                  cm.ui.create('span', {'class': 'cm-layer-date'}) :
                  null)
      ),
      this.contentElem_ = cm.ui.create('div', {'class': 'cm-content'},
          this.sliderDiv_ = cm.ui.create('div', {'title': MSG_OPACITY_TOOLTIP,
                                                 'class': 'cm-slider'}),
          cm.ui.create('div', {}, layerLinks),
          this.warningElem_ = cm.ui.create('div', {'class': 'cm-warning'}),
          this.legendBoxElem_ = cm.ui.create('div',
              {'class': 'cm-layer-legend-box'},
              cm.ui.create('fieldset', undefined,
                  cm.ui.create('legend', undefined, 'Legend'),
                  this.legendElem_ = cm.ui.create('div',
                      {'class': 'cm-layer-legend'}))),
          this.descriptionElem_ = cm.ui.create('div',
              {'class': 'cm-layer-description'}),
          this.timeElem_ = cm.ui.create('div', {'class': 'cm-timestamp'})
      ),
      this.sublayersElem_ = cm.ui.create('div', {'class': 'cm-sublayers'})
  );
  if (opt_index !== undefined && opt_index < parentElem.childNodes.length) {
    parentElem.insertBefore(this.entryElem_, parentElem.childNodes[opt_index]);
  } else {
    parentElem.appendChild(this.entryElem_);
  }


  if (isTimeSeries) {
    this.sublayerPicker_ = new cm.SublayerPicker(this.headerElem_, this.model_);
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

  // Attach event handlers to ensure this view reflects changes in the
  // layer model, the metadata model, and the AppState.
  cm.events.onChange(model, 'title', this.updateTitle_, this);
  cm.events.onChange(model, 'description', this.updateDescription_, this);
  cm.events.onChange(model, 'legend', this.updateLegend_, this);
  cm.events.onChange(model,
                     ['suppress_download_link', 'type', 'url', 'ft_from'],
                     this.updateDownloadLink_, this);
  cm.events.onChange(model, ['viewport', 'type'], this.updateZoomLink_, this);
  cm.events.onChange(model, 'locked', function() {
    this.updateFolderDecorator_();
    this.updateEnabled_();
  }, this);
  cm.events.onChange(model, 'type', this.updateSliderVisibility_, this);
  cm.events.onChange(metadataModel, id, function() {
    var metadata = this.metadataModel_.get(id);
    this.updateWarning_();
    this.updateDownloadLink_();
    this.updateZoomLink_();
    this.updateTime_();
  }, this);
  cm.events.onChange(appState, ['enabled_layer_ids', 'promoted_layer_ids'],
                     this.updateEnabled_, this);
  cm.events.onChange(appState, 'promoted_layer_ids', this.updateTitle_, this);

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
  cm.events.listen(goog.global, cm.events.ZOOM_CHANGED, this.handleZoomChange_,
                   this);

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

  if (isTimeSeries) {
    cm.events.listen(this.sublayerPicker_, cm.events.SELECT_SUBLAYER,
      function(event) {
        var sublayer = model.getSublayer(event.id);
        if (sublayer && event.value) {
          // Promote this sublayer.
          cm.events.emit(this, cm.events.PROMOTE_LAYER,
                         {object: sublayer, value: true});
          // Enable parent if a sublayer was promoted
          cm.events.emit(this,
                         cm.events.TOGGLE_LAYER, {id: id, value: true});
        } else {
          // Demote all of this layer's sublayers.
          cm.events.emit(this, cm.events.PROMOTE_LAYER,
                        {object: this.model_, value: false});
        }
      }, this);
  }
};

/**
 * The value to give the SublayerPicker menu option for displaying
 * multiple sublayers.
 * @type {string}
 */
cm.LayerEntryView.MULTIPLE_DATES_OPTION = '0';

/**
 * Accessor for the DOM element containing this layer's header information.
 * @return {Element} The header element.
 */
cm.LayerEntryView.prototype.getHeaderElement = function() {
  return this.headerElem_;
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
  if (this.model_.isTimeSeries()) {
    var formattedDate = '';
    var sublayer = this.appState_.getPromotedSublayer(this.model_);
    if (sublayer) {
      var update = sublayer.get('last_update') || null;
      if (update) {
        formattedDate = cm.ui.SEPARATOR_DASH + this.dateFormatter_.format(
            new Date(/** @type number */(update) * 1000));
      }
    } else {
      formattedDate = cm.ui.SEPARATOR_DASH + MSG_MULTIPLE_DATES;
    }
    cm.ui.setText(this.dateElem_, formattedDate);
  }
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
  goog.dom.classes.enable(this.legendBoxElem_, 'cm-hidden',
      !legend || goog.string.isEmpty(legend.getHtml()));
};

/** @private Updates the warning and fade state based on the layer metadata. */
cm.LayerEntryView.prototype.updateWarning_ = function() {
  var id = /** @type string */(this.model_.get('id'));
  var isEmpty = this.metadataModel_.isEmpty(id);
  var hasUnsupportedFeatures = this.metadataModel_.hasUnsupportedFeatures(id);
  var warning = isEmpty ? MSG_NO_DATA_WARNING :
      hasUnsupportedFeatures ? MSG_UNSUPPORTED_KML_WARNING : '';
  // TODO(kpy): Both handleZoomChange_ and updateWarning_ affect the fade
  // state, so for example, zooming from out-of-range to in-range will cause
  // the layer entry to go black even when there is no data (the entry should
  // stay grey).  These bits should be merged into a single updateFade_ method.
  this.setFade_(isEmpty, warning);
  cm.ui.setText(this.warningElem_, warning);
  goog.dom.classes.enable(this.warningElem_, 'cm-hidden', !warning);
};

/** @private Updates the panel entry to match the model. */
cm.LayerEntryView.prototype.updateDownloadLink_ = function() {
  var id = /** @type string */(this.model_.get('id'));
  var isFolder = this.model_.get('type') === cm.LayerModel.Type.FOLDER;
  var tip = '';
  cm.ui.clear(this.downloadElem_);
  if (!isFolder) {
    var type = /** @type cm.LayerModel.Type */(this.model_.get('type'));
    var hideLink = this.metadataModel_.serverErrorOccurred(id) ||
        this.model_.get('suppress_download_link');
    if (!hideLink) {
      var url = /** @type string */(this.model_.get('url'));
      var linkText = null;
      switch (type) {
        case cm.LayerModel.Type.KML:
          linkText = MSG_DOWNLOAD_KML_LINK;
          break;
        case cm.LayerModel.Type.GEORSS:
          linkText = MSG_DOWNLOAD_GEORSS_LINK;
          break;
        case cm.LayerModel.Type.FUSION:
          var value = this.model_.get('ft_from') + '';
          if (value) {
            url = 'http://www.google.com/fusiontables/DataSource?' +
                (value.match(/^\d{1,8}$/) ? 'dsrcid' : 'docid') + '=' + value;
            linkText = MSG_VIEW_FUSION_TABLE_LABEL;
          }
          break;
      }
      if (linkText && url) {
        cm.ui.append(this.downloadElem_, cm.ui.SEPARATOR_DOT,
                     cm.ui.createLink(linkText, url));
      }
      // Show the file size in human-readable form in a tooltip.
      tip = cm.util.formatFileSize(this.metadataModel_.getContentLength(id));
    }
  }
  this.downloadElem_.title = tip;
};

/** @private Updates the timestamp of this layer entry. */
cm.LayerEntryView.prototype.updateTime_ = function() {
  var message = '';
  var id = /** @type string */(this.model_.get('id'));
  var time = this.metadataModel_.getContentLastModified(id);
  if (time) {
    // Convert time in seconds to time in milliseconds.
    var d = new Date(time * 1000);
    // Format a string that displays Month Day, Year instead of the
    // getDateString "long" default which includes the day of the week as well.
    var dateMsg = this.dateFormatter_.format(d);
    /** @desc The last time this layer was updated. */
    var MSG_LAST_UPDATED = goog.getMsg('Last updated: {$formattedTime}', {
      formattedTime: goog.date.relative.getDateString(d, undefined, dateMsg)
    });
    message = MSG_LAST_UPDATED;
  }
  cm.ui.setText(this.timeElem_, message);
};

/**
 * Updates the entry's appearance based on whether the current zoom level is
 * within the layer's min/max zoom range.
 * @param {Object} e The event payload. One field is used:
 *     zoom: The current zoom level of the map.
 * @private
 */
cm.LayerEntryView.prototype.handleZoomChange_ = function(e) {
  var zoom = /** @type number */ (e.zoom);
  // If min_zoom or max_zoom are undefined, assume no lower or upper bound.
  var minZoom = this.model_.get('min_zoom');
  var maxZoom = this.model_.get('max_zoom');
  var visible = !(goog.isNumber(minZoom) && zoom < minZoom ||
                  goog.isNumber(maxZoom) && zoom > maxZoom);
  this.setFade_(!visible, MSG_OUT_OF_ZOOM_RANGE_TOOLTIP);
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
  // also display folder zoomto links once a folder's viewport can be computed
  // from its descendants' viewports.
  var id = /** @type string */(this.model_.get('id'));
  var showZoomLink = !this.metadataModel_.isEmpty(id) && (
      this.model_.get('viewport') ||
      this.model_.get('type') === cm.LayerModel.Type.KML ||
      this.model_.get('type') === cm.LayerModel.Type.GEORSS);
  goog.dom.classes.enable(this.zoomElem_, 'cm-hidden', !showZoomLink);
  // Include a separator dot iff the zoom element has a previous sibling.
  cm.ui.setText(/** @type Element */(this.zoomElem_.firstChild),
    this.zoomElem_.previousSibling ? cm.ui.SEPARATOR_DOT : '');
};

/**
 * Hides or shows the folder decorator depending on whether the layer is a
 * locked folder and the application has editing enabled.
 * @private
 */
cm.LayerEntryView.prototype.updateFolderDecorator_ = function() {
  // Show folder decorations except when the folder is locked and
  // editing is disabled.
  var folder = this.model_.get('type') === cm.LayerModel.Type.FOLDER;
  var locked = /** @type boolean */(this.model_.get('locked'));
  goog.dom.classes.enable(this.folderDecorator_, 'cm-hidden',
      !folder || (locked && !this.config_['enable_editing']));
};

/**
 * Updates the state of the checkbox and layer details to match the
 * AppState's layer enabled state.
 * @private
 */
cm.LayerEntryView.prototype.updateEnabled_ = function() {
  var id = /** @type string */(this.model_.get('id'));
  var enabled = this.appState_.getLayerEnabled(id);
  this.checkboxElem_.checked = enabled;
  var sublayer = null;
  var promotedId = null;
  if (this.model_.isTimeSeries()) {
    sublayer = this.appState_.getPromotedSublayer(this.model_);
    promotedId = sublayer && /** @type string **/(sublayer.get('id')) || null;
  }
  if (this.lastPromotedId_ && this.lastPromotedId_ != promotedId) {
    // The last-promoted sublayer is no longer promoted.
    goog.dom.classes.remove(
        this.layerEntryViews_[this.lastPromotedId_].getEntryElement(),
        'cm-promoted-sublayer');
    this.layerEntryViews_[this.lastPromotedId_].
        getHeaderElement().className = 'cm-header';
  }
  if (promotedId) {
    // Hide promoted sublayer's checkbox and title
    this.layerEntryViews_[promotedId].
        getHeaderElement().className = 'cm-hidden';
    if (promotedId != this.lastPromotedId_) {
      // A new sublayer is now promoted.
      goog.dom.classes.add(this.layerEntryViews_[promotedId].getEntryElement(),
                           'cm-promoted-sublayer');
    }
    if (!this.lastPromotedId_) {
      // The time series was toggled from not having a promoted sublayer
      // to having one.
      goog.dom.classes.add(this.entryElem_, 'cm-contains-promoted-sublayer');
    }
  }
  if (!promotedId && this.lastPromotedId_) {
    // The time series was toggled from having a promoted sublayer to
    // not having one.
    goog.dom.classes.remove(this.entryElem_, 'cm-contains-promoted-sublayer');
  }
  this.lastPromotedId_ = promotedId;

  // Hide layer details of disabled layers and folders with a promoted sublayer.
  goog.dom.classes.enable(this.contentElem_, 'cm-hidden',
                          !enabled || sublayer !== null);
  // Hide sublayers of disabled layers and locked folders.
  goog.dom.classes.enable(this.sublayersElem_, 'cm-hidden',
      !enabled || /** @type boolean */(this.model_.get('locked')));

  // The opacity slider does not update properly when it's hidden, so we need
  // update it when it becomes visible.
  if (enabled && this.slider_) {
    this.slider_.handleRangeModelChange(null);  // force UI update
  }
};

/**
 * Creates or destroys the slider element if appropriate based on its current
 * existence and the layer type.
 * @private
 */
cm.LayerEntryView.prototype.updateSliderVisibility_ = function() {
  var isTilesLayer = this.model_.get('type') === cm.LayerModel.Type.TILE;
  if (isTilesLayer && !this.slider_) {
    // Add an opacity slider (by default, a goog.ui.Slider goes from 0 to 100).
    this.slider_ = new goog.ui.Slider();
    this.slider_.setMoveToPointEnabled(true);
    this.slider_.render(this.sliderDiv_);
    this.slider_.getValueThumb().appendChild(
        cm.ui.create('div', {'class': 'cm-slider-circle'},
            this.sliderDot_ = cm.ui.create('div', {'class': 'cm-slider-dot'})));
    this.updateSliderValue_();

    this.sliderListeners_ = [
      // When the user moves the slider, forward a CHANGE_OPACITY event.
      cm.events.listen(this.slider_, 'change', function() {
        cm.events.emit(
            goog.global, cm.events.CHANGE_OPACITY,
            {id: this.model_.get('id'), opacity: this.slider_.getValue()});
      }, this),
      // Keep the slider's value updated.
      cm.events.onChange(this.appState_, 'layer_opacities',
                         this.updateSliderValue_, this)
    ];
  } else if (!isTilesLayer && this.slider_) {
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
 * @param {cm.LayerModel} layer A layer model for which to create a view.
 * @param {number} index The index into this layer entry's parent
 *   element's children at which to insert the sublayer.
 * @private
 */
cm.LayerEntryView.prototype.insertSublayer_ = function(layer, index) {
  var id = /** @type string */(layer.get('id'));
  this.layerEntryViews_[id] = new cm.LayerEntryView(this.sublayersElem_,
      layer, this.metadataModel_, this.appState_, this.config_, index);
  cm.events.forward(this.layerEntryViews_[id],
                    [cm.events.DELETE_LAYER,
                     cm.events.PROMOTE_LAYER,
                     cm.events.TOGGLE_LAYER,
                     cm.events.ZOOM_TO_LAYER], this);
};

/**
 * Removes an entry for a sublayer.
 * @param {cm.LayerModel} layer The layer model whose view to remove.
 * @private
 */
cm.LayerEntryView.prototype.removeSublayer_ = function(layer) {
  if (layer) {
    var id = /** @type string */(layer.get('id'));
    this.layerEntryViews_[id].dispose();
    delete this.layerEntryViews_[id];
  }
};

/** Removes this cm.LayerEntryView from the UI. */
cm.LayerEntryView.prototype.dispose = function() {
  cm.ui.remove(this.entryElem_);
};
