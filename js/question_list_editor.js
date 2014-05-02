// Copyright 2013 Google Inc.  All Rights Reserved.
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
 * @fileoverview [MODULE: edit] An editor for an array of topic questions.
 *
 * Draft changes to questions are propagated to this editor using the
 * QuestionEditor's 'value_changed' event. When a value changes on a
 * QuestionEditor, this editor recomputes its draft value from its properties
 * and the properties of all child questions.
 *
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.QuestionListEditor');

goog.require('cm.Editor');
goog.require('cm.InspectorView');
goog.require('cm.editors');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.array');

/**
 * An editor for an array of topic questions.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {Object} options Editor options.
 * @extends cm.Editor
 * @constructor
 */
cm.QuestionListEditor = function(parentElem, id, options) {
  cm.Editor.call(this);
  options = options || {};

  /**
   * @type Element
   * @private
   */
  this.input_ = cm.ui.create('div', {'id': id},
     this.tableElem_ = cm.ui.create('table',
         {'class': cm.css.EDITORS, 'cellpadding': '0', 'cellspacing': '0'}),
     this.newQuestionBtn_ = cm.ui.create(
         'div', {'class': [cm.css.BUTTON]}, cm.MSG_ADD_QUESTION));
  parentElem.appendChild(this.input_);

  /**
   * Renders the questions in the question list.
   * @type cm.InspectorView
   * @private
   */
  this.inspector_ = new cm.InspectorView(this.tableElem_);

  /**
   * The list of question IDs currently shown in the question list inspector.
   * @type Array.<string>
   * @private
   */
  this.questionIds_ = [];

  cm.events.listen(this.newQuestionBtn_, 'click', function() {
    var nextId = this.nextQuestionId_();
    this.questionIds_.push(nextId);
    var editor = this.inspector_.addEditor(this.newQuestionSpec_(nextId));
    this.registerQuestionEditor_(editor);
    // Initialize the question with 2 answers
    var questionTemplate =
        goog.object.clone(cm.QuestionListEditor.QUESTION_TEMPLATE);
    questionTemplate.id = nextId;
    editor.setValid(questionTemplate);
    editor.updateUi(questionTemplate);
  }, this);
};
goog.inherits(cm.QuestionListEditor, cm.Editor);

/**
 * Template used to pre-populate a new question when newQuestionBtn is pressed.
 * @type {Object}
 */
cm.QuestionListEditor.QUESTION_TEMPLATE = {
  text: '',
  answers: [
    {id: 'yes', title: cm.MSG_YES},
    {id: 'no', title: cm.MSG_NO}
  ]
};

/** @override */
cm.QuestionListEditor.prototype.updateUi = function(value) {
  this.questionIds_ = [];
  var questionList = /**
                      * @type {Array.<{id: string,
                      *           text: string,
                      *           answers: Array.<{id: string,
                      *                            title: string,
                      *                            label: string,
                      *                            color: string}>
                      *          }>}
                      */(value || []);
  // We use inspector_ to render the input question list, but that requires an
  // MVCObject where each question is a (key, value) pair, not an array.
  // questionListChanged_ converts back.
  var questionListObj = new google.maps.MVCObject();
  goog.array.forEach(questionList, function(question) {
    this.questionIds_.push(question['id']);
    questionListObj.set(question['id'], question);
  }, this);
  var editors = this.inspector_.inspect(
      goog.array.map(this.questionIds_, this.newQuestionSpec_, this),
      questionListObj);
  goog.array.forEach(editors, this.registerQuestionEditor_, this);
};

/**
 * Creates an editor spec for an question.
 * @param {string} id An id to use for the new editor spec.
 * @return {cm.EditorSpec} An EditorSpec for a new question
 * @private
 */
cm.QuestionListEditor.prototype.newQuestionSpec_ = function(id) {
  return {key: id, type: cm.editors.Type.QUESTION,
          label: '', tooltip: undefined,
          delete_callback: goog.bind(this.deleteQuestion_, this, id)};
};

/**
 * Removes the question with the given key from this question list.
 * @param {string} id The editor key for the question to be deleted.
 * @private
 */
cm.QuestionListEditor.prototype.deleteQuestion_ = function(id) {
  goog.array.remove(this.questionIds_, id);
  this.inspector_.deleteEditor(id);
};

/**
 * Finds the first unused question ID in this.questionIds_, counting up
 * numerically from '1'.
 * @return {string} An unused question ID.
 * @private
 */
cm.QuestionListEditor.prototype.nextQuestionId_ = function() {
  var nextQuestionId = 1;
  while (goog.array.contains(this.questionIds_, '' + nextQuestionId)) {
    nextQuestionId++;
  }
  return '' + nextQuestionId;
};

/**
 * Ensures this editor's value stays up-to-date as the given question editor's
 * value changes.
 * @param {cm.Editor} editor The question editor for which we need to
 *   track changes.
 * @private
 */
cm.QuestionListEditor.prototype.registerQuestionEditor_ = function(editor) {
  cm.events.listen(editor, 'value_changed', this.questionListChanged_, this);
};

/**
 * Handles recomputing the value of this editor when the values of its child
 * questions change.
 * @private
 */
cm.QuestionListEditor.prototype.questionListChanged_ = function() {
  var draft = this.inspector_.collectEdits().draftValues;
  var questionList = [];
  // Convert questions from (key, value) object entries in draft to an array,
  // using the questionIds to preserve editing order.
  goog.array.forEach(this.questionIds_, function(id) {
    var question = draft[id];
    question.id = question.id || id;
    questionList.push(question);
  }, this);
  this.setValid(questionList);
};
