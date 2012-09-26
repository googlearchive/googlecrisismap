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

// @author kpy@google.com (Ka-Ping Yee)

function NumberEditorTest() {
  cm.TestBase.call(this);
}
NumberEditorTest.prototype = new cm.TestBase();
registerTestSuite(NumberEditorTest);

/**
 * Constructs the NumberEditor and returns its parent.
 * @param {Object} options Display and validation options for the NumberEditor.
 * @return {Element} An element containing the new NumberEditor.
 * @private
 */
NumberEditorTest.prototype.createEditor_ = function(options) {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.NumberEditor(parent, 'editor1', options);
  return parent;
};

/** Tests construction of the NumberEditor. */
NumberEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectDescendantOf(parent, 'input', withId('editor1'));
  expectEq(null, this.editor_.get('value'));
  expectEq(null, this.editor_.get('validation_error'));
};

/** Tests that the HTML input element propagates to the 'value' property. */
NumberEditorTest.prototype.testInputUpdatesProperty = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  input.value = ' 3 ',
  cm.events.emit(input, 'change');
  expectEq(3, this.editor_.get('value'));
  expectEq(null, this.editor_.get('validation_error'));
};

/** Tests that the 'value' property propagates to the HTML input element. */
NumberEditorTest.prototype.testPropertyUpdatesInput = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  this.editor_.set('value', 45);
  expectEq('45', input.value);
  expectEq(null, this.editor_.get('validation_error'));
};

/** Tests that non-numeric input is rejected with a useful error message. */
NumberEditorTest.prototype.testInvalidNumericInput = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  input.value = 'x';
  cm.events.emit(input, 'change');
  expectEq(null, this.editor_.get('value'));
  expectEq('should be a number', this.editor_.get('validation_error'));
};

/** Tests that non-integer input is accepted by default. */
NumberEditorTest.prototype.testNonIntegerInput = function() {
  var parent = this.createEditor_();
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  input.value = '3.5';
  cm.events.emit(input, 'change');
  expectEq(3.5, this.editor_.get('value'));
  expectEq(null, this.editor_.get('validation_error'));
};

/** Tests that non-integer input is rejected with a useful error message. */
NumberEditorTest.prototype.testForbiddenNonIntegerInput = function() {
  var parent = this.createEditor_({require_integer: true});
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  input.value = '3.5';
  cm.events.emit(input, 'change');
  expectEq(null, this.editor_.get('value'));
  expectEq('should be a whole number', this.editor_.get('validation_error'));

  input.value = '3.';
  cm.events.emit(input, 'change');
  expectEq(3, this.editor_.get('value'));
  expectEq(null, this.editor_.get('validation_error'));
};

/** Tests that out-of-range input is rejected with a useful error message. */
NumberEditorTest.prototype.testOutOfRangeInput = function() {
  var parent = this.createEditor_({minimum: 1, maximum: 10});
  var input = expectDescendantOf(parent, 'input', withId('editor1'));
  input.value = '0';
  cm.events.emit(input, 'change');
  expectEq(null, this.editor_.get('value'));
  expectEq('should not be less than 1', this.editor_.get('validation_error'));

  input.value = '10';
  cm.events.emit(input, 'change');
  expectEq(10, this.editor_.get('value'));
  expectEq(null, this.editor_.get('validation_error'));

  input.value = '11';
  cm.events.emit(input, 'change');
  expectEq(null, this.editor_.get('value'));
  expectEq('should not be greater than 10',
           this.editor_.get('validation_error'));
};

