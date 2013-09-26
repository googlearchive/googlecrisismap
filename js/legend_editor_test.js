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

// @author joeysilva@google.com (Joey Silva)

goog.require('cm.css');

var EXTRACTED_LEGEND_ITEMS = {
  static_icon_urls: ['icon_href'],
  line_styles: [{color: '#111111'}],
  polygon_styles: [{fill_color: '#222222', border_color: '#333333'}],
  colors: ['#AAAAAA', '#BBBBBB']
};

function LegendEditorTest() {
  cm.TestBase.call(this);
  this.featurePalette_ = this.expectNew_('goog.ui.Palette', _);
  this.colorPalette_ = this.expectNew_('goog.ui.ColorPalette', _);

  this.parent_ = cm.ui.create('div', {'class': cm.css.LEGEND_EDITOR});
  this.draft_ = new google.maps.MVCObject();
  this.draft_.set('type', cm.LayerModel.Type.KML);

  this.setForTest_('goog.net.XhrIo.send',
                   createMockFunction('goog.net.XhrIo.send'));
}
LegendEditorTest.prototype = new cm.TestBase();
registerTestSuite(LegendEditorTest);

/**
 * Creates the legend editor, setting up all the initialization expectations for
 * it. Saves various editor elements into instance fields.
 * @return {cm.LegendEditor} The created legend editor.
 * @private
 */
LegendEditorTest.prototype.createEditor_ = function() {
  expectCall(this.featurePalette_.setSize)(_);
  expectCall(this.featurePalette_.render)(isElement('div'));

  expectCall(this.colorPalette_.setSize)(_);
  expectCall(this.colorPalette_.render)(isElement('div'));

  var url = this.draft_.get('url');
  if (url && !goog.string.isEmpty(url) && goog.array.contains(
      cm.LegendEditor.SUPPORTED_LAYER_TYPES_, this.draft_.get('type'))) {
    // Expect the request and palette update. The callback is called after the
    // LegendEditor is created.
    this.expectExtractRequest_(url);
    this.expectPaletteUpdates_(EXTRACTED_LEGEND_ITEMS);
  } else {
    // Expect the color palette to be updated to the default colors.
    this.expectColorPaletteUpdate_();
  }

  var legendEditor = new cm.LegendEditor(
      this.parent_, 'id', {legend_url: '/root/.legend'}, this.draft_);

  // Call the request callback if there is one.
  if (this.requestCallback_) {
    this.requestCallback_(this.generateExtractResponse_());
  }

  // Legend editor elements
  this.itemsElem_ =
      expectDescendantOf(this.parent_, withClass(cm.css.LEGEND_ITEMS));
  this.legendEditorElem_ = this.itemsElem_.parentNode;
  this.editHtmlLink_ = expectDescendantOf(
      this.legendEditorElem_, withText('Edit HTML'));

  // HTML editor elements
  var previewContainer = expectDescendantOf(this.parent_,
      withClass(cm.css.PREVIEW));
  // Container has three children: prefix, content, postfix.
  this.previewElem_ = previewContainer.childNodes[1];
  this.htmlEditorElem_ = previewContainer.parentNode;
  this.htmlTextarea_ = expectDescendantOf(this.htmlEditorElem_, 'textarea');
  this.editGraphicallyLink_ =
      expectDescendantOf(this.htmlEditorElem_, withText('Edit graphically'));
  this.revertLink_ =
      expectDescendantOf(this.htmlEditorElem_, withText('Revert'));

  return legendEditor;
};

/**
 * Sets the graphic of a given legend item to a color based on a given color
 * string, or to a given DOM element. Sets up appropriate expectations for
 * selecting the given color or element, and verifies that the graphic has been
 * updated in both the editor and preview. Will create and return a new legend
 * item if none is given.
 * @param {string|Element} graphic The graphic color string or DOM element to
 *     set the graphic to.
 * @param {Element} opt_legendItem The legend item to update. A new one is
 *     created and returned if none is specified.
 * @return {Element} The newly created graphic element in the editor's legend
 *     item, or the new legend item itself if one was created.
 * @private
 */
LegendEditorTest.prototype.setGraphic_ = function(graphic, opt_legendItem) {
  var isColor = goog.isString(graphic);
  var palette = isColor ? this.colorPalette_ : this.featurePalette_;

  // Emit a click event from either the given opt_legendItem's graphic, or from
  // the 'Add item' link.
  cm.events.emit(opt_legendItem ? expectDescendantOf(
      opt_legendItem, withClass(cm.css.LEGEND_GRAPHIC)).parentNode :
      expectDescendantOf(this.legendEditorElem_, withText('Add item')),
      'click');

  // Expect a call to the appropriate palette (color or feature), and emit a
  // palette selection action event.
  expectCall(isColor ? palette.getSelectedColor : palette.getSelectedItem)().
      willOnce(returnWith(graphic));
  expectCall(palette.setSelectedIndex)(-1);
  cm.events.emit(palette, goog.ui.Component.EventType.ACTION);

  // Expect a color graphic with the appropriate background color, in the case
  // of a color, or the DOM element itself in the case of a feature.
  var graphicMatcher = isColor ? isElement(
      withClass(cm.css.LEGEND_GRAPHIC), withClass(cm.css.LEGEND_COLOR),
      withStyle('backgroundColor', graphic)) : graphic;

  var legendItem = opt_legendItem || this.expectLegendItem_('', graphicMatcher);

  // Find and return the graphic element, if we were given a legend item;
  // otherwise return the newly created legend item.
  return opt_legendItem ?
      expectDescendantOf(legendItem, graphicMatcher) : legendItem;
};

/**
 * Tests that the given text and given matchers are found in a legend item, both
 * in the editor and the preview.
 * @param {string=} opt_text Expected text for the legend item. If the null
 *     string, will accept with a legend item with empty text (found in the
 *     preview), or one with the 'cm-empty' class (found in the editor).
 * @param {gjstest.Matcher=} opt_graphicMatcher Matcher to match the graphic
 *     element. Otherwise simply looks for the 'cm-legend-graphic' class.
 *     'cm-legend-graphic' class matcher is added by this method.
 * @return {Element} The matched editor legend item element.
 * @private
 */
LegendEditorTest.prototype.expectLegendItem_ = function(opt_text,
    opt_graphicMatcher) {
  var previewTextMatchers = ['div', withClass(cm.css.LEGEND_TEXT)];
  var editorTextMatchers = ['div', withClass(cm.css.LEGEND_TEXT)];
  if (opt_text != undefined) {
    // Mimic the preview and editor's respective whitespace trimming and
    // escaping behaviors.
    var trimmed = cm.LegendEditor.trimTrailingWhitespace_(opt_text);
    var previewHtml = cm.LegendEditor.convertWhitespaceToHtml_(trimmed);
    var editorHtml = cm.LegendEditor.convertWhitespaceToHtml_(opt_text);
    editorHtml = editorHtml.replace(/<br>[ ]?$/, '<br>&nbsp;');

    previewTextMatchers.push(withInnerHtml(sanitize(previewHtml)));
    editorTextMatchers.push(goog.string.isEmpty(opt_text) ?
        withClass(cm.css.EMPTY) : withInnerHtml(sanitize(editorHtml)));
  }
  var withGraphic = hasDescendant(
      opt_graphicMatcher || withClass(cm.css.LEGEND_GRAPHIC));

  expectDescendantOf(this.previewElem_, withClass(cm.css.LEGEND_ITEM),
      withGraphic, hasDescendant.apply(this, previewTextMatchers));
  return expectDescendantOf(this.itemsElem_, withClass(cm.css.LEGEND_ITEM),
      withGraphic, hasDescendant.apply(this, editorTextMatchers));
};

/**
 * Tests the display and modification of a legend item's text input field.
 * @param {Element} legendItem The editor legend item to update.
 * @param {Element} text The text to update the legend item with.
 * @private
 */
LegendEditorTest.prototype.setText_ = function(legendItem, text) {
  var textElem = expectDescendantOf(legendItem, isElement(
      'div', withClass(cm.css.LEGEND_TEXT)));
  var inputElem = expectDescendantOf(legendItem, isElement(
      'textarea', not(isShown())));

  // Activate and modify input element.
  cm.events.emit(textElem, 'click');
  expectThat(inputElem, isShown());
  inputElem.value = text;
  cm.events.emit(inputElem, 'change');
  this.expectLegendItem_(text);

  // Deactivate input element.
  cm.events.emit(inputElem, 'blur');
  expectThat(inputElem, not(isShown()));
};

/**
 * Tests the display and modification of the HTML textarea input field and
 * legend links for both valid and invalid HTML. Updates the preview element
 * manually with simple valid or invalid HTML, based on the given flag.
 * @param {boolean} html Value to set the HTML textarea to.
 * @param {boolean} valid Whether to set and check the preview element to
 *     a valid HTML (empty), or invalid HTML (single div).
 * @private
 */
LegendEditorTest.prototype.editHtml_ = function(html, valid) {
  this.htmlTextarea_.value = html;
  cm.ui.clear(this.previewElem_);
  if (!valid) {
    cm.ui.append(this.previewElem_, cm.ui.create('div'));
  }
  cm.events.emit(this.htmlTextarea_, 'change');

  // Test that the 'Edit graphically' and 'Revert' links are shown when
  // appropriate.
  expectThat(this.editGraphicallyLink_, valid ? isShown() : not(isShown()));
  expectThat(this.revertLink_.parentNode, valid ? not(isShown()) : isShown());
};

/**
 * Generates a successful legend extraction response, with
 * EXTRACTED_LEGEND_ITEMS as the response JSON.
 * @return {Object} Network response object.
 * @private
 */
LegendEditorTest.prototype.generateExtractResponse_ = function() {
  return {'target': {
    'isSuccess': function() { return true; },
    'getResponseJson': function() { return EXTRACTED_LEGEND_ITEMS; }
  }};
};

/**
 * Sets up the expectation of a network request for legend item extraction for a
 * given URL. Will set this.requestCallback_ to the given request callback.
 * @param {string} url Expected URL of the request.
 * @private
 */
LegendEditorTest.prototype.expectExtractRequest_ = function(url) {
  expectCall(goog.net.XhrIo.send)(
      '/root/.legend?url=' + encodeURIComponent(url), _).
      willOnce(goog.bind(function(url, callback) {
        this.requestCallback_ = callback;
      }, this));
};

/**
 * Sets up the expectation of new features and colors being added to the feature
 * and color palettes, based on the given list of legend items.
 * @param {Object=} opt_items Set of legend items that are expected to populate
 *     the feature and color palettes. These follow the same format of the
 *     legend item extractor response. If none are specified, the defaults of
 *     the palettes are expected.
 * @private
 */
LegendEditorTest.prototype.expectPaletteUpdates_ = function(opt_items) {
  var items = opt_items ||
      {static_icon_urls: [], line_styles: [], polygon_styles: [], colors: []};

  expectCall(this.featurePalette_.setContent)(_).
      willOnce(goog.bind(function(content) {
        var contentElem = cm.ui.create('div');
        goog.array.forEach(content, function(item) {
          cm.ui.append(contentElem, item);
        });

        var featureCount = 0;
        featureCount += items['static_icon_urls'].length;
        goog.array.forEach(items['static_icon_urls'], function(icon) {
          expectDescendantOf(contentElem, isElement(
              withClass(cm.css.LEGEND_GRAPHIC), withClass(cm.css.LEGEND_ICON),
              withStyle('backgroundImage', 'url(' + icon + ')')));
        });
        featureCount += items['line_styles'].length;
        goog.array.forEach(items['line_styles'], function(line) {
          expectDescendantOf(contentElem, isElement(
              withClass(cm.css.LEGEND_GRAPHIC), withClass(cm.css.LEGEND_LINE),
              hasDescendant(withStyle('borderBottomColor', line['color']))));
        });
        featureCount += items['polygon_styles'].length;
        goog.array.forEach(items['polygon_styles'], function(polygon) {
          if (polygon['border_color']) {
            expectDescendantOf(
                contentElem, withClass(cm.css.LEGEND_GRAPHIC),
                withClass(cm.css.LEGEND_POLYGON),
                withStyle('backgroundColor', polygon['fill_color']));
          } else {
            featureCount--;
          }
        });
        expectEq(featureCount ? featureCount : 1, content.length,
            'Call to setContent produced ' + content + ' from ' + items +
            '; arrays differ in expected lengths.');
      }, this));

  this.expectColorPaletteUpdate_(items['colors']);
};

/**
 * Sets up the expectation of the colors of the color palette being updated to
 * the given list of colors, or to the default colors.
 * @param {Array.<string>} opt_colors Array of colors that are expected to be
 *     used as the color palette colors. If none are given, the default colors
 *     are expected.
 * @private
 */
LegendEditorTest.prototype.expectColorPaletteUpdate_ = function(opt_colors) {
  var custom_colors = opt_colors || [];
  expectCall(this.colorPalette_.setColors)(_).
      willOnce(goog.bind(function(colors) {
        // Verify that the beginning of the colors array is the same as
        // custom_colors.
        expectThat(goog.array.slice(colors, 0, custom_colors.length),
                   elementsAre(custom_colors));

        // Verify that the rest are equal to the default colors (as many as
        // there is room for).
        expectThat(goog.array.slice(colors, custom_colors.length),
                   elementsAre(goog.array.slice(
                       cm.LegendEditor.DEFAULT_COLORS_, 0, Math.max(
                           cm.LegendEditor.DEFAULT_COLORS_.length -
                               custom_colors.length, 0))));
      }, this));
};

/** Tests the creation, modification, and deletion of a legend item. */
LegendEditorTest.prototype.testLegendItem = function() {
  this.createEditor_();

  // Test creating a legend item (with an icon).
  var legendItem = this.setGraphic_(cm.ui.create('div',
      {'class': [cm.css.LEGEND_GRAPHIC, cm.css.LEGEND_ICON],
       'style': {'backgroundImage': 'url(icon_url)'}}));

  // Test modifying its graphic element (to a color).
  this.setGraphic_('#ABCDEF', legendItem);

  // Test modifying its text.
  this.setText_(legendItem, 'Legend item text');

  // Test the delete button of the legend item.
  var closeBtn = expectDescendantOf(legendItem, withClass(cm.css.CLOSE_BUTTON));
  cm.events.emit(closeBtn, 'click');
  expectNoDescendantOf(this.parent_, withClass(cm.css.LEGEND_ITEM));
};

/** Tests the escaping and trimming behaviour of whitespace and linebreaks. */
LegendEditorTest.prototype.testWhitespace = function() {
  this.createEditor_();
  var legendItem = this.setGraphic_('#ABCDEF');

  this.setText_(legendItem, '  a  \n  \n  b  \n \n ');
  this.expectLegendItem_('&nbsp;&nbsp;a<br><br>&nbsp;&nbsp;b');
};

/** Tests extraction request sending and handling. */
LegendEditorTest.prototype.testExtractRequest = function() {
  // Test that a non-empty URL triggers a request during initialization.
  this.draft_.set('url', 'kml_url');
  this.createEditor_();

  // Test that changing the URL triggers a request.
  var response = this.generateExtractResponse_();
  this.expectExtractRequest_('new_kml_url');
  this.draft_.set('url', 'new_kml_url');
  this.expectPaletteUpdates_(EXTRACTED_LEGEND_ITEMS);
  this.requestCallback_(response);

  // Test that null and empty URLs don't trigger requests, and reset the palette
  // to have default colors.
  this.expectColorPaletteUpdate_();
  this.draft_.set('url', null);
  this.expectColorPaletteUpdate_();
  this.draft_.set('url', '  ');

  // Test that failures are handled gracefully.
  this.expectExtractRequest_('failure');
  this.draft_.set('url', 'failure');
  this.expectPaletteUpdates_();
  this.requestCallback_(
      {'target': {'isSuccess': function() { return false; }}});

  // Test that multiple requests are queued up.
  this.expectExtractRequest_('initial');
  this.draft_.set('url', 'initial');
  this.draft_.set('url', 'queued but overridden');
  this.draft_.set('url', 'queued');

  // Expect queued request, then respond to initial to trigger queued.
  this.expectExtractRequest_('queued', EXTRACTED_LEGEND_ITEMS);
  this.expectPaletteUpdates_(EXTRACTED_LEGEND_ITEMS); // for initial request
  this.requestCallback_(response);
};

/** Tests that no extract requests are made for non-supported layer types. */
LegendEditorTest.prototype.testNonSupportedLayerType = function() {
  this.draft_.set('type', 'not-supported');
  this.createEditor_();
};

/** Tests switching to and using the HTML editor. */
LegendEditorTest.prototype.testEditHtml = function() {
  var editor = this.createEditor_();

  // Test that the legend editor is visible, and the HTML editor isn't.
  expectThat(this.legendEditorElem_, isShown());
  expectThat(this.htmlEditorElem_, not(isShown()));

  // Test that clicking the edit HTML link toggles which editors are visible,
  // and loads the editor's value into the HTML textarea.
  editor.set('value', new cm.Html('legend HTML'));
  cm.events.emit(this.editHtmlLink_, 'click');
  expectThat(this.legendEditorElem_, not(isShown()));
  expectThat(this.htmlEditorElem_, isShown());
  expectThat(this.htmlTextarea_, withValue('legend HTML'));

  // Simulate a preview, since the test cannot actually convert innerHTML into
  // elements, or vice versa.
  var graphicElem;
  cm.ui.append(this.previewElem_,
      cm.ui.create('div', {'class': cm.css.LEGEND_ITEM},
          graphicElem = cm.ui.create('div',
              {'class': [cm.css.LEGEND_GRAPHIC, cm.css.WHATEVER_CLASS],
               'style': 'whatever-style: whatever-value'}),
          cm.ui.create('div',
                       {'class': [cm.css.LEGEND_TEXT, cm.css.WHATEVER_CLASS],
                        'style': 'whatever-style: whatever-value'},
              'Legend item text')));

  // Test that clicking the edit graphically link correctly loads the HTML in
  // the preview element back into the legend editor.
  expectThat(this.editGraphicallyLink_, isShown());
  cm.events.emit(this.editGraphicallyLink_, 'click');
  this.expectLegendItem_('Legend item text', graphicElem);
};

/** Tests various invalid legend HTMLs. */
LegendEditorTest.prototype.testInvalidHtml = function() {
  this.createEditor_();
  cm.events.emit(this.editHtmlLink_, 'click');
  var invalidLegendItems = [
      // no cm-legend-item class
      cm.ui.create('div', {},
          cm.ui.create('div', {'class': cm.css.LEGEND_GRAPHIC}),
          cm.ui.create('div', {'class': cm.css.LEGEND_TEXT})),
      // no graphic or text element
      cm.ui.create('div', {'class': cm.css.LEGEND_ITEM}),
      // no text element
      cm.ui.create('div', {'class': cm.css.LEGEND_ITEM},
          cm.ui.create('div', {'class': cm.css.LEGEND_GRAPHIC})),
      // no graphic element
      cm.ui.create('div', {'class': cm.css.LEGEND_ITEM},
          cm.ui.create('div', {'class': cm.css.LEGEND_TEXT}))
  ];

  goog.array.forEach(invalidLegendItems, function(invalidItem) {
    cm.ui.append(this.previewElem_, invalidItem);
    cm.events.emit(this.htmlTextarea_, 'change');
    expectThat(this.editGraphicallyLink_, not(isShown()));
    expectThat(this.revertLink_.parentNode, isShown());

    cm.ui.clear(this.previewElem_);
    cm.events.emit(this.htmlTextarea_, 'change');
    expectThat(this.editGraphicallyLink_, isShown());
    expectThat(this.revertLink_.parentNode, not(isShown()));
  }, this);
};

/** Tests reverting from invalid to saved, valid HTML. */
LegendEditorTest.prototype.testRevertHtml = function() {
  var editor = this.createEditor_();

  // Call updateUi with invalid HTML; no edit graphically or revert links.
  cm.ui.append(this.previewElem_, cm.ui.create('div'));
  editor.updateUi(new cm.Html('invalid HTML'));
  expectThat(this.legendEditorElem_, not(isShown()));
  expectThat(this.htmlEditorElem_, isShown());
  expectThat(this.editGraphicallyLink_, not(isShown()));
  expectThat(this.revertLink_.parentNode, not(isShown()));

  // Enter valid HTML, then invalid HTML, and revert to valid HTML.
  this.editHtml_('valid HTML', true);
  this.editHtml_('invalid HTML', false);
  cm.ui.clear(this.previewElem_);
  cm.events.emit(this.revertLink_, 'click');
  expectThat(this.htmlTextarea_, withValue('valid HTML'));
  expectThat(this.editGraphicallyLink_, isShown());
  expectThat(this.revertLink_.parentNode, not(isShown()));

  // Invalidate, and then correct the HTML manually.
  this.editHtml_('invalid HTML', false);
  this.editHtml_('corrected HTML', true);
};
