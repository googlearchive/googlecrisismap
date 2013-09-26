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
 * @fileoverview A logo image that floats in the bottom left corner of the map.
 */

goog.provide('cm.LogoView');
goog.provide('cm.LogoViewConfig');

goog.require('cm');
goog.require('cm.ExtraView');
goog.require('cm.css');
goog.require('cm.ui');
goog.require('goog.object');

/**
 * Configuration values for the LogoView.
 * height: Height in px of the logo image.
 * width: Width in px of the logo image.
 * url: The URL of the logo image.
 * @typedef {{height: number, width: number, url: string}}
 */
cm.LogoViewConfig;

/**
 * A logo image that floats in the bottom left corner of the map.
 * @param {!Element} frameElem The parent Element to place the LogoView into.
 * @param {!cm.LogoViewConfig} config Configuration specific to the logo view.
 * @constructor
 * @extends {cm.ExtraView}
 */
cm.LogoView = function(frameElem, config) {
  /**
   * @type {!cm.LogoViewConfig}
   * @private
   */
  this.config_ = config;

  cm.ui.append(frameElem, cm.ui.create('img', {
    'class': cm.css.LOGO_WATERMARK,
    'height': config.height + 'px',
    'width': config.width + 'px',
    'src': config.url
  }));
};

/**
 * @return {number} The height in pixels of the logo image.
 */
cm.LogoView.prototype.getHeight = function() {
  return this.config_.height;
};


