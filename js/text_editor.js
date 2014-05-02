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
 * @fileoverview [MODULE: edit] A single-line text entry field.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.TextEditor');

goog.require('cm.Editor');
goog.require('cm.ui');

/**
 * A single-line text input field.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object.<{input_class: string, placeholder: string}>} options
 *     Editor options:
 *     options.input_class: a CSS class for the input element.
 *     options.placeholder: placeholder text for the input element.
 * @extends cm.Editor
 * @constructor
 */
cm.TextEditor = function(parentElem, id, options) {
  cm.Editor.call(this);

  /**
   * @type Element
   * @private
   */
  this.input_ = cm.ui.create('input',
      {'id': id, 'type': 'text',
       'class': options && options.input_class || null,
       'placeholder': options && options.placeholder || ''});
  parentElem.appendChild(this.input_);

  // When the user makes an edit in the UI, update the MVCObject property.
  cm.events.listen(
      this.input_, ['change', 'input', 'keyup', 'cut', 'paste'], function() {
    this.validate(this.input_.value);
  }, this);
};
goog.inherits(cm.TextEditor, cm.Editor);

/**
 * Validates the given user-supplied value for submission.
 * If acceptable, implementations must invoke this.setValid(...).
 * If validation fails, implementations must invoke this.setInvalid(message).
 * @param {string} value User-supplied value.
 */
cm.TextEditor.prototype.validate = function(value) {
  this.setValid(value.replace(/^\s+|\s+$/g, ''));
};

/** @override */
cm.TextEditor.prototype.updateUi = function(value) {
  this.input_.value = (value === null) ? '' : '' + value;
};
