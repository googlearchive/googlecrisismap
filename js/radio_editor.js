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
 * @fileoverview [MODULE: edit] A radio button selector.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.RadioEditor');

goog.require('cm.Editor');
goog.require('cm.ui');

/**
 * A list of radio buttons.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {{choices: Array.<cm.InputChoice>, div_class: string,
 *          radio_class: string, label_class: string}} options
 *     options.choices: an array of the choices to offer, in display order.
 *     options.div_class: a CSS class for the div containing all the buttons.
 *     options.radio_class: a CSS class for the radio buttons.
 *     options.label_class: a CSS class for the labels next to the buttons.
 * @extends cm.Editor
 * @constructor
 */
cm.RadioEditor = function(parentElem, id, options) {
  cm.Editor.call(this);

  /**
   * @type Element
   * @private
   */
  this.div_;

  /**
   * @type Array.<Element>
   * @private
   */
  this.buttons_ = [];

  /**
   * @type Array.<*>
   * @private
   */
  this.values_ = [];

  var name = cm.ui.generateId('select');
  cm.ui.append(parentElem, this.div_ = cm.ui.create(
      'div', {'id': id, 'class': options && options.div_class || null}));
  for (var i = 0; i < options.choices.length; i++) {
    var choice = options.choices[i];
    var buttonId = cm.ui.generateId('option');
    var button = cm.ui.create(
        'input', {'type': 'radio', 'name': name, 'id': buttonId});
    var label = cm.ui.create('label', {'for': buttonId}, choice.label);
    cm.ui.append(this.div_, button, label, cm.ui.create('br'));
    this.buttons_.push(button);
    this.values_.push(choice.value);
    cm.events.listen(button, 'click', this.updateValue_, this);
  }
};
goog.inherits(cm.RadioEditor, cm.Editor);

/**
 * Update the 'value' property based on the state of the radio buttons.
 * @private
 */
cm.RadioEditor.prototype.updateValue_ = function() {
  for (var i = 0; i < this.buttons_.length; i++) {
    if (this.buttons_[i].checked) {
      this.setValid(this.values_[i]);
      return;
    }
  }
  this.setValid(null);
};

/** @override */
cm.RadioEditor.prototype.updateUi = function(value) {
  for (var i = 0; i < this.values_.length; i++) {
    this.buttons_[i].checked = (this.values_[i] === value);
  }
};
