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
 * @fileoverview Global utility functions.
 */
goog.provide('cm.util');

goog.require('goog.locale');

/** @return {boolean} True if the browser supports touch events. */
cm.util.browserSupportsTouch = function() {
  return cm.util.browserSupportsEvent('ontouchstart') &&
         cm.util.browserSupportsEvent('ontouchmove') &&
         cm.util.browserSupportsEvent('ontouchend');
};

/**
 * @param {string} eventName The name of a DOM event type.
 * @return {boolean} True if the browser supports this event type.
 */
cm.util.browserSupportsEvent = function(eventName) {
  var elem = cm.ui.create('div');
  elem.setAttribute(eventName, 'return;');
  return (typeof elem[eventName] == 'function' ||
          eventName in cm.ui.document.documentElement);
};

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
 * @param {?function(cm.LayerModel): boolean=} opt_expandFn A boolean
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
 * @param {?function(cm.LayerModel): boolean=} opt_expandFn A boolean
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

/**
 * Formats a file size as a friendly readable string.  We use this instead of
 * goog.format.fileSize because: (a) we want to display 34 as '34 bytes' but
 * goog.format.fileSize returns just '34', which is confusing; (b) we prefer
 * humane multipliers like 1000, whereas goog.format.fileSize pretends mortals
 * can multiply by 1024 and 1048576 in their heads; (c) goog.format.fileSize
 * uses inconsistent precision, formatting '123.45M' with five digits but '2K'
 * with just one; (d) goog.format.fileSize pulls in lots of other functions,
 * weighing in at 566 bytes whereas this is only 131.
 * @param {number?} size A number in bytes, or null.
 * @return {string} E.g. '2.3 M' or '157 k' or '8 bytes', or '' if size is null.
 */
cm.util.formatFileSize = function(size) {
  // We format the significand to two or three digits of precision; 9.5 is the
  // boundary for advancing to the next order of magnitude because it rounds
  // up to 10.  Adding 1e-9 before rounding avoids decimal rounding error (e.g.
  // (0.95).toFixed(1) gives '0.9' but we really want '1.0').
  return typeof(size) != 'number' ? '' :
      size >= 9.5e5 ? (size / 1e6 + 1e-9).toFixed(size < 9.5e6) + ' M' :
      size >= 9.5e2 ? (size / 1e3 + 1e-9).toFixed(size < 9.5e3) + ' k' :
      size + ' byte' + (size == 1 ? '' : 's');
};

/**
 * Translates a BCP 47 language code into the native language name, including
 * the region in parentheses, e.g. 'en_US' returns 'English (United States)'.
 * If there is no region subtag, then just the language name given by
 * goog.locale.getNativeLanguageName() is returned.
 * Special cases (we support these languages in other regions as well
 * and add the region to avoid ambiguity):
 *   en -> English (United States)
 *   fr -> français (France)
 *   es -> español (España)
 * Special cases (special names for some Chinese language codes). We special
 * case these to force translation into 'Simplified' or 'Traditional' Chinese,
 * which is what Google uses (instead of Chinese (China) and Chinese (Taiwan)).
 *   zh-CN -> Simplified Chinese (in Chinese characters)
 *   zh-TW -> Traditional Chinese (in Chinese characters)
 * @param {string} langCode the BCP 47 language code to name.
 * @return {string} The native language name, or the original code
 *   if that language is not recognized by Closure.
 */
cm.util.getNativeLanguageAndRegionName = function(langCode) {
  // Manually handle ambigious languages which don't have regions by default.
  var DEFAULT_REGIONS = {'en': 'US', 'fr': 'FR', 'es': 'ES'};
  var SPECIAL_LANGUAGE_NAMES = {
    'zh_CN': '\u7b80\u4f53\u4e2d\u6587',
    'zh_TW': '\u7e41\u9ad4\u4e2d\u6587',
    'zh_HK': '\u4e2d\u6587\uff08\u9999\u6e2f\uff09',
    // getNativeLanguageName doesn't support region numbers,
    // so we hard-code Latin America.
    'es_419': 'espa\u00f1ol (Latinoam\u00e9rica)'
  };
  var languageName = goog.locale.getNativeLanguageName(langCode);
  var regionSubTag = DEFAULT_REGIONS[langCode] ||
    goog.locale.getRegionSubTag(langCode);
  if (regionSubTag) {
    // getNativeCountryName needs all region subtags to be uppercase,
    // so we have to reformat the language code accordingly.
    var langSubTag = goog.locale.getLanguageSubTag(langCode);
    var newLangCode = langSubTag + '_' + regionSubTag.toUpperCase();
    var countryName = goog.locale.getNativeCountryName(newLangCode);
    // Check if newLangCode is special, and append the countryName only if the
    // returned string is valid (an actual display name, not a language code).
    languageName = SPECIAL_LANGUAGE_NAMES[newLangCode] ||
      languageName + (countryName === newLangCode ? '' :
      ' (' + countryName + ')');
  }
  return languageName;
};

/**
 * Build choices object for language-selection menus.
 * @param {Array.<string>} langCodes An array of BCP 47 language codes.
 * @return {Array.<{value: string, label: string}>} The option values and
 *     labels.
 */
cm.util.createLanguageChoices = function(langCodes) {
  var languageChoices = [];
  if (goog.array.isEmpty(langCodes || [])) {
    // Default to showing just English if languages don't load.
    var enName = cm.util.getNativeLanguageAndRegionName('en');
    languageChoices = [{value: 'en', label: enName}];
  } else {
    goog.array.forEach(langCodes, function(langCode) {
      var nativeName = cm.util.getNativeLanguageAndRegionName(langCode);
      languageChoices.push({value: langCode, label: nativeName});
    });
    // Sort languages by (downcased) name.
    goog.array.sort(languageChoices, function(a, b) {
      return goog.array.defaultCompare(a.label.toLowerCase(),
        b.label.toLowerCase());
    });
  }
  return languageChoices;
};
