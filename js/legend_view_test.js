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

goog.require('cm.LayerModel');
goog.require('cm.LegendView');
goog.require('cm.MetadataModel');
goog.require('cm.TestBase');
goog.require('cm.css');

goog.require('goog.json');
goog.require('goog.module');
goog.require('goog.object');

var SIMPLE_LAYER_JSON = {
  id: 'simpleLayer',
  title: 'Simple Layer',
  legend: 'Simple Legend',
  visibility: 'DEFAULT_ON',
  type: 'KML'
};

var MIN_ZOOM = 5;
var MAX_ZOOM = 10;
var SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON = {
  id: 'simpleLayerWithZoomBounds',
  title: 'Simple Layer with Zoom Bounds',
  legend: 'Zoom Bounds Legend',
  visibility: 'DEFAULT_ON',
  type: 'KML',
  min_zoom: MIN_ZOOM,
  max_zoom: MAX_ZOOM
};

var NO_LEGEND_LAYER_JSON = {
  id: 'noLegend',
  title: 'Layer with no legend',
  visibility: 'DEFAULT_ON',
  type: 'KML'
};

function SimpleLegendViewTest() {
  cm.TestBase.call(this);
  this.metadataModel_ = new cm.MetadataModel();
}
SimpleLegendViewTest.prototype = new cm.TestBase();
registerTestSuite(SimpleLegendViewTest);

/**
 * Uses the passed json to create a map with a single layer, creates a
 * map model and app state from that, then creates and returns the legend
 * view for the single layer.
 * @param {Object} json The json description of the single layer
 * @param {string} uniqueId A string that can be used to salt the layer's ID
 *   so that multiple tests can share the same pre-canned JSON.
 * @return {cm.LegendView} The legend view for the one layer in the map.
 * @private
 */
SimpleLegendViewTest.prototype.createLegendView_ = function(json, uniqueId) {
  // Need to modify the id to guarantee we get a fresh legend view; otherwise
  // getLegendViewForLayer() will not build a new legend view.
  var layerJson = this.fromTemplateJson(json, uniqueId);
  this.mapModel_ = cm.MapModel.newFromMapRoot({layers: [layerJson]});
  this.appState_ = new cm.AppState();
  this.appState_.setFromMapModel(this.mapModel_);
  this.layerModel_ = this.mapModel_.get('layers').getAt(0);
  return cm.LegendView.getLegendViewForLayer(
      this.layerModel_, this.metadataModel_, this.appState_);
};

/**
 * Verifies that the rendered DOM matches the model in this.layerModel_.
 * @param {Element} legendBox The element that contains the legend for the
 *   layer; should carry the cm.css.TABBED_LEGEND_BOX class
 * @private
 */
SimpleLegendViewTest.prototype.validateRenderingMatchesLayerModel_ = function(
    legendBox) {
  expectThat(legendBox, withClass(cm.css.TABBED_LEGEND_BOX));
  expectThat(legendBox, not(withClass(cm.css.HIDDEN)));
  expectDescendantOf(legendBox, withText(this.layerModel_.get('title')));
  expectDescendantOf(
      legendBox, withInnerHtml(this.layerModel_.get('legend').getHtml()));
};

SimpleLegendViewTest.prototype.testGetContent = function() {
  var legendView = this.createLegendView_(SIMPLE_LAYER_JSON, 'testGetContent');
  this.validateRenderingMatchesLayerModel_(legendView.getContent());
};

SimpleLegendViewTest.prototype.testHiddenWhenNoLegend = function() {
  var legendView = this.createLegendView_(
      NO_LEGEND_LAYER_JSON, 'testHiddenWhenNoLegend');
  expectThat(legendView.getContent(), withClass(cm.css.HIDDEN));
};

SimpleLegendViewTest.prototype.testHidesOnZoomChange = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON, 'testHidesOnZoomChange');
  var content = legendView.getContent();
  this.validateRenderingMatchesLayerModel_(content);
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED,
                 {zoom: SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON.min_zoom - 1});
  expectThat(content, withClass(cm.css.HIDDEN));
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED,
                 {zoom: SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON.min_zoom + 1});
  expectThat(content, not(withClass(cm.css.HIDDEN)));
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED,
                {zoom: SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON.max_zoom + 1});
  expectThat(content, withClass(cm.css.HIDDEN));
};

SimpleLegendViewTest.prototype.testUpdateOnModelZoomChange = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON, 'testUpdateOnModelZoomChange');
  var content = legendView.getContent();
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED,
                 {zoom: SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON.min_zoom + 1});
  expectThat(content, not(withClass(cm.css.HIDDEN)));
  this.layerModel_.set(
      'min_zoom', SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON.min_zoom + 2);
  expectThat(content, withClass(cm.css.HIDDEN));
};

SimpleLegendViewTest.prototype.testUpdateOnModelZoomSet = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_JSON, 'testUpdateOnModelAddsZoomBounds');
  var content = legendView.getContent();
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED, {zoom: 3});
  expectThat(content, not(withClass(cm.css.HIDDEN)));
  this.layerModel_.set('min_zoom', 5);
  expectThat(content, withClass(cm.css.HIDDEN));
};

SimpleLegendViewTest.prototype.testUpdatesOnTitleChange = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_JSON, 'testUpdatesOnTitleChange');
  // Force render before the title changes
  var content = legendView.getContent();
  this.layerModel_.set('title', 'testUpdatesOnTitleChange');
  this.validateRenderingMatchesLayerModel_(content);
};

SimpleLegendViewTest.prototype.testUpdatesOnLegendChange = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_JSON, 'testUpdatesOnLegendChange');
  // Force render before the title changes
  var content = legendView.getContent();
  this.layerModel_.set(
      'legend', cm.Html.fromSanitizedHtml('<b>testUpdatesOnLegendChange</b>'));
  this.validateRenderingMatchesLayerModel_(content);
};

SimpleLegendViewTest.prototype.testUpdatesOnMetadataChange = function() {
  var newJson = this.duplicateJson(
      SIMPLE_LAYER_JSON,
      {source: {kml: {url: 'http://testUpdatesOnMetadataChange.google.com'}}});
  var legendView = this.createLegendView_(
      newJson, 'testUpdatesOnMetadataChange');
  var content = legendView.getContent();
  this.validateRenderingMatchesLayerModel_(content);
  this.metadataModel_.set(this.layerModel_.getSourceAddress(),
                         {has_no_features: true});
  expectThat(content, withClass(cm.css.HIDDEN));
};

SimpleLegendViewTest.prototype.testUpdatesMetadataListener = function() {
  var newJson = this.duplicateJson(
      SIMPLE_LAYER_JSON, {source: {kml: {url: 'http://origurl.google.com'}}});
  var legendView = this.createLegendView_(
      newJson, 'testUpdatesMetadataListener');
  this.metadataModel_.set(this.layerModel_.getSourceAddress(),
                          {has_no_features: true});
  var content = legendView.getContent();
  expectThat(content, withClass(cm.css.HIDDEN));
  this.layerModel_.set('url', 'http://newurl.google.com');
  expectThat(content, not(withClass(cm.css.HIDDEN)));
  // Ensure we are really listening to the new source URL
  this.metadataModel_.set(this.layerModel_.getSourceAddress(),
                          {has_no_features: true});
  expectThat(content, withClass(cm.css.HIDDEN));
};

SimpleLegendViewTest.prototype.testLegendChangesReflectedInView = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_JSON, 'testLegendChangesReflectedInView');
  // Force rendering prior to changing the legend
  var content = legendView.getContent();
  this.layerModel_.set(
      'legend', new cm.Html('<b>New legend</b> for you!<br/>'));
  this.validateRenderingMatchesLayerModel_(content);
};

SimpleLegendViewTest.prototype.testGetContentRespectsIsFirstFlag = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_JSON, 'testGetContentRespectsIsFirstFlag');
  var content = legendView.getContent();
  expectThat(content, not(withClass(cm.css.FIRST_TABBED_LEGEND_BOX)));
  content = legendView.getContent(true);
  expectThat(content, withClass(cm.css.FIRST_TABBED_LEGEND_BOX));
};

var FOLDER_LAYER_JSON = {
  id: 'folderLayer',
  title: 'Folder Layer',
  legend: 'Folder Legend',
  visibility: 'DEFAULT_ON',
  type: 'FOLDER',
  subtype: 'UNLOCKED'
};

var RED_LAYER_JSON = {
  id: 'redLayer',
  title: 'Red Layer',
  legend: 'Red</br>Crimson</br>',
  visibility: 'DEFAULT_ON',
  type: 'KML'
};

var BLUE_LAYER_JSON = {
  id: 'blueLayer',
  title: 'Blue Layer',
  legend: 'Blue</br>Navy</br>',
  visibility: 'DEFAULT_ON',
  type: 'KML'
};

function FolderLegendViewTest() {
  cm.TestBase.call(this);
  this.metadataModel_ = new cm.MetadataModel();
  this.folderTypeToMaprootType = goog.object.transpose(
      cm.LayerModel.MAPROOT_TO_MODEL_FOLDER_TYPES);
  // unescapeEntities is used to render an en-dash for the title of
  // single-select folders; unfortunately, it relies on the DOM to do so.
  this.setForTest_('goog.string.unescapeEntities', function(s) { return s; });
}
FolderLegendViewTest.prototype = new cm.TestBase();
registerTestSuite(FolderLegendViewTest);

FolderLegendViewTest.prototype.getFolderJson_ = function(
    folderType, uniqueId, sublayerJson) {
  return this.duplicateJson(
      FOLDER_LAYER_JSON,
      {
        id: FOLDER_LAYER_JSON.id + '-' + uniqueId,
        list_item_type: this.folderTypeToMaprootType[folderType],
        sublayers: sublayerJson
      });
};

/**
 * Puts together the scaffolding necessary to produce a legend view of a folder.
 * By default, creates a folder containing the red layer, the no-legend layer,
 * and the blue layer, in that order.  Sets this.mapModel_ and this.appState_,
 * to the map model and app state used to bring up the scaffolding.  Sets
 * this.layerModel_ to hold the layer model for the newly created folder.
 * @param {cm.LayerModel.FOLDER_TYPE} folderType The type of folder desired.
 * @param {string} uniqueId A string that can be used to salt the layer
 *   ids so they will be unique across all tests; typically the name of
 *   the test itself.
 * @param {Array.<Object>=} opt_sublayerJson An array of the JSON descriptions
 *   of sublayers to be used in place of the default [red, noLegend, blue]
 *   sublayer list.
 * @return {cm.LegendView} The legend view created for the folder layer.
 * @private
 */
FolderLegendViewTest.prototype.createLegendView_ = function(
    folderType, uniqueId, opt_sublayerJson) {
  // Need to modify the id to guarantee we get a fresh legend view; otherwise
  // getLegendViewForLayer() will not build a new legend view.
  var sublayerJson = opt_sublayerJson || [
    this.fromTemplateJson(RED_LAYER_JSON, uniqueId),
    this.fromTemplateJson(NO_LEGEND_LAYER_JSON, uniqueId),
    this.fromTemplateJson(BLUE_LAYER_JSON, uniqueId)];

  this.folderJson_ = this.getFolderJson_(folderType, uniqueId, sublayerJson);
  this.mapModel_ = cm.MapModel.newFromMapRoot({layers: [this.folderJson_]});
  this.appState_ = new cm.AppState();
  this.appState_.setFromMapModel(this.mapModel_);
  this.layerModel_ = this.mapModel_.get('layers').getAt(0);
  return cm.LegendView.getLegendViewForLayer(
      this.layerModel_, this.metadataModel_, this.appState_);
};

/**
 * Validates the render of a legend against the layer that produced it.
 * @param {Element} contentElem The element containing the rendered legend.
 * @param {cm.LayerModel} layer The model whose legend was rendered.
 * @param {boolean} titleIsVisible Whether the title of the layer should
 *   be visible (this varies based on any containing folders)
 * @param {boolean} isVisible Whether the legend itself should be visible.
 * @param {Array.<string>=} opt_titleComponents A list of title components
 *   to test against, rather than the layer's title.  Useful if the display
 *   title was constructed, rather than derived directly from the layer.
 * @private
 */
FolderLegendViewTest.prototype.validateRender_ = function(
    contentElem, layer, titleIsVisible, isVisible, opt_titleComponents) {
  expectThat(contentElem, withInnerHtml(layer.get('legend').getHtml()));
  expectThat(contentElem, isVisible ? isShown() : not(isShown()));

  // Note box might not be the legend box belonging to layer; it may belong
  // to a folder that layer belongs to.
  var box = expectAncestorOf(contentElem, withClass(cm.css.TABBED_LEGEND_BOX));
  if (titleIsVisible) {
    var title = expectDescendantOf(box, withClass(cm.css.LAYER_TITLE));
    if (opt_titleComponents) {
      goog.array.forEach(opt_titleComponents, function(comp) {
        expectThat(title, withText(hasSubstr(comp)));
      });
    } else {
      expectThat(title, withText(layer.get('title')));
    }
    expectThat(title, isShown());

  } else {
    var title = findDescendantOf(box, withText(layer.get('title')));
    if (title) {
      expectThat(title, not(isShown()));
    }
  }
};

/**
 * Validates the render of a folder that should carry the styling for the
 * first legend in a list.  Most tests below pass isFirst=true to
 * getContent() because that's the more error-prone path.  Having done that
 * those tests should call this.validateIsFirst_() at the end to ensure
 * the rendering maintained the proper "first" behavior (only the first
 * visible legend box carries the FIRST_TABBED_LEGEND_BOX class).  A few
 * tests explicitly make sure the "first" behavior doesn't leak in to rendering
 * if getContent(isFirst=false) is called instead; they use
 * this.validateIsNotFirst_, below.
 * @param {contentElem} The element containing the rendered folder legend.
 * @private
 */
FolderLegendViewTest.prototype.validateIsFirst_ = function(contentElem) {
  var boxes = allDescendantsOf(
      contentElem, withClass(cm.css.TABBED_LEGEND_BOX));
  var foundFirst = false;
  for (var i = 0; i < boxes.length; i++) {
    var box = boxes[i];
    if (foundFirst) {
      expectThat(box, anyOf(
          [not(isShown()), not(withClass(cm.css.FIRST_TABBED_LEGEND_BOX))]));
    } else if (isShown().predicate(box)) {
      expectThat(box, withClass(cm.css.FIRST_TABBED_LEGEND_BOX));
      foundFirst = true;
    }
  }
};

/**
 * Validates the render of a folder that should NOT carry the styling for the
 * first legend in a list.
 * @param {contentElem} The element containing the rendered folder legend.
 * @private
 */
FolderLegendViewTest.prototype.validateIsNotFirst_ = function(contentElem) {
  var boxes = allDescendantsOf(
      contentElem, withClass(cm.css.TABBED_LEGEND_BOX));
  goog.array.forEach(boxes, function(box) {
    expectThat(box, anyOf([not(isShown()),
                           not(withClass(cm.css.FIRST_TABBED_LEGEND_BOX))]));
  });
};

/**
 * Recursive helper function to collect all the sublayers of a given set
 * of layers.
 * @param {Array.<cm.LayerModel>} seedLayers The layers whose sublayers are
 *   being collected.
 * @return {Array.<cm.LayerModel>} The union of seedLayers and all sublayers,
 *   including nested ones.
 * @private
 */
FolderLegendViewTest.collectSublayers_ = function(seedLayers) {
  var result = [];
  goog.array.forEach(seedLayers, function(layer) {
    result.push(layer);
    var sublayers = layer.get('sublayers');
    if (sublayers && sublayers.length) {
      result = goog.array.concat(
          result, FolderLegendViewTest.collectSublayers_(sublayers.getArray()));
    }
  });
  return result;
};

/**
 * Compute this.layerMapping_, which maps layer IDs to their rendered
 * legend content.  This method must be called before legendForId_() and
 * layerForId_() can be called (see below). The details for this.layerMapping_
 * are an internal, private detail between this method, legendForId_ and
 * layerForId_; the agreed format is a mapping from layer IDs to records
 * containing the matching layer model (under the key 'model') and the DOM
 * element for the legend's content (under the key 'content').
 * @param {Element} parentElem The root of the rendered legend content's DOM.
 * @param {string=} opt_idSuffix An optional suffix to strip from layer IDs.
 *   Useful for removing the suffixes that were added to ensure the layer IDs
 *   are unique, so that the ID from the original JSON can be used for lookup.
 * @private
 */
FolderLegendViewTest.prototype.findLayersAndLegends_ = function(
    parentElem, opt_idSuffix) {
  var legendContentDivs = allDescendantsOf(
      parentElem, withClass(cm.css.TABBED_LEGEND_CONTENT));
  var layerModels = FolderLegendViewTest.collectSublayers_([this.layerModel_]);
  var layerMapping = {};

  goog.array.forEach(layerModels, function(layer) {
    for (var i = 0; i < legendContentDivs.length; i++) {
      if (layer.get('legend').getHtml() === legendContentDivs[i].innerHTML) {
        var layerId = layer.get('id');
        if (opt_idSuffix) {
          var suffixLoc = layerId.lastIndexOf(opt_idSuffix);
          if (suffixLoc != -1 &&
              suffixLoc === layerId.length - opt_idSuffix.length) {
            layerId = layerId.substring(0, suffixLoc - 1);
          }
        }
        layerMapping[layerId] = {model: layer, content: legendContentDivs[i]};
        break;
      }
    }
  });
  /** @type {Object.<string, {model: <cm.LayerModel>, content: <Element>}} */
  this.layerMapping_ = layerMapping;
};

/**
 * Returns the DOM element for the specified layer's legend content.
 * findLayersAndLegends_ above must be called before any calls to this method.
 * @param {string} layerId The ID for the layer whose legend is sought.
 * @return {Element} The element that contains the layer's legend content;
 *   if the legend has a legend box, that box can be found by traversing the
 *   ancestors of the returned element.
 * @private
 */
FolderLegendViewTest.prototype.legendForId_ = function(layerId) {
  return this.layerMapping_[layerId].content;
};

/**
 * Returns the model for the specified layer. findLayersAndLegends_ above must
 * be called before any calls to this method.
 * @param {string} layerId The ID for the layer whose model is sought.
 * @return {cm.LayerModel} The layer's model.
 * @private
 */
FolderLegendViewTest.prototype.layerForId_ = function(layerId) {
  return this.layerMapping_[layerId].model;
};

FolderLegendViewTest.prototype.testUnlockedFolderRendering = function() {
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.UNLOCKED, 'testUnlockedFolderRendering');
  var legendElem = legendView.getContent(true);
  this.findLayersAndLegends_(legendElem, 'testUnlockedFolderRendering');

  // Unlocked folders render as if the the folder layer were a sibling of
  // its sublayers.  Each visible layer should get a box and have its
  // title and legend both displayed.
  var folderLegend = this.legendForId_(FOLDER_LAYER_JSON.id);
  this.validateRender_(folderLegend, this.layerModel_, true, true);

  var redLegend = this.legendForId_(RED_LAYER_JSON.id);
  this.validateRender_(
      redLegend, this.layerForId_(RED_LAYER_JSON.id), true, true);

  var emptyLegend = this.legendForId_(NO_LEGEND_LAYER_JSON.id);
  this.validateRender_(
      emptyLegend, this.layerForId_(NO_LEGEND_LAYER_JSON.id),
      false, false);

  var blueLegend = this.legendForId_(BLUE_LAYER_JSON.id);
  this.validateRender_(
      blueLegend, this.layerForId_(BLUE_LAYER_JSON.id), true, true);

  var folderBox = findAncestorOf(
      folderLegend, withClass(cm.css.TABBED_LEGEND_BOX));
  expectThat(redLegend, not(hasAncestor(folderBox)));
  expectThat(emptyLegend, not(hasAncestor(folderBox)));
  expectThat(blueLegend, not(hasAncestor(folderBox)));
  this.validateIsFirst_(legendElem);
};

FolderLegendViewTest.prototype.testLockedFolderRendering = function() {
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.LOCKED, 'testLockedFolderRendering');
  var legendElem = legendView.getContent(true);
  var idToLayerAndLegend = this.findLayersAndLegends_(
      legendElem, 'testLockedFolderRendering');

  // Locked folders render their sublayers' legends within the folder's own
  // legend box.  No title except the folders' itself should be visible.
  this.validateRender_(
      this.legendForId_(FOLDER_LAYER_JSON.id), this.layerModel_, true, true);

  this.validateRender_(this.legendForId_(RED_LAYER_JSON.id),
                       this.layerForId_(RED_LAYER_JSON.id), false, true);

  this.validateRender_(this.legendForId_(NO_LEGEND_LAYER_JSON.id),
                       this.layerForId_(NO_LEGEND_LAYER_JSON.id), false, false);

  this.validateRender_(this.legendForId_(BLUE_LAYER_JSON.id),
                       this.layerForId_(BLUE_LAYER_JSON.id), false, true);
  this.validateIsFirst_(legendElem);
};

FolderLegendViewTest.prototype.testSingleSelectFolderRendering = function() {
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.SINGLE_SELECT,
      'testSingleSelectFolderRendering');
  var legendElem = legendView.getContent(true);
  this.findLayersAndLegends_(legendElem, 'testSingleSelectFolderRendering');
  var titleComponents = [this.layerModel_.get('title'),
                         this.layerForId_(RED_LAYER_JSON.id).get('title')];

  this.validateRender_(this.legendForId_(FOLDER_LAYER_JSON.id),
                       this.layerModel_, true, true, titleComponents);

  this.validateRender_(this.legendForId_(RED_LAYER_JSON.id),
                       this.layerForId_(RED_LAYER_JSON.id), true, true,
                       titleComponents);

  this.validateRender_(this.legendForId_(BLUE_LAYER_JSON.id),
                       this.layerForId_(BLUE_LAYER_JSON.id), false, false);
  this.validateIsFirst_(legendElem);
};

FolderLegendViewTest.prototype.testSelectNewLayerInSingleSelect = function() {
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.SINGLE_SELECT,
      'testSelectNewLayerInSingleSelect');
  var legendElem = legendView.getContent(true);
  this.findLayersAndLegends_(legendElem, 'testSelectNewLayerInSingleSelect');
  this.appState_.selectSublayer(
      this.layerModel_, this.layerForId_(BLUE_LAYER_JSON.id).id);
  var titleComponents = [this.layerModel_.get('title'),
                         this.layerForId_(BLUE_LAYER_JSON.id).get('title')];
  this.validateRender_(this.legendForId_(BLUE_LAYER_JSON.id),
                       this.layerForId_(BLUE_LAYER_JSON.id), true, true,
                       titleComponents);

  this.validateRender_(this.legendForId_(RED_LAYER_JSON.id),
                       this.layerForId_(RED_LAYER_JSON.id), false, false);
  this.validateIsFirst_(legendElem);
};


FolderLegendViewTest.prototype.testRenderingAfterAddingSublayer = function() {
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.UNLOCKED, 'testRenderingAfterAddingSublayer');
  // Render before adding the new layer
  var legendElem = legendView.getContent(true);
  var newLayerId = 'newLayer';
  var newLayerJson = {
    id: newLayerId, title: 'Newly added layer', legend: 'A non-empty legend',
    type: 'KML', visibility: 'DEFAULT_ON'};
  this.appState_.setLayerEnabled(newLayerId, true);
  this.layerModel_.get('sublayers').push(
      cm.LayerModel.newFromMapRoot(newLayerJson));
  this.findLayersAndLegends_(legendElem, 'testUnlockedFolderRendering');
  this.validateRender_(this.legendForId_(newLayerId),
                       this.layerForId_(newLayerId), true, true);
  this.validateIsFirst_(legendElem);
};

FolderLegendViewTest.prototype.testRenderingAfterRemovingSublayer = function() {
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.UNLOCKED, 'testRenderingAfterRemovingSublayer');
  // Force render before manipulating the sublayer list
  var legendElem = legendView.getContent(true);
  expectDescendantOf(
      legendElem, withClass(cm.css.LAYER_TITLE),
      withText(RED_LAYER_JSON.title));
  // The layer from RED_LAYER_JSON is first
  this.layerModel_.get('sublayers').removeAt(0);
  expectNoDescendantOf(
      legendElem, withClass(cm.css.LAYER_TITLE),
      withText(RED_LAYER_JSON.title));
  this.validateIsFirst_(legendElem);
};

FolderLegendViewTest.prototype.testRenderingAfterChangingFolderType =
    function() {
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.UNLOCKED,
      'testRenderingAfterChangingFolderType');
  var legendElem = legendView.getContent(true);
  this.layerModel_.set('folder_type', cm.LayerModel.FolderType.LOCKED);
  this.findLayersAndLegends_(
      legendElem, 'testRenderingAfterChangingFolderType');
  this.validateRender_(
      this.legendForId_(FOLDER_LAYER_JSON.id), this.layerModel_, true, true);

  this.validateRender_(this.legendForId_(RED_LAYER_JSON.id),
                       this.layerForId_(RED_LAYER_JSON.id), false, true);

  this.validateRender_(this.legendForId_(NO_LEGEND_LAYER_JSON.id),
                       this.layerForId_(NO_LEGEND_LAYER_JSON.id), false, false);

  this.validateRender_(this.legendForId_(BLUE_LAYER_JSON.id),
                       this.layerForId_(BLUE_LAYER_JSON.id), false, true);
  this.validateIsFirst_(legendElem);
};

FolderLegendViewTest.prototype.testRenderingLockedFolderWithNestedFolders =
    function() {
  var uniqueId = 'testRenderingLockedFolderWithNestedFolders';
  var subFolderJson = this.getFolderJson_(
      cm.LayerModel.FolderType.UNLOCKED, uniqueId, [
    this.fromTemplateJson(RED_LAYER_JSON, uniqueId),
    this.fromTemplateJson(BLUE_LAYER_JSON, uniqueId)]);
  // We must customize the subfolder JSON or it will match the folder created
  // by createLegendView_ too closely, and the tests won't be able to
  // distinguish between folder and subfolder.
  subFolderJson.id = 'subfolderId';
  subFolderJson.title = 'Subfolder Title';
  subFolderJson.legend = 'Totally not the folder\'s legend';
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.LOCKED, uniqueId,
      [subFolderJson, this.fromTemplateJson(SIMPLE_LAYER_JSON, uniqueId)]);
  var legendElem = legendView.getContent(true);
  this.findLayersAndLegends_(legendElem, uniqueId);

  this.validateRender_(
      this.legendForId_(FOLDER_LAYER_JSON.id), this.layerModel_, true, true);
  this.validateRender_(this.legendForId_(RED_LAYER_JSON.id),
                       this.layerForId_(RED_LAYER_JSON.id), false, true);
  this.validateRender_(this.legendForId_(BLUE_LAYER_JSON.id),
                       this.layerForId_(BLUE_LAYER_JSON.id), false, true);
  this.validateRender_(this.legendForId_(RED_LAYER_JSON.id),
                       this.layerForId_(RED_LAYER_JSON.id), false, true);
  this.validateRender_(this.legendForId_(subFolderJson.id),
                       this.layerForId_(subFolderJson.id), false, true);
  this.validateRender_(this.legendForId_(SIMPLE_LAYER_JSON.id),
                       this.layerForId_(SIMPLE_LAYER_JSON.id), false, true);
  this.validateIsFirst_(legendElem);
};

FolderLegendViewTest.prototype.testFolderWithNoVisibleSublayers = function() {
  var legendView = this.createLegendView_(
      cm.LayerModel.FolderType.UNLOCKED, 'testFolderWithNoVisibleSublayers');
  var legendElem = legendView.getContent(true);
  this.findLayersAndLegends_(legendElem, 'testFolderWithNoVisibleSublayers');
  this.layerModel_.set('legend', new cm.Html(''));
  this.appState_.setLayerEnabled(this.layerForId_(RED_LAYER_JSON.id).id, false);
  this.appState_.setLayerEnabled(
      this.layerForId_(BLUE_LAYER_JSON.id).id, false);
  expectThat(legendElem, withClass(cm.css.HIDDEN));
};

FolderLegendViewTest.prototype.testNotFirstRendering = function() {
  for (folderType in cm.LayerModel.FolderType) {
    var legendView = this.createLegendView_(
        cm.LayerModel.FolderType[folderType],
        'testNotFirstRendering' + folderType);
    this.validateIsNotFirst_(legendView.getContent(false));
  }
};
