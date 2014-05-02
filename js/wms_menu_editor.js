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
 * @fileoverview [MODULE: edit] A dropdown menu selector for WMS layers.
 * @author romano@google.com (Raquel Romano)
 */
goog.provide('cm.WmsMenuEditor');

goog.require('cm.MenuEditor');
goog.require('cm.css');
goog.require('cm.ui');
goog.require('goog.Uri');
goog.require('goog.dom.classes');
goog.require('goog.net.Jsonp');

// Only support layers published with web/spherical mercator projections.
// https://developers.google.com/maps/documentation/javascript/maptypes#WorldCoordinates
var SPHERICAL_MERCATOR_PROJECTIONS = ['EPSG:3857', 'ESPG:3785', 'EPSG:900913'];

var SERVER_LAYERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Time to wait before sending a layer list request to a new URL if one is
// already pending, to avoid sending a request for every typed character.
var NEW_QUERY_DELAY_MS = 500; // 0.5s

// Time to wait for a response for a layer list request.
var QUERY_RESPONSE_TIMEOUT_MS = 30000; // 30s

/**
 * A multi-select list of options that are populated by querying the
 * WMS service proxy. The editor's 'value' property will default to an emtpy
 * array if its value is set to null, undefined, or an array of elements
 * none of which are in the array of choices returned by the query.
 * When no layer choices exist, 'value' defaults to an empty array.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {{div_class: string, menu_class: string,
 *          wms_query_url: string}} options
 *     options.div_class: a CSS class for the div containing all the buttons.
 *     options.menu_class: a CSS class for the dropdown menu.
 *     options.wms_query_url: URL to the WMS layer query service.
 * @param {google.maps.MVCObject} draft The inspector's draft object.
 * @extends cm.MenuEditor
 * @constructor
 */
cm.WmsMenuEditor = function(parentElem, id, options, draft) {
  /**
   * @type string
   * @private
   */
  this.wmsQueryUrl_ = options.wms_query_url;

  /**
   * True if a query has been sent for the WMS services's available layers,
   * but the handler has not been invoked.
   * @type boolean
   * @private
   */
  this.waitingForResponse_ = false;

  /**
   * True if the draft url has changed since the last layer query.
   * @type boolean
   * @private
   */
  this.draftUrlChanged_ = false;

  /**
   * A cache of available layers and last-queried timestamp, keyed by the
   * WMS server URL.
   * @type Object
   * @private
   */
  this.serverLayersCache_ = {};

  /**
   * Draft of the LayerModel, for updating the viewport according to
   * the WMS layer bounding boxes.
   * @type {google.maps.MVCObject}
   * @private
   */
  this.draft_ = draft;

  /**
   * Warning message displayed while waiting for the list of layer options or
   * when there was a problem populating the list of layer options.
   * @private
   */
  this.warningDiv_ = cm.ui.create('div',
                                  {'class': cm.css.WMS_MENU_EDITOR_MESSAGE});

  // Create the menu with an empty list of choices.
  goog.base(this, parentElem, id,
            {choices: [], div_class: options.div_class,
             menu_class: options.menu_class, multiple: true});

  cm.ui.append(parentElem, this.warningDiv_);

  this.bindTo('url', draft);
  this.bindTo('type', draft);

  cm.events.onChange(this, ['url', 'type'], this.updateMenuOptions_,
                     this);
  this.updateMenuOptions_();
};
goog.inherits(cm.WmsMenuEditor, cm.MenuEditor);

/**
 * Status codes returned by the WMS layers query service.
 * These must match the WmsLayersFetchStatus codes in
 * wmscache/wms_query.py
 * @enum {number}
 */
cm.WmsMenuEditor.WmsLayersFetchStatus = {
  SUCCESS: 0,
  EMPTY: 1,
  ERROR: 2
};

/**
 * Update the menu's layer options.
 * @private
 */
cm.WmsMenuEditor.prototype.updateMenuOptions_ = function() {
  if (/** @type cm.LayerModel.Type */(this.get('type')) !==
      cm.LayerModel.Type.WMS) {
    return;
  }
  var url = /** @type string */(this.get('url')) || '';
  url = url.replace(/^\s+|\s+$/g, '');   // remove leading and trailing spaces
  var handleWmsQueryResponse = goog.bind(function(json) {
    this.waitingForResponse_ = false;
    if (json) {
      var layers = json['layers'] || [];
      var status = parseInt(json['status'], 10);
      this.updateWarningMessage_(status);
      this.updateSelect_(layers);
      // Do not cache responses that returned an error, in case the request is
      // timing out and the user would like the fetch to be tried again.
      if (status !== cm.WmsMenuEditor.WmsLayersFetchStatus.ERROR) {
        this.serverLayersCache_[url] = {
          'layers': layers,
          'timestamp': (new Date()).getTime(),
          'status': status
        };
      }
      // If the draft URL has changed by the time the handler is invoked,
      // call the handler again.
      if (this.draftUrlChanged_) {
        this.draftUrlChanged_ = false;
        goog.global.setTimeout(goog.bind(function() {
          this.updateMenuOptions_();
        }, this), NEW_QUERY_DELAY_MS);
      }
    }
  }, this);
  // Require URL to have a valid hostname.
  if (goog.Uri.parse(url).getDomain()) {
    if (this.waitingForResponse_) {
      // Do not make a new request if we are still waiting for a response.
      this.draftUrlChanged_ = true;
    } else {
      // Check the layers cache for this WMS server before making a request.
      var layerCache = this.serverLayersCache_[url];
      if (layerCache && (new Date()).getTime() - layerCache['timestamp'] <
          SERVER_LAYERS_CACHE_TTL_MS) {
        var layers = layerCache['layers'];
        this.updateWarningMessage_(layerCache['status']);
        this.updateSelect_(layers);
      } else {
        var query = new goog.net.Jsonp(this.wmsQueryUrl_ +
            '?server_url=' + encodeURIComponent(url) +
            '&projections=' + SPHERICAL_MERCATOR_PROJECTIONS.join(','));
        query.setRequestTimeout(QUERY_RESPONSE_TIMEOUT_MS);
        this.waitingForResponse_ = true;
        cm.ui.setText(this.warningDiv_, cm.MSG_WMS_LAYERS_WAITING);
        query.send(null, handleWmsQueryResponse, goog.bind(function() {
          this.waitingForResponse_ = false;
          this.updateWarningMessage_(
              cm.WmsMenuEditor.WmsLayersFetchStatus.ERROR);
          this.updateSelect_([]);
        }, this));
      }
    }
  }
};

/**
 * Update the informational message under the WMS menu options list according
 * to the status code returned by the WMS layers query server.
 * @param {number} status The status code returned by the server.
 * @private
 */
cm.WmsMenuEditor.prototype.updateWarningMessage_ = function(status) {
  var warningMessage = '';
  if (status === cm.WmsMenuEditor.WmsLayersFetchStatus.EMPTY) {
    warningMessage = cm.MSG_WMS_LAYERS_FETCH_EMPTY;
  }
  if (status === cm.WmsMenuEditor.WmsLayersFetchStatus.ERROR) {
    warningMessage = cm.MSG_WMS_LAYERS_FETCH_ERROR;
  }
  cm.ui.setText(this.warningDiv_, warningMessage);
};

/**
 * Repopulate the select menu choices and update the UI with the
 * current value.
 * @param {Array.<Object>} layers The layers object returned by the WMS query.
 * @private
 */
cm.WmsMenuEditor.prototype.updateSelect_ = function(layers) {
  var choices = goog.array.map(layers, function(layer) {
    if (goog.array.contains(SPHERICAL_MERCATOR_PROJECTIONS, layer['crs'])) {
      // The layer name is its unique ID to store in the MapRoot, and
      // the layer title is the label to display in the menu.
      return {value: layer['name'],
              label: layer['title'] + ' (' + layer['name'] + ')'};
    }
  });
  cm.ui.clear(this.selectElem);
  goog.array.clear(this.values);
  this.populate(choices);
  // Update UI to correct any invalid selections.
  this.updateUi(this.get('value'));
};
