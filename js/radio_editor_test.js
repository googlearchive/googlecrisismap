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

function RadioEditorTest() {
  cm.TestBase.call(this);
}
RadioEditorTest.prototype = new cm.TestBase();
registerTestSuite(RadioEditorTest);

/**
 * Constructs the RadioEditor and returns its parent.
 * @return {Element} An element containing the new RadioEditor.
 * @private
 */
RadioEditorTest.prototype.createEditor_ = function() {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.RadioEditor(
      parent, 'editor1', {choices: [{value: 'x', label: 'Choice X'},
                                    {value: 'y', label: 'Choice Y'}]});
  this.labelX_ = expectDescendantOf(parent, 'label', withText('Choice X'));
  this.labelY_ = expectDescendantOf(parent, 'label', withText('Choice Y'));
  this.buttonX_ = expectDescendantOf(
      parent, inputType('radio'), withId(this.labelX_.attrs_['for']));
  this.buttonY_ = expectDescendantOf(
      parent, inputType('radio'), withId(this.labelY_.attrs_['for']));
  return parent;
};

/** Tests construction of the RadioEditor. */
RadioEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectTrue(!this.editor_.get('value'));  // any false value is okay
  expectTrue(!this.buttonX_.checked);  // any false value is okay
  expectTrue(!this.buttonY_.checked);  // any false value is okay
};

/** Tests that selecting a radio button sets the 'value' property. */
RadioEditorTest.prototype.buttonsUpdateValueProperty = function() {
  var parent = this.createEditor_();

  this.buttonX_.checked = true;
  this.buttonY_.checked = false;
  cm.events.emit(this.buttonX_, 'click');
  expectEq('x', this.editor_.get('value'));

  this.buttonX_.checked = false;
  this.buttonY_.checked = true;
  cm.events.emit(this.buttonY_, 'click');
  expectEq('y', this.editor_.get('value'));

  // If all radio buttons are deselected, the value should be null.
  this.buttonX_.checked = false;
  this.buttonY_.checked = false;
  cm.events.emit(this.buttonX_, 'click');
  expectEq(null, this.editor_.get('value'));
};

/** Tests that the 'value' property propagates to the radio buttons. */
RadioEditorTest.prototype.valuePropertyUpdatesButtons = function() {
  var parent = this.createEditor_();

  this.editor_.set('value', 'x');
  expectTrue(this.buttonX_.checked);
  expectFalse(this.buttonY_.checked);

  this.editor_.set('value', 'y');
  expectFalse(this.buttonX_.checked);
  expectTrue(this.buttonY_.checked);

  // Setting the editor to an invalid value should deselect all the buttons.
  this.editor_.set('value', 'z');
  expectFalse(this.buttonX_.checked);
  expectFalse(this.buttonY_.checked);
};
