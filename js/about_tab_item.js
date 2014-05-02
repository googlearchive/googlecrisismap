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

goog.provide('cm.AboutTabItem');

goog.require('cm');
goog.require('cm.MapModel');
goog.require('cm.MapTabItem');
goog.require('cm.TabItem');
goog.require('cm.ui');

/**
 * Produces the About tab in the tab panel.
 * @param {!cm.MapModel} mapModel The model for the map being displayed.
 * @param {!cm.AppState} appState The application state model.
 * @param {Object} config A dictionary of configuration options.
 * @extends cm.MapTabItem
 * @implements cm.TabItem
 * @constructor
 */
cm.AboutTabItem = function(mapModel, appState, config) {
  cm.MapTabItem.call(this, mapModel, appState, config);

  /**
   * @type Element
   * @private
   */
  this.descElem_;
};
goog.inherits(cm.AboutTabItem, cm.MapTabItem);

/** @override */
cm.AboutTabItem.prototype.addContent = function(parentElem) {
  this.descElem_ = cm.ui.create('div', {'class': cm.css.MAP_DESCRIPTION});
  cm.events.onChange(
      this.mapModel, 'description', this.handleDescriptionChanged_, this);
  this.handleDescriptionChanged_();

  var panelLinks = cm.ui.create('div', {'class': cm.css.PANEL_LINKS});
  if (this.editingEnabled) {
    var setDefaultView = cm.ui.createLink(cm.MSG_SET_DEFAULT_VIEW_LINK);
    cm.ui.append(panelLinks, setDefaultView, cm.ui.create('br'));
    cm.events.listen(setDefaultView, 'click', this.handleSetDefaultView_, this);
  }
  var resetViewLink = cm.ui.createLink(cm.MSG_RESET_VIEW_LINK);
  cm.ui.append(panelLinks, resetViewLink);
  cm.events.listen(resetViewLink, 'click', this.handleResetView_, this);

  cm.ui.append(parentElem, this.descElem_, panelLinks);
};


/**
 * Respond to a description change in the map model.
 * @private
 */
cm.AboutTabItem.prototype.handleDescriptionChanged_ = function() {
  var description = /** @type cm.Html */(this.mapModel.get('description'));
  description.pasteInto(this.descElem_);
  // TODO(kpy): On the Android web browser, the panel will not scroll if there
  // are any block tags in the map description.  Remove them and scrolling
  // works just fine.  Block tags in layer descriptions are harmless, though.
  // Requires further investigation.
  this.promptRelayout();
};

/**
 * Respond to a request to set the map's default view.
 * @private
 */
cm.AboutTabItem.prototype.handleSetDefaultView_ = function() {
  var oldDefault = cm.AppState.clone(this.appState);
  oldDefault.setFromMapModel(this.mapModel);
  var newDefault = cm.AppState.clone(this.appState);
  cm.events.emit(cm.app, cm.events.DEFAULT_VIEW_SET,
                 {oldDefault: oldDefault, newDefault: newDefault});
};

/**
 * Respond to a request to reset the view of the map to the default
 * stored in the map model.
 * @private
 */
cm.AboutTabItem.prototype.handleResetView_ = function() {
    cm.Analytics.logAction(cm.Analytics.AboutTabAction.VIEW_RESET, null);
    cm.events.emit(cm.app, cm.events.RESET_VIEW, {model: this.mapModel});
};

/** @override */
cm.AboutTabItem.prototype.getTitle = function() {
  return cm.MSG_ABOUT_TAB_LABEL;
};

/** @override */
cm.AboutTabItem.prototype.getIcon = function() { return null; };

/** @override */
cm.AboutTabItem.prototype.analyticsSelectionEvent = function() {
  return cm.Analytics.TabPanelAction.ABOUT_TAB_SELECTED;
};
