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

goog.require('cm.css');
goog.require('cm.ui');

function TabPanelViewTest() {
  cm.TestBase.call(this);
  // TODO(rew): This should be shared setup somewhere; need to look at how
  // widespread this kind of initialization is, and extract.
  this.mapDiv_ = new FakeElement('div');
  this.below_ = false;
  this.expand_ = true;
  this.config_ = {};
}
TabPanelViewTest.prototype = new cm.TestBase();
registerTestSuite(TabPanelViewTest);

TabPanelViewTest.DEFAULT_MAP_ROOT = {
  id: 'map',
  title: 'TabPanelViewTest map',
  description: 'TabPanelViewTest - description for MapModel',
  layers: [
    {id: 'layerA', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON',
     legend: 'A legend'},
    {id: 'layerB', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'},
    {id: 'layerC', type: cm.LayerModel.Type.KML}
  ]};

TabPanelViewTest.prototype.createTabPanelView_ = function(opt_maproot) {
  // Bring up the mapModel, metadataModel, and appState the same way that
  // buildUi_() in initialize.js does.
  this.mapModel_ = cm.MapModel.newFromMapRoot(
      opt_maproot || TabPanelViewTest.DEFAULT_MAP_ROOT);
  this.metadataModel_ = new cm.MetadataModel(this.mapModel_);
  this.appState_ = new cm.AppState();
  this.appState_.setFromMapModel(this.mapModel_);

  this.parent_ = new FakeElement('div');
  this.tabPanel_ = new cm.TabPanelView(
      cm.ui.document.body, this.parent_, this.mapDiv_, this.mapModel_,
      this.metadataModel_, this.appState_, this.below_, this.expand_,
      this.config_);
  this.tabElements_ = allDescendantsOf(this.parent_, withClass('goog-tab'));
  this.tabView_ = this.tabPanel_.tabView_;
};

/**
 * Tests that the tab with the given name is present at the given
 * index and returns the current tab content element.
 * @param {string} tabName The expected tab name.
 * @param {number} index The expected index.
 * @param {boolean} isSelected Whether to expect that the tab is selected.
 * @return {Element} The tab content element.
 * @private
 */
TabPanelViewTest.prototype.expectTab_ = function(tabName, index,
                                                 isSelected) {
  expectThat(this.tabElements_[index], withText(hasSubstr(tabName)));
  expectThat(this.tabElements_[index], isSelected ?
      withClass('goog-tab-selected') : not(withClass('goog-tab-selected')));
  return findDescendantOf(this.parent_, withClass('cm-tab-content'));
};

TabPanelViewTest.prototype.testCreation = function() {
  // Not interested in testing the sanitizer here, so just install
  // a transparent one.
  this.setForTest_('cm.Html.sanitize_', function(string) { return string; });

  this.createTabPanelView_();
  expectDescendantOf(this.parent_, withClass('goog-tab-bar'));

  // Test that all tabs are present and the 'Legend' tab selected.
  this.expectTab_('About', 0, false);
  this.expectTab_('Layers', 1, false);
  var legendContent = this.expectTab_('Legend', 2, true);
  expectDescendantOf(legendContent, withText('A legend'));

  // Select the 'About' tab and verify its content.
  var aboutTab = this.tabView_.getTabItemByTitle('About');
  this.tabView_.selectTabItem(aboutTab);
  var aboutContent = this.expectTab_('About', 0, true);
  expectDescendantOf(aboutContent,
                     withText(hasSubstr(this.mapModel_.get('title'))));
  expectDescendantOf(aboutContent,
                     withText(hasSubstr(
                         this.mapModel_.get('description').toText())));

  // Select the 'Layers' tab and verify its content.
  var layersTab = this.tabView_.getTabItemByTitle('Layers');
  this.tabView_.selectTabItem(layersTab);
  var layersContent = this.expectTab_('Layers', 1, true);
  expectDescendantOf(layersContent, withClass('cm-panel-layers'));
};

/** Tests that the About panel is absent. */
TabPanelViewTest.prototype.testConstructorHiddenHeader = function() {
  this.config_ = {
    'enable_editing': false,
    'hide_panel_header': true
  };
  this.createTabPanelView_();
  expectNoDescendantOf(
      this.parent_,
      allOf([withClass('goog-tab'), withText(hasSubstr('About'))]));
};

/** Tests construction when tab panel is placed below the map. */
TabPanelViewTest.prototype.testConstructorBelow = function() {
  this.below_ = true;
  this.createTabPanelView_();
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_BELOW));
};

/**
 * Test construction with the tab panel collapsed.
 */
TabPanelViewTest.prototype.testConstructorCollapsed = function() {
  this.expand_ = false;
  this.createTabPanelView_();
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));
};

TabPanelViewTest.prototype.testMultipleClicksOnSelectedTab = function() {
  this.createTabPanelView_();
  var chevron = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_UP));

  // Initally we should be in an expanded state
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));
  expectThat(chevron, withClass(cm.css.CHEVRON_UP));

  // Re-selecting the currently selected tab should result in collapsed state
  cm.events.emit(this.tabView_, cm.events.CLICK_ON_SELECTED_TAB);
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));
  expectThat(chevron, withClass(cm.css.CHEVRON_DOWN));
};

TabPanelViewTest.prototype.testExpandByClickingOnSelectedTab = function() {
  this.createTabPanelView_();
  var chevron = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_UP));
  this.expectLogAction(cm.Analytics.TabPanelAction.PANEL_TOGGLED_CLOSED, null);

  // Collapse the tab bar by selecting an already-selected tab.
  cm.events.emit(this.tabView_, cm.events.CLICK_ON_SELECTED_TAB);

  // Selecting the currently selected tab while in collapsed state should result
  // in an expanded state
  this.expectLogAction(cm.Analytics.TabPanelAction.PANEL_TOGGLED_OPEN, null);
  cm.events.emit(this.tabView_, cm.events.CLICK_ON_SELECTED_TAB);
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));
  expectThat(chevron, withClass(cm.css.CHEVRON_UP));
};

TabPanelViewTest.prototype.testExpandCollapse = function() {
  this.createTabPanelView_();
  var button = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_UP));

  // The panel should be expanded by default.
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));

  // Collapse the tab panel.
  this.expectLogAction(cm.Analytics.TabPanelAction.PANEL_TOGGLED_CLOSED, null);
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_DOWN));
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));

  // Expand the tab panel.
  this.expectLogAction(cm.Analytics.TabPanelAction.PANEL_TOGGLED_OPEN, null);
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_UP));
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));
};

TabPanelViewTest.prototype.testExpandCollapseBelowExpanded = function() {
  this.below_ = true;
  this.createTabPanelView_();

  var numTimesFirstChanged = 0;
  cm.events.listen(this.tabPanel_, cm.events.TAB_PANEL_STATE_FIRST_CHANGED,
    function() { numTimesFirstChanged += 1; });

  // The panel should be expanded by default.
  var button = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_DOWN));
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));

  // Collapse the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_UP));
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));
  expectEq(1, numTimesFirstChanged);

  // Expand the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_DOWN));
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));

  // Collapse again and verify theat the first-collapsed event doesn't fire.
  expectEq(1, numTimesFirstChanged);
};

TabPanelViewTest.prototype.testExpandCollapseBelowCollapsed = function() {
  this.below_ = true;
  this.expand_ = false;
  this.createTabPanelView_();

  var numTimesFirstChanged = 0;
  cm.events.listen(this.tabPanel_, cm.events.TAB_PANEL_STATE_FIRST_CHANGED,
    function() { numTimesFirstChanged += 1; });

  // The panel should be collapsed by default.
  var button = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_UP));
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));

  // Expand the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_DOWN));
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));
  expectEq(1, numTimesFirstChanged);

  // Collapse the tab panel.n
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_UP));
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));

  // Expand again and verify theat the first-changed event doesn't fire.
  expectEq(1, numTimesFirstChanged);
};

/**
 * Tests that when a feature is selected or de-selected the details
 * tab is created or destroyed.
 */
TabPanelViewTest.prototype.testFeatureSelectAndDeselect = function() {
  this.createTabPanelView_();
  this.tabPanel_.selectFeature({layerId: 'abc', title: 'Feature', content:
                                'Detailed information.'});
  this.tabElements_ = allDescendantsOf(this.parent_, withClass('goog-tab'));

  var detailsTab = this.expectTab_('Details', 3, true);
  expectDescendantOf(detailsTab,
                     withText('Detailed information.'));

  this.tabPanel_.deselectFeature();
  var selectedTab = this.tabView_.selectedTabItem().getContent();
  expectNoDescendantOf(selectedTab, withText('Detailed information.'));
};

/**
 * @private
 */
TabPanelViewTest.prototype.expectFeatureSelection_ = function() {
  // Set up a listener that should fire when a feature is selected.
  this.detailsOpened_ = false;
  cm.events.listen(cm.app, cm.events.DETAILS_TAB_OPENED, function() {
    this.detailsOpened_ = true;
  }, this);
  this.createTabPanelView_();
  // Select a feature.
  this.tabPanel_.selectFeature({layerId: 'abc', title: 'Feature', content:
                                'Detailed information.'});
};

/** Tests the details opened event fires when a feature is selected. */
TabPanelViewTest.prototype.testDetailsOpenedOnFeatureSelection = function() {
  this.expectFeatureSelection_();
  expectTrue(this.detailsOpened_);
};

/**
 * Tests the details opened event fires when the tab is expanded and the details
 * tab is already selected.
 */
TabPanelViewTest.prototype.testDetailsOpenedOnPanelExpand = function() {
  this.expectFeatureSelection_();

  // Reset this.detailsOpened_ and only expect it to become true when
  // the tab panel is expanded.
  this.detailsOpened_ = false;
  var button = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_UP));
  cm.events.emit(button, 'click');
  expectFalse(this.detailsOpened_);
  cm.events.emit(button, 'click');
  expectTrue(this.detailsOpened_);
};

/** Tests the details opened event fires when the details tab is selected. */
TabPanelViewTest.prototype.testDetailsOpenedOnDetailsSelect = function() {
  this.expectFeatureSelection_();

  // Rest this.detailsOpened_ and expect it to become true after selecting
  // another tab and then re-selecting the details tab.
  this.detailsOpened_ = false;
  var aboutTab = this.tabView_.getTabItemByTitle('About');
  this.tabView_.selectTabItem(aboutTab);
  expectFalse(this.detailsOpened_);
  var detailsTab = this.tabView_.getTabItemByTitle('Details');
  this.tabView_.selectTabItem(detailsTab);
  expectTrue(this.detailsOpened_);
};

/**
 * Tests that the tab panel view listens for layer filter events
 * on the layers tab item.
 */
TabPanelViewTest.prototype.testLayerFilter = function() {
  this.createTabPanelView_();
  var layersTabItem = this.tabView_.getTabItemByTitle('Layers');

  var query = '';
  cm.events.listen(this.tabPanel_, cm.events.FILTER_QUERY_CHANGED,
                   function(e) { query = e.query; });
  cm.events.emit(layersTabItem, cm.events.FILTER_QUERY_CHANGED,
                 {'query': 'a query'});
  expectEq('a query', query);

  var matches = ['layer1', 'layer2'];
  cm.events.listen(this.tabPanel_, cm.events.FILTER_MATCHES_CHANGED,
                   function(e) { matches = e.matches; });
  cm.events.emit(layersTabItem, cm.events.FILTER_MATCHES_CHANGED,
                 {'matches': ['layer3', 'layer4']});
  expectThat(matches, elementsAre(['layer3', 'layer4']));
};

/** Verify that the legend tab isn't created if there are no legends at all. */
TabPanelViewTest.prototype.testNoLegendTabWhenNoLegendsPresent = function() {
  var mapRoot = {
    id: 'testNoLegendTabWhenNoLegendsPresent',
    title: 'No Legend Map',
  description: 'A map with no legends',
  layers: [
    {id: 'layer1', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'},
    {id: 'layer2', type: cm.LayerModel.Type.KML}
  ]};
  this.createTabPanelView_(mapRoot);
  expectNoDescendantOf(
      this.parent_, withClass('goog-tab'), withText(hasSubstr('Legend')));
};

/**
 * Verify that the legend tab isn't created if the only legends available
 * are on layers that can never be enabled (e.g. a disabled layer in a
 * locked folder.)
 */
TabPanelViewTest.prototype.testNoLegendTabWhenImpossibleToEnableLegend =
    function() {
  var mapRoot = {
    id: 'testNoLegendTabWhenImpossibleToEnableLegend',
    title: 'Hidden Legend Map',
  description: 'A map with one legend stuck disabled behind a locked folder',
  layers: [
    {id: 'layer1', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'},
    {id: 'locked folder', type: cm.LayerModel.Type.FOLDER,
     list_item_type: 'CHECK_HIDE_CHILDREN', sublayers: [
       {id: 'layer2', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_OFF',
        legend: 'A legend no one can see'}
     ]}
  ]};
  this.createTabPanelView_(mapRoot);
  expectNoDescendantOf(
      this.parent_, withClass('goog-tab'), withText(hasSubstr('Legend')));
};

/**
 * Verify that when editing, the legend tab is present, even if there are
 * no legends currently.
 */
TabPanelViewTest.prototype.testLegendTabPresentWhenEditing = function() {
  var mapRoot = {
    id: 'testLegendTabPresentWhenEditing',
    title: 'No Legend Map',
  description: 'A map with no legends',
  layers: [
    {id: 'layer1', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'},
    {id: 'layer2', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_OFF'}
  ]};
  this.config_['enable_editing'] = true;
  this.createTabPanelView_(mapRoot);
  this.expectTab_('Legend', 2, false);
};
