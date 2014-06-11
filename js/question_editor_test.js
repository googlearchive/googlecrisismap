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
  cm.editors.register(cm.editors.Type.CHOICE, cm.ChoiceEditor);
  cm.editors.register(cm.editors.Type.TEXT, cm.TextEditor);
  cm.editors.register(cm.editors.Type.MENU, cm.MenuEditor);
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

/** Tests adding a choice. */
QuestionEditorTest.prototype.testAddChoice = function() {
  var parent = this.createEditor_();
  this.editor_.set('value', {'id': '1'});
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(2, inputs.length);  // the question text and title

  // When CHOICE is selected, the yes and no choices should appear.
  selectOption(expectDescendantOf(parent, 'option', withText('Choice')));
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(8, inputs.length);  // question + title + 2 choices * 3 fields each

  // Add a new choice and fill in the text
  var addChoiceBtn = expectDescendantOf(parent, withText(cm.MSG_ADD_CHOICE));
  cm.events.emit(addChoiceBtn, 'click');

  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(11, inputs.length);  // question + title + 3 choices * 3 fields each
  this.type_(inputs[0], 'To be or not to be?');
  this.type_(inputs[1], 'Existence');
  expectEq({'id': '1',
            'text': 'To be or not to be?',
            'title': 'Existence',
            'type': 'CHOICE',
            'choices': [{'id': '1', 'title': 'Yes', 'color': '#59AA00'},
                        {'id': '2', 'title': 'No', 'color': '#D70000'},
                        {'id': '3'}]},
           this.editor_.get('value'));

  this.type_(inputs[8], 'To be');
  this.type_(inputs[9], 'Be');
  this.type_(inputs[10], '#0f0');
  expectEq({'id': '1',
            'text': 'To be or not to be?',
            'title': 'Existence',
            'type': 'CHOICE',
            'choices': [{'id': '1', 'title': 'Yes', 'color': '#59AA00'},
                        {'id': '2', 'title': 'No', 'color': '#D70000'},
                        {'id': '3', 'title': 'To be', 'label': 'Be',
                         'color': '#0f0'}]},
           this.editor_.get('value'));

  // Add a second choice and fill in the text
  cm.events.emit(addChoiceBtn, 'click');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(14, inputs.length);
  expectEq('To be or not to be?', inputs[0].value);
  expectEq('', inputs[11].value);

  this.type_(inputs[11], 'Not to be');
  expectEq({'id': '1',
            'text': 'To be or not to be?',
            'title': 'Existence',
            'type': 'CHOICE',
            'choices': [{'id': '1', 'title': 'Yes', 'color': '#59AA00'},
                        {'id': '2', 'title': 'No', 'color': '#D70000'},
                        {'id': '3', 'title': 'To be', 'label': 'Be',
                         'color': '#0f0'},
                        {'id': '4', 'title': 'Not to be', 'label': '',
                         'color': ''}]},
           this.editor_.get('value'));
};

/** Tests adding, deleting, then re-adding a choice. */
QuestionEditorTest.prototype.testAddDeleteAddChoice = function() {
  var parent = this.createEditor_();
  this.editor_.set('value', null);
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(2, inputs.length);

  var addChoiceBtn = expectDescendantOf(parent, withText(cm.MSG_ADD_CHOICE));
  cm.events.emit(addChoiceBtn, 'click');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(5, inputs.length);

  this.editor_.deleteChoice_('1');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(2, inputs.length);

  cm.events.emit(addChoiceBtn, 'click');
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(5, inputs.length);
};

/** Tests editing and deleting an existing choice. */
QuestionEditorTest.prototype.testEditAndDeleteChoice = function() {
  var expected = {
    'id': 'q1',
    'text': 'To be or not to be?',
    'title': 'Existence',
    'type': 'CHOICE',
    'choices': [{'id': 'foo', 'title': 'To be', 'label': 'Be', 'color': '#0f0'},
                {'id': 'bar', 'title': 'Not to be'}]
  };
  var parent = this.createEditor_();
  this.editor_.set('value', expected);
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(8, inputs.length);
  expectEq('To be or not to be?', inputs[0].value);
  expectEq('To be', inputs[2].value);
  expectEq('Be', inputs[3].value);
  expectEq('#0f0', inputs[4].value);
  expectEq('Not to be', inputs[5].value);
  expectEq('', inputs[6].value);
  expectEq('', inputs[7].value);
  expectEq(expected, this.editor_.get('value'));

  // Change the text of the first choice.
  var newChoiceText = 'That is a stupid question.';
  expected['choices'][0]['title'] = newChoiceText;
  this.type_(inputs[2], newChoiceText);

  // The first choice text should have changed, but the rest stays the same.
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq('To be or not to be?', inputs[0].value);
  expectEq(newChoiceText, inputs[2].value);
  expectEq('Be', inputs[3].value);
  expectEq('#0f0', inputs[4].value);
  expectEq('Not to be', inputs[5].value);
  expectEq('', inputs[6].value);
  expectEq('', inputs[7].value);
  expectEq(expected, this.editor_.get('value'));

  // Now delete the first choice.
  this.editor_.deleteChoice_('foo');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(5, inputs.length);
  expectEq('To be or not to be?', inputs[0].value);
  expectEq('Not to be', inputs[2].value);
  expectEq('', inputs[3].value);
  expectEq('', inputs[4].value);
  expectEq({'id': 'q1',
            'text': 'To be or not to be?',
            'title': 'Existence',
            'type': 'CHOICE',
            'choices': [{'id': 'bar', 'title': 'Not to be'}]},
           this.editor_.get('value'));

  // Now delete the second choice; default choices shouldn't be put back.
  this.editor_.deleteChoice_('bar');
  inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(2, inputs.length);
  expectEq({'id': 'q1', 'text': 'To be or not to be?',
            'title': 'Existence', 'type': 'CHOICE', 'choices': []},
           this.editor_.get('value'));
};

/** Tests that the delete question button works */
QuestionEditorTest.prototype.testDeleteButton = function() {
  var parent = this.createEditor_();
  var btn = expectDescendantOf(parent, 'div', withClass(cm.css.CLOSE_BUTTON));

  expectCall(this.deleteCallback_)(_);
  cm.events.emit(btn, 'click');
};
