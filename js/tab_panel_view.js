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

goog.provide('cm.TabPanelView');

goog.require('cm.AboutTabItem');
goog.require('cm.DetailsTabItem');
goog.require('cm.LayersTabItem');
goog.require('cm.LegendTabItem');
goog.require('cm.TabItem');
goog.require('cm.TabView');
goog.require('cm.events');

/** If panel height is too small, the crowd report form will open in a popup. */
var MIN_PANEL_HEIGHT_FOR_EMBEDDED_FORM = 450;

/**
 * Panel view, containing the map information and layers list.
 * @param {Element} frameElem The frame element surrounding the entire UI.
 * @param {Element} parentElem The DOM element in which to create the panel.
 * @param {Element} mapContainer The map container to put the expand button on.
 * @param {cm.MapModel} mapModel The map model for which to create the panel
 *     view.
 * @param {cm.MetadataModel} metadataModel The metadata model.
 * @param {cm.AppState} appState The application state model.
 * @param {boolean} below Whether to position the tab panel below the map.
 * @param {boolean} expand Whether the panel should initially be expanded.
 * @param {Object=} opt_config Configuration settings.  These fields are used:
 *     draft_mode: Indicate that the map is an unpublished draft?
 *     hide_panel_header: Hide the map title and description?
 *     publisher_name: A string used as the map's publisher
 *     enable_editing: Allow any editing at all?  If true, the following fields
 *       are also used:
 *         save_url: The URL to post to upon save
 *         dev_mode: Enable development mode?
 *         map_list_url: The URL to go to the list of maps
 *         diff_url: The URL to go to see the diff in the map model.
 * @constructor
 */
cm.TabPanelView = function(frameElem, parentElem, mapContainer, mapModel,
                           metadataModel, appState, below, expand,
                           opt_config) {
  /** The map model
   * @type cm.MapModel
   * @private
   */
  this.mapModel_ = mapModel;

  /**
   * @type cm.AppState
   * @private
   */
  this.appState_ = appState;

  /**
   * @type !Object
   * @private
   */
  this.config_ = opt_config || {};

  /**
   * @type cm.MetadataModel
   * @private
   */
  this.metadataModel_ = metadataModel;

  /** The view's parent element.
   * @type Element
   * @private
   */
  this.parentElem_ = parentElem;

  /** The tab view we use to render.
   * @type cm.TabView
   * @private
   */
  this.tabView_ = new cm.TabView();

  /** @private {cm.DetailsTabItem} The tab item for feature details. */
  this.detailsTab_ = null;

  /** @private {boolean} Whether the panel is placed below the map. */
  this.below_ = below;

  /** @private {boolean} Whether the crowd report form opens in a popup. */
  this.formPopupEnabled_ = false;

  /**
   * Where the tab bar is positioned relative to the map.
   * @type cm.TabPanelView.TabPosition
   * @private
   */
  this.tabPosition_ = below ? cm.TabPanelView.TabPosition.BELOW :
      (this.config_['panel_side'] === 'left') ?
      cm.TabPanelView.TabPosition.LEFT : cm.TabPanelView.TabPosition.RIGHT;
  goog.dom.classes.enable(this.parentElem_, cm.css.TAB_PANEL_BELOW, below);

  /**
   * Whether the panel is currently expanded.
   * @type boolean
   * @private
   */
  this.expanded_;

  /**
   * The upward or downward pointing chevron button for expanding or
   * collapsing the tab panel.
   * @type Element
   * @private
   */
  this.expandCollapseButton_;

  /**
   * Whether the tab panel state has been toggled at least once by the
   * user (either from collapsed to expanded or vice versa).
   * @type boolean
   * @private
   */
  this.firstExpandCollapseDone_;

  this.createTabs_();
  this.createButtons_();
  this.render_(expand);
};

/**
 * Positions that the tab can take on relative to the map.
 * @enum {string}
 */
cm.TabPanelView.TabPosition = {
  RIGHT: 'RIGHT',
  LEFT: 'LEFT',
  BELOW: 'BELOW'
};

/**
 * Render the tab panel into the parent element.
 * @param {boolean} expand Whether to initially expand the panel.
 * @private
 */
cm.TabPanelView.prototype.render_ = function(expand) {
  this.tabView_.render(this.parentElem_);
  this.setExpanded_(expand);
  this.firstExpandCollapseDone_ = false;
  cm.events.listen(this.tabView_, cm.events.TAB_SELECTION_CHANGED, function() {
    this.setExpanded_(true);
  }, this);
  cm.events.listen(this.tabView_, cm.events.CLICK_ON_SELECTED_TAB,
      function() {
        this.setExpanded_(!this.expanded_);
      }, this);
};

/**
 * Update the tab panel UI; called by initialize.js on window resize.
 * @param {number} maxPanelHeight The panel's maximum height.
 * @param {boolean} below Whether the tab panel should be placed below
 *     the map.
 */
cm.TabPanelView.prototype.resize = function(maxPanelHeight, below) {
  this.below_ = below;

  // Placement below the map overrides left or right side placement.
  this.tabPosition_ = below ? cm.TabPanelView.TabPosition.BELOW :
      (this.config_['panel_side'] === 'left') ?
      cm.TabPanelView.TabPosition.LEFT : cm.TabPanelView.TabPosition.RIGHT;
  goog.dom.classes.enable(this.parentElem_, cm.css.TAB_PANEL_BELOW, below);

  if (below && this.expanded_) {
    this.parentElem_.style.height = maxPanelHeight + 'px';
    this.parentElem_.style.maxHeight = '';
  } else {
    this.parentElem_.style.height = '';
    this.parentElem_.style.maxHeight = maxPanelHeight + 'px';
  }
  this.tabView_.resize(maxPanelHeight, below);
  this.updateExpandCollapseButton_(this.expanded_);

  this.formPopupEnabled_ =
      below || maxPanelHeight < MIN_PANEL_HEIGHT_FOR_EMBEDDED_FORM;
  if (this.detailsTab_) {
    this.detailsTab_.enableFormPopup(this.formPopupEnabled_);
  }
};

/**
 * Expand or collapse the tab panel.
 * @param {boolean} shouldExpand If true, expand the panel; otherwise
 *   collapse it.
 * @private
 */
cm.TabPanelView.prototype.setExpanded_ = function(shouldExpand) {
  this.tabView_.setExpanded(shouldExpand);
  goog.dom.classes.enable(this.parentElem_, cm.css.TAB_PANEL_EXPANDED,
                          shouldExpand);

  this.updateExpandCollapseButton_(shouldExpand);
  this.expanded_ = shouldExpand;

  // Trigger adjustments to the tab panel height in initialize.js
  cm.events.emit(goog.global, 'resize');

  // Trigger viewport adjustment on first collapse.
  if (!this.firstExpandCollapseDone_) {
    // Instead of keeping track of this in a class member, we could simply
    // emit a global event on every collapse/expand and have the listener
    // cancel itself after it's triggered. For now, we instead emit this
    // event only once.
    this.firstExpandCollapseDone_ = true;
    cm.events.emit(this, cm.events.TAB_PANEL_STATE_FIRST_CHANGED);
  }

  // Recenter viewport if there is a currently selected marker.
  if (shouldExpand && this.tabView_.selectedTabItem() === this.detailsTab_) {
    cm.events.emit(goog.global, cm.events.DETAILS_TAB_OPENED);
  }
};

/** @return {boolean} Whether the panel is currently expanded. */
cm.TabPanelView.prototype.isExpanded = function() {
  return this.expanded_;
};

/** @return {boolean} Whether the panel is positioned below the map. */
cm.TabPanelView.prototype.isBelowMap = function() {
  return this.below_;
};

/**
 * Toggle the chevron up/down depending on whether the tab panel is expanded
 * and where it is positioned.
 * @param {boolean} expand Whether or not the panel will be expanded
 *   after the update.
 * @private
 */
cm.TabPanelView.prototype.updateExpandCollapseButton_ = function(expand) {
  var from, to;
  if (this.tabPosition_ === cm.TabPanelView.TabPosition.BELOW) {
    from = expand ? cm.css.CHEVRON_UP : cm.css.CHEVRON_DOWN;
    to = expand ? cm.css.CHEVRON_DOWN : cm.css.CHEVRON_UP;
  } else {
    from = expand ? cm.css.CHEVRON_DOWN : cm.css.CHEVRON_UP;
    to = expand ? cm.css.CHEVRON_UP : cm.css.CHEVRON_DOWN;
  }
  goog.dom.classes.swap(this.expandCollapseButton_, from, to);
};

/**
 * Sets the maximum height of the panel; currently a no-op.  Carried forward
 * from cm.PanelView to ensure API compatibility. Remove this and use only
 * resize() once we delete panel_view.js
 * @param {number?} height The maximum height of the panel, in pixels.
 */
cm.TabPanelView.prototype.setMaxHeight = function(height) {
};

/**
 * Return the panel's header element; currently returns null.  Carried forward
 * from cm.PanelView to ensure API compatibility.
 * @return {Element?} The header element.
 */
cm.TabPanelView.prototype.getHeader = function() {
  return null;
};

/**
 * Get the bounds of the element into which the PanelView was rendered. (This is
 * the same element that was passed to the constructor via the parentElem.)
 * @return {goog.math.Rect} The position and size of the element containing the
 *     PanelView.
 */
cm.TabPanelView.prototype.getBounds = function() {
  return goog.style.getBounds(this.parentElem_);
};

/**
 * Create the tabs for the panel view; called during initialization.  Right now
 * we just create some demo tabs.
 * @private
 */
cm.TabPanelView.prototype.createTabs_ = function() {
  if (!this.config_['hide_panel_header']) {
    this.tabView_.appendTabItem(
        new cm.AboutTabItem(this.mapModel_, this.appState_, this.config_));
  }
  var layersTab = new cm.LayersTabItem(
          this.mapModel_, this.appState_, this.config_, this.metadataModel_);
  cm.events.forward(layersTab,
                   [cm.events.TOGGLE_LAYER,
                    cm.events.SELECT_SUBLAYER,
                    cm.events.ZOOM_TO_LAYER],
                   this);
  this.tabView_.appendTabItem(layersTab);
  cm.events.forward(layersTab, cm.events.FILTER_QUERY_CHANGED, this);
  cm.events.forward(layersTab, cm.events.FILTER_MATCHES_CHANGED, this);

  var legendTab = new cm.LegendTabItem(
      this.mapModel_, this.appState_, this.config_, this.metadataModel_);
  this.tabView_.appendTabItem(legendTab);

  // TODO(romano): We currently select the 'About' tab by default. If instead
  // we want to select the 'Legend' tab, we should add something like
  // this.tabView_.selectTabItem(
  //     legendTab.getIsEnabled() && lagendTab || aboutTab);
  // once we handle disabling the legend tab when there are no enabled layers
  // with legends.
};

/**
 * Shows the details for a specific feature in the panel.
 * @param {cm.events.FeatureData} featureData Information about the feature.
 */
cm.TabPanelView.prototype.selectFeature = function(featureData) {
  if (this.detailsTab_) {
    this.tabView_.removeTabItem(this.detailsTab_);
  }
  this.detailsTab_ = new cm.DetailsTabItem(
      this.mapModel_, this.appState_, this.config_);
  this.detailsTab_.enableFormPopup(this.formPopupEnabled_);
  this.detailsTab_.loadFeatureData(featureData);
  this.tabView_.appendTabItem(this.detailsTab_);
  this.tabView_.selectTabItem(this.detailsTab_);
};

/** Closes the feature details tab. */
cm.TabPanelView.prototype.deselectFeature = function() {
  if (this.detailsTab_) {
    this.tabView_.removeTabItem(this.detailsTab_);
    this.detailsTab_ = null;
  }
};

/**
 * Create tab bar buttons and attach listeners.
 * @private
 */
cm.TabPanelView.prototype.createButtons_ = function() {
  this.expandCollapseButton_ = cm.ui.create('div',
                                            {'class': cm.css.CHEVRON_DOWN});
  cm.events.listen(this.expandCollapseButton_, 'click', function() {
    this.setExpanded_(!this.expanded_);
  }, this);
  this.tabView_.addButton(this.expandCollapseButton_);
};
