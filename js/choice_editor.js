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
 * @fileoverview [MODULE: edit] An editor for an answer choice to a question
 *     within a topic.
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.ChoiceEditor');

goog.require('cm.Editor');
goog.require('cm.InspectorView');
goog.require('cm.editors');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.array');
goog.require('goog.dom.classes');

/**
 * An editor for an answer choice to a question within a topic.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object.<{delete_callback: function()}>} options Editor options:
 *     options.delete_callback: Called when the user clicks the delete button.
 * @extends cm.Editor
 * @constructor
 */
cm.ChoiceEditor = function(parentElem, id, options) {
  cm.Editor.call(this);
  options = options || {};

  /**
   * @private Element
   */
  this.input_ = cm.ui.create(
      'div', {'class': cm.css.CHOICE_CONTAINER, 'id': id},
      this.deleteChoiceBtn_ = cm.ui.create('div', cm.css.CLOSE_BUTTON),
      this.tableElem_ = cm.ui.create('table',
          {'class': cm.css.EDITORS, 'cellpadding': '0', 'cellspacing': '0'}));
  parentElem.appendChild(this.input_);

  /**
   * Renders the fields of the choice.
   * @private cm.InspectorView
   */
  this.inspector_ = new cm.InspectorView(this.tableElem_);

  if (options.delete_callback) {
    cm.events.listen(this.deleteChoiceBtn_, 'click', options.delete_callback);
  }

  // When the delete button is hovered, highlight the section of the page
  // that would be deleted if clicked.
  cm.events.listen(this.deleteChoiceBtn_, 'mouseover', function() {
    if (parentElem.parentNode) {
      goog.dom.classes.add(parentElem.parentNode, cm.css.DELETE_HOVER);
    }
  });
  cm.events.listen(this.deleteChoiceBtn_, 'mouseout', function() {
    if (parentElem.parentNode) {
      goog.dom.classes.remove(parentElem.parentNode, cm.css.DELETE_HOVER);
    }
  });
};
goog.inherits(cm.ChoiceEditor, cm.Editor);

/**
 * An array of editor specs representing the fields of a choice.
 * @private Array.<cm.EditorSpec>
 */
cm.ChoiceEditor.CHOICE_FIELDS_ = [
  {key: 'title', label: cm.MSG_CHOICE_BUTTON_TITLE,
   type: cm.editors.Type.TEXT, tooltip: cm.MSG_CHOICE_BUTTON_TITLE_TOOLTIP},
  {key: 'label', label: cm.MSG_CHOICE_STANDALONE_LABEL,
   type: cm.editors.Type.TEXT,
   tooltip: cm.MSG_CHOICE_STANDALONE_LABEL_TOOLTIP},
  // TODO(shakusa) Create and use a color editor using goog.ui.ColorPalette
  {key: 'color', label: cm.MSG_CHOICE_COLOR, type: cm.editors.Type.TEXT,
   tooltip: cm.MSG_CHOICE_COLOR_TOOLTIP}
];

/** @override */
cm.ChoiceEditor.prototype.updateUi = function(value) {
  var choice = /** @type {{id: string,
                           title: string,
                           label: string,
                           color: string}} */(value || {});

  // We let the inspector render the UI for us.  It requires an MVCObject,
  // so convert from JSON.
  var choiceObj = new google.maps.MVCObject();
  // InspectorView expects the editable object to have predictable, quoted keys,
  // but the keys of choice are obfuscated by the closure compiler. We are
  // careful here not to call setValues but set each property individually.
  choiceObj.set('title', choice.title || '');
  choiceObj.set('label', choice.label || '');
  choiceObj.set('color', choice.color || '');

  var editors = this.inspector_.inspect(
      cm.ChoiceEditor.CHOICE_FIELDS_, choiceObj);

  // Listen to changes in the value of each of the editors. Set the value of
  // this editor to the copied values from all the editors, as JSON with the
  // same type as choice.
  goog.array.forEach(editors, function(editor) {
    cm.events.listen(editor, 'value_changed', function() {
      var draft = this.inspector_.collectEdits().draftValues;
      var value = {
        title: draft['title'],
        label: draft['label'],
        color: draft['color']
      };
      if (choice.id) {
        value.id = choice.id;
      }
      this.setValid(value);
    }, this);
  }, this);
};
