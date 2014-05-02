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

// @author shakusa@google.com (Steve Hakusa)

function QuestionListEditorTest() {
  cm.TestBase.call(this);
  cm.editors.register(cm.editors.Type.ANSWER, cm.AnswerEditor);
  cm.editors.register(cm.editors.Type.QUESTION, cm.QuestionEditor);
  cm.editors.register(cm.editors.Type.TEXT, cm.TextEditor);
}
QuestionListEditorTest.prototype = new cm.TestBase();
registerTestSuite(QuestionListEditorTest);

/**
 * Constructs the QuestionListEditor and returns its parent.
 * @return {Element} An element containing the new QuestionListEditor.
 * @private
 */
QuestionListEditorTest.prototype.createEditor_ = function() {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.QuestionListEditor(parent, 'editor1');
  return parent;
};

/**
 * Simulates typing into a text box and firing a change event.
 * @param {Element} textInput A text input element.
 * @param {string} text The new text for the input element.
 * @private
 */
QuestionListEditorTest.prototype.type_ = function(textInput, text) {
  textInput.value = text;
  cm.events.emit(textInput, 'change');
};

/** Tests construction of the QuestionListEditor. */
QuestionListEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectDescendantOf(parent, 'div', withId('editor1'));
};

/** Tests adding a new question. */
QuestionListEditorTest.prototype.testAddQuestion = function() {
  var parent = this.createEditor_();
  this.editor_.set('value', null);
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(0, inputs.length);

  var addQuestionBtn = expectDescendantOf(parent, 'div',
      withText(cm.MSG_ADD_QUESTION));
  cm.events.emit(addQuestionBtn, 'click');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(7, inputs.length);
  expectThat(this.editor_.get('value'), elementsAre(
      [{'id': '1', 'text': '',
        'answers': [{'id': '1', 'title': 'Yes'},
                    {'id': '2', 'title': 'No'}]}]));

  this.type_(inputs[0], 'To be or not to be?');
  expectThat(this.editor_.get('value'), elementsAre(
      [{'id': '1', 'text': 'To be or not to be?',
        'answers': [{'id': '1', 'title': 'Yes'},
                    {'id': '2', 'title': 'No'}]}]));

  this.type_(inputs[1], 'Not to be');
  this.type_(inputs[2], 'Not');
  this.type_(inputs[3], '#f00');
  expectThat(this.editor_.get('value'), elementsAre(
      [{'id': '1', 'text': 'To be or not to be?',
        'answers': [{'id': '1', 'title': 'Not to be', 'label': 'Not',
                     'color': '#f00'},
                    {'id': '2', 'title': 'No'}]}]));

  cm.events.emit(addQuestionBtn, 'click');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(14, inputs.length);
  expectEq('To be or not to be?', inputs[0].value);
  expectEq('No', inputs[4].value);

  this.type_(inputs[7], 'Second question');
  expectThat(this.editor_.get('value'), elementsAre(
      [{'id': '1', 'text': 'To be or not to be?',
        'answers': [{'id': '1', 'title': 'Not to be', 'label': 'Not',
                     'color': '#f00'},
                    {'id': '2', 'title': 'No'}]},
       {'id': '2', 'text': 'Second question',
        'answers': [{'id': '1', 'title': 'Yes'},
                    {'id': '2', 'title': 'No'}]}]));
};

/** Tests adding, deleting, then re-adding a question. */
QuestionListEditorTest.prototype.testAddDeleteAddQuestion = function() {
  var parent = this.createEditor_();
  this.editor_.set('value', null);
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(0, inputs.length);

  var addQuestionBtn = expectDescendantOf(parent, 'div',
      withText(cm.MSG_ADD_QUESTION));
  cm.events.emit(addQuestionBtn, 'click');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(7, inputs.length);

  this.editor_.deleteQuestion_('1');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(0, inputs.length);

  cm.events.emit(addQuestionBtn, 'click');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(7, inputs.length);
};

/** Tests editing and deleting an existing question. */
QuestionListEditorTest.prototype.testEditAndDeleteQuestion = function() {
  var expected = [
      {'id': '0', 'text': 'To be or not to be?',
       'answers': [{'id': '1', 'title': 'Not to be', 'label': 'Not',
                    'color': '#f00'}]},
      {'id': '1', 'text': 'Second question', 'answers': []}];
  var parent = this.createEditor_();
  this.editor_.set('value', expected);
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(5, inputs.length);
  expectEq('To be or not to be?', inputs[0].value);
  expectEq('Not to be', inputs[1].value);
  expectEq('Not', inputs[2].value);
  expectEq('#f00', inputs[3].value);
  expectEq('Second question', inputs[4].value);
  expectEq(expected, this.editor_.get('value'));

  // Change the text of the first question
  var newQuestionText = 'Am I supposed to be here?';
  expected[0]['text'] = newQuestionText;
  this.type_(inputs[0], newQuestionText);

  // The first question text should have changed, but the rest stays the same.
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(5, inputs.length);
  expectEq(newQuestionText, inputs[0].value);
  expectEq('Not to be', inputs[1].value);
  expectEq('Not', inputs[2].value);
  expectEq('#f00', inputs[3].value);
  expectEq('Second question', inputs[4].value);
  expectEq(expected, this.editor_.get('value'));

  // Now delete the first question.
  this.editor_.deleteQuestion_('0');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(1, inputs.length);
  expectEq('Second question', inputs[0].value);
};
