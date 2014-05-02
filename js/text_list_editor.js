// Copyright 2014 Google Inc.  All Rights Reserved.
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
 * @fileoverview [MODULE: edit] A text entry field for a string array.
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.TextListEditor');

goog.require('cm.TextEditor');
goog.require('cm.ui');

/**
 * A single-line text input field that expects and emits an array of strings.
 * The array is edited as a comma-separated list.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object.<{input_class: string, placeholder: string}>} options
 *     Editor options:
 *     options.input_class: a CSS class for the input element.
 *     options.placeholder: placeholder text for the input element.
 * @extends cm.TextEditor
 * @constructor
 */
cm.TextListEditor = function(parentElem, id, options) {
  goog.base(this, parentElem, id, options);
};
goog.inherits(cm.TextListEditor, cm.TextEditor);

/**
 * Validates the given user-supplied value for submission.
 * If acceptable, implementations must invoke this.setValid(...).
 * If validation fails, implementations must invoke this.setInvalid(message).
 * @param {string} value User-supplied value.
 * @override
 */
cm.TextListEditor.prototype.validate = function(value) {
  this.setValid(goog.array.map(value.split(','), goog.string.trim));
};

/** @override */
cm.TextListEditor.prototype.updateUi = function(value) {
  this.input.value = (value === null) ? '' :
      goog.isArray(value) ? value.join(', ') : value + '';
};
