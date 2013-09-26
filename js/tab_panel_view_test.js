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
};

TabPanelViewTest.prototype.testCreation = function() {
  this.createTabPanelView_();

  expectDescendantOf(this.parent_, withClass('goog-tab-bar'));

  var allTabs = allDescendantsOf(this.parent_, withClass('goog-tab'));
  expectThat(allTabs[0], withText(hasSubstr('About')));
  // Test that the about tab is present and selected
  expectDescendantOf(
      this.parent_, withText(hasSubstr(this.mapModel_.get('title'))));
  expectDescendantOf(
      this.parent_,
      withText(hasSubstr(this.mapModel_.get('description').toText())));

  expectThat(allTabs[1], withText(hasSubstr('Layers')));

  // As the standard tab items are implemented, this test should grow to
  // expect them.
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
  var button = expectDescendantOf(this.parent_, withClass(cm.css.CHEVRON_UP));

  // The panel should be collapsed by default. Note that this will change
  // when we differentiate between mobile and embedded loads.
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));

  // Expand the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_DOWN));
  expectThat(this.parent_, withClass(cm.css.TAB_PANEL_EXPANDED));

  // Collapse the tab panel.
  cm.events.emit(button, 'click');
  expectThat(button, withClass(cm.css.CHEVRON_UP));
  expectThat(this.parent_, not(withClass(cm.css.TAB_PANEL_EXPANDED)));
};
