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

function QuestionEditorTest() {
  cm.TestBase.call(this);
  cm.editors.register(cm.editors.Type.ANSWER, cm.AnswerEditor);
  cm.editors.register(cm.editors.Type.TEXT, cm.TextEditor);
}
QuestionEditorTest.prototype = new cm.TestBase();
registerTestSuite(QuestionEditorTest);

/**
 * Constructs the QuestionEditor and returns its parent.
 * @return {Element} An element containing the new QuestionEditor.
 * @private
 */
QuestionEditorTest.prototype.createEditor_ = function() {
  this.deleteCallback_ = createMockFunction();

  var parent = cm.ui.create('div');
  this.editor_ = new cm.QuestionEditor(parent, 'editor1',
      {'delete_callback': this.deleteCallback_});
  return parent;
};

/**
 * Simulates typing into a text box and firing a change event.
 * @param {Element} textInput A text input element.
 * @param {string} text The new text for the input element.
 * @private
 */
QuestionEditorTest.prototype.type_ = function(textInput, text) {
  textInput.value = text;
  cm.events.emit(textInput, 'change');
};

/** Tests construction of the QuestionEditor. */
QuestionEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectDescendantOf(parent, 'div', withId('editor1'));
  expectDescendantOf(parent, 'div', withClass(cm.css.CLOSE_BUTTON));
};

/** Tests adding an answer. */
QuestionEditorTest.prototype.testAddAnswer = function() {
  var parent = this.createEditor_();
  this.editor_.set('value', null);
  var inputs = allDescendantsOf(parent, inputType('text'));
  // Just the question text
  expectEq(1, inputs.length);

  // Add a new answer and fill in the text
  var addAnswerBtn = expectDescendantOf(parent, 'div',
      withText(cm.MSG_ADD_ANSWER));
  cm.events.emit(addAnswerBtn, 'click');
  inputs = allDescendantsOf(parent, inputType('text'));
  // The question text plus 3 fields for the answer
  expectEq(4, inputs.length);
  this.type_(inputs[0], 'To be or not to be?');
  expectEq({'text': 'To be or not to be?', 'answers': [{ 'id': '1'}]},
      this.editor_.get('value'));

  this.type_(inputs[1], 'To be');
  this.type_(inputs[2], 'Be');
  this.type_(inputs[3], '#0f0');
  expectEq({'text': 'To be or not to be?',
            'answers': [{'id': '1', 'title': 'To be', 'label': 'Be',
                         'color': '#0f0'}]},
      this.editor_.get('value'));

  // Add a second answer and fill in the text
  cm.events.emit(addAnswerBtn, 'click');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(7, inputs.length);
  expectEq('To be or not to be?', inputs[0].value);
  expectEq('', inputs[4].value);

  this.type_(inputs[4], 'Not to be');
  expectEq({'text': 'To be or not to be?',
            'answers': [
              {'id': '1', 'title': 'To be', 'label': 'Be', 'color': '#0f0'},
              {'id': '2', 'title': 'Not to be', 'label': '', 'color': ''}]},
      this.editor_.get('value'));
};

/** Tests editing and deleting an existing answer. */
QuestionEditorTest.prototype.testEditAndDeleteAnswer = function() {
  var expected = {
    'id': 'q1',
    'text': 'To be or not to be?',
    'answers': [
      {'id': 'foo', 'title': 'To be', 'label': 'Be', 'color': '#0f0'},
      {'id': 'bar', 'title': 'Not to be'}]};
  var parent = this.createEditor_();
  this.editor_.set('value', expected);
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(7, inputs.length);
  expectEq('To be or not to be?', inputs[0].value);
  expectEq('To be', inputs[1].value);
  expectEq('Be', inputs[2].value);
  expectEq('#0f0', inputs[3].value);
  expectEq('Not to be', inputs[4].value);
  expectEq('', inputs[5].value);
  expectEq('', inputs[6].value);
  expectEq(expected, this.editor_.get('value'));

  // Change the text of the first answer.
  var newAnswerText = 'That is a stupid question.';
  expected['answers'][0]['title'] = newAnswerText;
  this.type_(inputs[1], newAnswerText);

  // The first answer text should have changed, but the rest stays the same.
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq('To be or not to be?', inputs[0].value);
  expectEq(newAnswerText, inputs[1].value);
  expectEq('Be', inputs[2].value);
  expectEq('#0f0', inputs[3].value);
  expectEq('Not to be', inputs[4].value);
  expectEq('', inputs[5].value);
  expectEq('', inputs[6].value);
  expectEq(expected, this.editor_.get('value'));

  // Now delete the first answer.
  this.editor_.deleteAnswer_('foo');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(4, inputs.length);
  expectEq('To be or not to be?', inputs[0].value);
  expectEq('Not to be', inputs[1].value);
  expectEq('', inputs[2].value);
  expectEq('', inputs[3].value);
  expectEq(
      {'id': 'q1',
       'text': 'To be or not to be?',
       'answers': [
         {'id': 'bar', 'title': 'Not to be'}]},
      this.editor_.get('value'));

  // Now delete the second answer, default answers shouldn't be put back
  this.editor_.deleteAnswer_('bar');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(1, inputs.length);
  expectEq(
      {'id': 'q1', 'text': 'To be or not to be?', 'answers': []},
      this.editor_.get('value'));
};

/** Tests that the delete question button works */
QuestionEditorTest.prototype.testDeleteButton = function() {
  var parent = this.createEditor_();
  var btn = expectDescendantOf(parent, 'div', withClass(cm.css.CLOSE_BUTTON));

  expectCall(this.deleteCallback_)(_);
  cm.events.emit(btn, 'click');
};
