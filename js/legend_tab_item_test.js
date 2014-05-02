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

goog.require('cm.AboutTabItem');
goog.require('cm.ArrangeCommand');
goog.require('cm.CreateLayersCommand');
goog.require('cm.LegendTabItem');
goog.require('cm.TestBase');
goog.require('cm.css');

goog.require('goog.module');


/**
 * Used for the JSON representations of layers.  There are other keys
 * present, but these are the ones used in the test.
 * @typedef {{id: !string, title: string, type: !string, legend: string,
 * visibility: string}}
 */
cm.LayerDescription;

/** @type cm.LayerDescription */
var BLUE_LAYER = {
  id: 'blueLayer',
  title: 'Blue Layer',
  legend: 'The <b>blue</b> legend',
  type: 'KML',
  visibility: 'DEFAULT_ON'
};

/** @type cm.LayerDescription */
var RED_LAYER = {
  id: 'redLayer',
  title: 'Red Layer',
  legend: 'The <b>red</b> legend',
  visibility: 'DEFAULT_ON',
  type: 'KML'
};

/** @type cm.LayerDescription */
var NO_LEGEND_LAYER = {
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


/**
 * Helper that creates a legend tab.
 * @param {string} uniqueId A unique string to be added to layer IDs; typically
 *     the name of the calling function.  Because LegendViews are uniqued by ID,
 *     adding a unique string to the layer IDs guarantees a new LegendView.
 * @param {Array.<cm.LayerDescription>=} opt_layerDescs An optional list of
 *     descriptions of layers; if omitted, the list
 *     [BLUE_LAYER, RED_LAYER, NO_LEGEND_LAYER] (see above)
 *     will be used.
 * @return {cm.LegendTabItem} The created legend tab.
 * @private
 */
LegendTabItemTest.prototype.createLegendTabItem_ = function(
    uniqueId, opt_layerDescs) {
  if (opt_layerDescs) {
    this.layerDescs_ = opt_layerDescs;
  } else {
    var blueLayer = this.duplicateJson(
        BLUE_LAYER, {id: BLUE_LAYER.id + '_' + uniqueId});
    var redLayer = this.duplicateJson(
        RED_LAYER, {id: RED_LAYER.id + '_' + uniqueId});
    var noLegendLayer = this.duplicateJson(
        NO_LEGEND_LAYER, {id: NO_LEGEND_LAYER.id + '_' + uniqueId});
    this.layerDescs_ = [blueLayer, redLayer, noLegendLayer];
  }
  this.mapModel_ = cm.MapModel.newFromMapRoot({layers: this.layerDescs_});
  this.appState_.setFromMapModel(this.mapModel_);
  return new cm.LegendTabItem(
      this.mapModel_, this.appState_, {}, new cm.MetadataModel());
};


/**
 * Helper that returns the legend box for the given layer from the
 * provided content.
 * @param {!Element} content The rendered content of a legend tab.
 * @param {!cm.LayerDescription} layerDesc The description of the layer whose
 *     legend is sought.
 * @return {Element} The legend box containing the sought-after legend, or
 *     null if not found.
 * @private
 */
LegendTabItemTest.prototype.getLegendElem_ = function(content, layerDesc) {
  var titleElem = findDescendantOf(
      content, withText(hasSubstr(layerDesc.title)));
  if (!titleElem) return null;
  return findAncestorOf(titleElem, withClass(cm.css.TABBED_LEGEND_BOX));
};


/**
 * Helper that asserts that the legend for the given layer is visible
 * in the legend tab.
 * @param {!Element} content The rendered content of a legend tab.
 * @param {!cm.LayerDescription} layerDesc The description of the layer whose
 *     legend should be present.
 * @private
 */
LegendTabItemTest.prototype.assertLegendPresent_ = function(
    content, layerDesc) {
  var legendElem = this.getLegendElem_(content, layerDesc);
  expectDescendantOf(legendElem, withText(hasSubstr(layerDesc.title)));
  if (layerDesc.legend) {
    expectDescendantOf(legendElem, withInnerHtml(sanitize(layerDesc.legend)));
  }
  expectThat(legendElem, isShown());
};


/**
 * Helper that asserts that the legend for the given layer is not visible
 * in the legend tab.
 * @param {!Element} content The rendered content of a legend tab.
 * @param {!cm.LayerDescription} layerDesc The description of the layer whose
 *     legend should be absent.
 * @private
 */
LegendTabItemTest.prototype.assertLegendAbsent_ = function(content, layerDesc) {
  var legendElem = this.getLegendElem_(content, layerDesc);
  expectThat(legendElem, anyOf([isNull, not(isShown())]));
};


/**
 * Helper that asserts that the first visible legend carries the
 * FIRST_TABBED_LEGEND_BOX CSS class.
 * @param {!Element} content The rendered content of a legend tab.
 * @private
 */
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


/** Verifies that at creation, the legend tab matches the state of the map. */
LegendTabItemTest.prototype.testCreation = function() {
  var legendTabItem = this.createLegendTabItem_('testCreation');
  var content = legendTabItem.getContent();
  this.assertLegendPresent_(content, this.layerDescs_[0]);
  this.assertLegendPresent_(content, this.layerDescs_[1]);
  this.assertLegendAbsent_(content, this.layerDescs_[2]);
  this.assertCorrectBoxMarkedFirst_(content);
  expectTrue(legendTabItem.getIsEnabled());
  expectDescendantOf(content, withText(cm.MSG_OPEN_LAYERS_TAB_LINK));
};


/** Verifies that removing a layer also removes its legend. */
LegendTabItemTest.prototype.testRemoveLayer = function() {
  var legendTabItem = this.createLegendTabItem_('testRemoveLayer');
  var content = legendTabItem.getContent();
  this.mapModel_.get('layers').removeAt(0);
  this.assertLegendAbsent_(content, this.layerDescs_[0]);
  this.assertCorrectBoxMarkedFirst_(content);
};


/** Verifies that adding a layer also adds its legend. */
LegendTabItemTest.prototype.testAddLayer = function() {
  var legendTabItem = this.createLegendTabItem_('testAddLayer');
  var content = legendTabItem.getContent();
  var newLayerDescription = {
    id: 'testAddLayer',
    title: 'New Layer for testAddLayer',
    legend: 'New legend for testAddLayer',
    type: 'KML',
    visibility: 'DEFAULT_ON'
  };
  this.appState_.setLayerEnabled(newLayerDescription.id, true);
  this.mapModel_.get('layers').insertAt(
      2, cm.LayerModel.newFromMapRoot(newLayerDescription));
  this.assertLegendPresent_(content, newLayerDescription);
};


/** Verifies that enabling a layer adds its legend. */
LegendTabItemTest.prototype.testEnableLayer = function() {
  // We need to pre-disable one of the layers, so we must construct
  // this.layerDescs_ ourselves
  var blueLayer = this.duplicateJson(
      BLUE_LAYER, {id: BLUE_LAYER.id + '_testEnableLayer'});
  var redLayer = this.duplicateJson(
      RED_LAYER,
      {id: RED_LAYER.id + '_testEnableLayer', visibility: 'DEFAULT_OFF'});
  var legendTabItem = this.createLegendTabItem_(
      'testEnableLayer', [blueLayer, redLayer]);
  var content = legendTabItem.getContent();
  this.assertLegendAbsent_(content, this.layerDescs_[1]);
  this.appState_.setLayerEnabled(redLayer.id, true);
  this.assertLegendPresent_(content, this.layerDescs_[1]);
  this.assertCorrectBoxMarkedFirst_(content);
};


/** Verifies that disabling a layer removes its legend. */
LegendTabItemTest.prototype.testDisableLayer = function() {
  var legendTabItem = this.createLegendTabItem_('testDisableLayer');
  this.appState_.setLayerEnabled(this.layerDescs_[0].id, false);
  this.assertLegendAbsent_(legendTabItem.getContent(), this.layerDescs_[0]);
  this.assertCorrectBoxMarkedFirst_(legendTabItem.getContent());
};


/**
 * Verifies the legend tab is disabled if there are no layers enabled
 * that contain legends.
 */
LegendTabItemTest.prototype.testTabDisabledWhenNoContent = function() {
  var legendTabItem = this.createLegendTabItem_('testTabDisabledWhenNoContent');
  this.appState_.setLayerEnabled(this.layerDescs_[0].id, false);
  this.appState_.setLayerEnabled(this.layerDescs_[1].id, false);
  expectFalse(legendTabItem.getIsEnabled());
};


/** Verifies selecting the legend tab triggers the correct analytics log. */
LegendTabItemTest.prototype.testAnalyticsSelectionEvent = function() {
  var legendTabItem = this.createLegendTabItem_('testAnalyticsSelectionEvent');
  var aboutTabItem = new cm.AboutTabItem(this.mapModel_, this.appState_, {});
  var tabView = new cm.TabView();
  tabView.appendTabItem(aboutTabItem);
  tabView.appendTabItem(legendTabItem);
  tabView.render(cm.ui.create('div'));
  this.expectLogAction(cm.Analytics.TabPanelAction.LEGEND_TAB_SELECTED, null);

  tabView.tabBar_.selectTab(1);
  cm.events.emit(tabView.tabBar_, cm.TabBar.TAB_SELECTED);
};


/** Verifies the tab is enabled after the first layer is added. */
LegendTabItemTest.prototype.testEnabledAddingFirstLayer = function() {
  var legendTabItem = this.createLegendTabItem_('AddingFirstLayer', []);
  expectFalse(legendTabItem.getIsEnabled());
  // We would do this by emitting the NEW_LAYER event, but that would require
  // bringing up the edit presenter.  Instead, we simulate the behavior
  // of the edit presenter.
  /** @type cm.LayerDescription */
  var newLayerDescription = {
    id: 'firstLayer',
    title: 'The first layer',
    legend: 'A legend',
    type: 'KML'
  };
  var cmd = new cm.CreateLayersCommand([newLayerDescription]);
  cmd.execute(this.appState_, this.mapModel_);
  expectTrue(legendTabItem.getIsEnabled());
};


/** Verifies the tab is well-formed after an ArrangeCommand. */
LegendTabItemTest.prototype.testArrangeLayers = function() {
  var blueLayer = this.duplicateJson(
      BLUE_LAYER, {id: BLUE_LAYER.id + '_testArrangeLayers'});
  var redLayer = this.duplicateJson(
      RED_LAYER, {id: RED_LAYER.id + '_testArrangeLayers'});
  var lockedFolder = {
    id: 'lockedFolder',
    title: 'Locked Folder',
    visibility: 'DEFAULT_ON',
    type: 'FOLDER',
    list_item_type: 'CHECK_HIDE_CHILDREN'
  };
  var legendTabItem = this.createLegendTabItem_(
      'testArrangeLayers', [blueLayer, redLayer, lockedFolder]);
  var cmd = new cm.ArrangeCommand(
      [
        {id: blueLayer.id},
        {id: redLayer.id},
        {id: lockedFolder.id, sublayerIds: []}
      ], [
        {id: lockedFolder.id, sublayerIds:
         [
           {id: redLayer.id},
           {id: blueLayer.id}
         ]}
      ]);
  cmd.execute(this.appState_, this.mapModel_);
  var content = legendTabItem.getContent();
  var folderElem = this.getLegendElem_(content, lockedFolder);
  expectNoDescendantOf(folderElem, withText(hasSubstr(blueLayer.title)));
  expectDescendantOf(folderElem, withInnerHtml(sanitize(blueLayer.legend)));
  expectNoDescendantOf(folderElem, withText(hasSubstr(redLayer.title)));
  expectDescendantOf(folderElem, withInnerHtml(sanitize(redLayer.legend)));
  this.assertCorrectBoxMarkedFirst_(content);
};


/** Verifies the tab is well-formed after two subsequent ArrangeCommands. */
LegendTabItemTest.prototype.testArrangeLayersTwice = function() {
  var blueLayer = this.duplicateJson(
      BLUE_LAYER, {id: BLUE_LAYER.id + '_testArrangeLayersTwice'});
  var redLayer = this.duplicateJson(
      RED_LAYER, {id: RED_LAYER.id + '_testArrangeLayersTwice'});
  var lockedFolder = {
    id: 'lockedFolder_testArrangeLayersTwice',
    title: 'Locked Folder',
    visibility: 'DEFAULT_ON',
    type: 'FOLDER',
    list_item_type: 'CHECK_HIDE_CHILDREN'
  };
  var legendTabItem = this.createLegendTabItem_(
      'testArrangeLayers', [blueLayer, redLayer, lockedFolder]);

  var cmd = new cm.ArrangeCommand([
    {id: blueLayer.id},
    {id: redLayer.id},
    {id: lockedFolder.id, sublayerIds: []}
  ], [
    {id: lockedFolder.id, sublayerIds: [{id: redLayer.id}, {id: blueLayer.id}]}
  ]);
  cmd.execute(this.appState_, this.mapModel_);

  var cmd2 = new cm.ArrangeCommand([
    {id: lockedFolder.id, sublayerIds: [{id: redLayer.id}, {id: blueLayer.id}]}
  ], [
    {id: blueLayer.id},
    {id: lockedFolder.id, sublayerIds: [{id: redLayer.id}]}
  ]);
  cmd2.execute(this.appState_, this.mapModel_);
  var content = legendTabItem.getContent();
  expectDescendantOf(content, withText(hasSubstr(blueLayer.title)));
  this.assertCorrectBoxMarkedFirst_(content);
};

LegendTabItemTest.prototype.testOpenLayersTabLink = function() {
  var legendTabItem = this.createLegendTabItem_('testOpenLayersTabLink');
  var link = expectDescendantOf(
      legendTabItem.getContent(), withText(cm.MSG_OPEN_LAYERS_TAB_LINK));
  this.expectEvent(legendTabItem, cm.events.OPEN_LAYERS_TAB);
  cm.events.emit(link, 'click');
};
