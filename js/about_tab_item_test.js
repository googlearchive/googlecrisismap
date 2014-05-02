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

goog.require('cm.TestBase');
goog.require('cm.ToolbarView');
goog.require('cm.css');

goog.require('goog.module');

function AboutTabItemTest() {
  cm.TestBase.call(this);
  this.mapModel_ = cm.MapModel.newFromMapRoot({});
  this.appState_ = new cm.AppState();
}
AboutTabItemTest.prototype = new cm.TestBase();
registerTestSuite(AboutTabItemTest);

AboutTabItemTest.prototype.createAboutTabItem_ = function(
    title, opt_desc, opt_config) {
  title = title || 'AboutTabItemTest';
  this.mapModel_.set('title', title);
  if (opt_desc) {
    this.mapModel_.set('description', opt_desc);
  } else {
    this.mapModel_.set(
        'description',
        cm.Html.fromSanitizedHtml('AboutTabItemTest - dummy description'));
  }
  return new cm.AboutTabItem(this.mapModel_, this.appState_, opt_config || {});
};

AboutTabItemTest.prototype.testCreation = function() {
  var titleStr = 'AboutTabItemTest';
  var descStr = 'AboutTabItemTest.prototype.testCreation';
  var about = this.createAboutTabItem_(
      titleStr, cm.Html.fromSanitizedHtml(descStr), {});
  var content = about.getContent();
  expectDescendantOf(content, withText(hasSubstr(titleStr)));
  expectDescendantOf(content, withText(hasSubstr(descStr)));
};

AboutTabItemTest.prototype.testCreation_editingEnabled = function() {
  // Avoids the async load of the edit module.
  goog.module.provide('edit', 'cm.ToolbarView', cm.ToolbarView);
  var about = this.createAboutTabItem_(
      'AboutTabItemTest.testCreation', null,
      {'draft_mode': true, 'enable_editing': true});
  expectDescendantOf(about.getContent(), withText(cm.MSG_RESET_VIEW_LINK));
};

/** Tests that the 'reset view' link is present and works. */
AboutTabItemTest.prototype.testResetViewLink = function() {
  var about = this.createAboutTabItem_('testResetViewLink');
  var link = expectDescendantOf(about.getContent(),
                                withText(cm.MSG_RESET_VIEW_LINK));
  this.expectLogAction(cm.Analytics.AboutTabAction.VIEW_RESET, null);
  this.expectEvent(cm.app, cm.events.RESET_VIEW);
  cm.events.emit(link, 'click');
};

/** Tests that the displayed description updates when the map model updates. */
AboutTabItemTest.prototype.testDescriptionUpdates = function() {
  var about = this.createAboutTabItem_('testDescriptionUpdates');
  var newDescStr = 'New description';
  expectNoDescendantOf(about.getContent(), withText(hasSubstr(newDescStr)));
  this.mapModel_.set('description', cm.Html.fromSanitizedHtml(newDescStr));
  expectDescendantOf(about.getContent(), withText(hasSubstr(newDescStr)));
};

/**
 * Tests that the set default view link is not shown by default (because
 * enable_editing is false).
 */
AboutTabItemTest.prototype.testSetDefaultViewHidden = function() {
  var about = this.createAboutTabItem_('testSetDefaultViewHidden');
  expectNoDescendantOf(
      about.getContent(), withText(cm.MSG_SET_DEFAULT_VIEW_LINK));
};

/** Tests the set default view. */
AboutTabItemTest.prototype.testSetDefaultView = function() {
  // Avoids the async load of the toolbar.
  goog.module.provide('edit', 'cm.ToolbarView', cm.ToolbarView);
  var about = this.createAboutTabItem_(
      'testSetDefaultView', null, {'enable_editing': true});
  var link = expectDescendantOf(
      about.getContent(), withText(cm.MSG_SET_DEFAULT_VIEW_LINK));

  var event = undefined;
  cm.events.listen(cm.app, cm.events.DEFAULT_VIEW_SET, function(e) {
    event = e;
  });

  // Modify the app state and set a new default view.
  this.appState_.set('map_type', 'HYBRID');
  cm.events.emit(link, 'click', {});

  // Verify that the old and new app state snapshots are captured.
  expectThat(event.oldDefault, not(isUndefined));
  expectThat(event.newDefault, not(isUndefined));
  expectEq('ROADMAP', event.oldDefault.get('map_type'));
  expectEq('HYBRID', event.newDefault.get('map_type'));
};

AboutTabItemTest.prototype.testAnalyticsSelectionEvent = function() {
  var tabView = new cm.TabView();
  var about1 = this.createAboutTabItem_('testAnalyticsSelectionEvent - tab 1');
  var about2 = this.createAboutTabItem_('testAnalyticsSelectionEvent - tab 2');
  tabView.appendTabItem(about1);
  tabView.appendTabItem(about2);
  tabView.render(cm.ui.create('div'));
  tabView.tabBar_.selectTab(1);
  this.expectLogAction(cm.Analytics.TabPanelAction.ABOUT_TAB_SELECTED, null);

  cm.events.emit(tabView.tabBar_, cm.TabBar.TAB_SELECTED);
};
