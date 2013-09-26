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

// TODO(rew): These class names should all be replaced with CrisisMap-specific
// ones, but right now we are using the normal goog.ui.TabBar, so we look
// for those classes
TAB_BAR_CLASS = 'goog-tab-bar';
TAB_CLASS = 'goog-tab';
DISABLED_TAB_CLASS = 'goog-tab-disabled';

function TabViewTest() {
  cm.TestBase.call(this);
}
TabViewTest.prototype = new cm.TestBase();
registerTestSuite(TabViewTest);

/**
 * Simple mock for TabItem to use for testing.
 * @implements cm.TabItem
 * @constructor
 */
TabViewTest.TestTabItem = function(title, content) {
  this.title = title;
  this.content = content;
  this.tabView = null;
  this.isSelected = false;
  this.isEnabled = true;
};

/** Class used on the <div>s for the content of mock tabs. */
TabViewTest.TestTabItem.TEST_CLASS = 'MockTabClass';

TabViewTest.TestTabItem.newFromTitle = function(title) {
  return new TabViewTest.TestTabItem(title, cm.ui.create(
      'div', {'class': TabViewTest.TestTabItem.TEST_CLASS},
      'This is the ' + title + 'tab!'));
};

TabViewTest.TestTabItem.prototype.getTitle = function() { return this.title; };

TabViewTest.TestTabItem.prototype.getIcon = function() { return null; };

TabViewTest.TestTabItem.prototype.getContent = function() {
  return this.content;
};

TabViewTest.TestTabItem.prototype.getIsEnabled = function() {
  return this.isEnabled;
};

TabViewTest.TestTabItem.prototype.setSelected = function(isSelected) {
  this.isSelected = isSelected;
};

TabViewTest.TestTabItem.prototype.setTabView = function(tabView) {
  this.tabView = tabView;
};

TabViewTest.TestTabItem.prototype.setTitle = function(newTitle) {
  this.title = newTitle;
  this.tabView.updateTabItem(this);
};

TabViewTest.TestTabItem.prototype.contentString = function() {
  return this.content.toString();
};

TabViewTest.TestTabItem.prototype.setIsEnabled = function(isEnabled) {
  this.isEnabled = isEnabled;
  this.tabView.updateTabItem(this);
};

TabViewTest.prototype.initializeTabView_ = function(opt_numTabs) {
  this.parent_ = new FakeElement('div');
  this.tabView_ = new cm.TabView();
  // Holds the list of TestTabItems that have been added to the tabView; its
  // ordering matches the order of tabs in the tabView.
  this.tabs_ = [];

  if (opt_numTabs === undefined) opt_numTabs = 3;
  for (var i = 0; i < opt_numTabs; i++) {
    var newTab = TabViewTest.TestTabItem.newFromTitle('Mock ' + i);
    this.tabView_.appendTabItem(newTab);
    this.tabs_.push(newTab);
  }
  this.tabView_.render(this.parent_);

  this.tabBarElem_ = expectDescendantOf(this.parent_, withClass(TAB_BAR_CLASS));
};

TabViewTest.prototype.testCreation = function() {
  this.initializeTabView_();
  expectDescendantOf(
      this.parent_, withClass(TabViewTest.TestTabItem.TEST_CLASS));
  expectEq(3, allDescendantsOf(this.tabBarElem_, withClass(TAB_CLASS)).length);
};

TabViewTest.prototype.testAppendTabItem = function() {
  this.initializeTabView_();
  this.tabView_.appendTabItem(
      TabViewTest.TestTabItem.newFromTitle('Appended Tab'));
  var tabs = allDescendantsOf(this.tabBarElem_, withClass(TAB_CLASS));
  expectEq(4, tabs.length);
  expectThat(tabs[3], withText(hasSubstr('Appended Tab')));
};

TabViewTest.prototype.testInsertTabItem = function() {
  this.initializeTabView_();
  this.tabView_.insertTabItem(
      TabViewTest.TestTabItem.newFromTitle('testInsertTabItem'), 1);
  var tabs = allDescendantsOf(this.parent_, withClass(TAB_CLASS));
  expectEq(4, tabs.length);
  expectThat(tabs[1], withText(hasSubstr('testInsertTabItem')));
};

TabViewTest.prototype.testTitleChangeHandled = function() {
  this.initializeTabView_();
  for (var i = 0; i < this.tabs_.length; i++) {
    var tab = this.tabs_[i];
    tab.setTitle('testTitleChangeHandled');
    expectThat(allDescendantsOf(this.parent_, withClass(TAB_CLASS))[i],
               withText(hasSubstr('testTitleChangeHandled')));
  }
};

TabViewTest.prototype.testInitialSelection = function() {
  this.initializeTabView_();
  for (var i = 0; i < this.tabs_.length; i++) {
    var tab = this.tabs_[i];
    if (tab === this.tabView_.selectedTabItem()) {
      expectTrue(tab.isSelected);
    } else {
      expectFalse(tab.isSelected);
    }
  }
};

TabViewTest.prototype.chooseRandomTabItem_ = function() {
  return this.tabs_[Math.floor(Math.random() * this.tabs_.length)];
};

TabViewTest.prototype.chooseUnselectedTabItem_ = function() {
  var tab = this.chooseRandomTabItem_();
  while (tab.isSelected) {
    tab = this.chooseRandomTabItem_();
  }
  return tab;
};

TabViewTest.prototype.testSelectTabItem = function() {
  this.initializeTabView_();
  var oldSelected = this.tabView_.selectedTabItem();
  var newSelected = this.chooseUnselectedTabItem_();
  this.tabView_.selectTabItem(newSelected);
  expectFalse(oldSelected.isSelected);
  expectTrue(newSelected.isSelected);
};

TabViewTest.prototype.testRemoveTabItem = function() {
  this.initializeTabView_();
  var tab = this.chooseUnselectedTabItem_();
  this.tabView_.removeTabItem(tab);
  expectEq(null, tab.tabView);
  expectThat(this.parent_, withText(not(hasSubstr(tab.getTitle()))));
};

TabViewTest.prototype.testRemoveSelectedTabItem = function() {
  this.initializeTabView_();
  var tab = this.chooseRandomTabItem_();
  this.tabView_.selectTabItem(tab);
  this.tabView_.removeTabItem(tab);
  expectEq(null, tab.tabView);
  expectThat(this.parent_, withText(not(hasSubstr(tab.getTitle()))));
  // Verifies that a new tab was selected
  expectTrue(this.tabView_.selectedTabItem());
};

TabViewTest.prototype.testSetTabEnabled = function() {
  this.initializeTabView_();
  var tab = this.tabView_.selectedTabItem();
  var tabIndex = this.tabs_.indexOf(tab);
  tab.setIsEnabled(false);
  expectThat(allDescendantsOf(this.tabBarElem_, withClass(TAB_CLASS))[tabIndex],
             withClass(DISABLED_TAB_CLASS));
  expectTrue(this.tabView_.selectedTabItem());
  // Do not use expectNe() here; it will force the tabs to stringify, which
  // takes long enough to provoke a timeout
  expectTrue(tab !== this.tabView_.selectedTabItem());
  tab.setIsEnabled(true);
  expectNoDescendantOf(this.tabBarElem_, withClass(DISABLED_TAB_CLASS));
};

TabViewTest.prototype.testSelectedTabItem = function() {
  this.initializeTabView_();
  var tab = this.chooseRandomTabItem_();
  this.tabView_.selectTabItem(tab);
  // Do not use expectEq() here; it will force the tabs to stringify, which
  // takes long enough to provoke a timeout.
  expectTrue(tab === this.tabView_.selectedTabItem());
};
