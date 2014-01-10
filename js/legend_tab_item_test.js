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

goog.require('cm.LegendTabItem');
goog.require('cm.TestBase');
goog.require('cm.css');

goog.require('goog.module');

var BLUE_LAYER_JSON = {
  id: 'blueLayer',
  title: 'Blue Layer',
  legend: 'The <b>blue</b> legend',
  type: 'KML',
  visibility: 'DEFAULT_ON'
};

var RED_LAYER_JSON = {
  id: 'redLayer',
  title: 'Red Layer',
  legend: 'The <b>red</b> legend',
  visibility: 'DEFAULT_ON',
  type: 'KML'
};

var NO_LEGEND_LAYER_JSON = {
  id: 'noLegendLayer',
  title: 'Layer with no legend',
  visibility: 'DEFAULT_ON',
  type: 'KML'
};

function LegendTabItemTest() {
  cm.TestBase.call(this);
  this.mapModel_ = cm.MapModel.newFromMapRoot(
      {layers: [BLUE_LAYER_JSON, RED_LAYER_JSON, NO_LEGEND_LAYER_JSON]});
  this.appState_ = new cm.AppState();
  this.appState_.setFromMapModel(this.mapModel_);
}
LegendTabItemTest.prototype = new cm.TestBase();
registerTestSuite(LegendTabItemTest);

LegendTabItemTest.prototype.createLegendTabItem_ = function() {
  return new cm.LegendTabItem(
      this.mapModel_, this.appState_, {}, new cm.MetadataModel());
};

LegendTabItemTest.prototype.assertLegendPresent_ = function(
    content, layerJson) {
  expectDescendantOf(content, withText(hasSubstr(layerJson.title)));
  if (layerJson.legend) {
    expectDescendantOf(content, withInnerHtml(sanitize(layerJson.legend)));
  }
};

LegendTabItemTest.prototype.assertLegendAbsent_ = function(content, layerJson) {
  expectNoDescendantOf(content, withText(hasSubstr(layerJson.title)));
};

LegendTabItemTest.prototype.testCreation = function() {
  var legendTabItem = this.createLegendTabItem_();
  var content = legendTabItem.getContent();
  this.assertLegendPresent_(content, BLUE_LAYER_JSON);
  this.assertLegendPresent_(content, RED_LAYER_JSON);
  // The layer is actually present, but hidden
  // TODO(rew): Add test that checks for the cm.css.HIDDEN class
  // which appears on one of the parents.
  this.assertLegendPresent_(content, NO_LEGEND_LAYER_JSON);
};

LegendTabItemTest.prototype.testRemoveLayer = function() {
  var legendTabItem = this.createLegendTabItem_();
  var content = legendTabItem.getContent();
  this.mapModel_.get('layers').removeAt(0);
  this.assertLegendAbsent_(content, BLUE_LAYER_JSON);
};

LegendTabItemTest.prototype.testAddLayer = function() {
  var legendTabItem = this.createLegendTabItem_();
  var content = legendTabItem.getContent();
  var newLayerJson = {
    id: 'testAddLayer',
    title: 'New Layer for testAddLayer',
    legend: 'New legend for testAddLayer',
    type: 'KML',
    visibility: 'DEFAULT_ON'
  };
  var newLayer = cm.LayerModel.newFromMapRoot(newLayerJson);
  this.appState_.setLayerEnabled(newLayerJson.id, true);
  this.mapModel_.get('layers').insertAt(
      2, cm.LayerModel.newFromMapRoot(newLayerJson));
  this.assertLegendPresent_(content, newLayerJson);
};

LegendTabItemTest.prototype.testEnableLayer = function() {
  this.appState_.setLayerEnabled(RED_LAYER_JSON.id, false);
  var legendTabItem = this.createLegendTabItem_();
  var content = legendTabItem.getContent();
  this.assertLegendAbsent_(content, RED_LAYER_JSON);
  this.appState_.setLayerEnabled(RED_LAYER_JSON.id, true);
  this.assertLegendPresent_(content, RED_LAYER_JSON);
};

LegendTabItemTest.prototype.testDisableLayer = function() {
  var legendTabItem = this.createLegendTabItem_();
  this.appState_.setLayerEnabled(BLUE_LAYER_JSON.id, false);
  this.assertLegendAbsent_(legendTabItem.getContent(), BLUE_LAYER_JSON);
};
