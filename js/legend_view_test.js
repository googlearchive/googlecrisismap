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

SimpleLegendViewTest.prototype.duplicateJson_ = function(
    json, opt_newProperties) {
  var newJson = goog.json.parse(goog.json.serialize(json));
  if (opt_newProperties) {
    for (key in opt_newProperties) {
      newJson[key] = opt_newProperties[key];
    }
  }
  return newJson;
};

SimpleLegendViewTest.prototype.createLegendView_ = function(json, uniqueId) {
  // Need to modify the title to guarantee we get a fresh legend view; otherwise
  // getLegendViewForLayer() will not build a new legend view.
  this.layerModel_ = cm.LayerModel.newFromMapRoot(
      this.duplicateJson_(json, {id: json.id + '-' + uniqueId}));
  return cm.LegendView.getLegendViewForLayer(
      this.layerModel_, this.metadataModel_, undefined);
};

/**
 * Verifies that the rendered DOM matches the model in this.layerModel_.
 * @param {Element} legendBox the element that contains the legend for the
 *   layer; should carry the cm.css.LAYER_LEGEND_BOX class
 * @private
 */
SimpleLegendViewTest.prototype.validateRender_ = function(legendBox) {
  expectThat(legendBox, withClass(cm.css.LAYER_LEGEND_BOX));
  expectThat(legendBox, not(withClass(cm.css.HIDDEN)));
  expectDescendantOf(legendBox, withText(this.layerModel_.get('title')));
  expectDescendantOf(
      legendBox, withInnerHtml(this.layerModel_.get('legend').getHtml()));
};

SimpleLegendViewTest.prototype.testGetContent = function() {
  var legendView = this.createLegendView_(SIMPLE_LAYER_JSON, 'testGetContent');
  this.validateRender_(legendView.getContent());
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
  this.validateRender_(content);
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED,
                 {zoom: SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON.min_zoom - 1});
  expectThat(content, withClass(cm.css.HIDDEN));
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED,
                 {zoom: SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON.min_zoom + 1});
  expectThat(content, not(withClass(cm.css.HIDDEN)));
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED,
                {zoom: SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON.max_zoom + 1});
  expectThat(content, withClass(cm.css.HIDDEN));
};

SimpleLegendViewTest.prototype.testUpdateOnModelZoomChange = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_WITH_ZOOM_BOUNDS_JSON, 'testUpdateOnModelZoomChange');
  var content = legendView.getContent();
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED,
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
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED, {zoom: 3});
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
  this.validateRender_(content);
};

SimpleLegendViewTest.prototype.testUpdatesOnLegendChange = function() {
  var legendView = this.createLegendView_(
      SIMPLE_LAYER_JSON, 'testUpdatesOnLegendChange');
  // Force render before the title changes
  var content = legendView.getContent();
  this.layerModel_.set(
      'legend', cm.Html.fromSanitizedHtml('<b>testUpdatesOnLegendChange</b>'));
  this.validateRender_(content);
};

SimpleLegendViewTest.prototype.testUpdatesOnMetadataChange = function() {
  var newJson = this.duplicateJson_(
      SIMPLE_LAYER_JSON,
      {source: {kml: {url: 'http://testUpdatesOnMetadataChange.google.com'}}});
  var legendView = this.createLegendView_(
      newJson, 'testUpdatesOnMetadataChange');
  var content = legendView.getContent();
  this.validateRender_(content);
  this.metadataModel_.set(this.layerModel_.getSourceAddress(),
                         {has_no_features: true});
  expectThat(content, withClass(cm.css.HIDDEN));
};

SimpleLegendViewTest.prototype.testUpdatesMetadataListener = function() {
  var newJson = this.duplicateJson_(
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
