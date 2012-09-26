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
 * @fileoverview [MODULE: edit] A dropdown menu selector.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.MenuEditor');

goog.require('cm.Editor');
goog.require('cm.ui');

/**
 * A list of radio buttons.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {{choices: Array.<cm.InputChoice>, div_class: string,
 *          menu_class: string}} options
 *     options.choices: an array of the choices to offer, in display order.
 *     options.div_class: a CSS class for the div containing all the buttons.
 *     options.menu_class: a CSS class for the dropdown menu.
 * @extends cm.Editor
 * @constructor
 */
cm.MenuEditor = function(parentElem, id, options) {
  cm.Editor.call(this);

  /**
   * @type Element
   * @private
   */
  this.select_;

  /**
   * @type Array.<*>
   * @private
   */
  this.values_ = [];

  var name = cm.ui.generateId('select');
  cm.ui.append(parentElem, this.select_ = cm.ui.create(
      'select', {'id': id, 'class': options && options.menu_class || null}));
  for (var i = 0; i < options.choices.length; i++) {
    var choice = options.choices[i];
    cm.ui.append(this.select_, cm.ui.create(
        'option', {'name': name}, choice.label));
    this.values_.push(choice.value);
  }
  cm.events.listen(this.select_, 'change', this.updateValue_, this);
};
goog.inherits(cm.MenuEditor, cm.Editor);

/**
 * Update the 'value' property based on the state of the menu selector.
 * @private
 */
cm.MenuEditor.prototype.updateValue_ = function() {
  this.setValid_(this.values_[this.select_.selectedIndex]);
};

/** @override */
cm.MenuEditor.prototype.updateUi = function(value) {
  for (var i = 0; i < this.values_.length; i++) {
    if (this.values_[i] === value) {
      this.select_.selectedIndex = i;
      break;
    }
  }
};
