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

goog.provide('cm.LegendTabItem');

goog.require('cm');
goog.require('cm.LegendView');
goog.require('cm.LegendViewList');
goog.require('cm.MapModel');
goog.require('cm.MapTabItem');
goog.require('cm.MetadataModel');
goog.require('cm.TabItem');
goog.require('cm.events');



/**
 * Produces the Legend tab in the tab panel.  The LegendTabItem maintains
 * a LegendViewList that keeps a list of legends in sync with the list of
 * layers in the map model.  Each legend provides a LegendView to the
 * LegendViewList.  On update, the LegendTabItem grabs the LegendViews from
 * the LegendViewList and adds them to the containing element.
 * @param {!cm.MapModel} mapModel The model for the map being displayed.
 * @param {!cm.AppState} appState The application state model.
 * @param {Object} config A dictionary of configuration options.
 * @param {!cm.MetadataModel} metadataModel The metadata model for layers.
 * @extends {cm.MapTabItem}
 * @implements {cm.TabItem}
 * @constructor
 */
cm.LegendTabItem = function(mapModel, appState, config, metadataModel) {
  cm.MapTabItem.call(this, mapModel, appState, config);

  /** @private {cm.MetadataModel} */
  this.metadataModel_ = metadataModel;

  /** @private {!Element} */
  this.legendContainer_ = cm.ui.create('div');

  /**
   * Whether the tab item is currently enabled; set in update_()
   * @private {boolean}
   */
  this.isEnabled_ = true;

  /**
   * The legend view list watching the list of layers in the map.
   * @private {!cm.LegendViewList}
   */
  this.legendViewList_ = new cm.LegendViewList(this.mapModel, 'layers',
      this.appState, this.metadataModel_);

  cm.events.listen(this.legendViewList_,
      cm.events.LEGEND_VIEW_LIST_RENDERING_CHANGED, this.update_, this);

  this.update_();
};
goog.inherits(cm.LegendTabItem, cm.MapTabItem);


/** @override */
cm.LegendTabItem.prototype.addContent = function(parentElem) {
  parentElem.appendChild(this.legendContainer_);
};


/** @override */
cm.LegendTabItem.prototype.getTitle = function() {
  return cm.MSG_LEGEND_TAB_LABEL;
};


/**
 * Updates the content of legendContainer to contain all legend views.
 * @private
 */
cm.LegendTabItem.prototype.update_ = function() {
  var hasContent = false;
  cm.ui.clear(this.legendContainer_);

  goog.array.forEach(this.legendViewList_.getLegendViews(),
      function(legendView) {
        var content = legendView.getContent();
        if (!content) return;
        cm.ui.append(this.legendContainer_, content);
        hasContent = true;
      }, this);

  this.isEnabled_ = hasContent;
  if (hasContent) {
    this.markFirstLegend_();
  }
  if (this.tabView) {
    this.tabView.updateTabItem(this);
  }
};


/**
 * Locates the first legend box inside legendContainer and gives it the special
 * first-legend-box class.  Clears that class off all other legend boxes.
 * @private
 */
cm.LegendTabItem.prototype.markFirstLegend_ = function() {
  var allLegends = goog.dom.findNodes(this.legendContainer_, function(elt) {
    return goog.dom.classes.has(elt, cm.css.TABBED_LEGEND_BOX);
  });
  if (allLegends) {
    goog.dom.classes.add(allLegends[0], cm.css.FIRST_TABBED_LEGEND_BOX);
    goog.array.forEach(allLegends.slice(1), function(elt) {
      goog.dom.classes.remove(elt, cm.css.FIRST_TABBED_LEGEND_BOX);
    });
  }
};


/** @override */
cm.LegendTabItem.prototype.getIsEnabled = function() {
  return this.isEnabled_;
};


/** @override */
cm.LegendTabItem.prototype.analyticsSelectionEvent = function() {
  return cm.Analytics.TabPanelAction.LEGEND_TAB_SELECTED;
};
