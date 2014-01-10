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
  this.mapModel_ = cm.MapModel.newFromMapRoot({});
  this.mapModel_.set('title', 'TabPanelViewTest map');
  this.mapModel_.set(
      'description',
      cm.Html.fromSanitizedHtml('TabPanelViewTest - description for MapModel'));
  this.metadataModel_ = new google.maps.MVCObject();
  this.appState_ = new cm.AppState();
  this.below_ = false;
  this.config_ = {};
}
TabPanelViewTest.prototype = new cm.TestBase();
registerTestSuite(TabPanelViewTest);

TabPanelViewTest.prototype.createTabPanelView_ = function() {
  this.parent_ = new FakeElement('div');
  this.tabPanel_ = new cm.TabPanelView(
      cm.ui.document.body, this.parent_, this.mapDiv_, this.mapModel_,
      this.metadataModel_, this.appState_, this.below_, this.config_);
  this.tabElements_ = allDescendantsOf(this.parent_, withClass('goog-tab'));
  this.tabView_ = this.tabPanel_.tabView_;
};

/**
 * Tests that the tab with the given name is present at the given
 * index and returns the current tab content element.
 * @param {string} tabName The expected tab name.
 * @param {number} index The expected index.
 * @param {boolean} isSelected Whether to expect that the tab is selected.
 * @return {Element} The tab contentelement.
 * @private
 */
TabPanelViewTest.prototype.expectTab_ = function(tabName, index,
                                                 isSelected) {
  expectThat(this.tabElements_[index], withText(hasSubstr(tabName)),
             isSelected ? withClass('goog-tab-selected') :
                 not(withClass('goog-tab-selected')));
  return (findDescendantOf(this.parent_, withClass('cm-tab-content')));
};

TabPanelViewTest.prototype.testCreation = function() {
  this.createTabPanelView_();
  expectDescendantOf(this.parent_, withClass('goog-tab-bar'));

  // Test that the 'About' tab is present and selected, and verify its content.
  var aboutContent = this.expectTab_('About', 0, true);
  expectDescendantOf(aboutContent,
                     withText(hasSubstr(this.mapModel_.get('title'))));
  expectDescendantOf(aboutContent,
                     withText(hasSubstr(
                         this.mapModel_.get('description').toText())));
  this.expectTab_('Layers', 1, false);

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


TabPanelViewTest.prototype.testExpandCollapse = function() {
  this.createTabPanelView_();
  var button = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_UP));

  // The panel should be expanded by default.
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));

  // Collapse the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_DOWN));
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));

  // Expand the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_UP));
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));
};

TabPanelViewTest.prototype.testExpandCollapseBelow = function() {
  this.below_ = true;
  this.createTabPanelView_();

  var numTimesFirstCollapsed = 0;
  cm.events.listen(this.tabPanel_, cm.events.TAB_PANEL_FIRST_COLLAPSED,
    function() { numTimesFirstCollapsed += 1; });

  // The panel should be expanded by default.
  var button = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_DOWN));
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));

  // Collapse the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_UP));
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));
  expectEq(1, numTimesFirstCollapsed);

  // Expand the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_DOWN));
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));

  // Collapse again and verify theat the first-collapsed event doesn't fire.
  expectEq(1, numTimesFirstCollapsed);
};

/**
 * Tests that the tab panel view listens for layer filter eventsn
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
