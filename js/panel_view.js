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
 * @fileoverview Panel view, containing the map description and layer list.
 * @author kpy@google.com (Ka-Ping Yee)
 */

goog.provide('cm.PanelView');

goog.require('cm');
goog.require('cm.AppState');
goog.require('cm.Html');
goog.require('cm.LayerEntryView');
goog.require('cm.MapModel');
goog.require('cm.MetadataModel');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.layerFilter');
goog.require('cm.ui');
goog.require('cm.util');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.events.EventType');
goog.require('goog.i18n.MessageFormat');
goog.require('goog.module');
goog.require('goog.style');

/** @const string */
var EMPTY_PNG = '//maps.gstatic.com/mapfiles/transparent.png';

/**
 * @const number
 * The layer filter input element is shown if there are at least
 * LAYER_FILTER_VISIBILITY_THRESHOLD layers in the map model.
 * NOTE(user): The number was somewhat arbitrarily chosen;
 * it may be changed as necessary.
 */
var LAYER_FILTER_VISIBILITY_THRESHOLD = 8;

/**
 * Panel view, containing the map information and layers list.
 * @param {Element} frameElem The frame element surrounding the entire UI.
 * @param {Element} parentElem The DOM element in which to create the panel.
 * @param {Element} mapContainer The map container to put the expand button on.
 * @param {cm.MapModel} model The map model for which to create the panel view.
 * @param {cm.MetadataModel} metadataModel The metadata model.
 * @param {cm.AppState} appState The application state model.
 * @param {Object=} opt_config Configuration settings.  These fields are used:
 *     draft_mode: Indicate that the map is an unpublished draft?
 *     hide_panel_header: Hide the map title and description?
 *     publisher_name: A string used as the map's publisher
 *     enable_editing: Allow any editing at all?  If true, the following fields
 *       are also used:
 *         save_url: The URL to post to upon save
 *         dev_mode: Enable development mode?
 *         map_list_url: The URL to go to the list of maps
 *         diff_url: The URL to go to see the diff in the map model.
 * @constructor
 */
cm.PanelView = function(frameElem, parentElem, mapContainer, model,
                        metadataModel, appState, opt_config) {
  /**
   * @type Element
   * @private
   */
  this.frameElem_ = frameElem;

  /**
   * @type Element
   * @private
   */
  this.parentElem_ = parentElem;

  /**
   * @type cm.MapModel
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
   * @type Element
   * @private
   */
  this.panelInner_;

  /**
   * @type Element
   * @private
   */
  this.panelOuterHeader_;

  /**
   * @type Element
   * @private
   */
  this.panelHeader_;

  /**
   * @type Element
   * @private
   */
  this.titleElem_;

  /**
   * @type Element
   * @private
   */
  this.descElem_;

  /**
   * @type Element
   * @private
   */
  this.panelLinks_;

  /**
   * @type Element
   * @private
   */
  this.panelLayers_;

  /**
   * @type Element
   * @private
   */
  this.scroll_;

  /**
   * @type Element
   * @private
   */
  this.scrollTop_;

  /**
   * @type Element
   * @private
   */
  this.layerFilterBox_;

  /**
   * Shows how many layers match the current layer filter query, if there
   * is a query.
   * @type Element
   * @private
   */
  this.matchingLayersMessage_;

  /**
   * @type !Object
   * @private
   */
  this.config_ = opt_config || {};

  var collapse = cm.ui.create('div', {'class': cm.css.COLLAPSE},
      cm.ui.create('img', {'class': cm.css.COLLAPSE_ICON, 'src': EMPTY_PNG}));

  var toggleCollapseOnClick = goog.bind(function() {
      goog.dom.classes.toggle(this.frameElem_, cm.css.PANEL_COLLAPSED);
      if (goog.dom.classes.has(this.frameElem_, cm.css.PANEL_COLLAPSED)) {
        cm.Analytics.logAction(
            cm.Analytics.LayersPanelAction.PANEL_TOGGLED_CLOSED, null);
      } else {
        cm.Analytics.logAction(
            cm.Analytics.LayersPanelAction.PANEL_TOGGLED_OPEN, null);
      }
      cm.events.emit(goog.global, 'resize');  // readjust layout
    }, this);
  cm.events.listen(collapse, 'click', toggleCollapseOnClick);
  var expand = cm.ui.create('div', {'class': cm.css.EXPAND},
      cm.ui.create('img', {'class': cm.css.EXPAND_ICON, 'src': EMPTY_PNG}));
  cm.events.listen(expand, 'click', toggleCollapseOnClick);
  mapContainer.appendChild(expand);

  // Create the panel elements: editing toolbar (if editing), outer header,
  // links, and layer list.
  var setDefaultViewLink, resetLink;
  var publisherName = this.config_['publisher_name'];
  var enableLayerFilter = this.config_['enable_layer_filter'];
  var toolbarContainer;
  cm.ui.append(parentElem,
      this.panelInner_ = cm.ui.create('div', {'class': cm.css.PANEL_INNER},
          toolbarContainer = cm.ui.create('div', {}),
          this.panelOuterHeader_ = cm.ui.create(
              'div', {'class': cm.css.PANEL_OUTER_HEADER},
              collapse,
              this.panelHeader_ = cm.ui.create(
                  'div', {'class': cm.css.PANEL_HEADER},
                  this.config_['draft_mode'] ? cm.ui.create(
                      'span', {'class': cm.css.DRAFT_INDICATOR,
                               'title': cm.MSG_DRAFT_TOOLTIP},
                      cm.MSG_DRAFT_LABEL) : null,
                  this.titleElem_ = cm.ui.create(
                      'h1', {'class': cm.css.MAP_TITLE}),
                  publisherName ? cm.ui.create(
                      'div', {'class': cm.css.MAP_PUBLISHER},
                      cm.getMsgPublisherAttribution(publisherName)) : null)),
          this.scrollTop_ = cm.ui.create('div'),
          this.scroll_ = cm.ui.create('div', {'class': cm.css.PANEL_SCROLL},
              this.descElem_ = cm.ui.create(
                  'div', {'class': cm.css.MAP_DESCRIPTION}),
              this.panelLinks_ = cm.ui.create(
                  'div', {'class': cm.css.PANEL_LINKS},
                  setDefaultViewLink = this.config_['enable_editing'] ?
                      cm.ui.createLink(cm.MSG_SET_DEFAULT_VIEW_LINK) : null,
                  setDefaultViewLink && cm.ui.create('br'),
                  resetLink = cm.ui.createLink(cm.MSG_RESET_VIEW_LINK)),
              this.layerFilterBox_ = enableLayerFilter ? cm.ui.create('input',
                {'type': 'text',
                 'class': cm.css.LAYER_FILTER,
                 'placeholder': cm.MSG_LAYER_FILTER_PLACEHOLDER}) : null,
              this.matchingLayersMessage_ = cm.ui.create('span',
                {'class': cm.css.LAYER_FILTER_INFO}),
              this.panelLayers_ = cm.ui.create('div',
                  {'class': cm.css.PANEL_LAYERS})
          )));
  if (this.config_['hide_panel_header']) {
    this.panelHeader_.style.display = 'none';
    this.descElem_.style.display = 'none';
  }

  // Populate the editing toolbar.
  if (this.config_['enable_editing']) {
    // This loads the 'edit' module, then calls the function in arg 3, passing
    // it the object that the module exported with the name 'cm.ToolbarView'.
    var me = this;
    goog.module.require('edit', 'cm.ToolbarView', function(ToolbarView) {
      var toolbarView = new ToolbarView(
          toolbarContainer, me.model_, !!me.config_['save_url'],
          me.config_['dev_mode'], me.config_['map_list_url'],
          cm.util.browserSupportsTouch(), me.config_['diff_url']);
      cm.events.emit(me.panelInner_, goog.events.EventType.RESIZE);
    });
  }
  if (this.layerFilterBox_) {
    // Enable the layer filter.
    cm.events.listen(this.layerFilterBox_,
      ['change', 'input', 'cut', 'paste', 'keyup'], function() {
        cm.events.emit(this, cm.events.FILTER_QUERY_CHANGED,
                       {'query': this.layerFilterBox_.value});
        this.filterLayers_();
      }, this);
    // Set up a one-time listener because the app state filter_query is set from
    // the URL after the panel view is constructed.
    var filterToken = cm.events.onChange(this.appState_, 'filter_query',
      function() {
        cm.events.unlisten(filterToken);
        this.layerFilterBox_.value = this.appState_.getFilterQuery();
        this.filterLayers_();
      }, this);
    // Show or hide the layer filter as appropriate.
    this.updateLayerFilterVisibility_();

    // TODO(romano): There should be UX decison made about how the editor and
    // layer filter interact, since this listener could result in a layer
    // disappearing after being edited.
    cm.events.listen(goog.global, cm.events.MODEL_CHANGED, this.filterLayers_,
                     this);
  }

  // Populate the title and description and listen for changes.
  this.updateTitle_();
  this.updateDescription_();
  cm.events.onChange(model, 'title', this.updateTitle_, this);
  cm.events.onChange(model, 'description', this.updateDescription_, this);

  if (setDefaultViewLink) {
    // Set the current view as default.
    cm.events.listen(setDefaultViewLink, 'click', function() {
      var oldDefault = cm.AppState.fromAppState(this.appState_);
      oldDefault.setFromMapModel(this.model_);
      var newDefault = cm.AppState.fromAppState(this.appState_);
      cm.events.emit(goog.global, cm.events.DEFAULT_VIEW_SET,
          {oldDefault: oldDefault, newDefault: newDefault});
    }, this);
  }

  // Reset to the default view of the map.
  cm.events.listen(resetLink, 'click', function() {
    cm.Analytics.logAction(cm.Analytics.LayersPanelAction.VIEW_RESET, null);
    cm.events.emit(goog.global, cm.events.RESET_VIEW, {model: this.model_});
  }, this);

  // Open the property inspector on the map.
  cm.events.forward(this.titleElem_, 'click', goog.global,
                    cm.events.INSPECT, {object: model});

  // Add or remove LayerEntryViews when layers are added or removed.
  var layers = /** @type google.maps.MVCArray */(model.get('layers'));
  cm.events.listen(layers, 'insert_at', function(i) {
    this.addLayer_(layers.getAt(i), i);
  }, this);
  cm.events.listen(layers, 'remove_at', function(i, layer) {
    this.removeLayer_(layer);
  }, this);
  cm.events.listen(layers, ['insert_at', 'remove_at'],
    this.updateLayerFilterVisibility_, this);

  // Create a close button in the panel container that hides the layers panel.
  cm.ui.createCloseButton(parentElem, function() {
    cm.events.emit(parentElem, 'panelclose');
  });

  // Add views for all the layers.
  goog.array.forEach(layers.getArray(), this.addLayer_, this);

  // Listen to changes in the inner panel's height.
  this.positionPanelScroll_();
  cm.events.listen(this.panelInner_, goog.events.EventType.RESIZE,
                   this.positionPanelScroll_, this);

  // Listen to the open/close events triggered on the layers panel container.
  cm.events.listen(parentElem, 'panelopen', this.open_, this);
  cm.events.listen(parentElem, 'panelclose', this.close_, this);
};

/**
 * Set the panel's maxHeight. This is triggered in initialize.js when the
 * browser window is resized, so that the map's height can be passed in.
 * @param {number?} height The maximum height of the panel, in pixels.
 */
cm.PanelView.prototype.setMaxHeight = function(height) {
  this.panelMaxHeight_ = height;
  this.parentElem_.style.maxHeight = height ? height + 'px' : '';
  this.positionPanelScroll_();
};

/**
 * Adjusts the top and maxHeight of the panel layers container.
 * @private
 */
cm.PanelView.prototype.positionPanelScroll_ = function() {
  this.scroll_.style.maxHeight = this.panelMaxHeight_ ?
      (this.panelMaxHeight_ - this.scrollTop_.offsetTop) + 'px' : '';
  this.scroll_.style.top = this.scrollTop_.offsetTop + 'px';
};

/**
 * Return the panel's header element
 * @return {Element} The header element.
 */
cm.PanelView.prototype.getHeader = function() {
  return this.panelHeader_;
};

/**
 * Makes the title text a clickable target to bring up the MapPicker.
 * @param {cm.MapPicker} picker The MapPicker to trigger.
 */
cm.PanelView.prototype.enableMapPicker = function(picker) {
  goog.dom.classes.add(this.titleElem_, cm.css.MAP_TITLE_PICKER);
  cm.events.listen(this.titleElem_, 'click', goog.bind(function(e) {
      picker.showMenu(true);
      e.stopPropagation ? e.stopPropagation() : (e.cancelBubble = true);
  }, picker));
};

/**
 * Updates the displayed title to match the MapModel.
 * @private
 */
cm.PanelView.prototype.updateTitle_ = function() {
  var title = /** @type string */(this.model_.get('title'));
  cm.ui.setText(this.titleElem_, title);
  cm.ui.document.title = title;
  cm.events.emit(this.panelInner_, goog.events.EventType.RESIZE);
};

/**
 * Updates the displayed description to match the MapModel.
 * @private
 */
cm.PanelView.prototype.updateDescription_ = function() {
  var description = /** @type cm.Html */(this.model_.get('description'));
  description.pasteInto(this.descElem_);
  // TODO(kpy): On the Android web browser, the panel will not scroll if there
  // are any block tags in the map description.  Remove them and scrolling works
  // just fine.  Block tags in layer descriptions are harmless, though.
  // Requires further investigation.
  cm.events.emit(this.panelInner_, goog.events.EventType.RESIZE);
};

/**
 * Runs a filter query and updates the matched layers in the appState.
 * @private
 */
cm.PanelView.prototype.filterLayers_ = function() {
  // Retrieve the query from the AppState in case it was set by the q= URL
  // parameter.
  var query = this.appState_.getFilterQuery();
  var matches = cm.layerFilter.matchAllLayers(this.model_, query);
  // Hide the message about total matching layers if there isn't a query.
  goog.dom.classes.enable(this.matchingLayersMessage_, cm.css.HIDDEN, !query);
  if (query) {
    cm.ui.setText(this.matchingLayersMessage_,
      (new goog.i18n.MessageFormat(cm.MSG_NUMBER_MATCHING_LAYERS)).format(
        {'NUM_LAYERS': matches.length}));
  }
  cm.events.emit(this, cm.events.FILTER_MATCHES_CHANGED, {matches: matches});
};

/**
 * Shows or hides the layer filter depending on the number of layers in the map.
 * @private
 */
cm.PanelView.prototype.updateLayerFilterVisibility_ = function() {
  if (this.layerFilterBox_) {
    // TODO(romano): do not count layers in locked folders.
    var hide = this.model_.getAllLayerIds().length <
        LAYER_FILTER_VISIBILITY_THRESHOLD;
    goog.dom.classes.enable(this.layerFilterBox_, cm.css.HIDDEN, hide);
  }
};

/**
 * Opens the panel in the middle of the document.
 * @private
 */
cm.PanelView.prototype.open_ = function() {
  goog.dom.classes.add(this.parentElem_, cm.css.OPEN);
  // Once the style is set on the container, its width can be retrieved.
  var x = (this.frameElem_.offsetWidth - this.parentElem_.offsetWidth) / 2;
  this.parentElem_.style.left = Math.max(0, Math.round(x)) + 'px';
  // If the panel hasn't been displayed previously, this is its first
  // opportunity to measure its size and position the layer list accordingly.
  this.positionPanelScroll_();
};

/**
 * Closes the panel and resets properties that were set on open.
 * @private
 */
cm.PanelView.prototype.close_ = function() {
  goog.dom.classes.remove(this.parentElem_, cm.css.OPEN);
  this.parentElem_.style.left = 'auto';
};

/**
 * Adds an entry for a layer.
 * @param {cm.LayerModel} layer A layer model for which to create a view.
 * @param {number} index The index into this layer entry's sibling
 *   array at which to insert the layer.
 * @private
 */
cm.PanelView.prototype.addLayer_ = function(layer, index) {
  var id = /** @type string */(layer.get('id'));
  this.layerEntryViews_[id] = new cm.LayerEntryView(
      this.panelLayers_, layer, this.metadataModel_, this.appState_,
      this.config_, index);
  var view = this.layerEntryViews_[id];
  cm.events.listen(view, cm.events.DELETE_LAYER, function(e) {
    cm.events.emit(goog.global, cm.events.DELETE_LAYER,
                   {model: this.model_, id: e.id});
  }, this);
  cm.events.forward(view, [cm.events.TOGGLE_LAYER,
                           cm.events.SELECT_SUBLAYER,
                           cm.events.ZOOM_TO_LAYER],
                           this);
};

/**
 * Removes an entry for a layer.
 * @param {cm.LayerModel} layer The layer model whose view to remove.
 * @private
 */
cm.PanelView.prototype.removeLayer_ = function(layer) {
  if (layer) {
    var id = /** @type string */(layer.get('id'));
    this.layerEntryViews_[id].dispose();
    delete this.layerEntryViews_[id];
  }
};

/**
 * Get the bounds of the Element into which the PanelView was rendered. (This is
 * the same Element that was passed to the constructor via the parentlElem.)
 * @return {goog.math.Rect} The position and size of the Element containing the
 *     PanelView.
 */
cm.PanelView.prototype.getBounds = function() {
  return goog.style.getBounds(this.parentElem_);
};
