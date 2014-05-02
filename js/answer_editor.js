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
 * @fileoverview [MODULE: edit] An editor for an answer to a topic question.
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.AnswerEditor');

goog.require('cm.Editor');
goog.require('cm.InspectorView');
goog.require('cm.editors');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.array');

/**
 * An editor for an answer to a topic question.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object.<{delete_callback: function()}>} options Editor options:
 *     options.delete_callback: Called when the user clicks the delete button.
 * @extends cm.Editor
 * @constructor
 */
cm.AnswerEditor = function(parentElem, id, options) {
  cm.Editor.call(this);
  options = options || {};

  this.input_ = cm.ui.create('div', {'class': cm.css.ANSWER_CONTAINER,
                                     'id': id},
     this.deleteAnswerBtn_ = cm.ui.create('div', cm.css.CLOSE_BUTTON),
     this.tableElem_ = cm.ui.create('table',
         {'class': cm.css.EDITORS, 'cellpadding': '0', 'cellspacing': '0'}));
  parentElem.appendChild(this.input_);

  this.inspector_ = new cm.InspectorView(this.tableElem_);

  if (options.delete_callback) {
    cm.events.listen(this.deleteAnswerBtn_, 'click', options.delete_callback);
  }
};
goog.inherits(cm.AnswerEditor, cm.Editor);

/**
 * An array of editor specs representing the fields of an answer.
 * @type Array.<cm.EditorSpec>
 */
cm.AnswerEditor.ANSWER_FIELDS = [
      {key: 'title', label: cm.MSG_ANSWER_BUTTON_LABEL,
       type: cm.editors.Type.TEXT, tooltip: cm.MSG_ANSWER_BUTTON_LABEL_TOOLTIP},
      {key: 'label', label: cm.MSG_ANSWER_STANDALONE_LABEL,
       type: cm.editors.Type.TEXT,
       tooltip: cm.MSG_ANSWER_STANDALONE_LABEL_TOOLTIP},
      // TODO(shakusa) Create and use a color editor using goog.ui.ColorPalette
      {key: 'color', label: cm.MSG_ANSWER_COLOR, type: cm.editors.Type.TEXT,
       tooltip: cm.MSG_ANSWER_COLOR_TOOLTIP}
  ];

/** @override */
cm.AnswerEditor.prototype.updateUi = function(value) {
  var answer = /**
                * @type {{id: string,
                *         title: string,
                *         label: string,
                *         color: string}}
                */(value || {});

  // We let the inspector render the UI for us.  It requires an MVCObject,
  // so convert from JSON.
  var answerObj = new google.maps.MVCObject();
  // InspectorView expects the editable object to have predictable, quoted keys,
  // but the keys of answer are obfuscated by the closure compiler. We are
  // careful here not to call setValues but set each property individually.
  answerObj.set('title', answer.title || '');
  answerObj.set('label', answer.label || '');
  answerObj.set('color', answer.color || '');

  var editors = this.inspector_.inspect(
      cm.AnswerEditor.ANSWER_FIELDS, answerObj);

  // Listen to changes in the value of each of the editors. Set the value of
  // this editor to the copied values from all the editors, as JSON with the
  // same type as answer.
  goog.array.forEach(editors, function(editor) {
    cm.events.listen(editor, 'value_changed', function() {
      var draft = this.inspector_.collectEdits().draftValues;
      var value = {
        title: draft['title'],
        label: draft['label'],
        color: draft['color']
      };
      if (answer.id) {
        value.id = answer.id;
      }
      this.setValid(value);
    }, this);
  }, this);
};
