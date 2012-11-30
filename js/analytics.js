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
 * @fileoverview Google Analytics interface code.
 * @author arb@google.com (Anthony Baxter)
 */

goog.provide('cm.Analytics');

goog.require('cm');

// The default Crisis Maps Analytics account
// TODO(kpy): Move this to the datastore and pass it in via cm_config.
/** @const */var DEFAULT_ANALYTICS_ID = 'UA-8630973-2';

/**
 * Google Analytics command queue. Each element (command) is an array of
 * strings to be dispatched to the Analytics backend. More:
 * http://code.google.com/apis/analytics/docs/gaJS/gaJSApi_gaq.html
 * @type Array.<Array.<string>>
 */
var _gaq = _gaq || [];  // Google Analytics command queue

/**
 * Interface to Google Analytics operations.
 * @constructor
 */
cm.Analytics = function() { };

/**
 * Initialize Google Analytics.
 * @param {string} opt_analyticsId The Analytics account ID that should be
 *     associated with this logged session.
 */
cm.Analytics.initialize = function(opt_analyticsId) {
  var analyticsId = opt_analyticsId || DEFAULT_ANALYTICS_ID;
  _gaq.push(['_setAccount', analyticsId]);
  _gaq.push(['_trackPageview']);

  var ga = document.createElement('script');
  ga.type = 'text/javascript';
  ga.async = true;
  ga.src = ('https:' == document.location.protocol ?
      'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(ga, s);
};


/**
 * Push an event onto the analytics command queue.
 * @param {string} category A short string identifying the event category
 *     (usually a noun for the object or category of object that was affected,
 *     e.g. "layer").  Our convention is to use lowercase_with_underscores.
 * @param {string} action A short string identifying the user action to be
 *     logged (usually a verb or verb phrase, e.g. "toggle_on").
 *     Our convention is to use lowercase_with_underscores.
 * @param {string} opt_label An optional more specific label (usually a unique
 *     programmatic ID, e.g. map ID, layer ID, URL, e-mail address, etc.).
 * @param {number} opt_value An optional numeric value for the event (Analytics
 *     will compute sums and averages of these values).
 */
cm.Analytics.logEvent = function(category, action, opt_label, opt_value) {
  _gaq.push(['_trackEvent', category, action, opt_label, opt_value]);
};
