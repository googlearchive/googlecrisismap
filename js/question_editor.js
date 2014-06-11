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
 * @fileoverview [MODULE: edit] An editor for a topic question.
 *
 * A question can contain a list of choices, which are edited in ChoiceEditors.
 * Draft changes to choices are propagated to this editor using the
 * ChoiceEditor's 'value_changed' event. When a value changes on a ChoiceEditor
 * this QuestionEditor recomputes its draft value from its properties and the
 * properties of all child choices.
 *
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.QuestionEditor');

goog.require('cm.Editor');
goog.require('cm.InspectorView');
goog.require('cm.TopicModel');
goog.require('cm.editors');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.array');
goog.require('goog.dom.classes');

/**
 * An editor for a topic question.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object.<{delete_callback: function()}>} options Editor options:
 *     options.delete_callback: Called when the user clicks the delete button.
 * @extends cm.Editor
 * @constructor
 */
cm.QuestionEditor = function(parentElem, id, options) {
  cm.Editor.call(this);
  options = options || {};

  /**
   * @private Element
   */
  this.input_ = cm.ui.create(
      'div', {'class': cm.css.QUESTION_CONTAINER, 'id': id},
      this.deleteQuestionBtn_ = cm.ui.create('div', cm.css.CLOSE_BUTTON),
      this.tableElem_ = cm.ui.create('table',
          {'class': cm.css.EDITORS, 'cellpadding': '0', 'cellspacing': '0'}),
      this.addChoiceBtn_ = cm.ui.create(
          'div', cm.css.BUTTON, cm.MSG_ADD_CHOICE));
  this.addChoiceBtn_.style.display = 'none';
  parentElem.appendChild(this.input_);

  /**
   * Renders the fields of the question.
   * @private cm.InspectorView
   */
  this.inspector_ = new cm.InspectorView(this.tableElem_);

  /**
   * The list of choice IDs currently shown in the question inspector.
   * @private Array.<string>
   */
  this.choiceIds_ = [];

  cm.events.listen(this.addChoiceBtn_, 'click', function() {
    var nextId = this.nextChoiceId_();
    this.choiceIds_.push(nextId);
    var editor = this.inspector_.addEditor(this.newChoiceSpec_(nextId));
    this.registerChoiceEditor_(editor);
    var defaultChoice = {'id': nextId};
    editor.setValid(defaultChoice);
    editor.updateUi(defaultChoice);
  }, this);
  if (options.delete_callback) {
    cm.events.listen(this.deleteQuestionBtn_, 'click', options.delete_callback);
  }

  // When the delete button is hovered, highlight the section of the page
  // that would be deleted if clicked.
  cm.events.listen(this.deleteQuestionBtn_, 'mouseover', function() {
    if (parentElem.parentNode) {
      goog.dom.classes.add(parentElem.parentNode, cm.css.DELETE_HOVER);
    }
  });
  cm.events.listen(this.deleteQuestionBtn_, 'mouseout', function() {
    if (parentElem.parentNode) {
      goog.dom.classes.remove(parentElem.parentNode, cm.css.DELETE_HOVER);
    }
  });
};
goog.inherits(cm.QuestionEditor, cm.Editor);

/**
 * An array of editor specs representing the fields of a question, not
 * including the list of choices.
 * @type Array.<cm.EditorSpec>
 */
cm.QuestionEditor.QUESTION_FIELDS = [
    {key: 'text', label: cm.MSG_QUESTION_TEXT, type: cm.editors.Type.TEXT,
     tooltip: cm.MSG_QUESTION_TEXT_TOOLTIP},
    {key: 'title', label: cm.MSG_QUESTION_TITLE, type: cm.editors.Type.TEXT,
     tooltip: cm.MSG_QUESTION_TITLE_TOOLTIP},
    {key: 'type', label: cm.MSG_ANSWER_TYPE, type: cm.editors.Type.MENU,
     tooltip: cm.MSG_ANSWER_TYPE_TOOLTIP, choices: [
        {value: cm.TopicModel.QuestionType.STRING, label: cm.MSG_TYPE_TEXT},
        {value: cm.TopicModel.QuestionType.NUMBER, label: cm.MSG_TYPE_NUMBER},
        {value: cm.TopicModel.QuestionType.CHOICE, label: cm.MSG_TYPE_CHOICE}
     ]}
];

/**
 * Template used to prepopulate the set of choices when CHOICE type is selected.
 * @type {Array}
 */
cm.QuestionEditor.DEFAULT_CHOICES = [
  {id: '1', title: cm.MSG_YES, color: '#59AA00'},
  {id: '2', title: cm.MSG_NO, color: '#D70000'}
];

/** @override */
cm.QuestionEditor.prototype.updateUi = function(value) {
  this.choiceIds_ = [];

  var question = /** @type {{id: string,
                             text: string,
                             title: string,
                             type: cm.TopicModel.QuestionType,
                             choices: Array.<{id: string, title: string,
                                              label: string, color: string}>
                           }} */(value || {});
  // We use inspector_ to render the input question, but that requires an
  // MVCObject where each choice is a property on the MVCObject, rather than
  // an array of choices (questionChanged_ converts back to an array).
  var questionObj = new google.maps.MVCObject();
  // InspectorView needs the editable MVCObject to have predictable, quoted
  // keys, but the keys of this.get('value') are obfuscated by the Closure
  // compiler.  So we must set each property individually, not call setValues.
  questionObj.set('id', question.id || '');
  questionObj.set('text', question.text || '');
  questionObj.set('title', question.title || '');
  questionObj.set('type', question.type || cm.TopicModel.QuestionType.STRING);
  questionObj.set('choices', question.choices || []);

  goog.array.forEach(question.choices || [], function(choice) {
    this.choiceIds_.push(choice['id']);
    questionObj.set(choice['id'], choice);
  }, this);
  var editors = this.inspector_.inspect(
      cm.QuestionEditor.QUESTION_FIELDS.concat(
          goog.array.map(this.choiceIds_, this.newChoiceSpec_, this)),
      questionObj);
  goog.array.forEach(editors, this.registerChoiceEditor_, this);

  // cm.QuestionEditor.QUESTION_FIELDS[2] is the question type field.
  cm.events.onChange(editors[2], 'value', this.typeChanged_, this);
  this.typeChanged_();  // ensure correct initial state
};

/**
 * Creates an editor spec for a choice.
 * @param {string} id An id to use for the new editor spec.
 * @return {cm.EditorSpec} An EditorSpec for a new choice.
 * @private
 */
cm.QuestionEditor.prototype.newChoiceSpec_ = function(id) {
  var isChoiceType = function(type) {
    return type === cm.TopicModel.QuestionType.CHOICE;
  };
  return {key: id, type: cm.editors.Type.CHOICE, label: '',
          tooltip: undefined, conditions: {'type': isChoiceType},
          delete_callback: goog.bind(this.deleteChoice_, this, id)};
};

/**
 * Removes the choice with the given id from this question.
 * @param {string} id The editor key for the choice to be deleted.
 * @private
 */
cm.QuestionEditor.prototype.deleteChoice_ = function(id) {
  goog.array.remove(this.choiceIds_, id);
  this.inspector_.deleteEditor(id);
};

/**
 * Finds the lowest choice ID that's not already used in this.choiceIds_,
 * counting up numerically from '1'.
 * @return {string} An unused choice ID.
 * @private
 */
cm.QuestionEditor.prototype.nextChoiceId_ = function() {
  var nextChoiceId = 1;
  while (goog.array.contains(this.choiceIds_, '' + nextChoiceId)) {
    nextChoiceId++;
  }
  return '' + nextChoiceId;
};

/**
 * Ensures this editor's value stays up-to-date as the given choice editor's
 * value changes.
 * @param {cm.Editor} editor The choice editor for which to track changes.
 * @private
 */
cm.QuestionEditor.prototype.registerChoiceEditor_ = function(editor) {
  cm.events.onChange(editor, 'value', this.questionChanged_, this);
};

/**
 * Handles recomputing the value of this editor when the values of its child
 * choices change.
 * @private
 */
cm.QuestionEditor.prototype.questionChanged_ = function() {
  var old = this.get('value');
  var draft = this.inspector_.collectEdits().draftValues;
  /* this.get('value') and value have unquoted keys (obfuscated by compiler) */
  var value = {text: draft['text'], title: draft['title'],
               type: draft['type'], choices: []};
  if (old && old.id) {
    value.id = old.id;
  }
  goog.array.forEach(this.choiceIds_, function(id) {
    var choice = draft[id];
    if (choice) {
      choice.id = choice.id || id;
      value.choices.push(choice);
    }
  }, this);

  this.setValid(value);  // set 'value' without triggering updateUi
};

/**
 * Updates the UI and (if needed) fills in the default set of choices, when the
 * CHOICE type is selected.
 * @private
 */
cm.QuestionEditor.prototype.typeChanged_ = function() {
  var draft = this.inspector_.collectEdits().draftValues;
  var isChoiceType = draft['type'] === cm.TopicModel.QuestionType.CHOICE;
  this.addChoiceBtn_.style.display = isChoiceType ? '' : 'none';

  if (isChoiceType && !this.choiceIds_.length) {
    var value = this.get('value');
    this.set('value', {id: value.id, text: draft['text'],
                       type: draft['type'], title: draft['title'],
                       choices: cm.QuestionEditor.DEFAULT_CHOICES});
  }
};
