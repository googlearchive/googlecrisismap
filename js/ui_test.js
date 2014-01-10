// Copyright 2012 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

function UiTest() {
  cm.TestBase.call(this);
}
UiTest.prototype = new cm.TestBase();
registerTestSuite(UiTest);

// The following functions aren't tested here because they abstract DOM
// operations for the purpose of testing:
//     cm.ui.create
//     cm.ui.clear
//     cm.ui.remove
//     cm.ui.append
//     cm.ui.get
//     cm.ui.getByClass
//     cm.ui.getAllByClass
//     cm.ui.getAllByTag
//     cm.ui.getText
//     cm.ui.setText

UiTest.prototype.testLegibleTextColor = function() {
  expectEq('#000', cm.ui.legibleTextColor('#fff'));
  expectEq('#fff', cm.ui.legibleTextColor('#000'));

  // green is brighter than red or blue
  expectEq('#000', cm.ui.legibleTextColor('#0f0'));
  expectEq('#fff', cm.ui.legibleTextColor('#f00'));
  expectEq('#fff', cm.ui.legibleTextColor('#00f'));
};
