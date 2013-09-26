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
 * @fileoverview [MODULE: edit] A nullable numeric entry field.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.NumberEditor');

goog.require('cm.Editor');
goog.require('cm.ui');

/**
 * A single numeric input field.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object.<{input_class: string,
 *                  require_integer: boolean,
 *                  minimum: number,
 *                  maximum: number}>} options Editor options:
 *     options.input_class: a CSS class for the input element.
 *     options.require_integer: if true, allow only an integer value.
 *     options.minimum: if specified, reject values below this minimum.
 *     options.maximum: if specified, reject values above this maximum.
 * @extends cm.Editor
 * @constructor
 */
cm.NumberEditor = function(parentElem, id, options) {
  cm.Editor.call(this);
  options = options || {};

  /**
   * @type Element
   * @private
   */
  this.input_ = cm.ui.create('input', {'id': id, 'class': options.input_class});
  parentElem.appendChild(this.input_);

  // When the user makes an edit in the UI, update the MVCObject property.
  cm.events.listen(
      this.input_, ['change', 'input', 'keyup', 'cut', 'paste'], function() {
    var text = this.input_.value;
    if (text.match(/\S/)) {
      var number = text - 0;
      if (isNaN(number) || !isFinite(number)) {
        this.setInvalid('should be a number');
      } else if (options.require_integer && number % 1) {
        this.setInvalid('should be a whole number');
      } else if (options.minimum != null && number < options.minimum) {
        this.setInvalid('should not be less than ' + options.minimum);
      } else if (options.maximum != null && number > options.maximum) {
        this.setInvalid('should not be greater than ' + options.maximum);
      } else {
        this.setValid(number);
      }
    } else {
      this.setValid(null);  // empty input is valid and yields a value of null
    }
  }, this);
};
goog.inherits(cm.NumberEditor, cm.Editor);


/** @override */
cm.NumberEditor.prototype.updateUi = function(value) {
  this.input_.value = (value === null) ? '' : '' + value;
};
