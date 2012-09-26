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
 * Whether the data does not contain any features or has a file size zero.
 * @param {string} id Id of the layer.
 * @return {boolean} Whether the data does not contain any features or has a
 *     file size zero.
 */
cm.MetadataModel.prototype.hasNoFeatures = function(id) {
  var metadata = this.get(id);
  return !!(metadata && (metadata['has_features'] === false ||
                         metadata['content_length'] === 0));
};


/**
 * Whether the data has features that are unsupported by the viewer.
 * @param {string} id Id of the layer.
 * @return {boolean} Whether the data contains unsupported features.
 */
cm.MetadataModel.prototype.hasUnsupportedFeatures = function(id) {
  var metadata = this.get(id);
  return !!(metadata && metadata['has_unsupported_kml']);
};


/**
 * Whether a server error has occurred.
 * @param {string} id Id of the layer.
 * @return {boolean} Whether a server error has occurred.
 */
cm.MetadataModel.prototype.serverErrorOccurred = function(id) {
  var metadata = this.get(id);
  return !!(metadata && metadata['server_error_occurred']);
};


/**
 * Returns the length of the content, i.e. the file size.
 * @param {string} id Id of the layer.
 * @return {number} The length of the content if it is known, undefined
 *     otherwise.
 */
cm.MetadataModel.prototype.getContentLength = function(id) {
  var metadata = this.get(id);
  return metadata && metadata['content_length'] ? metadata['content_length'] :
      undefined;
};
