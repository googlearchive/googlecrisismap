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
 * @fileoverview URL shortening service.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.UrlShortener');

goog.require('goog.json');
goog.require('goog.net.Jsonp');

/**
 * Encapsulates a service for shortening URLs.
 * @param {string} jsonProxyUrl URL to the JSON proxy service.
 * @param {string=} googleApiKey Google API key, used for the URL Shortener API.
 * @constructor
 */
cm.UrlShortener = function(jsonProxyUrl, googleApiKey) {
  this.jsonProxyUrl_ = jsonProxyUrl;
  this.serviceUrl_ = cm.UrlShortener.SERVICE_URL_ +
      (googleApiKey ? '?key=' + googleApiKey : '');
};

/** @private @const {string} URL for the goo.gl URL Shortener API. */
cm.UrlShortener.SERVICE_URL_ = 'https://www.googleapis.com/urlshortener/v1/url';

/**
 * Sends off a long URL to the shortening service, calling the callback with
 * the shortened URL or with null if the request failed or was rejected.
 * @param {string} longUrl The URL to shorten.
 * @param {function(string)} callback A function to call with the result.
 */
cm.UrlShortener.prototype.shorten = function(longUrl, callback) {
  new goog.net.Jsonp(this.jsonProxyUrl_).send({
    'url': this.serviceUrl_,
    'post_json': goog.json.serialize({'longUrl': longUrl})
  }, function(result) { callback(result['id'] || null); });
};
