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
 * A select list of options. The editor's 'value' will default to the first
 * option (for single-select menus) or the empty array (for multi-select menus)
 * when the value is set to null or undefined. When no layer choices
 * exist, 'value' defaults to null for a single-select menu or the empty array
 * for a multi-select menu.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {{choices: Array.<cm.InputChoice>, div_class: string,
 *          menu_class: string, multiple: boolean}} options
 *     options.choices: an array of the choices to offer, in display order.
 *     options.div_class: a CSS class for the div containing all the buttons.
 *     options.menu_class: a CSS class for the dropdown menu.
 *     options.multiple: if true, create a multi-select menu.
 * @extends cm.Editor
 * @constructor
 */
cm.MenuEditor = function(parentElem, id, options) {
  cm.Editor.call(this);

  /**
   * @type Element
   * @protected
   */
  this.selectElem;

  /**
   * @type Array.<*>
   * @protected
   */
  this.values = [];

  /**
   * @type boolean
   * @private
   */
  this.isMultiSelect_ = options && options.multiple;

  /**
   * @type string
   * @protected
   */
  this.elementId = cm.ui.generateId('select');

  cm.ui.append(parentElem, this.selectElem = cm.ui.create(
      'select', {'id': id, 'class': options && options.menu_class || null}));
  if (this.isMultiSelect_) {
    this.selectElem.setAttribute('multiple', true);
  }
  for (var i = 0; i < options.choices.length; i++) {
    var choice = options.choices[i];
    cm.ui.append(this.selectElem, cm.ui.create(
        'option', {'name': this.elementId}, choice.label));
    this.values.push(choice.value);
  }
  cm.events.listen(this.selectElem, 'change', this.updateValue_, this);

  // Call updateUI to correct invalid values.
  this.updateUi(this.get('value'));
};
goog.inherits(cm.MenuEditor, cm.Editor);

/**
 * Update the 'value' property based on the state of the menu selector.
 * @private
 */
cm.MenuEditor.prototype.updateValue_ = function() {
  var isSelected = goog.bind(function(v, index) {
    return this.selectElem.options[index].selected;
  }, this);
  if (this.isMultiSelect_) {
    this.setValid(goog.array.filter(this.values, isSelected));
  } else {
    this.setValid(goog.array.find(this.values, isSelected));
  }
};

/**
 * Update the UI to select the given value. If the value is null or undefined,
 * set the editor's 'value' property to a valid value: for a multiselect, the
 * empty list, and for a single select, either the first available option
 * or null if there are no options.
 * @override
 */
cm.MenuEditor.prototype.updateUi = function(value) {
  // If the value is null or undefined, prevent the editor's 'value'
  // property (and any bound properties) from being set to undefined.
  // Instead, select the menu's first option if it exists.
  if (value === null || value == undefined) {
    if (this.isMultiSelect_) {
      value = [];
    } else {
      value = this.values.length > 0 ? this.values[0] : null;
    }
    this.setValid(value);
  }

  // Update the selected options. Note that this may not properly
  // handle object value types since 1) closure mutates objects with
  // goog.getUid() (e.g., when constructing a set), and 2) the
  // closure set contains() method will not perform deep comparison.
  var valueSet = new goog.structs.Set(this.isMultiSelect_ ?
      /** @type Array.<*> */(value) : [value]);
  goog.array.forEach(this.values, function(v, index) {
    this.selectElem.options[index].selected = valueSet.contains(v);
  }, this);
};
