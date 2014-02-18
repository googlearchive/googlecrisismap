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


goog.require('cm.LayerModel');
goog.require('cm.css');

LAYER_JSON = {
  id: 'layer0',
  title: 'monsters',
  description: 'lots of monsters',
  legend: 'red - evil monsters<br/>' +
          'dark red - eviler monsters',
  type: 'KML',
  url: 'XYZ:xyz',
  visibility: 'DEFAULT_OFF'
};

function LayerEntryViewTest() {
  cm.TestBase.call(this);

  this.mapModel_ = cm.MapModel.newFromMapRoot(
      {id: 'layerEntryViewTest', layers: [LAYER_JSON]});
  this.layerModel_ = this.mapModel_.get('layers').getAt(0);
  this.appState_ = new cm.AppState();
  this.appState_.setFromMapModel(this.mapModel_);
  this.metadataModel_ = new cm.MetadataModel(this.mapModel_);

  this.setForTest_('goog.style.setOpacity', createMockFunction());
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
 * @param {boolean=} opt_includeLegend Whether to include the legend
 *   from the view; defaults to true.
 * @return {Element} An element containing the new LayerEntryView.
 * @private
 */
LayerEntryViewTest.prototype.createView_ = function(
    opt_config, opt_index, opt_childCount, opt_includeLegend) {
  var parent = new FakeElement('div');
  var index = opt_index || 0;
  var childCount = opt_childCount || index + 1;
  for (var i = 0; i < childCount - 1; i++) {
    parent.appendChild(new FakeElement('div', {'class': cm.css.LAYER_ENTRY}));
  }
  opt_includeLegend =
      opt_includeLegend === undefined ? true : opt_includeLegend;
  this.view_ = new cm.LayerEntryView(parent, this.layerModel_,
                                     this.metadataModel_, this.appState_,
                                     opt_config, index, opt_includeLegend);
  return parent;
};

/**
 * Verifies that the constructor creates an entry with an unchecked checkbox,
 * a title div, and a hidden content div containing a comments div.
 */
LayerEntryViewTest.prototype.testConstructor = function() {
  // Not interested in testing the sanitizer here, so just install
  // a transparent one.
  this.setForTest_('cm.Html.sanitize_', function(string) { return string; });

  var parent = this.createView_();
  var contentElem = expectDescendantOf(
      parent, 'div', withClass(cm.css.CONTENT), not(isShown()));
  expectDescendantOf(
      parent, withClass(cm.css.LAYER_TITLE), withText('monsters'));
  expectDescendantOf(
      contentElem, withClass(cm.css.LAYER_DESCRIPTION),
      withText('lots of monsters'));
  expectDescendantOf(
      contentElem, withClass(cm.css.LAYER_LEGEND_BOX),
      not(withStyle('display', 'none'),
      hasDescendant(
          not(isShown()),
          hasDescendant(withClass(cm.css.LAYER_LEGEND), withText(
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
  var childNodes = allDescendantsOf(parent, withClass(cm.css.LAYER_ENTRY));
  expectEq(2, childNodes.length);
  expectDescendantOf(childNodes[0], withText('monsters'));

  // Insert layer in the middle of the child node list.
  parent = this.createView_({}, 1, 3);
  childNodes = allDescendantsOf(parent, withClass(cm.css.LAYER_ENTRY));
  expectEq(3, childNodes.length);
  expectDescendantOf(childNodes[1], withText('monsters'));

  // Add layer to the end of the child node list.
  parent = this.createView_({}, 4);
  childNodes = allDescendantsOf(parent, withClass(cm.css.LAYER_ENTRY));
  expectEq(5, childNodes.length);
  expectDescendantOf(childNodes[4], withText('monsters'));
};

/**
 * Prepare a mock of the opacity slider.  It should be possible to use a real
 * goog.ui.Slider in the tests, except that FakeElement doesn't support enough
 * of the DOM (it needs an implementation of el.classList).
 * @private
 */
LayerEntryViewTest.prototype.mockOpacitySlider_ = function() {
  this.sliderMock_ = this.expectNew_('goog.ui.Slider');
  this.sliderThumb_ = cm.ui.create('div');
  stub(this.sliderMock_.getValueThumb)().is(this.sliderThumb_);
  this.sliderMock_.valueStack = [];
  this.sliderMock_.setValue = function(val) {
    this.valueStack.push(val);
  };
  this.sliderMock_.getValue = function() {
    return this.valueStack.length ?
        this.valueStack[this.valueStack.length - 1] : 0;
  };
  stub(this.sliderMock_.setMoveToPointEnabled)(_).is(null);
  stub(this.sliderMock_.render)(_).is(null);
};

/**
 * Tests that the opacity slider is toggled on and off appropriately for TILE
 * layers and non-TILE layers, respectively. Also tests that the value is
 * initialized correctly for TILE layers.
 */
LayerEntryViewTest.prototype.testOpacitySlider = function() {
  // Create view with non-TILE layer.
  var parent = this.createView_();

  this.mockOpacitySlider_();

  // Change the layer to TILE, and verify the slider is created.  It should
  this.layerModel_.set('type', cm.LayerModel.Type.TILE);

  var sliderDot = expectDescendantOf(this.sliderThumb_,
                                     withClass(cm.css.SLIDER_DOT));
  expectEq(1, sliderDot.style.opacity);

  // Test that the slider's 'change' event fires a CHANGE_OPACITY event with the
  // correct opacity.  Also expect the corresponding analytics log
  this.expectLogAction(cm.Analytics.LayersTabAction.OPACITY_SLIDER_MOVED,
                       this.layerModel_.get('id'));
  var changeOpacityEmitted = false;
  var opacity;
  cm.events.listen(cm.app, cm.events.CHANGE_OPACITY, function(e) {
    changeOpacityEmitted = true;
    opacity = e.opacity;
  });

  // Simulate the user sliding the slider
  this.sliderMock_.setValue(50);
  cm.events.emit(this.sliderMock_, goog.ui.Component.EventType.CHANGE);
  cm.events.emit(this.sliderMock_, goog.ui.SliderBase.EventType.DRAG_VALUE_END);
  expectTrue(changeOpacityEmitted);
  expectEq(50, opacity);

  // Test whether changes in the app state are reflected upon the slider.
  this.appState_.setLayerOpacity('layer0', 40);
  expectEq(0.4, sliderDot.style.opacity);

  // The slider thumb should contain circle and dot divs.
  var circle = expectDescendantOf(this.sliderThumb_,
                                  withClass(cm.css.SLIDER_CIRCLE));
  expectDescendantOf(circle, withClass(cm.css.SLIDER_DOT));

  // Change the layer to non-TILE to verify that the slider is destroyed.
  this.layerModel_.set('type', cm.LayerModel.Type.KML);
};

/**
 * Tests that the workaround for goog.ui.Slider not properly initializing
 * is in place.  See discussion in LayerEntryView.wasRevealed.
 */
LayerEntryViewTest.prototype.testOpacitySliderInitializedOnReveal = function() {
  var childModel = cm.LayerModel.newFromMapRoot({
    id: 'childWithOpacity',
    title: 'Child Layer with Opacity',
    type: 'GOOGLE_MAP_TILES'
  });
  this.appState_.setLayerOpacity('childWithOpacity', 25);

  this.mockOpacitySlider_();

  this.layerModel_.set('type', cm.LayerModel.Type.FOLDER);
  this.layerModel_.get('sublayers').push(childModel);
  this.appState_.setLayerEnabled('layer0', false);
  this.appState_.setLayerEnabled('childWithOpacity', true);

  this.createView_();

  // Enable the folder layer
  var valueStackLength = this.sliderMock_.valueStack.length;
  this.appState_.setLayerEnabled('layer0', true);

  // The slider's value should have been set since being enabled
  expectTrue(this.sliderMock_.valueStack.length > valueStackLength);
  // Its value should match the one in the appState
  expectEq(25, this.sliderMock_.getValue());
  // And it should have been temporarily set to a different value to
  // force a redraw.
  expectNe(this.sliderMock_.valueStack[this.sliderMock_.valueStack.length - 1],
           this.sliderMock_.valueStack[this.sliderMock_.valueStack.length - 2]);
};


/** Tests that a single-select folder get a sublayer picker. */
LayerEntryViewTest.prototype.testSublayerPicker = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.FOLDER);
  this.layerModel_.set('folder_type', cm.LayerModel.FolderType.SINGLE_SELECT);
  this.layerModel_.isSingleSelect = function() { return true; };

  this.expectNew_('cm.SublayerPicker', _, this.layerModel_, '');
  this.createView_();
};

/** Tests that setting the 'title' property updates the displayed title. */
LayerEntryViewTest.prototype.updateTitle = function() {
  var parent = this.createView_();
  this.layerModel_.set('title', 'unicorns');
  expectDescendantOf(parent,
      withClass(cm.css.LAYER_TITLE), withText('unicorns'));
};

/** Tests whether word breaks are placed properly for title. */
LayerEntryViewTest.prototype.updateTitleWithWordBreaks = function() {
  var parent = this.createView_();
  var longTitle = 'thisisaverylooooooooooooooooooongone';
  this.layerModel_.set('title', longTitle);
  // We expect the title to be broken into chunks using <wbr> tags.
  // Each chunk should be no more than 10 characters long
  expectNoDescendantOf(parent, withClass(cm.css.LAYER_TITLE),
      withInnerHtml(longTitle));
  var titleHtml = expectDescendantOf(
      parent, withClass(cm.css.LAYER_TITLE)).innerHTML;
  var words = titleHtml.split('wbr');
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    var start, end;
    // Discard leading and trailing '<', '</', '>', '/>' - those are part
    // of the wbr tag, not part of the word.
    start = (word.indexOf('/>') === 0) ? 2 : (word.indexOf('>') === 0) ? 1 : 0;
    if (word.lastIndexOf('</') === word.length - 2) {
      end = word.length - 2;
    } else if (word.lastIndexOf('<') === word.length - 1) {
      end = word.length - 1;
    } else {
      end = word.length;
    }
    expectTrue(end - start <= 10);
  }
};

/** Tests that setting the 'description' property updates the description. */
LayerEntryViewTest.prototype.updateDescription = function() {
  var parent = this.createView_();
  this.layerModel_.set(
      'description', cm.Html.fromSanitizedHtml('heaps of unicorns'));
  expectDescendantOf(parent,
      withClass(cm.css.LAYER_DESCRIPTION), withText('heaps of unicorns'));
};

/** Tests that setting the 'legend' property updates the legend. */
LayerEntryViewTest.prototype.updateLegend = function() {
  this.appState_.setLayerEnabled(this.layerModel_.id, true);
  var parent = this.createView_();

  // clear legend and check that box disappears
  this.layerModel_.set('legend', cm.Html.fromSanitizedHtml(''));
  expectDescendantOf(
      parent, withClass(cm.css.LAYER_LEGEND_BOX), not(isShown()),
      hasDescendant(withClass(cm.css.LAYER_LEGEND), withText('')));

  // put a new legend
  var text = 'red - evil monsters<br/>' +
             'dark red - eviler monsters<br/>' +
             'blue - friendly monsters';
  this.layerModel_.set('legend', cm.Html.fromSanitizedHtml(text));
  expectDescendantOf(
      parent, withClass(cm.css.LAYER_LEGEND_BOX), isShown(),
      hasDescendant(withClass(cm.css.LAYER_LEGEND), withInnerHtml(text)));
};

/** Tests that the layer's timestamp is displayed correctly. */
LayerEntryViewTest.prototype.updateTime = function() {
  var parent = this.createView_();
  var timeElem = expectDescendantOf(parent, withClass(cm.css.TIMESTAMP));
  var now = new Date().valueOf() / 1000;
  var metadata = this.metadataModel_;

  // Tests that the current time is formatted to say 0 minutes ago.
  metadata.setUpdateTime(this.layerModel_, now);
  expectThat(cm.ui.getText(timeElem), containsRegExp(
      /Last updated: \d\d?:\d\d [AP]M \(0 minutes ago\)/));

  // Check 23 hours ago.
  metadata.setUpdateTime(this.layerModel_, now - 3600 * 23);
  expectThat(cm.ui.getText(timeElem), containsRegExp(
      /Last updated: \d\d?:\d\d [AP]M \(23 hours ago\)/));

  // Check yesterday.
  metadata.setUpdateTime(this.layerModel_, now - 3600 * 24);
  expectThat(cm.ui.getText(timeElem), containsRegExp(
      /Last updated: [A-Z][a-z]+ \d+, \d{4} \(1 day ago\)/));

  // Check 14 days ago.
  metadata.setUpdateTime(this.layerModel_, now - 3600 * 24 * 14);
  expectThat(cm.ui.getText(timeElem), containsRegExp(
      /Last updated: [A-Z][a-z]+ \d+, \d{4}/));

  // Try a missing timestamp.
  this.metadataModel_.setUpdateTime(this.layerModel_, null);
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

/** Tests that a click on a download link generates an Analytics log. */
LayerEntryViewTest.prototype.downloadUrlGeneratesLog = function() {
  this.layerModel_.set('type', cm.LayerModel.Type.KML);
  this.layerModel_.set('url', 'http://monsters.com.au');

  var parent = this.createView_();
  var link = expectDescendantOf(parent,
      'a', withText('Download KML'), withHref('http://monsters.com.au'));
  this.expectLogAction(
      cm.Analytics.LayersTabAction.DOWNLOAD_DATA_LINK_CLICKED,
      this.layerModel_.get('id'));
  cm.events.emit(link, 'click');
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
 * Tests download links are updated when a MEL/MEP LayerModel's URL changes.
 */
LayerEntryViewTest.prototype.updateUrlMelMep = function() {
  var melUrl =
      'http://mapsengine.google.com/map/viewer?mid=zYYdhADI7PvQ.kzJSidMtEIqY';
  var kmlUrl =
      'http://mapsengine.google.com/map/kml?mid=zYYdhADI7PvQ.kzJSidMtEIqY';
  this.layerModel_.set('type',
      cm.LayerModel.Type.GOOGLE_MAPS_ENGINE_LITE_OR_PRO);
  this.layerModel_.set('maps_engine_url', melUrl);
  this.layerModel_.set('url', kmlUrl);

  var parent = this.createView_();
  expectDescendantOf(parent,
      'a', withText('Download KML'), withHref(kmlUrl));
  expectDescendantOf(parent,
      'a', withText('View\xa0in\xa0Google\xa0Maps\xa0Engine'),
      withHref(melUrl));

  var melUrl2 =
      'http://mapsengine.google.com/map/viewer?mid=somethingelse';
  var kmlUrl2 =
      'http://mapsengine.google.com/map/kml?mid=somethingelse';

  this.layerModel_.set('maps_engine_url', melUrl2);
  this.layerModel_.set('url', kmlUrl2);
  expectNoDescendantOf(parent, 'a', withHref(kmlUrl));
  expectNoDescendantOf(parent, 'a', withHref(melUrl));
  expectDescendantOf(parent,
      'a', withText('Download KML'), withHref(kmlUrl2));
  expectDescendantOf(parent,
      'a', withText('View\xa0in\xa0Google\xa0Maps\xa0Engine'),
      withHref(melUrl2));
};

/**
 * Tests that the download links are not created when a MEL/MEP LayerModel's
 * URL changes, as specified by a true value for suppress_download_link.
 */
LayerEntryViewTest.prototype.updateUrlMelMepNoLink = function() {
  this.layerModel_.set('type',
      cm.LayerModel.Type.GOOGLE_MAPS_ENGINE_LITE_OR_PRO);
  this.layerModel_.set('maps_engine_url',
      'http://mapsengine.google.com/map/viewer?mid=zYYdhADI7PvQ.kzJSidMtEIqY');
  this.layerModel_.set('url',
      'http://mapsengine.google.com/map/kml?mid=zYYdhADI7PvQ.kzJSidMtEIqY');
  this.layerModel_.set('suppress_download_link', true);

  var parent = this.createView_();
  expectNoDescendantOf(parent, 'a', withText('Download KML'));
  expectNoDescendantOf(parent, 'a', withText('View in Google Maps Engine'));
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

/** Tests that the zoom link issues the expected events. */
LayerEntryViewTest.prototype.testZoomLink = function() {
  this.layerModel_.set('viewport', new cm.LatLonBox(30, 40, -30, -60));
  var parent = this.createView_();
  var link = expectDescendantOf(parent, 'a',
                                withText(containsRegExp(/Zoom/)));
  this.expectLogAction(
      cm.Analytics.LayersTabAction.ZOOM_TO_AREA, this.layerModel_.get('id'));
  this.expectEvent(this.view_, cm.events.ZOOM_TO_LAYER);
  cm.events.emit(link, 'click');
};

/**
 * Tests that the zoom link's visibility is updated when the layer's
 * 'viewport' or 'type' property changes.
 */
LayerEntryViewTest.prototype.testZoomLinkVisibility = function() {
  // A non-KML layer with a valid viewport...
  this.layerModel_.set('viewport', new cm.LatLonBox(30, 40, -80, -100));
  this.appState_.setLayerEnabled(this.layerModel_.id, true);
  var parent = this.createView_();
  // ...should have a visible zoom link.
  var zoomLink = expectDescendantOf(parent, 'a',
                                    withText(containsRegExp(/Zoom/)));
  expectThat(zoomLink, isShown());

  // When we clear the viewport...
  this.layerModel_.set('viewport', undefined);
  // ...the zoom link for a KML layer should still be present.
  expectThat(zoomLink, isShown());

  // But when we change to a Fusion table
  this.layerModel_.set('type', cm.LayerModel.Type.FUSION);
  // ...the zoom link should disappear.
  expectThat(zoomLink, not(isShown()));
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
      [cm.css.HEADER, cm.css.LAYER_DESCRIPTION, cm.css.LAYER_LEGEND,
       cm.css.TIMESTAMP, cm.css.SLIDER, cm.css.SUBLAYERS, cm.css.WARNING],
      function(cls) { return expectDescendantOf(parent, withClass(cls)); });

  // Each of the elements above should be faded out twice and faded in twice.
  expectCall(goog.style.setOpacity)(anyOf(elems), 0.5).times(elems.length);
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED, {zoom: 9}); // Fade out.

  expectCall(goog.style.setOpacity)(anyOf(elems), 1.0).times(elems.length);
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED, {zoom: 4}); // Fade in.

  expectCall(goog.style.setOpacity)(anyOf(elems), 0.5).times(elems.length);
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED, {zoom: 2}); // Fade out.

  expectCall(goog.style.setOpacity)(anyOf(elems), 1.0).times(elems.length);
  cm.events.emit(cm.app, cm.events.ZOOM_CHANGED, {zoom: 5}); // Fade in.
};

/**
 * Tests that the checkbox and content are updated when a LayerModel's
 * enabled state changes in the AppState.
 */
LayerEntryViewTest.prototype.updateEnabled = function() {
  var parent = this.createView_();
  var checkbox = expectDescendantOf(parent, inputType('checkbox'));
  expectFalse(checkbox.checked);  // layer is initially toggled off
  // Defaults for queries made by layer filtering when enabled layers
  // are changed.

  // Enable the layer.
  this.appState_.setLayerEnabled('layer0', true);
  expectTrue(checkbox.checked);
  // Warning element is hidden initially.
  expectNoDescendantOf(parent, 'div', not(isShown()), not(anyOf(
      [withClass(cm.css.WARNING),
       withClass(cm.css.CHECKBOX_FOLDER_DECORATION)])));

  // Disable the layer.
  this.appState_.setLayerEnabled('layer0', false);
  expectFalse(checkbox.checked);
  // Warning element is already hidden, make sure some other is hidden too.
  expectDescendantOf(parent, 'div', not(isShown()),
                     not(withClass(cm.css.WARNING)));
};

/**
 * Create a single-select folder with the given sublayerIds, and add it to
 * the map model.
 * @param {string} sublayerIds The IDs of the folder's sublayers.
 * @return {Array.<cm.LayerModel>} An array of the folder's sublayer models.
 * @private
 */
LayerEntryViewTest.prototype.createSingleSelect_ = function(sublayerIds) {
  var sublayerJson = {
    type: 'KML',
    url: 'ABC:abc'
  };
  var children = [];
  goog.array.forEach(sublayerIds, function(id) {
    sublayerJson.id = id;
    sublayerJson.title = 'Title for ' + id;
    var childModel = cm.LayerModel.newFromMapRoot(sublayerJson);
    children.push(childModel);
  }, this);
  var sublayerPicker = this.expectNew_('cm.SublayerPicker',
                                       _, this.layerModel_, _);
  sublayerPicker.dispose = function() {};
  this.layerModel_.set('type', cm.LayerModel.Type.FOLDER);
  this.layerModel_.set('folder_type', cm.LayerModel.FolderType.SINGLE_SELECT);
  this.layerModel_.set('sublayers', new google.maps.MVCArray(children));
  return children;
};

/**
 * Tests that a single-select folder's layer entry is updated when its
 * enabled state changes in the AppState.
 */
LayerEntryViewTest.prototype.updateEnabledSingleSelect = function() {
  var children = this.createSingleSelect_(['child1', 'child2'], 0);
  // Defaults for queries made by layer filtering when enabled layers
  // are changed.

  // Initialize the single-select menu with a single enabled child.
  this.appState_.setLayerEnabled('child1', true);
  this.appState_.setLayerEnabled('child2', false);

  var parent = this.createView_();
  var child1 = this.view_.layerEntryViews_['child1'].getEntryElement();
  var child2 = this.view_.layerEntryViews_['child2'].getEntryElement();

  // Initially disable folder.
  var checkbox = expectDescendantOf(parent, inputType('checkbox'));
  expectFalse(checkbox.checked);

  // Enable the parent layer.
  this.appState_.setLayerEnabled('layer0', true);
  expectTrue(checkbox.checked);

  expectDescendantOf(parent, 'div', withClass(cm.css.SUBLAYER_SELECT));
  expectDescendantOf(parent, 'div', withClass(cm.css.SUBLAYERS));

  // The selected sublayer's checkbox should not be shown.
  expectDescendantOf(child1, 'div', withClass(cm.css.CHECKBOX_CONTAINER),
                     not(isShown()));
  // The selected sublayer's title should not be shown, but its details
  // should be.
  expectDescendantOf(child1, 'label', withAttr('for', 'checkboxchild1'),
                     not(isShown()));
  expectDescendantOf(child1, 'div', withClass(cm.css.CONTENT), isShown());

  // The sibling sublayer should be hidden.
  expectThat(child2, isElement('div'), withAttr('display', 'none'));

  // The parent folder's details should not be shown. We can't
  // use expectNoDescendantOf(parent, ...) because the child content
  // element will give a false match.
  expectThat(this.view_.getEntryElement().childNodes[1], isElement('div'),
             withClass(cm.css.CONTENT), not(isShown()));
};

/** Tests displaying layer details of single-select folders in the editor. */
LayerEntryViewTest.prototype.updateEnabledSingleSelectInEditor = function() {
  var children = this.createSingleSelect_(['child1', 'child2'], 0);
  // Defaults for queries made by layer filtering when enabled layers
  // are changed.

  // Initialize the single-select menu with a single enabled child.
  this.appState_.setLayerEnabled('child1', true);
  this.appState_.setLayerEnabled('child2', false);

  var parent = this.createView_({enable_editing: true});
  var child1 = this.view_.layerEntryViews_['child1'].getEntryElement();
  var child2 = this.view_.layerEntryViews_['child2'].getEntryElement();

  // Enable the parent layer.
  this.appState_.setLayerEnabled('layer0', true);

  // The selected sublayer's checkbox should not be shown.
  expectDescendantOf(child1, 'div', withClass(cm.css.CHECKBOX_CONTAINER),
                     not(isShown()));

  // The selected sublayer's title and details should be shown.
  expectDescendantOf(child1, 'label', withAttr('for', 'checkboxchild1'),
                     isShown());
  expectDescendantOf(child1, 'div', withClass(cm.css.CONTENT),
                     isShown());

  // The sibling sublayer should be hidden.
  expectThat(child2, isElement('div'), withAttr('display', 'none'));

  // The parent folder's details should be shown.  We can't
  // use expectNoDescendantOf(parent, ...) because the child content
  // element will give a false match.
  expectThat(this.view_.getEntryElement().childNodes[1],
             isElement('div'), withClass(cm.css.CONTENT),
             isShown());
};

/**
 * Tests that a single-select folder is updated when a selection is made
 * from its SublayerPicker.
 */
LayerEntryViewTest.prototype.updateEnabledOnSelection = function() {
  var children = this.createSingleSelect_(['child1', 'child2']);

  // Initialize the single-select menu with 'child2' and its parent enabled.
  this.appState_.setLayerEnabled('child1', false);
  this.appState_.setLayerEnabled('child2', true);
  this.appState_.setLayerEnabled('layer0', true);
  var parent = this.createView_();
  var childElem1 = this.view_.layerEntryViews_['child1'].getEntryElement();
  var childElem2 = this.view_.layerEntryViews_['child2'].getEntryElement();

  // Check the class names of the parent layer, selected sublayer, and
  // non-selected sublayer.
  expectDescendantOf(parent, withClass(cm.css.CONTAINS_PROMOTED_SUBLAYER));
  var sublayers = expectDescendantOf(parent, withClass(cm.css.SUBLAYERS));
  var selected = expectDescendantOf(parent,
      withClass(cm.css.LAYER_ENTRY), withClass(cm.css.PROMOTED_SUBLAYER));
  expectEq(childElem2, selected);
  var notSelected = expectDescendantOf(sublayers,
      withClass(cm.css.LAYER_ENTRY), not(withClass(cm.css.PROMOTED_SUBLAYER)));
  expectEq(childElem1, notSelected);

  // Select the other sublayer and verify its class name.
  this.appState_.setLayerEnabled('child1', true);
  selected = expectDescendantOf(parent,
                                withClass(cm.css.LAYER_ENTRY),
                                withClass(cm.css.PROMOTED_SUBLAYER));
  expectEq(childElem1, selected);
};

/** Tests that a locked folder's sublayers are not shown. */
LayerEntryViewTest.prototype.updateEnabledLockedFolder = function() {
  var childModel = cm.LayerModel.newFromMapRoot({
    id: 'child',
    title: 'child model',
    type: 'KML',
    url: 'PQR:pqr'
  });
  this.layerModel_.set('type', cm.LayerModel.Type.FOLDER);
  this.layerModel_.get('sublayers').push(childModel);
  this.layerModel_.set('folder_type', cm.LayerModel.FolderType.LOCKED);

  // When a locked folder and its sublayers are enabled...
  this.appState_.setLayerEnabled('layer0', true);
  this.appState_.setLayerEnabled('child', true);
  var parent = this.createView_();
  // ...the sublayers should be hidden.  We can't
  // use expectNoDescendantOf(parent, ...) because descendant layers'
  // sublayer elements will give a false match for this layer's sublayers.
  expectThat(this.view_.getEntryElement().childNodes[2], not(isShown()));

  // When the folder is unlocked...
  this.layerModel_.set('folder_type', cm.LayerModel.FolderType.UNLOCKED);
  // ...the sublayers should be visible.
  expectThat(this.view_.getEntryElement().childNodes[2], isShown());
};

/**
 * Tests that a TOGGLE_LAYER event is emitted when a checkbox is clicked
 * and the corresponding Analytics logs are sent.  Note we cannot check the
 * passive Analytics logs for LAYER_HIDDEN and LAYER_DISPLAYED because we
 * don't have a real presenter.
 */
LayerEntryViewTest.prototype.clickCheckbox = function() {
  var parent = this.createView_();
  var checkbox = expectDescendantOf(parent, inputType('checkbox'));

  var event = null;
  cm.events.listen(this.view_, cm.events.TOGGLE_LAYER, function(e) {
    event = e;
  });

  // Simulate checking the checkbox.
  this.expectLogAction(cm.Analytics.LayersTabAction.TOGGLED_ON, 'layer0');
  checkbox.checked = true;
  cm.events.emit(checkbox, 'click');
  expectEq({id: 'layer0', value: true, type: cm.events.TOGGLE_LAYER}, event);

  // Simulate unchecking the checkbox.
  this.expectLogAction(cm.Analytics.LayersTabAction.TOGGLED_OFF, 'layer0');
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
  this.appState_.setLayerEnabled(this.layerModel_.id, true);

  var parent = this.createView_();
  var elems = goog.array.map(
      [cm.css.HEADER, cm.css.LAYER_DESCRIPTION, cm.css.LAYER_LEGEND,
       cm.css.TIMESTAMP, cm.css.SLIDER, cm.css.SUBLAYERS, cm.css.WARNING],
      function(cls) { return expectDescendantOf(parent, withClass(cls)); });

  // The layer should be faded out...
  expectCall(goog.style.setOpacity)(anyOf(elems), 0.5).times(elems.length);
  // ...when the metadata says the layer has no features.
  this.metadataModel_.set(this.layerModel_.getSourceAddress(), {
    'update_time': 1344989642.0,
    'length': 25000,
    'has_no_features': true
  });

  var warningElem = expectDescendantOf(parent, withClass(cm.css.WARNING),
                                       isShown());
  expectThat(cm.ui.getText(warningElem), containsRegExp(/nothing to show/));
  var timeElem = expectDescendantOf(parent, withClass(cm.css.TIMESTAMP),
                                    isShown());
  var downloadElem = expectDescendantOf(parent, 'a', withText('Download KML'),
                                        withHref('http://monsters.com.au'),
                                        isShown());
  expectEq('25 k', downloadElem.parentNode.title);
  var zoomLink = expectDescendantOf(
      parent, 'a', withText(containsRegExp(/Zoom/)));

  // When the length field is removed...
  this.metadataModel_.set(this.layerModel_.getSourceAddress(), {
    'update_time': 1344989642.0,
    'has_no_features': false
  });
  // ...the file-size tooltip should go away.
  downloadElem = expectDescendantOf(parent, 'a', withText('Download KML'));
  expectEq('', downloadElem.parentNode.title);
};

/**
 * Tests that matchingSublayersMessage is updated when appState changes.
 */
LayerEntryViewTest.prototype.testUpdateMatchingSublayersMessage = function() {
  var parent = this.createView_();
  var matchMsg = expectDescendantOf(
      parent, withClass(cm.css.LAYER_FILTER_INFO));
  this.layerModel_.set('type', cm.LayerModel.Type.FOLDER);
  var layerId = this.layerModel_.get('id');
  expectEq('', cm.ui.getText(matchMsg));

  // Setup expectations and calls.
  // We need the layers to be disabled, or the sublayer messages won't show.
  sub1 = cm.LayerModel.newFromMapRoot({id: 'sub1', type: 'KML'});
  sub2 = cm.LayerModel.newFromMapRoot({id: 'sub2', type: 'KML'});
  this.layerModel_.get('sublayers').setAt(0, sub1);
  this.layerModel_.get('sublayers').setAt(1, sub2);
  this.appState_.setLayerEnabled('sub1', false);
  this.appState_.setLayerEnabled('sub2', false);
  // Must set some query, but anything non-empty will do, since we will
  // be spoon-feeding the matches to the appstate.
  this.appState_.setFilterQuery('q');

  // Expectations for the actual test.
  expectEq('', cm.ui.getText(matchMsg));
  expectThat(matchMsg, isShown());

  // Make 'sub1' match.
  this.appState_.setMatchedLayers(['sub1']);
  expectEq('1 matching layer in this folder', cm.ui.getText(matchMsg));
  expectThat(matchMsg, isShown());

  // Make 'sub2' match as well.
  this.appState_.setMatchedLayers(['sub1', 'sub2']);
  expectEq('2 matching layers in this folder', cm.ui.getText(matchMsg));
  expectThat(matchMsg, isShown());

  // When the layer is enabled, the sublayer message is hidden.
  this.appState_.setLayerEnabled('layer0', true);
  this.appState_.setLayerEnabled('sub1', true);
  this.appState_.setLayerEnabled('sub2', true);
  expectThat(matchMsg, not(isShown()));
};

/**
 * Tests that a LayerEntryView's elements are removed from the DOM when it is
 * disposed of.
 */
LayerEntryViewTest.prototype.dispose = function() {
  var parent = this.createView_();
  this.view_.dispose();
  expectNoDescendantOf(parent, withClass(cm.css.LAYER_ENTRY));
};

/** Tests that the legend is omitted when requested. */
LayerEntryViewTest.prototype.testNoLegend = function() {
  var folderModel = cm.LayerModel.newFromMapRoot(
      {
        id: 'folder',
        type: 'FOLDER',
        folder_type: 'CHECK',
        legend: '<b>Folder</b> Legend',
        sublayers: [
          {id: 'sublayer1', type: 'KML', legend: 'sublayer 1 legend'},
          {id: 'sublayer2', type: 'KML', legend: 'sublayer 2 legend'}
          ]
      });
  var simpleModel = cm.LayerModel.newFromMapRoot(
      {
        id: 'simple',
        type: 'KML',
        legend: 'Simple Legend'
      });
  var parent = new FakeElement('div');
  this.appState_.setLayerEnabled('folder', true);
  this.appState_.setLayerEnabled('simple', true);
  this.appState_.setLayerEnabled('sublayer1', true);
  this.appState_.setLayerEnabled('sublayer2', true);
  var folderView = new cm.LayerEntryView(
      parent, folderModel, this.metadataModel_, this.appState_, {}, 0, false);
  var simpleView = new cm.LayerEntryView(
      parent, simpleModel, this.metadataModel_, this.appState_, {}, 1, false);
  expectNoDescendantOf(parent, withClass(cm.css.LAYER_LEGEND));
  expectNoDescendantOf(parent, withClass(cm.css.LAYER_LEGEND_BOX));
};

/* Would be good to have a test here to verify that tne analytics event
 * cm.Analytics.LayersPanelAction.EMBEDDED_LINK_CLICKED was triggered when
 * links within the description were clicked.  We can't do that, because when
 * there's no sanitizer, it's very hard to get an arbitrary tree of elements
 * inside FakeElement, and even if we did, we'd need events to propagate
 * correctly from the link up to the surrounding div.  Those two would
 * require massive expansion to FakeElement; we need a real DOM available
 * programmatically for testing purposes. */
