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


function LayerEntryViewTest() {
  cm.TestBase.call(this);

  // The LayerModel is just a simple MVCObject, so it's much simpler to test it
  // as an MVCObject than to create a mock instance.
  this.layerModel_ = new google.maps.MVCObject();
  this.layerModel_.set('id', 'layer0');
  this.layerModel_.set('title', 'monsters');
  this.layerModel_.set(
      'description', cm.Html.fromSanitizedHtml('lots of monsters'));
  this.layerModel_.set(
      'legend', cm.Html.fromSanitizedHtml(
          'red - evil monsters<br/>' +
          'dark red - eviler monsters'));
  this.layerModel_.set('type', cm.LayerModel.Type.FUSION);
  this.layerModel_.set('sublayers', new google.maps.MVCArray());
  this.layerModel_.isTimeSeries = function() { return false; };

  this.metadataModel_ = new cm.MetadataModel();

  this.setForTest_('goog.style.setOpacity', createMockFunction());
  expectCall(goog.style.setOpacity)(_, 1).willRepeatedly(returnWith(undefined));

  this.appState_ = createMockInstance(cm.AppState);
  expectCall(this.appState_.getLayerEnabled)('layer0')
      .willRepeatedly(returnWith(false));
  expectCall(this.appState_.get)('layer_opacities')
      .willRepeatedly(returnWith(undefined));
}
LayerEntryViewTest.prototype = new cm.TestBase();
registerTestSuite(LayerEntryViewTest);

/**
 * Constructs the LayerEntryView and returns its parent. Optionally
 * fakes adding LayerEntryView elements to the parent by inserting
 * empty divs before the new LayerEntryView element.
 * @param {Object=} opt_config Configuration settings.
 * @param {number=} opt_index Index into parent element's child node
 *     array. If not given, defaults to 0.
 * @param {number=} opt_childCount Total number of child nodes to give
 *     the parent element, including the new entry. If not given,
 *     defaults to opt_index + 1. If opt_index is not given, defaults
 *     to 1.
 * @return {Element} An element containing the new LayerEntryView.
 * @private
 */
LayerEntryViewTest.prototype.createView_ = function(
    opt_config, opt_index, opt_childCount) {
  var parent = new FakeElement('div');
  var index = opt_index || 0;
  var childCount = opt_childCount || index + 1;
  for (var i = 0; i < childCount - 1; i++) {
    parent.appendChild(new FakeElement('div', {'class': 'cm-layer-entry'}));
  }
  this.view_ = new cm.LayerEntryView(parent, this.layerModel_,
                                     this.metadataModel_, this.appState_,
                                     opt_config, index);
  return parent;
};

/**
 * Verifies that the constructor creates an entry with an unchecked checkbox,
 * a title div, and a hidden content div containing a comments div.
 */
LayerEntryViewTest.prototype.testConstructor = function() {
  var parent = this.createView_();
  var contentElem = expectDescendantOf(parent, 'div', withClass('cm-hidden'));
  expectDescendantOf(
      parent, withClass('cm-layer-title'), withText('monsters'));
  expectDescendantOf(
      contentElem, withClass('cm-layer-description'),
      withText('lots of monsters'));
  expectDescendantOf(
      contentElem, withClass('cm-layer-legend-box'),
      not(withStyle('display', 'none'),
      hasDescendant(not(withClass('cm-hidden')),
          hasDescendant(withClass('cm-layer-legend'), withText(
              'red - evil monsters<br/>' +
              'dark red - eviler monsters')))));
  var checkbox = expectDescendantOf(parent, inputType('checkbox'));
  expectFalse(checkbox.checked);
};

/** Verifies that the Edit and Delete links appear only when they should. */
LayerEntryViewTest.prototype.testEnableEditingFlags = function() {
  var parent = this.createView_();
  expectNoDescendantOf(parent, 'a', withText('Edit'));
  expectNoDescendantOf(parent, 'a', withText('Delete'));

  parent = this.createView_({enable_editing: true});
  expectDescendantOf(parent, 'a', withText('Edit'));
  expectDescendantOf(parent, 'a', withText('Delete'));

};

/**
 * Verifies that providing an opt_index results in the layer being inserted
 * at the proper index in the parent element's child node array.
*/
LayerEntryViewTest.prototype.testConstructorIndex = function() {
  // Insert layer at the beginning of the child node list.
  var parent = this.createView_({}, 0, 2);
  var childNodes = allDescendantsOf(parent, withClass('cm-layer-entry'));
  expectEq(2, childNodes.length);
  expectDescendantOf(childNodes[0], withText('monsters'));

  // Insert layer in the middle of the child node list.
  parent = this.createView_({}, 1, 3);
  childNodes = allDescendantsOf(parent, withClass('cm-layer-entry'));
  expectEq(3, childNodes.length);
  expectDescendantOf(childNodes[1], withText('monsters'));

  // Add layer to the end of the child node list.
  parent = this.createView_({}, 4);
  childNodes = allDescendantsOf(parent, withClass('cm-layer-entry'));
  expectEq(5, childNodes.length);
  expectDescendantOf(childNodes[4], withText('monsters'));
};

/**
 * Tests that the opacity slider is toggled on and off appropriately for TILE
 * layers and non-TILE layers, respectively. Also tests that the value is
 * initialized correctly for TILE layers.
 */
LayerEntryViewTest.prototype.testOpacitySlider = function() {
  // Create view with non-TILE layer.
  this.createView_();

  // Change the layer to TILE, and verify the slider is created.
  this.slider_ = this.expectNew_('goog.ui.Slider');
  this.fakeThumb_ = cm.ui.create('div');
  expectCall(this.slider_.setMoveToPointEnabled)(true);
  expectCall(this.slider_.render)(_);
  expectCall(this.slider_.getValueThumb)().
      willOnce(returnWith(this.fakeThumb_));
  expectCall(this.appState_.get)('layer_opacities').
      willOnce(returnWith({}));
  expectCall(this.slider_.setValue)(100);

  this.layerModel_.set('type', cm.LayerModel.Type.TILE);
  var sliderDot = expectDescendantOf(
      this.fakeThumb_, withClass('cm-slider-dot'));
  expectEq(1, sliderDot.style.opacity);

  // Test that the slider's 'change' event fires a CHANGE_OPACITY event with the
  // correct opacity.
  expectCall(this.slider_.getValue)().willOnce(returnWith(50));
  var changeOpacityEmitted = false;
  var opacity;
  cm.events.listen(goog.global, cm.events.CHANGE_OPACITY, function(e) {
    changeOpacityEmitted = true;
    opacity = e.opacity;
  });
  cm.events.emit(this.slider_, 'change');
  expectTrue(changeOpacityEmitted);
  expectEq(50, opacity);

  // Test whether changes in the app state are reflected upon the slider.
  expectCall(this.appState_.get)('layer_opacities')
      .willRepeatedly(returnWith({'layer0': 40}));
  expectCall(this.slider_.setValue)(40);
  cm.events.emit(this.appState_, 'layer_opacities_changed');
  expectEq(0.4, sliderDot.style.opacity);

  // The slider thumb should contain circle and dot divs.
  var circle = expectDescendantOf(
      this.fakeThumb_, withClass('cm-slider-circle'));
  expectDescendantOf(circle, withClass('cm-slider-dot'));

  // Change the layer to non-TILE to verify that the slider is destroyed.
  expectCall(this.slider_.dispose)();
  this.layerModel_.set('type', cm.LayerModel.Type.KML);
};

/** Tests that time series layers get a sublayer picker. */
LayerEntryViewTest.prototype.testSublayerPicker = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.FOLDER);
  this.layerModel_.set('tags', [cm.LayerModel.IS_TIME_SERIES_FOLDER]);

  var container = new FakeElement('div');
  var sublayerPicker = this.expectNew_(
      'cm.SublayerPicker', _, this.layerModel_);
  this.createView_();
};

/** Tests that setting the 'title' property updates the displayed title. */
LayerEntryViewTest.prototype.updateTitle = function() {
  var parent = this.createView_();
  this.layerModel_.set('title', 'unicorns');
  expectDescendantOf(parent,
      withClass('cm-layer-title'), withText('unicorns'));
};

/** Tests whether word breaks are placed properly for title. */
LayerEntryViewTest.prototype.updateTitleWithWordBreaks = function() {
  var parent = this.createView_();
  var longTitle = '<b>thisisaverylooooooooooooooooooongone</b>';
  this.layerModel_.set('title', longTitle);
  var wordBrokenTitle = '&lt;b&gt;thisisa<wbr>verylooooo<wbr>oooooooooo<wbr>' +
                        'oooongone&lt;<wbr>/b&gt;';
  expectDescendantOf(parent, withClass('cm-layer-title'),
      withInnerHtml(wordBrokenTitle));
  expectNoDescendantOf(parent, withClass('cm-layer-title'),
      withInnerHtml(longTitle));
};

/**
 * Tests that a time series 'title' property updates to reflect a
 * promoted sublayer.
 */
LayerEntryViewTest.prototype.updateTitleTimeSeries = function() {
  var sublayerPicker = this.expectNew_(
      'cm.SublayerPicker', _, this.layerModel_);
  this.layerModel_.isTimeSeries = function() { return true; };
  var childModel = new google.maps.MVCObject;
  childModel.set('last_update', new Date(2020, 2, 20).valueOf() / 1000);
  expectCall(this.appState_.getPromotedSublayer)(this.layerModel_)
      .willRepeatedly(returnWith(childModel));
  var parent = this.createView_();
  var expectedSubtitle = cm.ui.SEPARATOR_DASH + 'Mar 20, 2020';

  cm.events.emit(this.appState_, 'promoted_layer_ids_changed');
  expectDescendantOf(parent, withClass('cm-layer-title'),
                     withText('monsters'));
  expectDescendantOf(parent, withClass('cm-layer-date'),
                     withText(expectedSubtitle));

  expectCall(this.appState_.getPromotedSublayer)(this.layerModel_)
      .willRepeatedly(returnWith(null));
  cm.events.emit(this.appState_, 'promoted_layer_ids_changed');
  expectDescendantOf(parent, withClass('cm-layer-title'),
                     withText('monsters'));
  expectNoDescendantOf(parent, withClass('cm-layer-date'),
                       withText(expectedSubtitle));
};

/** Tests that setting the 'description' property updates the description. */
LayerEntryViewTest.prototype.updateDescription = function() {
  var parent = this.createView_();
  this.layerModel_.set(
      'description', cm.Html.fromSanitizedHtml('heaps of unicorns'));
  expectDescendantOf(parent,
      withClass('cm-layer-description'), withText('heaps of unicorns'));
};

/** Tests that setting the 'legend' property updates the legend. */
LayerEntryViewTest.prototype.updateLegend = function() {
  var parent = this.createView_();

  // clear legend and check that box disappears
  this.layerModel_.set('legend', cm.Html.fromSanitizedHtml(''));
  expectDescendantOf(parent,
      withClass('cm-layer-legend-box'), withClass('cm-hidden'),
          hasDescendant(withClass('cm-layer-legend'), withText('')));

  // put a new legend
  var text = 'red - evil monsters<br/>' +
             'dark red - eviler monsters<br/>' +
             'blue - friendly monsters';
  this.layerModel_.set('legend', cm.Html.fromSanitizedHtml(text));
  expectDescendantOf(parent,
      withClass('cm-layer-legend-box'), not(withClass('cm-hidden'),
          hasDescendant(withClass('cm-layer-legend'), withText(text))));
};

/** Tests that the layer's timestamp is displayed correctly. */
LayerEntryViewTest.prototype.updateTime = function() {
  var parent = this.createView_();
  var timeElem = expectDescendantOf(parent, withClass('cm-timestamp'));
  var now = new Date().valueOf() / 1000;
  var metadata = this.metadataModel_;

  // Tests that the current time is formatted to say 0 minutes ago.
  metadata.set('layer0', {'content_last_modified': now});
  expectThat(cm.ui.getText(timeElem), containsRegExp(
      /Last updated: \d\d?:\d\d [AP]M \(0 minutes ago\)/));

  // Check 23 hours ago.
  metadata.set('layer0', {'content_last_modified': now - 3600 * 23});
  expectThat(cm.ui.getText(timeElem), containsRegExp(
      /Last updated: \d\d?:\d\d [AP]M \(23 hours ago\)/));

  // Check yesterday.
  metadata.set('layer0', {'content_last_modified': now - 3600 * 24});
  expectThat(cm.ui.getText(timeElem), containsRegExp(
      /Last updated: [A-Z][a-z]+ \d+, \d{4} \(1 day ago\)/));

  // Check 14 days ago.
  metadata.set('layer0', {'content_last_modified': now - 3600 * 24 * 14});
  expectThat(cm.ui.getText(timeElem), containsRegExp(
      /Last updated: [A-Z][a-z]+ \d+, \d{4}/));

  // Try a missing timestamp.
  this.metadataModel_.set('layer0', {});
  expectEq(cm.ui.getText(timeElem), '');
};

/**
 * Tests that the download links are not created when a KML LayerModel's URL
 * changes, as specified by a true value for suppress_download_link.
 */
LayerEntryViewTest.prototype.updateUrlKmlNoLink = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.KML);
  this.layerModel_.set('url', 'http://monsters.com.au');
  this.layerModel_.set('suppress_download_link', true);

  var parent = this.createView_();
  expectNoDescendantOf(parent, 'a', withText('Download KML'));
};

/** Tests that the download links of a KML layer are created and updated. */
LayerEntryViewTest.prototype.updateUrlKml = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.KML);
  this.layerModel_.set('url', 'http://monsters.com.au');

  var parent = this.createView_();
  expectDescendantOf(parent,
      'a', withText('Download KML'), withHref('http://monsters.com.au'));

  this.layerModel_.set('url', 'http://unicorns.de');
  expectNoDescendantOf(parent, 'a', withHref('http://monsters.com.au'));
  expectDescendantOf(parent,
      'a', withText('Download KML'), withHref('http://unicorns.de'));
};

/**
 * Tests that the download links are not created when a GEORSS LayerModel's URL
 * changes, as specified by a true value for suppress_download_link.
 */
LayerEntryViewTest.prototype.updateUrlGeorssNoLink = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.GEORSS);
  this.layerModel_.set('url', 'http://monsters.com.au');
  this.layerModel_.set('suppress_download_link', true);

  var parent = this.createView_();
  this.layerModel_.set('url', 'http://unicorns.de');
  expectNoDescendantOf(parent, 'a', withText('Download KML'));
};

/**
 * Tests that the download links are updated when a GeoRSS LayerModel's URL
 * changes.
 */
LayerEntryViewTest.prototype.updateUrlGeorss = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.GEORSS);
  this.layerModel_.set('url', 'http://monsters.com.au');

  var parent = this.createView_();
  expectDescendantOf(parent,
      'a', withText('Download GeoRSS'), withHref('http://monsters.com.au'));

  this.layerModel_.set('url', 'http://unicorns.de');
  expectNoDescendantOf(parent, 'a', withHref('http://monsters.com.au'));
  expectDescendantOf(parent,
      'a', withText('Download GeoRSS'), withHref('http://unicorns.de'));
};

/**
 * Tests that the View Data links are not created when a Fusion Table's source
 * changes, as specified by a true value for suppress_download_link.
 */
LayerEntryViewTest.prototype.updateUrlFusionNoLink = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.FUSION);
  this.layerModel_.set('ft_from', 11111);
  this.layerModel_.set('suppress_download_link', true);

  var parent = this.createView_();
  this.layerModel_.set('ft_from', 22222);
  expectNoDescendantOf(parent, 'a', withText('View data'));
};

/**
 * Tests that the View Data links are updated when a Fusion LayerModel's source
 * changes.
 */
LayerEntryViewTest.prototype.updateUrlFusion = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.FUSION);
  this.layerModel_.set('ft_from', 11111);

  // Old-style table IDs should be used with the 'dsrcid' parameter.
  var parent = this.createView_();
  expectDescendantOf(
      parent, 'a', withText('View data'),
      withHref('http://www.google.com/fusiontables/DataSource?dsrcid=11111'));

  this.layerModel_.set('ft_from', 22222);
  expectNoDescendantOf(
      parent, 'a',
      withHref('http://www.google.com/fusiontables/DataSource?dsrcid=11111'));
  expectDescendantOf(
      parent, 'a', withText('View data'),
      withHref('http://www.google.com/fusiontables/DataSource?dsrcid=22222'));

  // New-style document IDs should be used with the 'docid' parameter.
  this.layerModel_.set('ft_from', '1nCWC1X_g-pOFUit_EmYV_fAIFQ5MLAz4HNhM2h4');
  expectNoDescendantOf(
      parent, 'a',
      withHref('http://www.google.com/fusiontables/DataSource?dsrcid=22222'));
  expectDescendantOf(
      parent, 'a', withText('View data'),
      withHref('http://www.google.com/fusiontables/DataSource?' +
               'docid=1nCWC1X_g-pOFUit_EmYV_fAIFQ5MLAz4HNhM2h4'));
};

/**
 * Tests that the download links are NOT updated when a non-GeoRSS/non-KML
 * LayerModel's URL changes.
 */
LayerEntryViewTest.prototype.updateUrlOther = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.TRAFFIC);
  this.layerModel_.set('url', 'http://monsters.com.au');

  var parent = this.createView_();
  expectNoDescendantOf(parent, 'a', withText(containsRegExp(/Download/)));

  this.layerModel_.set('url', 'http://unicorns.de');
  expectNoDescendantOf(parent, 'a', withText(containsRegExp(/Download/)));
};

/**
 * Tests that the zoom link's visibility is updated when the layer's
 * 'viewport' or 'type' property changes.
 */
LayerEntryViewTest.prototype.testZoomLinks = function() {
  // A non-KML layer with a valid viewport...
  this.layerModel_.set('viewport', new cm.LatLonBox(30, 40, -80, -100));
  var parent = this.createView_();
  // ...should have a visible zoom link.
  var zoomLink = expectDescendantOf(parent, 'a',
                                    withText(containsRegExp(/Zoom/)));
  expectThat(zoomLink.parentNode, isElement(not(withClass('cm-hidden'))));

  // When the viewport is not defined...
  this.layerModel_.set('viewport', undefined);
  // ...the zoom link should disappear.
  expectThat(zoomLink.parentNode, isElement(withClass('cm-hidden')));

  // When the layer type is changed to KML...
  this.layerModel_.set('type', cm.LayerModel.Type.KML);
  // ...the zoom link should reappear.
  expectThat(zoomLink.parentNode, isElement(not(withClass('cm-hidden'))));
};

/**
 * Tests that the entry item fades away when the map's zoom level is out of
 * the layer's zoom range.
 */
LayerEntryViewTest.prototype.testZoomFading = function() {
  this.layerModel_.set('min_zoom', 3);
  this.layerModel_.set('max_zoom', 5);

  var parent = this.createView_();

  var elems = goog.array.map(
      ['cm-header', 'cm-layer-description', 'cm-layer-legend',
       'cm-timestamp', 'cm-slider', 'cm-sublayers', 'cm-warning'],
      function(cls) {
          return expectDescendantOf(parent, withClass(cls));
      });

  // Each of the elements above should be faded out twice and faded in twice.
  expectCall(goog.style.setOpacity)(anyOf(elems), 0.5).times(elems.length);
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED, {zoom: 9}); // Fade out.

  expectCall(goog.style.setOpacity)(anyOf(elems), 1.0).times(elems.length);
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED, {zoom: 4}); // Fade in.

  expectCall(goog.style.setOpacity)(anyOf(elems), 0.5).times(elems.length);
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED, {zoom: 2}); // Fade out.

  expectCall(goog.style.setOpacity)(anyOf(elems), 1.0).times(elems.length);
  cm.events.emit(goog.global, cm.events.ZOOM_CHANGED, {zoom: 5}); // Fade in.
};

/**
 * Tests that the checkbox and content are updated when a LayerModel's
 * enabled state changes in the AppState.
 */
LayerEntryViewTest.prototype.updateEnabled = function() {
  var parent = this.createView_();
  var checkbox = expectDescendantOf(parent, inputType('checkbox'));
  expectFalse(checkbox.checked);  // layer is initially toggled off

  // Enable the layer.
  expectCall(this.appState_.getLayerEnabled)('layer0')
      .willRepeatedly(returnWith(true));
  cm.events.emit(this.appState_, 'enabled_layer_ids_changed');
  expectTrue(checkbox.checked);
  // Warning element is hidden initially, all other are visible.
  expectNoDescendantOf(parent, 'div', withClass('cm-hidden'),
                       not(withClass('cm-warning')));

  // Disable the layer.
  expectCall(this.appState_.getLayerEnabled)('layer0')
      .willRepeatedly(returnWith(false));
  cm.events.emit(this.appState_, 'enabled_layer_ids_changed');
  expectFalse(checkbox.checked);
  // Warnign element is already hidden, make sure some other is hidden too.
  expectDescendantOf(parent, 'div', withClass('cm-hidden'),
                     not(withClass('cm-warning')));
};

/**
 * Tests that a time series layer entry is updated when its
 * enabled state changes in the AppState.
 */
LayerEntryViewTest.prototype.updateEnabledTimeSeries = function() {
  var childModel = new google.maps.MVCObject;
  childModel.set('id', 'child');
  childModel.set('sublayers', new google.maps.MVCArray());
  childModel.isTimeSeries = function() { return false; };

  this.layerModel_.set('sublayers', new google.maps.MVCArray([childModel]));
  this.layerModel_.isTimeSeries = function() { return true; };
  var sublayerPicker = this.expectNew_(
      'cm.SublayerPicker', _, this.layerModel_);

  expectCall(this.appState_.getPromotedSublayer)(this.layerModel_)
      .willRepeatedly(returnWith(childModel));
  expectCall(this.appState_.getLayerEnabled)('child')
      .willRepeatedly(returnWith(true));
  var parent = this.createView_();
  var childEntry = this.view_.layerEntryViews_['child'].getEntryElement();

  var checkbox = expectDescendantOf(parent, inputType('checkbox'));
  expectFalse(checkbox.checked);  // layer is initially toggled off

  // Enable the parent layer.
  expectCall(this.appState_.getLayerEnabled)('layer0')
      .willRepeatedly(returnWith(true));
  cm.events.emit(this.appState_, 'enabled_layer_ids_changed');
  expectTrue(checkbox.checked);

  // TODO(romano): replace this when expectNoDescendantOf() takes a
  // maximum recursion depth, so that the childEntry's content div is excluded.
  //expectNoDescendantOf(parent, 'div', withClass('cm-content'));
  expectDescendantOf(parent, 'div', withClass('cm-sublayers'));
  expectDescendantOf(childEntry, 'div', withClass('cm-content'));
  expectNoDescendantOf(childEntry, 'div', withClass('cm-header'));
};

/**
 * Tests that a time series layer entry is updated when a selection is made
 * from its SublayerPicker.
 */
LayerEntryViewTest.prototype.updateEnabledTimeSeriesSelect = function() {
  var childModel1 = new google.maps.MVCObject;
  childModel1.set('id', 'child1');
  childModel1.set('sublayers', new google.maps.MVCArray());
  childModel1.isTimeSeries = function() { return false; };

  var childModel2 = new google.maps.MVCObject;
  childModel2.set('id', 'child2');
  childModel2.set('sublayers', new google.maps.MVCArray());
  childModel2.isTimeSeries = function() { return false; };

  this.layerModel_.set('sublayers',
                       new google.maps.MVCArray([childModel1, childModel2]));
  this.layerModel_.isTimeSeries = function() { return true; };
  var sublayerPicker = this.expectNew_(
      'cm.SublayerPicker', _, this.layerModel_);

  // Initialize the time series as enabled with a promoted sublayer.
  expectCall(this.appState_.getPromotedSublayer)(this.layerModel_)
      .willRepeatedly(returnWith(childModel1));
  expectCall(this.appState_.getLayerEnabled)('child1')
      .willRepeatedly(returnWith(true));
  expectCall(this.appState_.getLayerEnabled)('child2')
      .willRepeatedly(returnWith(false));
  expectCall(this.appState_.getLayerEnabled)('layer0')
      .willRepeatedly(returnWith(true));
  var parent = this.createView_();
  var childEntry1 = this.view_.layerEntryViews_['child1'].getEntryElement();
  var childEntry2 = this.view_.layerEntryViews_['child2'].getEntryElement();

  // Check the class names of the parent layer, promoted sublayer, and
  // not-promoted sublayer.
  expectDescendantOf(parent, withClass('cm-contains-promoted-sublayer'));
  var sublayers = expectDescendantOf(parent, withClass('cm-sublayers'));
  var promoted = expectDescendantOf(parent,
                                    withClass('cm-layer-entry'),
                                    withClass('cm-promoted-sublayer'));
  expectEq(childEntry1, promoted);
  var notPromoted = expectDescendantOf(sublayers,
                                       withClass('cm-layer-entry'),
                                       not(withClass('cm-promoted-sublayer')));
  expectEq(childEntry2, notPromoted);

  // Promote the other sublayer and verify its class name.
  expectCall(this.appState_.getPromotedSublayer)(this.layerModel_)
      .willRepeatedly(returnWith(childModel2));
  cm.events.emit(this.appState_, 'promoted_layer_ids_changed');
  promoted = expectDescendantOf(parent,
                                withClass('cm-layer-entry'),
                                withClass('cm-promoted-sublayer'));
  expectEq(childEntry2, promoted);

  // Select the multiple dates option and verify that no layers are
  // promoted sublayers or contain promoted sublayers.
  expectCall(this.appState_.getPromotedSublayer)(this.layerModel_)
      .willRepeatedly(returnWith(null));
  cm.events.emit(this.appState_, 'promoted_layer_ids_changed');
  expectNoDescendantOf(parent, withClass('cm-contains-promoted-sublayer'));
  expectNoDescendantOf(parent, withClass('cm-promoted-sublayer'));
};

/**
 * Tests that a locked folder's sublayers are not shown.
 */
LayerEntryViewTest.prototype.updateEnabledLockedFolder = function() {
  var childModel = new google.maps.MVCObject;
  childModel.set('id', 'child');
  childModel.set('sublayers', new google.maps.MVCArray());
  childModel.isTimeSeries = function() { return false; };

  this.layerModel_.set('type', cm.LayerModel.Type.FOLDER);
  this.layerModel_.set('sublayers', new google.maps.MVCArray([childModel]));
  this.layerModel_.set('locked', true);

  // When a locked folder and its sublayers are enabled...
  expectCall(this.appState_.getLayerEnabled)('layer0')
      .willRepeatedly(returnWith(true));
  expectCall(this.appState_.getLayerEnabled)('child')
      .willRepeatedly(returnWith(true));
  var parent = this.createView_();
  // ...the sublayers should be hidden.
  // TODO(romano): replace this element definition with expectDescendantOf()
  // once it takes maximum recursion depth, so that only this layer's sublayers
  // element qualifies.
  expectThat(this.view_.getEntryElement().childNodes[2],
             isElement(withClass('cm-hidden')));

  // When the folder is unlocked...
  this.layerModel_.set('locked', false);
  // ...the sublayers should be visible.
  expectThat(this.view_.getEntryElement().childNodes[2],
             isElement(not(withClass('cm-hidden'))));
};

/**
 * Tests that a TOGGLE_LAYER event is emitted when a checkbox is clicked.
 */
LayerEntryViewTest.prototype.clickCheckbox = function() {
  var parent = this.createView_();
  var checkbox = expectDescendantOf(parent, inputType('checkbox'));

  var event = null;
  cm.events.listen(this.view_, cm.events.TOGGLE_LAYER, function(e) {
    event = e;
  });

  // Simulate checking the checkbox.
  checkbox.checked = true;
  cm.events.emit(checkbox, 'click');
  expectEq({id: 'layer0', value: true, type: cm.events.TOGGLE_LAYER}, event);

  // Simulate unchecking the checkbox.
  event = null;
  checkbox.checked = false;
  cm.events.emit(checkbox, 'click');
  expectEq({id: 'layer0', value: false, type: cm.events.TOGGLE_LAYER}, event);
};

/**
 * Tests that metadata updates are handled correctly.
 */
LayerEntryViewTest.prototype.testMetadataUpdates = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.KML);
  this.layerModel_.set('url', 'http://monsters.com.au');
  var parent = this.createView_();
  this.metadataModel_.set('layer0', {
    'content_last_modified': 1344989642.0,
    'content_length': 25000,
    'has_no_features': false,
    'has_unsupported_kml': true
  });

  var warningElem = expectDescendantOf(parent, withClass('cm-warning'),
                                       not(withClass('cm-hidden')));
  expectThat(cm.ui.getText(warningElem), containsRegExp(/unsupported/));
  var timeElem = expectDescendantOf(parent, withClass('cm-timestamp'),
                                    not(withClass('cm-hidden')));
  var downloadElem = expectDescendantOf(parent, 'a', withText('Download KML'),
                                        withHref('http://monsters.com.au'),
                                        not(withClass('cm-hidden')));
  expectEq('25 k', downloadElem.parentNode.title);
  var zoomLink = expectDescendantOf(parent, 'a',
                                    withText(containsRegExp(/Zoom/)));

  // Remove content_length to clear file-size tooltip.
  this.metadataModel_.set('layer0', {
    'content_last_modified': 1344989642.0,
    'has_no_features': false,
    'has_unsupported_kml': true
  });
  downloadElem = expectDescendantOf(parent, 'a', withText('Download KML'));
  expectEq('', downloadElem.parentNode.title);
};

/**
 * Tests that a LayerEntryView's elements are removed from the DOM when it is
 * disposed of.
 */
LayerEntryViewTest.prototype.dispose = function() {
  var parent = this.createView_();
  this.view_.dispose();
  expectNoDescendantOf(parent, withClass('cm-layer-entry'));
};
