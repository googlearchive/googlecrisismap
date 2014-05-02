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
goog.require('cm.CrowdView');
goog.require('cm.MapTabItem');
goog.require('cm.TabItem');
goog.require('cm.ui');
goog.require('goog.dom.classes');

/**
 * The Details tab in the tab panel.
 * @param {!cm.MapModel} mapModel The model for the map being displayed.
 * @param {!cm.AppState} appState The application state model.
 * @param {Object} config A dictionary of configuration options.
 * @extends cm.MapTabItem
 * @implements cm.TabItem
 * @constructor
 */
cm.DetailsTabItem = function(mapModel, appState, config) {
  cm.MapTabItem.call(this, mapModel, appState, config);

  /** @private {Element} Details about the selected feature, as provided by
   *      the original data source, rendered as a DOM element. */
  this.featureInfoElem_ = cm.ui.create('div');

  /** @private {Element} The element containing the crowd view. */
  this.crowdElem_ = cm.ui.create('div');

  /** @private {cm.CrowdView} */
  this.crowdView_ = new cm.CrowdView(this.crowdElem_, mapModel, config);
};
goog.inherits(cm.DetailsTabItem, cm.MapTabItem);

/**
 * @param {boolean} enabled If true, the crowd report form will open in a popup.
 *     Otherwise, it will open embedded within the tab.
 */
cm.DetailsTabItem.prototype.enableFormPopup = function(enabled) {
  this.crowdView_.enableFormPopup(enabled);
};

/** @override */
cm.DetailsTabItem.prototype.addHeader = function(headerElem) {
  // We don't want the map title to appear on Details tabs, so override default
  // header contents and hide the element.
  headerElem.style.display = 'none';
};

/** @override */
cm.DetailsTabItem.prototype.addContent = function(parentElem) {
  cm.ui.append(parentElem, this.featureInfoElem_, this.crowdElem_);
};

/**
 * Populates the tab with content for a given map feature.
 * @param {cm.events.FeatureData} featureData
 */
cm.DetailsTabItem.prototype.loadFeatureData = function(featureData) {
  // Information from the original data source
  cm.ui.clear(this.featureInfoElem_);
  cm.ui.append(this.featureInfoElem_, featureData.content);
  goog.dom.classes.add(featureData.content, cm.css.FEATURE_INFO_CONTENT);

  // Information from the crowd
  if (this.mapModel.getCrowdTopicsForLayer(featureData.layerId).length) {
    this.crowdElem_.style.display = '';
    this.crowdView_.open(featureData);
  } else {
    this.crowdElem_.style.display = 'none';
    this.crowdView_.close();
  }
};

/** @override */
cm.DetailsTabItem.prototype.getTitle = function() {
  return cm.MSG_DETAILS_TAB_LABEL;
};

/** @override */
cm.DetailsTabItem.prototype.analyticsSelectionEvent = function() {
  return cm.Analytics.TabPanelAction.DETAILS_TAB_SELECTED;
};
