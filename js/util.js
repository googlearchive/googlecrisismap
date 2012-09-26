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

// Author: romano@google.com (Raquel Romano)

/**
 * @fileoverview Utility functions for walking through all layers descending
 * from a a given layer, or all layers in a map.
 */
goog.provide('cm.util');

/**
 * Recursively apply callback to the given layer and its tree of sublayers.
 * If opt_expandFn is given and returns true at a node, then the
 * callback subtree under the node will be expanded; if false, the
 * callback will still be applied to this node, but the subtree under
 * the node is pruned. If opt_expandFn is not given, all nodes are expanded.
 * If opt_obj is given, bind the given object to 'this' in the
 * callback and the expandFn.
 * @param {cm.LayerModel} layer The root layer model.
 * @param {function(cm.LayerModel)} callback The callback to call on
 *   itself and all descendants.
 * @param {?function(cm.LayerModel): boolean} opt_expandFn A boolean
 *   function to pass the current layer to. If it returns true, this
 *   node's descendants will be expanded; otherwise, they are pruned.
 * @param {Object=} opt_obj An object to bind 'this' to in the callback.
 */
cm.util.forLayerAndDescendants = function(layer, callback,
                                          opt_expandFn, opt_obj) {
  if (opt_obj) {
    callback = goog.bind(callback, opt_obj);
  }
  var expandFn = opt_expandFn ?
    (opt_obj ? goog.bind(opt_expandFn, opt_obj) : opt_expandFn) :
    function(layer) { return true; };
  callback(layer);
  if (expandFn(layer) && layer.get('sublayers')) {
    layer.get('sublayers').forEach(function(sublayer) {
      cm.util.forLayerAndDescendants(sublayer, callback, expandFn);
    });
  }
};

/**
 * Apply the given callback to all layers in the map. See
 * cm.util.forLayerAndDescendants for more details.
 * @param {cm.MapModel} map The map model.
 * @param {function(cm.LayerModel)} callback The callback to call on
 *   itself and all descendants.
 * @param {?function(cm.LayerModel): boolean} opt_expandFn A boolean
 *   function to pass the current layer to. If it returns true, this
 *   node's descendants will be expanded; otherwise, they are pruned.
 * @param {Object=} opt_obj An object to bind 'this' to in the callback.
 */
cm.util.forLayersInMap = function(map, callback, opt_expandFn, opt_obj) {
  map.get('layers') && map.get('layers').forEach(function(layer) {
   cm.util.forLayerAndDescendants(layer, callback, opt_expandFn, opt_obj);
  });
};

// Since we only have three small math-related functions, they can stay in
// cm.util for now.  If we start to build up a collection of math and geometry
// stuff, it might make sense to move these into cm.math in the future.

/**
 * @param {number} pixelY A Y-coordinate in Google Maps at zoom 0, where y = 0
 *     is at the equator and y = 128 is at MAX_LATITUDE.
 * @return {number} The corresponding latitude in degrees.
 */
cm.util.yToLat = function(pixelY) {
  var PI = Math.PI;
  // See http://en.wikipedia.org/wiki/Mercator_projection for details.
  // We use the formulation lat = arctan(sinh(y)) so that yToLat(0) yields
  // exactly 0 and yToLat(-y) is guaranteed to yield exactly -yToLat(y).
  var y = PI * pixelY / 128;
  return Math.atan((Math.exp(y) - Math.exp(-y)) / 2) * 180 / PI;
};

/**
 * @param {number} lat A latitude in degrees.
 * @return {number} pixelY The corresponding Y-coordinate in Google Maps at
 *     zoom 0, where y = 0 is at the equator and y = 128 is at MAX_LATITUDE.
 */
cm.util.latToY = function(lat) {
  var PI = Math.PI;
  // See http://en.wikipedia.org/wiki/Mercator_projection for details.
  // We use the formulation y = arctanh(sin(lat)) so that latToY(0) yields
  // exactly 0 and latToY(-lat) is guaranteed to yield exactly -latToY(lat).
  var sinY = Math.sin(lat * PI / 180);
  return (Math.log(1 + sinY) - Math.log(1 - sinY)) * 64 / PI;
};

/**
 * Rounds a number to a given number of decimal places.  Works like toFixed,
 * but allows 'decimals' to be negative or greater than 20.
 * @param {number} value A finite number.
 * @param {number} decimals An integer (positive to round at a position right
 *     of the decimal point; negative to round left of the decimal point).
 * @return {number} The number rounded to the given number of decimal places.
 */
cm.util.round = function(value, decimals) {
  if (decimals > 20 || !isFinite(decimals)) {  // toFixed allows at most 20
    return value;
  } else if (decimals >= 0) {
    return value.toFixed(decimals) - 0;
  } else {
    var ulp = Math.pow(10, -decimals);
    return Math.round(value / ulp) * ulp;
  }
};

/**
 * If the argument is a primitive Object or Array, returns a new copy of
 * it with all the null or undefined properties and array elements removed,
 * and recurses into primitive Objects or Arrays.  All other primitive values
 * and non-primitive Objects are left untouched.
 * @param {*} thing Any JavaScript value.  The argument will not be mutated.
 * @return {*} The value with null or undefined properties and elements removed.
 */
cm.util.removeNulls = function(thing) {
  switch (thing.constructor) {
    case Array:
      var result = [];
      for (var i = 0; i < thing.length; i++) {
        if (goog.isDefAndNotNull(thing[i])) {
          result.push(cm.util.removeNulls(thing[i]));
        }
      }
      return result;
    case Object:
      var result = {};
      for (var key in thing) {
        if (thing.hasOwnProperty(key) && goog.isDefAndNotNull(thing[key])) {
          result[key] = cm.util.removeNulls(thing[key]);
        }
      }
      return result;
  }
  return thing;
};
