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

// @author romano@google.com (Raquel Romano)

function CheckboxEditorTest() {
  cm.TestBase.call(this);
}
CheckboxEditorTest.prototype = new cm.TestBase();
registerTestSuite(CheckboxEditorTest);

/**
 * Constructs the CheckboxEditor and returns its parent.
 * @param {Object} opt_options Options to pass to the constructor.
 * @return {Element} An element containing the new CheckboxEditor.
 * @private
 */
CheckboxEditorTest.prototype.createEditor_ = function(opt_options) {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.CheckboxEditor(parent, 'editor1', opt_options);
  this.checkbox_ = expectDescendantOf(parent, inputType('checkbox'));
  return parent;
};

/** Tests constructor with no options. */
CheckboxEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectFalse(this.checkbox_.checked);
  expectFalse(this.editor_.get('value'));
};

/** Tests that the checkbox state propagates to the 'value' property. */
CheckboxEditorTest.prototype.checkboxUpdatesProperty = function() {
  var parent = this.createEditor_();
  expectFalse(this.editor_.get('value'));
  this.checkbox_.checked = true;
  cm.events.emit(this.checkbox_, 'click');
  expectTrue(this.editor_.get('value'));
};

/** Tests that the 'value' property propagates to the checkbox state. */
CheckboxEditorTest.prototype.propertyUpdatesCheckbox = function() {
  var parent = this.createEditor_();
  expectFalse(this.checkbox_.checked);
  this.editor_.set('value', true);
  expectTrue(this.checkbox_.checked);
};

/** Tests that the checkbox state propagates to the negated 'value' property. */
CheckboxEditorTest.prototype.checkboxUpdatesPropertyOptions = function() {
  var parent = this.createEditor_(
      {checked_value: false, unchecked_value: true});
  this.editor_.set('value', true);
  expectFalse(this.checkbox_.checked);
  this.editor_.set('value', false);
  expectTrue(this.checkbox_.checked);
};

/** Tests that the 'value' property propagates to the negated checkbox state. */
CheckboxEditorTest.prototype.propertyUpdatesCheckboxOptions = function() {
  var parent = this.createEditor_(
      {checked_value: false, unchecked_value: true});
  this.editor_.set('value', true);
  expectFalse(this.checkbox_.checked);
  this.editor_.set('value', false);
  expectTrue(this.checkbox_.checked);
};
