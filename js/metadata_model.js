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
 * @fileoverview Model for layer metadata.
 * @author cimamoglu@google.com (Cihat Imamoglu)
 */
goog.provide('cm.MetadataModel');

/**
 * Model for layer metadata.
 * @constructor
 * @extends {google.maps.MVCObject}
 */
cm.MetadataModel = function() {
  google.maps.MVCObject.call(this);
};
goog.inherits(cm.MetadataModel, google.maps.MVCObject);


/**
 * Returns true if the specified layer has no displayable content.
 * @param {string} id The layer ID.
 * @return {boolean} True if the source data has no features or has size zero.
 */
cm.MetadataModel.prototype.isEmpty = function(id) {
  var metadata = this.get(id) || {};
  return !!metadata['has_no_features'] || metadata['content_length'] === 0;
};


/**
 * Returns true if the specified layer has features unsupported by the viewer.
 * @param {string} id The layer ID.
 * @return {boolean} True if the source data contains unsupported features.
 */
cm.MetadataModel.prototype.hasUnsupportedFeatures = function(id) {
  var metadata = this.get(id) || {};
  return !!metadata['has_unsupported_kml'];
};


/**
 * Returns true if fetching the specified layer's source data gave an error.
 * @param {string} id The layer ID.
 * @return {boolean} True if the attempt to fetch the data gave a server error.
 */
cm.MetadataModel.prototype.serverErrorOccurred = function(id) {
  var metadata = this.get(id) || {};
  return !!metadata['server_error_occurred'];
};


/**
 * Returns the size of the specified layer's source data in bytes.
 * @param {string} id The layer ID.
 * @return {number?} The content length in bytes if known, or null.
 */
cm.MetadataModel.prototype.getContentLength = function(id) {
  var metadata = this.get(id) || {};
  var value = metadata['content_length'];
  return typeof value === 'number' ? value : null;
};


/**
 * Returns the last modification time of the specified layer's source data.
 * @param {string} id The layer ID.
 * @return {number?} The modification time in epoch seconds if known, or null.
 */
cm.MetadataModel.prototype.getContentLastModified = function(id) {
  var metadata = this.get(id) || {};
  return metadata['content_last_modified'] || null;
};


/**
 * Sets the last modification time of the specified layer's source data.
 * @param {string} id The layer ID.
 * @param {number?} time The modification time in epoch seconds, or null.
 */
cm.MetadataModel.prototype.setContentLastModified = function(id, time) {
  var metadata = this.get(id) || {};
  metadata['content_last_modified'] = time;
  this.set(id, metadata);
};
