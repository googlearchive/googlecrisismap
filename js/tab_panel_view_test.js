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

function TabPanelViewTest() {
  cm.TestBase.call(this);
  // TODO(rew): This should be shared setup somewhere; need to look at how
  // widespread this kind of initialization is, and extract.
  this.mapDiv_ = new FakeElement('div');
  this.mapModel_ = new google.maps.MVCObject();
  this.metadataModel_ = new google.maps.MVCObject();
  this.appState_ = new cm.AppState();
  this.config_ = {};
}
TabPanelViewTest.prototype = new cm.TestBase();
registerTestSuite(TabPanelViewTest);

TabPanelViewTest.prototype.testCreation = function() {
  var parent = new FakeElement('div');
  var tabPanel = new cm.TabPanelView(
      cm.ui.document.body, parent, this.mapDiv_, this.mapModel_,
      this.metadataModel_, this.appState_, this.config_);

  // For now we just test for the presence of the tab bar.
  expectDescendantOf(parent, withClass('goog-tab-bar'));

  // As the standard tab items are implemented, this test should grow to
  // expect them.
};
