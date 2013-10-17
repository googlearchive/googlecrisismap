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

goog.provide('cm.DetailsTabItem');

goog.require('cm');
goog.require('cm.MapModel');
goog.require('cm.MapTabItem');
goog.require('cm.TabItem');
goog.require('cm.ui');

/**
 * The Details tab in the tab panel.
 * @param {cm.MapModel} mapModel The model for the map being displayed.
 * @param {cm.AppState} appState The application state model.
 * @param {Object} config A dictionary of configuration options.
 * @extends cm.MapTabItem
 * @implements cm.TabItem
 * @constructor
 */
cm.DetailsTabItem = function(mapModel, appState, config) {
  cm.MapTabItem.call(this, mapModel, appState, config);

  /**
   * @type string
   * @private
   */
  this.layerId_;

  /**
   * @type string
   * @private
   */
  this.featureTitle_;

  /**
   * @type string
   * @private
   */
  this.featureSnippet_;

  /**
   * @type google.maps.LatLng
   * @private
   */
  this.featurePosition_;

  /**
   * Details about the selected placemark, as provided by the original data
   * source, rendered as a DOM element.
   * @type Element
   * @private
   */
  this.featureContentElem_;
};
goog.inherits(cm.DetailsTabItem, cm.MapTabItem);

/** @override */
cm.DetailsTabItem.prototype.addScrollingContent = function(parentElem) {
  cm.ui.append(parentElem, this.featureContentElem_);
};

/**
 * Populates the tab with content for a given map feature.
 * @param {cm.events.FeatureData} featureData
 */
cm.DetailsTabItem.prototype.loadFeatureData = function(featureData) {
  // Currently we just dump the content into the tab.  We aren't using the
  // rest of the fields yet, but we'll probably want them soon.
  this.featureContentElem_ = featureData.content;

  this.layerId_ = featureData.layerId;
  this.featureTitle_ = featureData.title;
  this.featureSnippet_ = featureData.snippet;
  this.featurePosition_ = featureData.position;
};

/** @override */
cm.DetailsTabItem.prototype.getTitle = function() {
  return cm.MSG_DETAILS_TAB_LABEL;
};
