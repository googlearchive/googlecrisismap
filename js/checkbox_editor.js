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
 * @fileoverview [MODULE: edit] A checkbox.
 * @author romano@google.com (Raquel Romano)
 */
goog.provide('cm.CheckboxEditor');

goog.require('cm.Editor');
goog.require('cm.ui');

/**
 * A checkbox.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object.<{checked_value: *, unchecked_value: *}>} options
 *     options.checked_value: the value to set the editor's 'value' property to
 *         when the box is checked.
 *     options.unchecked_value: the value to set the editor's 'value'
 *         property to when the box is unchecked.
 * @extends cm.Editor
 * @constructor
*/
cm.CheckboxEditor = function(parentElem, id, options) {
  cm.Editor.call(this);

  /**
   * @type {*}
   * @private
   */
  this.checkedValue_ = options && options.checked_value !== undefined ?
      options.checked_value : true;

  /**
   * @type {*}
   * @private
   */
  this.uncheckedValue_ = options && options.unchecked_value !== undefined ?
      options.unchecked_value : null;

  /**
   * @type Element
   * @private
   */
  this.checkbox_ = cm.ui.create('input', {'type': 'checkbox', 'id': id});
  parentElem.appendChild(this.checkbox_);

  cm.events.listen(this.checkbox_, 'click', function() {
    // In the puppet test in IE 8, the .checked attribute is updated *after*
    // the 'click' event occurs, so we have to read .checked asynchronously.
    goog.global.setTimeout(goog.bind(function() {
      this.setValid(this.checkbox_.checked ? this.checkedValue_ :
          this.uncheckedValue_);
    }, this), 0);
  }, this);
};
goog.inherits(cm.CheckboxEditor, cm.Editor);

/** @override */
cm.CheckboxEditor.prototype.updateUi = function(value) {
  this.checkbox_.checked = (value === this.checkedValue_);
};
