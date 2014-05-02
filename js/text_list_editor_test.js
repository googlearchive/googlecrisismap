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

// @author shakusa@google.com (Steve Hakusa)

function TextListEditorTest() {
  cm.TestBase.call(this);
}
TextListEditorTest.prototype = new cm.TestBase();
registerTestSuite(TextListEditorTest);

/**
 * Constructs the TextListEditor and returns its parent.
 * @return {Element} An element containing the new TextListEditor.
 * @private
 */
TextListEditorTest.prototype.createEditor_ = function() {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.TextListEditor(parent, 'editor1', {});
  return parent;
};

/** Tests construction of the TextListEditor. */
TextListEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectDescendantOf(parent, 'input', withId('editor1'));
};

/** Tests that the HTML input element propagates to the 'value' property. */
TextListEditorTest.prototype.testInputUpdatesProperty = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  input.value = 'abc , def  ',
  cm.events.emit(input, 'change');
  expectEq(['abc', 'def'], this.editor_.get('value'));
};

/** Tests that an input with no commas propagates to the 'value' property. */
TextListEditorTest.prototype.testSingleInputUpdatesProperty = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  input.value = 'abc',
  cm.events.emit(input, 'change');
  expectEq(['abc'], this.editor_.get('value'));
};

/** Tests that the 'value' property propagates to the HTML input element. */
TextListEditorTest.prototype.testPropertyUpdatesInput = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  this.editor_.set('value', ['def', 'ghi']);
  expectEq('def, ghi', input.value);
};

/** Tests that an empty 'value' property propagates correctly. */
TextListEditorTest.prototype.testEmptyPropertyUpdatesInput = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  expectEq('', input.value);
};

/** Tests that a non-array 'value' property propagates correctly. */
TextListEditorTest.prototype.testNonArrayPropertyUpdatesInput = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  this.editor_.set('value', 'def');
  expectEq('def', input.value);
};
