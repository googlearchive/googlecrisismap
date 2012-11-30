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
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.array');
goog.require('goog.dom.classes');

/** @const @type string */
var EMPTY_PNG = '//maps.gstatic.com/mapfiles/transparent.png';

/** @desc Label for a link that resets the map to its default view. */
var MSG_RESET_VIEW_LINK = goog.getMsg('Reset to default view');

/** @desc Label for a link that resets the map to its default view. */
var MSG_SET_DEFAULT_VIEW_LINK = goog.getMsg('Set current view as default');

/** @desc Label to show for a draft (unpublished) map. */
var MSG_DRAFT_LABEL = goog.getMsg('DRAFT');

/** @desc Detail text for the label on a draft (unpublished) map. */
var MSG_DRAFT_TOOLTIP = goog.getMsg(
    'This is an unpublished version of this map.');


/**
 * Panel view, containing the map description and layer list.
 * @param {Element} frameElem The frame element surrounding the entire UI.
 * @param {Element} parentElem The DOM element in which to create the panel.
 * @param {Element} mapContainer The map container to put the expand button on.
 * @param {cm.MapModel} model The map model for which to create the panel view.
 * @param {cm.MetadataModel} metadataModel The metadata model.
 * @param {cm.AppState} appState The application state model.
 * @param {Object=} opt_config Configuration settings.  These fields are used:
 *     draft_mode: Indicate that the map is an unpublished draft?
 *     hide_panel_header: Hide the map title and description?
 *     enable_editing: Allow any editing at all?
 * @constructor
 */
cm.PanelView = function(frameElem, parentElem, mapContainer,
                        model, metadataModel, appState, opt_config) {
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
  this.layerListElem_;

  /**
   * @type Element
   * @private
   */
  this.headerElem_;

  /*
   * @type !Object
   * @private
   */
  this.config_ = opt_config || {};

  var collapse = cm.ui.create('div', {'class': 'cm-collapse'},
      cm.ui.create('img', {'class': 'cm-collapse-icon', 'src': EMPTY_PNG}));

  var toggleCollapseOnClick = goog.bind(function() {
      goog.dom.classes.toggle(this.frameElem_, 'cm-panel-collapsed');
      cm.events.emit(goog.global, 'resize');  // readjust layout
    }, this);
  cm.events.listen(collapse, 'click', toggleCollapseOnClick);
  var expand = cm.ui.create('div', {'class': 'cm-expand'},
      cm.ui.create('img', {'class': 'cm-expand-icon', 'src': EMPTY_PNG}));
  cm.events.listen(expand, 'click', toggleCollapseOnClick);
  mapContainer.appendChild(expand);

  // Create the elements for the map title and description.
  var setDefaultViewLink, resetLink;
  cm.ui.append(parentElem, cm.ui.create('div', {'class': 'cm-panel-inner'},
      collapse,
      this.headerElem_ = cm.ui.create('div', {'class': 'cm-panel-header'},
          this.config_['draft_mode'] ? cm.ui.create(
              'span',
              {'class': 'cm-draft-indicator', 'title': MSG_DRAFT_TOOLTIP},
              MSG_DRAFT_LABEL) : null,
          this.titleElem_ = cm.ui.create('h1',
              {'class': 'cm-map-title'})),
      this.descElem_ = cm.ui.create('div', {'class': 'cm-map-description'}),
      cm.ui.create('div', {'class': 'cm-panel-links'},
          setDefaultViewLink = this.config_['enable_editing'] ?
              cm.ui.createLink(MSG_SET_DEFAULT_VIEW_LINK) : null,
          setDefaultViewLink && cm.ui.create('br'),
          resetLink = cm.ui.createLink(MSG_RESET_VIEW_LINK)),
      this.layerListElem_ = cm.ui.create('div', {'class': 'cm-panel-layers'})
  ));
  if (this.config_['hide_panel_header']) {
    this.headerElem_.style.display = 'none';
    this.descElem_.style.display = 'none';
  }

  // Populate the elements with the current values.
  this.updateTitle_();
  this.updateDescription_();

  // Keep this view up to date with changes in the model.
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
  cm.events.forward(resetLink, 'click', goog.global,
                    cm.events.RESET_VIEW, {model: model});

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

  // Create a close button in the panel container that hides the layers panel.
  cm.ui.createCloseButton(parentElem, function() {
    cm.events.emit(parentElem, 'panelclose');
  });

  // Add views for all the layers.
  goog.array.forEach(layers.getArray(), this.addLayer_, this);

  // Listen to the open/close events triggered on the layers panel container.
  cm.events.listen(parentElem, 'panelopen', this.open_, this);
  cm.events.listen(parentElem, 'panelclose', this.close_, this);
};

/**
 * Return the panel's header element
 * @return {Element} The header element.
 */
cm.PanelView.prototype.getHeader = function() {
  return this.headerElem_;
};

/**
 * Updates the displayed title to match the MapModel.
 * @private
 */
cm.PanelView.prototype.updateTitle_ = function() {
  var title = /** @type string */(this.model_.get('title'));
  cm.ui.setText(this.titleElem_, title);
  cm.ui.document.title = title;
};

/**
 * Updates the displayed description to match the MapModel.
 * @private
 */
cm.PanelView.prototype.updateDescription_ = function() {
  var description = /** @type cm.Html */(this.model_.get('description'));
  var html = description.getHtml();
  // Incredibly, on the Android web browser, the panel will not scroll if there
  // are any <p> tags in the map description.  Remove them and scrolling works
  // just fine.  <p> tags in layer descriptions are harmless, though.
  this.descElem_.innerHTML = html.replace(/<[pP]( [^>]*)?>/g, '<br><br>');
};

/**
 * Opens the panel in the middle of the document.
 * @private
 */
cm.PanelView.prototype.open_ = function() {
  goog.dom.classes.add(this.parentElem_, 'cm-open');
  // Once the style is set on the container, its width can be retrieved.
  var x = (this.frameElem_.offsetWidth - this.parentElem_.offsetWidth) / 2;
  this.parentElem_.style.left = Math.max(0, Math.round(x)) + 'px';
};

/**
 * Closes the panel and resets properties that were set on open.
 * @private
 */
cm.PanelView.prototype.close_ = function() {
  goog.dom.classes.remove(this.parentElem_, 'cm-open');
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
      this.layerListElem_, layer, this.metadataModel_,
      this.appState_, this.config_, index);
  var view = this.layerEntryViews_[id];
  cm.events.listen(view, cm.events.DELETE_LAYER, function(e) {
    cm.events.emit(goog.global, cm.events.DELETE_LAYER,
                   {model: this.model_, id: e.id});
  }, this);
  cm.events.forward(view, [cm.events.PROMOTE_LAYER,
                           cm.events.TOGGLE_LAYER,
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
