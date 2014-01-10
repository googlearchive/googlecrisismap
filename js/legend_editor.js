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

/**
 * @fileoverview [MODULE: edit] A tool for creating legends.
 * @author joeysilva@google.com (Joey Silva)
 */
goog.provide('cm.LegendEditor');

goog.require('cm.Editor');
goog.require('cm.Html');
goog.require('cm.HtmlEditor');
goog.require('cm.LayerModel');
goog.require('cm.css');
goog.require('cm.ui');
goog.require('goog.net.XhrIo');
goog.require('goog.ui.ColorPalette');
goog.require('goog.ui.ColorPicker');
goog.require('goog.ui.Palette');

/**
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object} options Editor options:
 *     options.preview_class: a CSS class for the rendered HTML preview area
 *         (which will be applied in addition to the "cm-preview" class).
 *     options.legend_url: URL to the legend item extractor service.
 * @param {google.maps.MVCObject} draft Inspector's draft object.
 * @extends cm.HtmlEditor
 * @constructor
 */
cm.LegendEditor = function(parentElem, id, options, draft) {
  /**
   * @type {string}
   * @private
   */
  this.legendUrl_ = options.legend_url;

  /**
   * Flag set to true when a KML extract request is sent. Reset upon receiving
   * the response. No other requests will be sent while this flag is set, but
   * a new request will instead be queued up.
   * @type {boolean}
   * @private
   */
  this.extractRequestSent_ = false;

  /**
   * Flag to indicate a KML request was made while one was still pending. Will
   * be reset when the queued request is sent, after the pending request is
   * completed. Only one request is queued up at a time, and it will read the
   * value of the draft's URL at the time the queued request is sent.
   * @type {boolean}
   * @private
   */
  this.extractRequestPending_ = false;

  /**
   * Element containing the entire legend editor. Hidden when switched to the
   * HTML editor.
   * @type Element
   * @private
   */
  this.legendEditorElem_;

  /**
   * Element containing the various legend items being edited.
   * @type Element
   * @private
   */
  this.legendItemsElem_;

  /**
   * Popup containing the graphic selection palettes.
   * @type Element
   * @private
   */
  this.paletteDialog_;

  /**
   * Item shown instead of the feature palette when waiting on an extract
   * request.
   * @type Element
   * @private
   */
  this.loadingElem_;

  /**
   * Palette containing extracted features (icons, lines and polygons).
   * @type {goog.ui.Palette}
   * @private
   */
  this.featurePalette_;

  /**
   * Parent element of the feature palette.
   * @type Element
   * @private
   */
  this.featurePaletteElem_;

  /**
   * Element containing the feature palette and a separator. Hidden when there
   * are no extracted features available.
   * @type Element
   * @private
   */
  this.featurePaletteContainer_;

  /**
   * Palette containing extracted and default colors.
   * @type {goog.ui.ColorPalette}
   * @private
   */
  this.colorPalette_;

  /**
   * Callback registered by showPaletteDialog_, and called by the palette click
   * handlers.
   * @type {?function(Element)}
   * @private
   */
  this.paletteCallback_ = null;

  /**
   * Flag used to keep the selection dialog open, despite clicks being received
   * by the global click listener that closes the dialog. Set when one clicks on
   * the dialog, but not a particular graphic, and whenever the dialog is opened
   * due to a click. Reset by that global listener that would have otherwise
   * closed the dialog.
   * @type {boolean}
   * @private
   */
  this.ignoreCloseClick_ = false;

  /**
   * The last valid cm.Html value that the legend editor can understand, if such
   * a value has been observed. Can be reverted to by the HTML editor.
   * @type {?cm.Html}
   * @private
   */
  this.lastValid_ = null;

  /**
   * Link shown in the HTML editor to go back to the legend editor. Hidden when
   * the HTML is no longer a valid to the legend editor, and shown again when it
   * is.
   * @type Element
   * @private
   */
  this.editGraphicallyLink_;

  /**
   * Link shown in the HTML editor to revert the HTML back to the last value
   * that was valid to the legend editor. Shown as soon as a change is made that
   * invalidates the legend HTML.
   * @type Element
   * @private
   */
  this.revertToLastValidLink_;

  /**
   * Whether or not the legend editor is shown (as opposed to the HTML editor).
   * @type {boolean}
   * @private
   */
  this.shown_ = true;

  // Construct graphic selection dialog.
  var colorPaletteElem;
  this.paletteDialog_ = cm.ui.create('div',
      {'class': [cm.css.GRAPHIC_SELECTOR, cm.css.POPUP]},
      this.featurePaletteContainer_ = cm.ui.create('div', {},
          this.loadingElem_ = cm.ui.create('div', {}, 'Loading...'),
          this.featurePaletteElem_ = cm.ui.create('div',
              {'class': cm.css.FEATURE_PALETTE}),
          cm.ui.create('hr')),
      colorPaletteElem = cm.ui.create('div', {'class': cm.css.COLOR_PALETTE}));

  cm.events.listen(this.paletteDialog_, 'click', function() {
    this.ignoreCloseClick_ = true;
  }, this);
  cm.events.listen(cm.ui.document.body, 'click', function() {
    if (this.ignoreCloseClick_) {
      this.ignoreCloseClick_ = false;
    } else {
      cm.ui.remove(this.paletteDialog_);
    }
  }, this);

  this.featurePalette_ = new goog.ui.Palette([cm.ui.create('div')]);
  this.featurePalette_.setSize(cm.LegendEditor.PALETTE_WIDTH_);
  this.featurePalette_.render(this.featurePaletteElem_);
  goog.style.setElementShown(this.featurePaletteContainer_, false);
  cm.events.listen(this.featurePalette_, goog.ui.Component.EventType.ACTION,
      goog.bind(this.handleFeaturePaletteClick_, this));

  this.colorPalette_ = new goog.ui.ColorPalette(
      cm.LegendEditor.DEFAULT_COLORS_);
  this.colorPalette_.setSize(cm.LegendEditor.PALETTE_WIDTH_);
  this.colorPalette_.render(colorPaletteElem);
  cm.events.listen(this.colorPalette_, goog.ui.Component.EventType.ACTION,
      goog.bind(this.handleColorPaletteClick_, this));

  // Construct legend editor.
  var addItemLink, editHtmlLink, revertLink;
  cm.ui.append(parentElem, this.legendEditorElem_ = cm.ui.create('div', {},
      this.legendItemsElem_ = cm.ui.create('div',
          {'class': cm.css.LEGEND_ITEMS}),
      addItemLink = cm.ui.createLink(cm.MSG_ADD_ITEM),
      cm.ui.SEPARATOR_DOT,
      editHtmlLink = cm.ui.createLink(cm.MSG_EDIT_HTML)));

  cm.events.listen(addItemLink, 'click', goog.bind(
      this.showPaletteDialog_, this, addItemLink, goog.bind(
          function(selectedItem) {
            this.setLegendItemGraphic_(
                /** @type {!cm.LegendEditor.LegendItem_} */ (
                    this.createLegendItem_()), selectedItem);
          }, this)));
  cm.events.listen(editHtmlLink, 'click',
                   goog.bind(this.showHtmlEditor_, this, true, undefined));

  // Listen for changes on the url. New requests will wait for the pending one
  // to complete.
  cm.events.onChange(draft, 'url',
                     goog.bind(this.handleUrlChanged_, this, draft));
  this.handleUrlChanged_(draft);

  // Construct underlying HTML editor, and hide its elements.
  goog.base(this, parentElem, id, options);

  cm.ui.append(this.htmlEditorElem,
      this.editGraphicallyLink_ =
          cm.ui.createLink(cm.MSG_EDIT_GRAPHICALLY),
      this.revertToLastValidLink_ = cm.ui.create('div', {},
          cm.ui.create('span', {'class': cm.css.VALIDATION_ERROR},
              cm.MSG_INVALID_LEGEND),
          cm.ui.SEPARATOR_DOT,
          revertLink = cm.ui.createLink(cm.MSG_REVERT)));

  cm.events.listen(this.editGraphicallyLink_, 'click',
                   goog.bind(this.showHtmlEditor_, this, false, undefined));
  cm.events.listen(revertLink, 'click', this.handleRevertClick_, this);

  // Use graphical editing mode only if the legend service is available.
  this.showHtmlEditor_(!this.legendUrl_);
};
goog.inherits(cm.LegendEditor, cm.HtmlEditor);

/**
 * Type definition for either the editor or preview component of a legend item.
 * graphicElem and textElem are the legend's graphic and text, respectively.
 * elem is the element containing both of these (and in the case of the editor,
 * potentially other elements), and is ultimately what is rendered (and saved in
 * the case of the preview component).
 * @typedef {{elem: Element, graphicElem: Element, textElem: Element}}
 * @private
 */
cm.LegendEditor.LegendItemComponent_;

/**
 * An object combining both the edit component and preview component of a legend
 * item. The 'editor' field holds the DOM element displayed in the inspector
 * dialog, and the 'preview' field holds the DOM element that will be displayed
 * in the panel view.
 * @typedef {{editor:  cm.LegendEditor.LegendItemComponent_,
 *            preview: cm.LegendEditor.LegendItemComponent_}}
 * @private
 */
cm.LegendEditor.LegendItem_;

/**
 * Number of icons/colors displayed on each row of the palettes.
 * @const
 * @type {number}
 * @private
 */
cm.LegendEditor.PALETTE_WIDTH_ = 14;

/**
 * Number of pixels each graphic element's height and width are, as defined by
 * the 'cm-legend-icon' CSS class. Overridden if icons are smaller, to avoid
 * scaling them up.
 * @const
 * @type {number}
 * @private
 */
cm.LegendEditor.GRAPHIC_SIZE_ = 15;

/**
 * Number of pixels each graphic element's margin-right is.
 * @const
 * @type {number}
 * @private
 */
cm.LegendEditor.GRAPHIC_MARGIN_RIGHT_ = 5;

/**
 * List of colors to use in palette by default.
 * @const
 * @type {Array.<string>}
 * @private
 */
cm.LegendEditor.DEFAULT_COLORS_ = goog.ui.ColorPicker.SIMPLE_GRID_COLORS;

/**
 * List of supported layer types for making legend item extraction requests. All
 * other layer types will only have a color palette available.
 * @type {Array.<cm.LayerModel.Type>}
 * @private
 */
cm.LegendEditor.SUPPORTED_LAYER_TYPES_ = [
    cm.LayerModel.Type.KML
];

/** @override */
cm.LegendEditor.prototype.updateUi = function(value) {
  var htmlValue = /** @type {cm.Html} */(value || cm.Html.EMPTY);
  goog.base(this, 'updateUi', htmlValue);
  if (this.shown_) {
    if (this.previewValid_()) {
      cm.ui.clear(this.legendItemsElem_);
      goog.array.forEach(this.previewContent.childNodes,
          this.createLegendItem_, this);
    } else {
      this.showHtmlEditor_(true, htmlValue);
    }
  } else {
    this.handleChange();
  }
};

/**
 * Returns whether or not the preview element contains valid legend-editor HTML.
 * Specifically, all children must have the class cm-legend-item, and each of
 * these children must have a descendant with the class cm-legend-graphic, as
 * well as one with the class cm-legend-text.
 * @return {boolean} Whether or not this is a valid legend editor legend.
 * @private
 */
cm.LegendEditor.prototype.previewValid_ = function() {
  for (var i = 0, itemElem; itemElem = this.previewContent.childNodes[i]; i++) {
    if (!goog.dom.classes.has(itemElem, cm.css.LEGEND_ITEM)) {
      return false;
    }
    if (!cm.ui.getByClass(cm.css.LEGEND_GRAPHIC, itemElem) ||
        !cm.ui.getByClass(cm.css.LEGEND_TEXT, itemElem)) {
      return false;
    }
  }
  return true;
};

/**
 * Shows or hides the HTML editor based on the given value of display, as well
 * as hides or shows the graphical legend editor, as appropriate.
 * @param {boolean} showHtml Whether or not to display the HTML editor. Also
 *     whether or not to hide the legend editor.
 * @param {cm.Html=} opt_value Optional value to update the editor's UI with.
 *     Defaults to the editor's stored value.
 * @private
 */
cm.LegendEditor.prototype.showHtmlEditor_ = function(showHtml, opt_value) {
  if (!this.legendUrl_) {
    showHtml = true;  // no legend service means no graphical editing
  }

  goog.style.setElementShown(this.htmlEditorElem, showHtml);
  goog.style.setElementShown(this.legendEditorElem_, !showHtml);

  // Set this.shown_ to the opposite of showHtml, and update the UI if this
  // causes a change.
  if (this.shown_ != (this.shown_ = !showHtml) || opt_value) {
    var from = showHtml ? cm.css.LEGEND_EDITOR : cm.css.HTML_EDITOR;
    var to = showHtml ? cm.css.HTML_EDITOR : cm.css.LEGEND_EDITOR;

    var parentElem = goog.dom.getAncestorByClass(this.legendEditorElem_, from);
    goog.dom.classes.swap(parentElem, from, to);

    this.updateUi(opt_value || this.get('value'));
  }
};

/**
 * Check whether the updated value is valid. If so, saves the value as the last
 * valid value, and enables the option to edit the legend graphically;
 * otherwise, removes that option, and offers to revert, if there is a
 * previously valid value stored to revert to.
 * @override
 */
cm.LegendEditor.prototype.handleChange = function() {
  if (!this.shown_) {
    goog.base(this, 'handleChange');
    var valid = this.previewValid_();
    if (valid) {
      this.lastValid_ = /** @type {cm.Html} */(this.get('value'));
    }
    goog.style.setElementShown(this.editGraphicallyLink_, valid);
    goog.style.setElementShown(
        this.revertToLastValidLink_, !valid && this.lastValid_);
  }
};

/**
 * Resets the editor to the last valid legend HTML, or blank if none existed,
 * and sets the view back to the graphical legend editor.
 * @private
 */
cm.LegendEditor.prototype.handleRevertClick_ = function() {
  this.textarea.value = (this.lastValid_ || cm.Html.EMPTY).getUnsanitizedHtml();
  this.handleChange();
};

/**
 * Creates a legend item, and adds the appropriate event listeners to the editor
 * component.
 * @param {Element=} opt_previewElem If specified, the element is parsed for a
 *     graphic element and text element to copy for the editor object that is
 *     created. The editor will use copies of its graphic and text elements, and
 *     preview will consist of a reference to it and its components. Must be a
 *     child of an element for which verify_() returned true.
 * @return {?cm.LegendEditor.LegendItem_} The legend item created, or null if
 *     an invalid preview element was given.
 * @private
 */
cm.LegendEditor.prototype.createLegendItem_ = function(opt_previewElem) {
  var graphicElem = opt_previewElem ?
      cm.ui.getByClass(cm.css.LEGEND_GRAPHIC, opt_previewElem) :
      cm.ui.create('div', {'class': cm.css.LEGEND_GRAPHIC});
  var textElem = opt_previewElem ?
      cm.ui.getByClass(cm.css.LEGEND_TEXT, opt_previewElem) :
      cm.ui.create('div', {'class': cm.css.LEGEND_TEXT});

  if (!graphicElem || !textElem) {
    return null;
  }

  var legendItem = {
    editor: {
      elem: null, // set below
      graphicElem: graphicElem.cloneNode(true),
      textElem: textElem.cloneNode(true)
    },
    preview: {
      elem: opt_previewElem ||
          cm.ui.create('div', {'class': cm.css.LEGEND_ITEM},
                       cm.ui.create('div', {'style': 'width: 1%'}, graphicElem),
                       cm.ui.create('div', {}, textElem)),
      graphicElem: graphicElem,
      textElem: textElem
    }
  };

  var inputElem, deleteBtn;
  cm.ui.append(this.legendItemsElem_, legendItem.editor.elem =
      cm.ui.create('div', {'class': cm.css.LEGEND_ITEM},
          cm.ui.create('div', {'style': 'width: 1%'},
              legendItem.editor.graphicElem),
          cm.ui.create('div', {'style': 'vertical-align:top;position:relative'},
              legendItem.editor.textElem,
              inputElem = cm.ui.create('textarea',
                  {'class': cm.css.LEGEND_TEXT, 'type': 'text', 'value':
                      goog.string.unescapeEntities(cm.ui.getText(textElem)).
                      replace(/<br\/?>/g, '\n').replace(/&nbsp;/g, ' ')})),
          cm.ui.create('div', {'style': 'width: 1%'},
              deleteBtn = cm.ui.create('div',
                                       {'class': cm.css.CLOSE_BUTTON}))));
  if (!opt_previewElem) {
    cm.ui.append(this.previewContent, legendItem.preview.elem);
  }

  cm.events.listen(legendItem.editor.graphicElem.parentNode, 'click',
                   goog.bind(this.handleGraphicClick_, this, legendItem));

  cm.events.listen(legendItem.editor.textElem, 'click',
                   goog.bind(this.setTextEditable_, this,
                             legendItem, inputElem, true));
  cm.events.listen(inputElem, 'blur',
                  goog.bind(this.setTextEditable_, this,
                            legendItem, inputElem, false));
  this.setTextEditable_(legendItem, inputElem, false);

  cm.events.listen(inputElem,
                   ['keyup', 'change', 'input', 'cut', 'paste'],
                   goog.bind(this.handleTextChange_, this,
                             legendItem, inputElem, false));

  cm.events.listen(deleteBtn, 'click',
                   goog.bind(this.handleDeleteItem_, this, legendItem));

  return legendItem;
};

/**
 * Displays the selection dialog in response to clicking an existing legend's
 * graphic.
 * @param {cm.LegendEditor.LegendItem_} legendItem The legend item to update.
 * @private
 */
cm.LegendEditor.prototype.handleGraphicClick_ = function(legendItem) {
  this.showPaletteDialog_(legendItem.editor.graphicElem,
                   goog.bind(this.setLegendItemGraphic_, this, legendItem));
};

/**
 * Sets the legend text editable or not by toggling between a textarea input
 * element and a non-editable text element.
 * @param {cm.LegendEditor.LegendItem_} legendItem The associated legend item.
 * @param {Element} inputElem The textarea element to enable or disable.
 * @param {boolean} editable Whether to show or hide the textarea.
 * @private
 */
cm.LegendEditor.prototype.setTextEditable_ = function(legendItem, inputElem,
    editable) {
  goog.style.setElementShown(inputElem, editable);
  if (editable) {
    this.handleTextChange_(legendItem, inputElem);
    inputElem.focus();
  } else {
    this.handleTextChange_(legendItem, inputElem, true);
  }
};

/**
 * Removes trailing whitespace at the end of each line, as well as trailing
 * line-breaks.
 * @param {string} text String to trim.
 * @return {string} Trimmed string.
 * @private
 */
cm.LegendEditor.trimTrailingWhitespace_ = function(text) {
  return text.replace(/[ ]+$/gm, '').replace(/\n+$/, '');
};

/**
 * Converts line-breaks to <br> tags, and pairs of whitespace into pairs of
 * &nbsp;'s.
 * @param {string} text String to convert.
 * @return {string} Converted, HTML string.
 * @private
 */
cm.LegendEditor.convertWhitespaceToHtml_ = function(text) {
  // Only convert pairs of spaces to avoid creating unnecessary &nbsp;'s.
  return text.replace(/\n/g, '<br>').replace(/(  )/g, '&nbsp;&nbsp;');
};

/**
 * Handles changes to the editor's input element by mirroring the text into the
 * editor and preview components' text elements. Does HTML newline/whitespace
 * conversion, and trims trailing whitespace and newlines.
 * @param {cm.LegendEditor.LegendItem_} legendItem The associated legend item.
 * @param {Element} inputElem The associated textarea element.
 * @param {boolean=} opt_trimInEditor Whether to trim the input in the editor's
 *     component, as is done always in the preview component.
 * @private
 */
cm.LegendEditor.prototype.handleTextChange_ = function(legendItem, inputElem,
    opt_trimInEditor) {
  var value = goog.string.htmlEscape(inputElem.value);
  var trimmedText = cm.LegendEditor.trimTrailingWhitespace_(value);
  var trimmedHtml = cm.LegendEditor.convertWhitespaceToHtml_(trimmedText);
  var editorHtml = cm.LegendEditor.convertWhitespaceToHtml_(value);

  if (opt_trimInEditor) {
    inputElem.value = trimmedText;
    editorHtml = trimmedHtml;
  } else {
    // Add &nbsp; to the end of a trailing <br> tag to ensure the editor element
    // expands for the new line.
    editorHtml = editorHtml.replace(/<br>[ ]?$/, '<br>&nbsp;');
  }

  var empty = goog.string.isEmpty(editorHtml) &&
      (!!opt_trimInEditor || editorHtml.indexOf('\n') == -1);
  goog.dom.classes.enable(legendItem.editor.textElem, cm.css.EMPTY, empty);
  if (empty) {
    editorHtml = cm.MSG_EMPTY_LEGEND_TEXT;
  }

  new cm.Html(editorHtml).pasteInto(legendItem.editor.textElem);
  new cm.Html(trimmedHtml).pasteInto(legendItem.preview.textElem);
  this.setValid(cm.Html.fromElement(this.previewContent));

  inputElem.style.height =
      legendItem.editor.textElem.offsetHeight + 'px';
};

/**
 * Deletes the given legend item from the editor and from the preview and
 * updates the HTML editor's 'value' property.
 * @param {cm.LegendEditor.LegendItem_} legendItem Legend item to delete.
 * @private
 */
cm.LegendEditor.prototype.handleDeleteItem_ = function(legendItem) {
  cm.ui.remove(legendItem.editor.elem);
  cm.ui.remove(legendItem.preview.elem);
  this.setValid(cm.Html.fromElement(this.previewContent));
};

/**
 * Displays the selection dialog under the given element, and registers the
 * given callback to be called when a selection is made.
 * @param {Element} underElem Element to position the selection dialog under.
 * @param {function(Element)} callback Function to call when a selection is
 *     made. The selected item is passed in as an argument.
 * @private
 */
cm.LegendEditor.prototype.showPaletteDialog_ = function(underElem, callback) {
  cm.ui.remove(this.paletteDialog_);

  var pos = goog.style.getClientPosition(underElem);
  goog.style.setStyle(this.paletteDialog_, {
    'left': pos.x + 'px',
    'top': pos.y + underElem.offsetHeight + 'px'
  });
  cm.ui.append(cm.ui.document.body, this.paletteDialog_);
  this.paletteCallback_ = callback;
  this.ignoreCloseClick_ = true;
};

/**
 * Sends a KML extraction request to the server using the draft's URL. Only
 * one request is sent at once, and other requests will cause one (and only one)
 * to be queued up for later. Successful requests will update the selection
 * dialog feature and color palettes with new graphic elements generated from
 * the returned extracted legend items.
 * @param {google.maps.MVCObject} draft This layer's draft.
 * @private
 */
cm.LegendEditor.prototype.handleUrlChanged_ = function(draft) {
  var url = /** @type {string} */(draft.get('url'));
  if (url && !goog.string.isEmpty(url) && goog.array.contains(
      cm.LegendEditor.SUPPORTED_LAYER_TYPES_, draft.get('type'))) {
    if (!this.extractRequestSent_) {
      goog.style.setElementShown(this.loadingElem_, true);
      goog.style.setElementShown(this.featurePaletteElem_, false);
      goog.style.setElementShown(this.featurePaletteContainer_, true);

      this.extractRequestSent_ = true;
      // In edit mode, the app root is always at "../..".
      goog.net.XhrIo.send(this.legendUrl_ + '?url=' + encodeURIComponent(url),
                          goog.bind(function(event) {
        if (this.disposed_) {
          return;
        }

        goog.style.setElementShown(this.loadingElem_, false);
        var features = [];
        var colors = new goog.structs.Set();
        if (event.target.isSuccess()) {
          var graphics = event.target.getResponseJson();
          if (graphics) {
            features = this.constructFeatureElements_(graphics);
            colors.addAll(graphics['colors']);
          }
        }
        // Add extracted features, or a single div if there are none because
        // the palette requires at least one element.
        this.featurePalette_.setContent(features.length ?
            features : [cm.ui.create('div')]);
        goog.style.setElementShown(this.featurePaletteContainer_,
                                   features.length);

        // Add all the default colors to the set, and then pick a fixed
        // number of colors from the beginning of the set, to display.
        colors.addAll(cm.LegendEditor.DEFAULT_COLORS_);
        this.colorPalette_.setColors(goog.array.slice(
            colors.getValues(), 0, cm.LegendEditor.DEFAULT_COLORS_.length));

        goog.style.setElementShown(this.featurePaletteElem_, true);

        this.extractRequestSent_ = false;
        if (this.extractRequestPending_) {
          this.extractRequestPending_ = false;
          this.handleUrlChanged_(draft);
        }
      }, this));
    } else {
      this.extractRequestPending_ = true;
    }
  } else {
    // No valid URL; clear any queued request, and only use the default color
    // palette.
    this.extractRequestPending_ = false;
    goog.style.setElementShown(this.featurePaletteContainer_, false);
    this.colorPalette_.setColors(cm.LegendEditor.DEFAULT_COLORS_);
  }
};

/**
 * Constructs elements based on the given graphics object, containing styles for
 * icons, lines, and polygons.
 * @param {{static_icon_urls: Array.<Object>, line_styles: Array.<Object>,
 *     polygon_styles: Array.<Object>}} graphics Object containing arrays of
 *     objects describing icon, line, and polygon styles.
 * @return {Array.<Element>} An array containing elements constructed based on
 *     the given graphics objects.
 * @private
 */
cm.LegendEditor.prototype.constructFeatureElements_ = function(graphics) {
  var features = [];
  goog.array.extend(
      features,
      goog.array.map(graphics['static_icon_urls'], function(static_icon_url) {
        var iconElem = cm.ui.create('div', {
          'class': [cm.css.LEGEND_GRAPHIC, cm.css.LEGEND_ICON],
          'style': {
            'backgroundImage': 'url(' + static_icon_url + ')'
          }
        });

        // Load image to detect its size, if browser supports that. Otherwise,
        // the image will be the default size specified by the CSS class
        // 'cm-legend-icon'.
        if (goog.global['Image']) {
          var img = new Image();
          img.onload = function() {
            var horizDiff = cm.LegendEditor.GRAPHIC_SIZE_ - img.width;
            var vertDiff = cm.LegendEditor.GRAPHIC_SIZE_ - img.height;

            // Only need to override CSS if both dimensions are small; otherwise
            // the larger dimension will prevent any image scaling-up.
            if (horizDiff > 0 && vertDiff > 0) {
              var horizMargin = horizDiff / 2;
              var vertMargin = vertDiff / 2;

              iconElem.style.width = img.width + 'px';
              iconElem.style.height = img.height + 'px';
              iconElem.style.margin = goog.string.format(
                  '%spx %spx', vertMargin, horizMargin);

              img = null;
            }
            img.src = static_icon_url;
          };
        }
        return iconElem;
      }),
      goog.array.map(graphics['line_styles'], function(line) {
        return cm.ui.create('div',
            {'class': [cm.css.LEGEND_GRAPHIC, cm.css.LEGEND_LINE]},
            cm.ui.create('div', {'style': {
              'borderBottomColor': line['color']
            }}));
      }),
      goog.array.map(graphics['polygon_styles'], function(polygon) {
        return cm.ui.create('div', {
          'class': [cm.css.LEGEND_GRAPHIC, cm.css.LEGEND_POLYGON],
          'style': {
            'backgroundColor': polygon['fill_color'] || 'white',
            'borderColor': polygon['border_color'] || 'black'
          }
        });
      }));
  return features;
};

/**
 * Closes the selection dialog and calls the registered palette callback with
 * the selected palette element. Also clears this.paletteCallback_.
 * @private
 */
cm.LegendEditor.prototype.handleFeaturePaletteClick_ = function() {
  cm.ui.remove(this.paletteDialog_);
  this.paletteCallback_ && this.paletteCallback_(
      /** @type {Element} */(this.featurePalette_.getSelectedItem()));
  this.paletteCallback_ = null;
  this.featurePalette_.setSelectedIndex(-1);
};

/**
 * Closes the selection dialog and calls the registered palette callback with a
 * graphic element generated with the selected background color.  Also clears
 * this.paletteCallback_.
 * @private
 */
cm.LegendEditor.prototype.handleColorPaletteClick_ = function() {
  cm.ui.remove(this.paletteDialog_);
  if (this.paletteCallback_) {
    var color = this.colorPalette_.getSelectedColor();
    this.paletteCallback_(cm.ui.create('div',
        {'class': [cm.css.LEGEND_GRAPHIC, cm.css.LEGEND_COLOR],
         'style': {'backgroundColor': color}}));
  }
  this.paletteCallback_ = null;
  this.colorPalette_.setSelectedIndex(-1);
};

/**
 * Sets the given legend item's graphic to a copy of the given graphic element
 * (both in the editor and in the preview), and updates the 'value' property
 * with the updated legend HTML.
 * @param {cm.LegendEditor.LegendItem_} legendItem The legend item to update.
 * @param {Element} graphicElem The new graphic element.
 * @private
 */
cm.LegendEditor.prototype.setLegendItemGraphic_ = function(legendItem,
    graphicElem) {
  var parent = /** @type Element */(legendItem.editor.graphicElem.parentNode);
  cm.ui.clear(parent);
  cm.ui.append(parent,
      legendItem.editor.graphicElem = graphicElem.cloneNode(true));

  parent = /** @type Element */(legendItem.preview.graphicElem.parentNode);
  cm.ui.clear(parent);
  cm.ui.append(parent,
      legendItem.preview.graphicElem = graphicElem.cloneNode(true));
  this.setValid(cm.Html.fromElement(this.previewContent));
};

/** @override */
cm.LegendEditor.prototype.dispose = function() {
  this.featurePalette_.dispose();
  this.colorPalette_.dispose();
  goog.base(this, 'dispose');
};
