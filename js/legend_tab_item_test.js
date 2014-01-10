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
  this.appState_ = new cm.AppState();
}
LegendTabItemTest.prototype = new cm.TestBase();
registerTestSuite(LegendTabItemTest);

LegendTabItemTest.prototype.createLegendTabItem_ = function(
    uniqueId, opt_layerJsons) {
  if (opt_layerJsons) {
    this.layerJsons_ = opt_layerJsons;
  } else {
    var blueLayer = this.duplicateJson(
        BLUE_LAYER_JSON, {id: BLUE_LAYER_JSON.id + '_' + uniqueId});
    var redLayer = this.duplicateJson(
        RED_LAYER_JSON, {id: RED_LAYER_JSON.id + '_' + uniqueId});
    var noLegendLayer = this.duplicateJson(
        NO_LEGEND_LAYER_JSON, {id: NO_LEGEND_LAYER_JSON.id + '_' + uniqueId});
    this.layerJsons_ = [blueLayer, redLayer, noLegendLayer];
  }
  this.mapModel_ = cm.MapModel.newFromMapRoot({layers: this.layerJsons_});
  this.appState_.setFromMapModel(this.mapModel_);
  return new cm.LegendTabItem(
      this.mapModel_, this.appState_, {}, new cm.MetadataModel());
};

LegendTabItemTest.prototype.getLegendElem_ = function(content, layerJson) {
  var titleElem = findDescendantOf(
      content, withText(hasSubstr(layerJson.title)));
  if (!titleElem) return null;
  return findAncestorOf(titleElem, withClass(cm.css.TABBED_LEGEND_BOX));
};

LegendTabItemTest.prototype.assertLegendPresent_ = function(
    content, layerJson) {
  var legendElem = this.getLegendElem_(content, layerJson);
  expectDescendantOf(legendElem, withText(hasSubstr(layerJson.title)));
  if (layerJson.legend) {
    expectDescendantOf(legendElem, withInnerHtml(sanitize(layerJson.legend)));
  }
  expectThat(legendElem, isShown());
};

LegendTabItemTest.prototype.assertLegendAbsent_ = function(content, layerJson) {
  var legendElem = this.getLegendElem_(content, layerJson);
  expectThat(legendElem, anyOf([isNull, not(isShown())]));
};

LegendTabItemTest.prototype.assertCorrectBoxMarkedFirst_ = function(content) {
  var legendBoxes = allDescendantsOf(
    content, withClass(cm.css.TABBED_LEGEND_BOX));
  var firstBoxSeen = false;
  for (i = 0; i < legendBoxes.length; i++) {
    var box = legendBoxes[i];
    if (!isShown().predicate(box)) continue;
    if (firstBoxSeen) {
      expectThat(box, not(withClass(cm.css.FIRST_TABBED_LEGEND_BOX)));
    } else {
      expectThat(box, withClass(cm.css.FIRST_TABBED_LEGEND_BOX));
      firstBoxSeen = true;
    }
  }
};

LegendTabItemTest.prototype.testCreation = function() {
  var legendTabItem = this.createLegendTabItem_('testCreation');
  var content = legendTabItem.getContent();
  this.assertLegendPresent_(content, this.layerJsons_[0]);
  this.assertLegendPresent_(content, this.layerJsons_[1]);
  this.assertLegendAbsent_(content, this.layerJsons_[2]);
  this.assertCorrectBoxMarkedFirst_(content);
  expectTrue(legendTabItem.getIsEnabled());
};

LegendTabItemTest.prototype.testRemoveLayer = function() {
  var legendTabItem = this.createLegendTabItem_('testRemoveLayer');
  var content = legendTabItem.getContent();
  this.mapModel_.get('layers').removeAt(0);
  this.assertLegendAbsent_(content, this.layerJsons_[0]);
  this.assertCorrectBoxMarkedFirst_(content);
};

LegendTabItemTest.prototype.testAddLayer = function() {
  var legendTabItem = this.createLegendTabItem_('testAddLayer');
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
  // We need to pre-disable one of the layers, so we must construct
  // this.layerJsons_ ourselves
  var blueLayer = this.duplicateJson(
        BLUE_LAYER_JSON, {id: BLUE_LAYER_JSON.id + '_testEnableLayer'});
  var redLayer = this.duplicateJson(
      RED_LAYER_JSON, {id: RED_LAYER_JSON.id + '_testEnableLayer',
                       visibility: 'DEFAULT_OFF'});
  var legendTabItem = this.createLegendTabItem_(
      'testEnableLayer', [blueLayer, redLayer]);
  var content = legendTabItem.getContent();
  this.assertLegendAbsent_(content, this.layerJsons_[1]);
  this.appState_.setLayerEnabled(redLayer.id, true);
  this.assertLegendPresent_(content, this.layerJsons_[1]);
  this.assertCorrectBoxMarkedFirst_(content);
};

LegendTabItemTest.prototype.testDisableLayer = function() {
  var legendTabItem = this.createLegendTabItem_('testDisableLayer');
  this.appState_.setLayerEnabled(this.layerJsons_[0].id, false);
  this.assertLegendAbsent_(legendTabItem.getContent(), this.layerJsons_[0]);
  this.assertCorrectBoxMarkedFirst_(legendTabItem.getContent());
};

LegendTabItemTest.prototype.testTabDisabledWhenNoContent = function() {
  var legendTabItem = this.createLegendTabItem_('testTabDisabledWhenNoContent');
  this.appState_.setLayerEnabled(this.layerJsons_[0].id, false);
  this.appState_.setLayerEnabled(this.layerJsons_[1].id, false);
  expectFalse(legendTabItem.getIsEnabled());
};
