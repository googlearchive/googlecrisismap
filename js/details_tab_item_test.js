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

goog.require('goog.module');

function DetailsTabItemTest() {
  cm.TestBase.call(this);
  this.mapModel_ = cm.MapModel.newFromMapRoot({});
  this.appState_ = new cm.AppState();
  this.tabItem_ = new cm.DetailsTabItem(this.mapModel_, this.appState_, {});
}
DetailsTabItemTest.prototype = new cm.TestBase();
registerTestSuite(DetailsTabItemTest);


DetailsTabItemTest.prototype.loadFeatureData = function() {
  this.tabItem_.loadFeatureData({
    content: cm.ui.create('div', {}, 'some details about this feature'),
    title: 'title',
    snippet: 'snippet',
    position: new google.maps.LatLng(10, 20)
  });
  var content = this.tabItem_.getContent();
  expectDescendantOf(content, withText('some details about this feature'));
};
