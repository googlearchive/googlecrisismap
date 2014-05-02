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
goog.require('cm.css');

function MapTabItemTest() {
  cm.TestBase.call(this);
  this.mapModel_ = cm.MapModel.newFromMapRoot({});
  this.appState_ = new cm.AppState();
}
MapTabItemTest.prototype = new cm.TestBase();
registerTestSuite(MapTabItemTest);

MapTabItemTest.prototype.createMapTabItem_ = function(title, opt_config) {
  title = title || 'MapTabItemTest.Title';
  this.mapModel_.set('title', title);
  return new cm.MapTabItem(this.mapModel_, this.appState_, opt_config || {});
};

MapTabItemTest.prototype.testCreation = function() {
  var titleStr = 'TestCreation.Title';
  var item = this.createMapTabItem_(titleStr);
  var content = item.getContent();
  expectDescendantOf(content, withClass('cm-panel-header'));
  expectDescendantOf(content, withClass('cm-map-title'));
  expectDescendantOf(content, withText(hasSubstr(titleStr)));
};

MapTabItemTest.prototype.testCreation_headerHidden = function() {
  var titleStr = 'TestCreation.TitleHidden';
  var item = this.createMapTabItem_(titleStr, {'hide_panel_header': true});
  var content = item.getContent();
  expectNoDescendantOf(content, withClass('cm-map-title'));
  expectNoDescendantOf(content, withText(hasSubstr(titleStr)));
};

MapTabItemTest.prototype.testCreation_editingEnabled = function() {
  var item = this.createMapTabItem_('MapTabItemTest.testCreation',
      {'draft_mode': true, 'enable_editing': true});
  var content = item.getContent();
  expectDescendantOf(content, withClass(cm.css.DRAFT_INDICATOR));
  this.expectEvent(cm.app, cm.events.INSPECT);
  cm.events.emit(
      expectDescendantOf(content, withClass(cm.css.MAP_TITLE)), 'click');
};

/** Tests that the displayed title updates when the map model updates. */
MapTabItemTest.prototype.testTitleUpdates = function() {
  var item = this.createMapTabItem_('testTitleUpdates');
  var newTitle = 'New Title';
  expectNoDescendantOf(
      item.getContent(), withClass(cm.css.MAP_TITLE), withText(newTitle));
  this.mapModel_.set('title', newTitle);
  expectDescendantOf(
      item.getContent(), withClass(cm.css.MAP_TITLE), withText(newTitle));
  expectEq(newTitle, cm.ui.document.title);
};

/** Tests that if a publisher is present, it is properly displayed. */
MapTabItemTest.prototype.testPublisherIsDisplayed = function() {
  // We wish to ensure the sanitizer has been invoked (as opposed to other
  // methods that insert potentially unsafe HTML directly in to the DOM), so we
  // insert a mock that will capture sanitized strings.
  var sanitized = [];
  this.setForTest_('cm.Html.sanitize_', function(x) {
    sanitized.push(x);
    // copied from other tests; we add the asterisks so that sanitized strings
    // are readily identifiable in test output, etc.
    return '*' + x + '*';
  });
  var publisherString = 'Spiffy the TestBot';
  var item = this.createMapTabItem_(
      'testPublisherIsDisplayed', {'publisher_name': publisherString});
  var publisher =
      expectDescendantOf(item.getContent(), withClass(cm.css.MAP_PUBLISHER));
  expectThat(publisher.innerHTML, hasSubstr(publisherString));
  expectThat(sanitized, contains(hasSubstr(publisherString)));
};

/** Tests that the map picker is enabled. */
MapTabItemTest.prototype.testMapPickerEnabled = function() {
  var item = this.createMapTabItem_(
      'testEnabledMapPicker', {'map_picker_items': ['Another Map']});
  expectDescendantOf(item.getContent(), withClass('cm-map-title-picker'));
};

/** Tests that the map picker is disabled. */
MapTabItemTest.prototype.testMapPickerDisabled = function() {
  var item = this.createMapTabItem_(
      'testEnabledMapPicker', {'map_picker_items': []});
  expectNoDescendantOf(item.getContent(), withClass('cm-map-title-picker'));
};
