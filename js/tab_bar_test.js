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

function TabBarTest() {
  cm.TestBase.call(this);
}
TabBarTest.prototype = new cm.TestBase();
registerTestSuite(TabBarTest);

TabBarTest.prototype.testRender = function() {
  var parent = cm.ui.create('div');
  var tabBar = new cm.TabBar();
  tabBar.render(parent);

  var tabs = expectDescendantOf(parent, withClass(cm.css.TAB_BAR_CONTAINER));
  var buttons = expectDescendantOf(tabs, withClass(cm.css.TAB_BAR_BUTTONS));
};
