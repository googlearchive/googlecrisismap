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
 * @fileoverview Miscellaneous browser detection stuff.
 * @author arb@google.com (Anthony Baxter)
 */

goog.provide('cm.BrowserDetect');
goog.require('cm.ui');
goog.require('goog.dom.TagName');

/**
 * @constructor
 */
cm.BrowserDetect = function() {
};

/**
 * Does this browser support touch?
 * @return {boolean} Whether we support touch.
 */
cm.BrowserDetect.prototype.supportsTouch = function() {
  return this.hasEvent_('ontouchstart') &&
         this.hasEvent_('ontouchmove') &&
         this.hasEvent_('ontouchend');
};

/**
 * Does the browser support this event type?
 * @param {string} eventName The name of the event to check.
 * @return {boolean} Whether we support the event type.
 * @private
 */
cm.BrowserDetect.prototype.hasEvent_ = function(eventName) {
  var elem = cm.ui.create(goog.dom.TagName.DIV);
  elem.setAttribute(eventName, 'return;');
  return (typeof elem[eventName] == 'function' ||
      eventName in cm.ui.document.documentElement);
};
