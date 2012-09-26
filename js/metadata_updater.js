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
 * @fileoverview The Metadata Updater retrieves metadata updates from the
 *     server side, /crisismap/metadata, and transmits them to relevant
 *     views to present to users.
 * @author cimamoglu@google.com (Cihat Imamoglu)
 */
goog.provide('cm.MetadataUpdater');

goog.require('cm.LayerModel');
goog.require('cm.MapModel');
goog.require('cm.MetadataModel');
goog.require('cm.events');
goog.require('goog.Timer');
goog.require('goog.array');
goog.require('goog.net.XhrIo');

/** @const @type {number} */
var REQUEST_TIMEOUT_INTERVAL_SECONDS = 20;
/** @const @type {number} */
var UPDATE_REQUEST_INTERVAL_SECONDS = 10;


/**
 * The Metadata Updater.
 * @param {cm.MapModel} mapModel The map model.
 * @param {cm.MetadataModel} metadataModel The metadata model.
 * @param {string} metadataUrl The metadata request base URL.
 * @constructor
 */
cm.MetadataUpdater = function(mapModel, metadataModel, metadataUrl) {
  /*
   * The map model.
   * @type {cm.MapModel}
   * @private
   */
  this.mapModel_ = mapModel;

  /*
   * The metadata model.
   * @type {cm.MetadataModel}
   * @private
   */
  this.metadataModel_ = metadataModel;

  /**
   * The metadata request base URL.
   * @type {string}
   * @private
   */
  this.metadataUrl_ = metadataUrl;

  /**
   * XMLHttpRequest handler for communicating with the server.
   * @type {goog.net.XhrIo}
   * @private
   */
  this.xhr_ = new goog.net.XhrIo();

  /**
   * Timer for periodically asking for updates.
   * @type {goog.Timer}
   * @private
   */
  this.timer_ = new goog.Timer(UPDATE_REQUEST_INTERVAL_SECONDS * 1000);

  /**
   * A map to keep layer address to layer ID mapping. Since an adress be the
   * same for multiple layers, the values are lists. The keys are strings
   * representing layer addresses.
   * @type {Object}
   * @private
   */
  this.addressMap_ = {};

  /**
   * Set of layer addresses at initialization. This is used for keeping track of
   * new added and changed layer addresses. This dictionary is initialized at
   * the constructor and is not modified after.
   * @type {Object}
   * @private
   */
  this.initialAddresses_ = {};

  this.updateAddressMap_();
  for (var address in this.addressMap_) {
    this.initialAddresses_[address] = true;
  }

  cm.events.listen(goog.global, cm.events.MODEL_CHANGED,
                   this.updateAddressMap_, this);
  cm.events.listen(this.timer_, goog.Timer.TICK, function() {
    this.xhr_.send(this.getRequestUrl_(), 'GET');
  }, this);
  this.xhr_.setTimeoutInterval(REQUEST_TIMEOUT_INTERVAL_SECONDS * 1000);
  cm.events.listen(this.xhr_, goog.net.EventType.SUCCESS,
                   this.handleSuccess_, this);

  this.timer_.start();
  // The first TICK event is dispatched manually to update fields initially.
  this.timer_.dispatchTick();
};


/** @private Updates the address map according to layers in the map model. */
cm.MetadataUpdater.prototype.updateAddressMap_ = function() {
  var model = /** @type cm.MapModel */(this.mapModel_);
  this.addressMap_ = {};
  cm.util.forLayersInMap(model, function(layer) {
    var address = layer.getSourceAddress();
    // Right after a new layer is created, its address is undefined.
    if (address) {
      var id = layer.get('id');
      if (this.addressMap_[address]) {
        this.addressMap_[address].push(id);
      } else {
        this.addressMap_[address] = [id];
      }
    }
  }, null, this);
};


/**
 * Creates the request URL based on token and changed layers' addresses.
 * @private
 * @return {string} The URL for making metadata request.
 */
cm.MetadataUpdater.prototype.getRequestUrl_ = function() {
  var url = this.metadataUrl_ + '&layers=';
  for (var address in this.addressMap_) {
    if (address && !this.initialAddresses_[address]) {
      url += encodeURIComponent(address + '$');
    }
  }
  return url;
};


/**
 * Handler for successful requests.
 * @param {Object} e The event payload.
 * @private
 */
cm.MetadataUpdater.prototype.handleSuccess_ = function(e) {
  var json = e.target.getResponseJson();
  for (var address in json) {
    goog.array.forEach(this.addressMap_[address], function(layerId) {
      this.metadataModel_.set(layerId, json[address]);
    }, this);
  }
};

