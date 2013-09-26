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
  var content = about.getContent();
  expectDescendantOf(content, withClass(cm.css.DRAFT_INDICATOR));
  expectDescendantOf(content, withText(cm.MSG_RESET_VIEW_LINK));
  this.expectEvent(goog.global, cm.events.INSPECT);
  cm.events.emit(
      expectDescendantOf(content, withClass(cm.css.MAP_TITLE)), 'click');
};

/** Tests that the 'reset view' link is present and works. */
AboutTabItemTest.prototype.testResetViewLink = function() {
  var about = this.createAboutTabItem_('testResetViewLink');
  var link = expectDescendantOf(about.getContent(),
                                withText(cm.MSG_RESET_VIEW_LINK));
  this.expectLogAction(cm.Analytics.LayersPanelAction.VIEW_RESET, null);
  this.expectEvent(goog.global, cm.events.RESET_VIEW);
  cm.events.emit(link, 'click');
};

/** Tests that the displayed title updates when the map model updates. */
AboutTabItemTest.prototype.testTitleUpdates = function() {
  var about = this.createAboutTabItem_('testTitleUpdates');
  var newTitle = 'New Title';
  expectNoDescendantOf(
      about.getContent(), withClass(cm.css.MAP_TITLE), withText(newTitle));
  this.mapModel_.set('title', newTitle);
  expectDescendantOf(
      about.getContent(), withClass(cm.css.MAP_TITLE), withText(newTitle));
  expectEq(newTitle, cm.ui.document.title);
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

/**
 * Test that the set default view link is shown when enable_editing is true, and
 * fires the appropriate event.
 */
AboutTabItemTest.prototype.testSetDefaultView = function() {
  // Avoids the async load of the toolbar.
  goog.module.provide('edit', 'cm.ToolbarView', cm.ToolbarView);
  var about = this.createAboutTabItem_(
      'testSetDefaultView', null, {'enable_editing': true});
  var link = expectDescendantOf(
      about.getContent(), withText(cm.MSG_SET_DEFAULT_VIEW_LINK));

  var event = undefined;
  cm.events.listen(goog.global, cm.events.DEFAULT_VIEW_SET, function(e) {
    event = e;
  });
  cm.events.emit(link, 'click', {});
  expectThat(event.oldDefault, not(isUndefined));
  expectThat(event.newDefault, not(isUndefined));
};

/** Tests that if a publisher is present, it is properly displayed. */
AboutTabItemTest.prototype.testPublisherIsDisplayed = function() {
  var publisherString = 'Spiffy the TestBot';
  var about = this.createAboutTabItem_(
      'testPublisherIsDisplayed', null, {'publisher_name': publisherString});
  var publisher =
      expectDescendantOf(about.getContent(), withClass(cm.css.MAP_PUBLISHER));
  expectThat(publisher, withText(hasSubstr(publisherString)));
};
