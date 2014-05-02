// Copyright 2014 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

/** @fileoverview Functions for making asynchronous HTTP requests. */
goog.provide('cm.xhr');

goog.require('goog.json');
goog.require('goog.net.XhrIo');

/**
 * Performs an asynchronous HTTP request with form parameters.
 * @param {string} method The HTTP method, 'GET' or 'POST'.
 * @param {string} url Target of the POST request.
 * @param {Object.<string>=} opt_params Form parameters to send.  Values that
 *     are JS objects will be encoded in JSON for transmission.  If the target
 *     was previously registered using cm.xhr.protectInputs, the values of the
 *     associated input elements will be automatically included as form values.
 * @param {function(boolean, string)=} opt_callback Function to be called
 *     with a boolean success flag and the content returned by the server.
 * @param {boolean=} opt_decodeJson If true, the returned content will be
 *     JSON-decoded before it is passed to the callback.
 * @private
 */
cm.xhr.send_ = function(method, url, opt_params, opt_callback, opt_decodeJson) {
  var params = opt_params || {};
  if (cm.xhr.urlSigners_[url]) {
    // Add values from input elements previously registered by protectInputs.
    var ids = cm.xhr.urlInputIds_[url] || [];
    for (var i = 0; i < ids.length; i++) {
      params[ids[i]] = document.getElementById(ids[i]).value;
    }
    // Apply a signature, to be verified by the server.
    cm.xhr.urlSigners_[url](params);
  }

  // Serialize the form data.
  var pairs = [];
  for (var key in params) {
    var value = params[key];
    pairs.push(key + '=' + encodeURIComponent(
        (typeof value === 'object') ? goog.json.serialize(value) : value));
  }
  var data = pairs.join('&');

  // Send off the request.
  if (method === 'GET' && data) {
    url += '?' + data;
  }
  goog.net.XhrIo.send(url, function(event) {
    if (opt_callback) {
      var content = event.target.getResponseText();
      var result = opt_decodeJson ? goog.json.parse(content) : content;
      opt_callback(event.target.isSuccess(), result);
    }
  }, method, (method === 'POST') ? data : '');
};

/**
 * Performs an asynchronous GET with form parameters, returning text content.
 * @param {string} url Target of the GET request.
 * @param {Object.<string>=} opt_params Form parameters to send.  Values that
 *     are JS objects will be encoded in JSON for transmission.  If the target
 *     was previously registered using cm.xhr.protectInputs, the values of the
 *     associated input elements will be automatically included as form values.
 * @param {function(boolean, *)=} opt_callback Function that will be called
 *     with a boolean success flag and the decoded JSON returned by the server.
 */
cm.xhr.get = function(url, opt_params, opt_callback) {
  cm.xhr.send_('GET', url, opt_params, opt_callback, false);
};

/**
 * Performs an asynchronous GET with form parameters, returning decoded JSON.
 * @param {string} url Target of the GET request.
 * @param {Object.<string>=} opt_params Form parameters to send.  Values that
 *     are JS objects will be encoded in JSON for transmission.  If the target
 *     was previously registered using cm.xhr.protectInputs, the values of the
 *     associated input elements will be automatically included as form values.
 * @param {function(boolean, *)=} opt_callback Function that will be called
 *     with a boolean success flag and the decoded JSON returned by the server.
 */
cm.xhr.getJson = function(url, opt_params, opt_callback) {
  cm.xhr.send_('GET', url, opt_params, opt_callback, true);
};

/**
 * Performs an asynchronous POST with form parameters, returning text content.
 * @param {string} url Target of the POST request.
 * @param {Object.<string>=} opt_params Form parameters to send.  Values that
 *     are JS objects will be encoded in JSON for transmission.  If the target
 *     was previously registered using cm.xhr.protectInputs, the values of the
 *     associated input elements will be automatically included as form values.
 * @param {function(boolean, string)=} opt_callback Function that will be called
 *     with a boolean success flag and the content returned by the server.
 */
cm.xhr.post = function(url, opt_params, opt_callback) {
  cm.xhr.send_('POST', url, opt_params, opt_callback, false);
};

/**
 * Performs an asynchronous POST with form parameters, returning decoded JSON.
 * @param {string} url Target of the POST request.
 * @param {Object.<string>=} opt_params Form parameters to send.  Values that
 *     are JS objects will be encoded in JSON for transmission.  If the target
 *     was previously registered using cm.xhr.protectInputs, the values of the
 *     associated input elements will be automatically included as form values.
 * @param {function(boolean, *)=} opt_callback Function that will be called
 *     with a boolean success flag and the decoded JSON returned by the server.
 */
cm.xhr.postJson = function(url, opt_params, opt_callback) {
  cm.xhr.send_('POST', url, opt_params, opt_callback, true);
};

/** @private {number} A unique ID counter. */
cm.xhr.nextId_ = 0;

/**
 * @private {Object.<function(Object)>} Each URL that has abuse protection
 *     enabled is a key in this object; the value associated with each key is
 *     the function used to add a signature to the form values for that URL.
 */
cm.xhr.urlSigners_ = {};

/**
 * @private {Object.<Array.<string>>} For URLs with abuse protection enabled,
 *     stores an array of the IDs of input elements to include as form values.
 */
cm.xhr.urlInputIds_ = {};

/**
 * Registers a target URL and a list of input element IDs for abuse protection.
 * Call this when the input elements are presented to the user; then submit the
 * data by calling a cm.xhr.get* or cm.xhr.post* function, passing a params
 * dictionary whose keys are the element IDs and values are the entered values.
 * The request will then be augmented with a signature verified on the server.
 * @param {string} initUrl URL to fetch JavaScript that initializes protection.
 *     The URL should take two query params: "inputs" with a comma-separated
 *     list of input element IDs, and "callback" with the name of a callback
 *     function.  The returned JavaScript should pass a signing function to
 *     the callback; the signing function takes a dictionary of form values
 *     (keyed by the input element IDs) and adds a 'signature' parameter to it.
 * @param {string} targetUrl URL to the protected form submission endpoint.
 * @param {Array.<string>} inputIds IDs of input elements to be protected.
 * @param {function()} opt_callback A callback to invoke when initialization
 *     is complete.
 */
cm.xhr.protectInputs = function(initUrl, targetUrl, inputIds, opt_callback) {
  if (initUrl) {
    // Set up a callback so that the server-provided signing function will
    // end up mapped to targetUrl in cm.xhr.urlSigners_.
    var callbackName = 'setSigner' + (++cm.xhr.nextId_);
    window['google'] = window['google'] || {};
    window['google']['cm'] = window['google']['cm'] || {};
    window['google']['cm'][callbackName] = function(signer) {
      cm.xhr.urlSigners_[targetUrl] = signer;
      opt_callback && opt_callback();
    };
    goog.net.jsloader.load(initUrl + '?callback=google.cm.' + callbackName +
                           '&inputs=' + inputIds.join(','));
    cm.xhr.urlInputIds_[targetUrl] = inputIds;
  }
};
