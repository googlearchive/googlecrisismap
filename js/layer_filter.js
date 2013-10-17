// Copyright 2013 Google Inc.  All Rights Reserved.
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
 * @fileoverview The logic for searching through layers of a MapModel.
 */

goog.provide('cm.layerFilter');

goog.require('cm');
goog.require('cm.LayerModel');
goog.require('cm.MapModel');


/** @const Array.<string> */
cm.layerFilter.DEFAULT_FILTER_KEYS = ['title', 'description'];

/**
 * Iterate over the map's layers to see if the query matches any of the layer's
 * filter properties (ie those keyed by the given or default filter keys).
 * @param {cm.MapModel} mapModel The model to match against.
 * @param {string} query The string to query against (an empty query matches
 *   any layer).
 * @param {Array.<string>=} opt_filterKeys The properties on each layer against
 *   which to match the query.
 * @return {Array.<string>} All the matching layer IDs.
 */
cm.layerFilter.matchAllLayers = function(mapModel, query, opt_filterKeys) {
  var queryWords = cm.layerFilter.tokenizeQuery(query);
  var filterKeys = opt_filterKeys || cm.layerFilter.DEFAULT_FILTER_KEYS;
  var layerIds = mapModel.getLayerIds();
  var matches = [];
  goog.object.forEach(layerIds, function(id) {
    matches = goog.array.concat(matches,
        cm.layerFilter.matchLayerTree_(mapModel.getLayer(id),
          queryWords, filterKeys));
  });
  return matches;
};

/**
 * Finds all layers in a layer's descendant tree (including the layer itself)
 * that match a query. Matching means that at least one of its filter key
 * properties contains a word in the query.
 *
 * @param {cm.LayerModel} layer The layer whose subtree to match against.
 * @param {Array.<string>} queryWords The tokenized query.
 * @param {Array.<string>} filterKeys The properties on each layer against
 *   which to compare the queries.
 * @return {Array.<string>} An array of IDs of all matching sublayers of this
 *   layer, including this layer. Empty if there are no matches in this
 *   layer tree.
 * @private
 */
cm.layerFilter.matchLayerTree_ = function(layer, queryWords, filterKeys) {
  var match = cm.layerFilter.matchLayer_(layer, queryWords, filterKeys);
  var matches = match ? [layer.get('id')] : [];
  // Look only inside folders that aren't locked.
  if (layer.get('type') === cm.LayerModel.Type.FOLDER &&
      layer.get('folder_type') !== cm.LayerModel.FolderType.LOCKED) {
    // Collect all matches from this layer's sublayers.
    matches = goog.array.reduce(layer.getSublayerIds(),
      function(matches, subId) {
        return goog.array.concat(matches,
          cm.layerFilter.matchLayerTree_(layer.getSublayer(subId), queryWords,
            filterKeys));
    }, matches);
  }
  return matches;
};

/**
 * Public endpoint for matchLayer_.
 * @param {cm.LayerModel} layer The layer.
 * @param {string} query The query.
 * @param {Array.<string>=} opt_filterKeys The filter keys.
 * @return {boolean} Whether the layer explicitly matches the query.
 */
cm.layerFilter.matchLayer = function(layer, query, opt_filterKeys) {
  var queryWords = cm.layerFilter.tokenizeQuery(query);
  var filterKeys = opt_filterKeys || cm.layerFilter.DEFAULT_FILTER_KEYS;
  return cm.layerFilter.matchLayer_(layer, queryWords, filterKeys);
};

/**
 * Checks each of the layer's filter properties, returning true if any filter
 * property contains a word in the query.
 * @param {cm.LayerModel} layer The layer.
 * @param {Array.<string>} queryWords The tokenized query.
 * @param {Array.<string>} filterKeys The properties on each layer against
 *   which to compare the queries.
 * @return {boolean} Whether the query matches any of the filter fields.
 * @private
 */
cm.layerFilter.matchLayer_ = function(layer, queryWords, filterKeys) {
  var checkString = goog.array.reduce(filterKeys, function(str, key) {
    var value = layer.get(key);
    if (value instanceof cm.Html) {
      value = value.toText();
    }
    if (goog.isString(value)) {
      str += (' ' + value);
    }
    return str;
  }, '');
  return cm.layerFilter.matchesString_(checkString, queryWords);
};

/**
 * Checks if a string matches the query.
 * @param {string} toCheck The value to check.
 * @param {Array.<string>} queryWords The tokenized query.
 * @return {boolean} Whether the query matches.
 * @private
 */
cm.layerFilter.matchesString_ = function(toCheck, queryWords) {
  var doesMatch = true;
  toCheck = toCheck.toLowerCase();
  // Check if each query word has a match in the string toCheck.
  goog.array.forEach(queryWords, function(queryWord) {
    doesMatch = doesMatch && (toCheck.indexOf(queryWord) >= 0);
  });
  return doesMatch;
};

/**
 * Tokenizes the query.
 * @param {string} query The query.
 * @return {Array.<string>} The tokenized query.
 */
cm.layerFilter.tokenizeQuery = function(query) {
  return goog.string.trim(query).toLowerCase().split(/\s+/g);
};

