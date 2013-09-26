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
 * @fileoverview [MODULE: edit] A text area for editing HTML code.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.HtmlEditor');

goog.require('cm.Editor');
goog.require('cm.Html');
goog.require('cm.css');
goog.require('cm.ui');

/**
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object.<{preview_class: string,
 *                  preview_prefix: Element,
 *                  preview_postfix: Element}>} options Editor options:
 *     options.preview_class: a CSS class for the rendered HTML preview area
 *         (which will be applied in addition to the "cm-preview" class).
 *     options.preview_prefix: Content to prepend to preview content.
 *     options.preview_postfix: Content to append to preview content.
 * @extends cm.Editor
 * @constructor
 */
cm.HtmlEditor = function(parentElem, id, options) {
  cm.Editor.call(this);

  /**
   * @type Element
   * @protected
   */
  this.htmlEditorElem;

  /**
   * @type Element
   * @protected
   */
  this.textarea = null;

  /**
   * @type Element
   * @protected
   */
  this.preview = null;

  /**
   * @type Element
   * @protected
   */
  this.previewContent = null;

  /**
   * @type Element
   * @private
   */
  this.previewTriangle_ = null;

  /**
   * @type boolean
   * @private
   */
  this.previewShown_ = false;

  this.textarea = cm.ui.create('textarea', {'id': id});
  var previewLabel = cm.ui.create('div', {'class': cm.css.DISCLOSURE},
      this.previewTriangle_ = cm.ui.create('span', {'class': cm.css.TRIANGLE}),
      cm.ui.create('span', {'class': cm.css.LABEL}, 'Preview'));
  var previewClass = options && options.preview_class || '';
  this.previewContent = cm.ui.create('span');
  var previewPrefix = (options && options.preview_prefix) ||
      cm.ui.create('span');
  var previewPostfix = (options && options.preview_postfix) ||
      cm.ui.create('span');
  this.preview = cm.ui.create('div', {'class': [cm.css.PREVIEW, previewClass]},
      previewPrefix, this.previewContent, previewPostfix);
  cm.ui.append(parentElem, this.htmlEditorElem = cm.ui.create('div', {},
      this.textarea,
      previewLabel,
      this.preview));

  // When the user clicks the "Preview" triangle, toggle the HTML preview.
  this.showPreview_(false);
  cm.events.listen(previewLabel, 'click', function() {
    this.showPreview_(!this.previewShown_);
  }, this);

  // When the user makes an edit in the UI, update the MVCObject property.
  cm.events.listen(this.textarea, ['keyup', 'change', 'input', 'cut', 'paste'],
                   this.handleChange, this);
};
goog.inherits(cm.HtmlEditor, cm.Editor);

/**
 * Updates the value and preview based on the HTML present in the textarea.
 * @protected
 */
cm.HtmlEditor.prototype.handleChange = function() {
  var value = new cm.Html(this.textarea.value);
  this.setValid(value);
  value.pasteInto(this.previewContent);
};

/** @override */
cm.HtmlEditor.prototype.updateUi = function(value) {
  if (!value) {
    value = new cm.Html('');
  }
  this.textarea.value = value.getUnsanitizedHtml();
  value.pasteInto(this.previewContent);
};

/**
 * Shows or hides the rendered HTML preview.
 * @param {boolean} show True/false to show/hide the preview area.
 * @private
 */
cm.HtmlEditor.prototype.showPreview_ = function(show) {
  // These constants are used only in this function.
  var TRIANGLE_RIGHT = '\u25b6';
  var TRIANGLE_DOWN = '\u25bc';

  cm.ui.setText(this.previewTriangle_, show ? TRIANGLE_DOWN : TRIANGLE_RIGHT);
  this.preview.style.display = show ? '' : 'none';
  this.previewShown_ = show;
};
