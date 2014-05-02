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

function AnswerEditorTest() {
  cm.TestBase.call(this);
  cm.editors.register(cm.editors.Type.TEXT, cm.TextEditor);
}
AnswerEditorTest.prototype = new cm.TestBase();
registerTestSuite(AnswerEditorTest);

/**
 * Constructs the AnswerEditor and returns its parent.
 * @return {Element} An element containing the new AnswerEditor.
 * @private
 */
AnswerEditorTest.prototype.createEditor_ = function() {
  this.deleteCallback_ = createMockFunction();

  var parent = cm.ui.create('div');
  this.editor_ = new cm.AnswerEditor(parent, 'editor1',
      {'delete_callback': this.deleteCallback_});
  return parent;
};

/**
 * Simulates typing into a text box and firing a change event.
 * @param {Element} textInput A text input element.
 * @param {string} text The new text for the input element.
 * @private
 */
AnswerEditorTest.prototype.type_ = function(textInput, text) {
  textInput.value = text;
  cm.events.emit(textInput, 'change');
};

/** Tests construction of the AnswerEditor. */
AnswerEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectDescendantOf(parent, 'div', withId('editor1'));
  expectDescendantOf(parent, 'div', withClass(cm.css.CLOSE_BUTTON));
};

/** Tests that an input element propagates to the 'value' property. */
AnswerEditorTest.prototype.testInputUpdatesProperty = function() {
  var parent = this.createEditor_();
  this.editor_.set('value', null);
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq(3, inputs.length);
  this.type_(inputs[0], 'abc');
  expectEq({'title': 'abc', 'label': '', 'color': ''},
      this.editor_.get('value'));

  this.type_(inputs[1], 'def');
  this.type_(inputs[2], '#f00');
  expectEq({'title': 'abc', 'label': 'def', 'color': '#f00'},
      this.editor_.get('value'));
};

/** Tests that the 'value' property propagates to the HTML input elements. */
AnswerEditorTest.prototype.testPropertyUpdatesInput = function() {
  var parent = this.createEditor_();
  this.editor_.set('value', {'title': 'abc', 'label': 'def', 'color': '#f00'});
  var inputs = allDescendantsOf(parent, inputType('text'));
  expectEq('abc', inputs[0].value);
  expectEq('def', inputs[1].value);
  expectEq('#f00', inputs[2].value);
};

/** Tests that the delete answer button works */
AnswerEditorTest.prototype.testDeleteButton = function() {
  var parent = this.createEditor_();
  var btn = expectDescendantOf(parent, 'div', withClass(cm.css.CLOSE_BUTTON));

  expectCall(this.deleteCallback_)(_);
  cm.events.emit(btn, 'click');
};
