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
 * @fileoverview Model for all the layer metadata, keyed by source address.
 * @author cimamoglu@google.com (Cihat Imamoglu)
 */
goog.provide('cm.MetadataModel');

goog.require('goog.Timer');
goog.require('goog.net.Jsonp');
goog.require('goog.structs.Set');


/**
 * Model for all the layer metadata, keyed by source address.  The metadata for
 * each source is a dictionary; see metadata_fetch.py for details on its fields.
 * @param {cm.MapModel} mapModel The MapModel to watch for new layers.
 * @param {Object} opt_initialMetadata Initial metadata to load into the model.
 * @param {string?} opt_metadataUrl URL from which to fetch metadata updates,
 *     including the ?key=<cache-key> parameter, so that it gets the updates
 *     for all the source addresses in the initial model.  If this URL is
 *     provided, the MetadataModel will periodically use it to get updated
 *     metadata.
 * @constructor
 * @extends {google.maps.MVCObject}
 */
cm.MetadataModel = function(mapModel, opt_initialMetadata, opt_metadataUrl) {
  google.maps.MVCObject.call(this);

  /** @private {cm.MapModel} The MapModel to watch for new layers. */
  this.mapModel_ = mapModel;

  /**
   * @private {Object.<number?>} Update times, keyed by source address.  This
   *     contains just the values set by setUpdateTime, which locally override
   *     values in the 'update_time' fields of the retrieved metadata.
   */
  this.updateTimes_ = {};

  /**
   * @private {goog.structs.Set} Addresses that are loaded by the given
   *     metadataUrl with its ?key=<cache-key> parameter, i.e all source
   *     addresses in the initial model.  When requesting metadata, we only
   *     need to specify additional addresses not already in this set.
   */
  this.initialAddresses_ = new goog.structs.Set();

  /** @private {string?} URL from which to fetch metadata updates. */
  this.metadataUrl_ = opt_metadataUrl || null;

  /** @private {goog.Timer} Timer for periodic metadata updates. */
  this.timer_ = new goog.Timer(cm.MetadataModel.UPDATE_PERIOD_SECONDS * 1000);

  /** @private {number} When to return to normal instead of fast updates. */
  this.fastUpdateEndTime_ = 0;

  for (var address in (opt_initialMetadata || {})) {
    this.set(address, opt_initialMetadata[address]);
    this.initialAddresses_.add(address);
  }
  if (this.metadataUrl_) {
    cm.events.listen(this.timer_, goog.Timer.TICK,
                     this.updateActiveMetadata_, this);
    this.timer_.start();
  }
};
goog.inherits(cm.MetadataModel, google.maps.MVCObject);

/** @const {number} Normal period, for refreshing metadata we already have. */
cm.MetadataModel.UPDATE_PERIOD_SECONDS = 90;

/** @const {number} Fast update period, for filling in missing metadata. */
cm.MetadataModel.FAST_UPDATE_PERIOD_SECONDS = 2;

/** @const {number} How long to do fast updates before returning to normal. */
cm.MetadataModel.FAST_UPDATE_DURATION_SECONDS = 15;


/**
 * Returns true if the specified layer has no displayable content.
 * @param {cm.LayerModel} layer The layer model.
 * @return {boolean} True if the source data has no features or has size zero.
 */
cm.MetadataModel.prototype.isEmpty = function(layer) {
  var metadata = this.get(layer.getSourceAddress()) || {};
  return metadata['has_no_features'] || metadata['length'] === 0 ||
      metadata['ill_formed'];
};


/**
 * Returns true if the specified layer has features unsupported by the viewer.
 * @param {cm.LayerModel} layer The layer model.
 * @return {boolean} True if the source data contains unsupported features.
 */
cm.MetadataModel.prototype.hasUnsupportedFeatures = function(layer) {
  var metadata = this.get(layer.getSourceAddress()) || {};
  return !!metadata['has_unsupported_kml'];
};


/**
 * Returns true if fetching the specified layer's source data gave an error.
 * @param {cm.LayerModel} layer The layer model.
 * @return {boolean} True if the attempt to fetch the data gave a server error.
 */
cm.MetadataModel.prototype.fetchErrorOccurred = function(layer) {
  var metadata = this.get(layer.getSourceAddress()) || {};
  return !!metadata['fetch_error_occurred'];
};


/**
 * Returns the size of the specified layer's source data in bytes.
 * @param {cm.LayerModel} layer The layer model.
 * @return {number?} The content length in bytes if known, or null.
 */
cm.MetadataModel.prototype.getLength = function(layer) {
  var metadata = this.get(layer.getSourceAddress()) || {};
  var value = metadata['length'];
  return typeof value === 'number' ? value : null;
};


/**
 * Returns the last update time of the specified layer's source data.
 * @param {cm.LayerModel} layer The layer model.
 * @return {number?} The update time in epoch seconds if known, or null.
 */
cm.MetadataModel.prototype.getUpdateTime = function(layer) {
  var address = layer.getSourceAddress();
  var metadata = this.get(address) || {};
  return this.updateTimes_[address] || metadata['update_time'] || null;
};


/**
 * Sets the last update time of the specified layer's source data.  Once set,
 * this value overrides the update_time value received from the server.
 * @param {cm.LayerModel} layer The layer model.
 * @param {number?} time The modification time in epoch seconds, or null.
 */
cm.MetadataModel.prototype.setUpdateTime = function(layer, time) {
  var address = layer.getSourceAddress();
  if (address) {
    this.updateTimes_[address] = time;
    this.notify(address);  // notify that metadata for this source has changed
  }
};

/**
 * For WMS layers, returns the bounding boxes for all published layers at the
 * given layer's source URL, or null if the layer is not a WMS layer, or no
 * metadata is available.
 * @param {cm.LayerModel} layer The layer model.
 * @return {Object} A dictionary of layer bounding boxes keyed by WMS layer
 *   name.
 */
cm.MetadataModel.prototype.getWmsLayerExtents = function(layer) {
  var address = layer.getSourceAddress();
  var metadata = this.get(address) || {};
  return metadata['wms_layers'] || null;
};

/**
 * Registers a callback to be called on changes to the metadata for the given
 * layer's current source.  (If the layer's source changes, the caller will
 * need to cm.events.unlisten and call this method again.)  If metadata is not
 * yet available for the specified layer, this also speeds up our metadata
 * update requests for a little while, since requests to metadata.py can cause
 * the server to queue up metadata_fetch.py tasks for the source in question.
 * @param {cm.LayerModel} layer The layer model.
 * @param {!Function} handler A function to handle the event.
 * @param {Object=} opt_obj An object to bind 'this' to within the handler.
 * @return {cm.events.ListenerToken} A token that can be passed to
 *     cm.events.unlisten to remove the added listener.
 */
cm.MetadataModel.prototype.onChange = function(layer, handler, opt_obj) {
  var address = layer.getSourceAddress();
  if (address && !this.get(address)) {
    this.accelerateUpdates_();
  }
  return /** @type {cm.events.ListenerToken} */(address ?
      cm.events.onChange(this, address, handler, opt_obj) : null);
};

/**
 * Requests the metadata for all layers in this.mapModel_ from the server.
 * @private
 */
cm.MetadataModel.prototype.updateActiveMetadata_ = function() {
  /**
   * @param {cm.MapModel} mapModel A map model.
   * @return {goog.structs.Set} A set of all source addresses in the map.
   */
  function getSourceAddresses(mapModel) {
    var addresses = new goog.structs.Set();
    cm.util.forLayersInMap(mapModel, function(layer) {
      var address = layer.getSourceAddress();
      address && addresses.add(address);
    });
    return addresses;
  }

  // We only need to add "source=" params for the additional addresses that
  // weren't in the initial set, as the existing ?key=<cache-key> parameter in
  // the URL should get metadata for all layers present on initial page load.
  var that = this;
  var params = {'source': getSourceAddresses(this.mapModel_)
      .difference(this.initialAddresses_).getValues()};
  new goog.net.Jsonp(this.metadataUrl_).send(params, function(result) {
    for (var address in result) {
      that.set(address, result[address]);
    }
  });
  if (new Date().getTime() > this.fastUpdateEndTime_) {
    this.timer_.setInterval(cm.MetadataModel.UPDATE_PERIOD_SECONDS * 1000);
  }
};

/**
 * Makes updates run more frequently for the next FAST_UPDATE_DURATION_SECONDS
 * seconds, for situations when we don't have metadata yet and expect that the
 * server might be fetching it soon.  For example, when a map loads and not all
 * the metadata is available, the page load will cause the server to queue up
 * fetches that could make the metadata available in the next 5 or 10 seconds.
 * @private
 */
cm.MetadataModel.prototype.accelerateUpdates_ = function() {
  if (this.metadataUrl_) {
    this.timer_.setInterval(cm.MetadataModel.FAST_UPDATE_PERIOD_SECONDS * 1000);
    this.fastUpdateEndTime_ = new Date().getTime() +
        cm.MetadataModel.FAST_UPDATE_DURATION_SECONDS * 1000;
  }
};
