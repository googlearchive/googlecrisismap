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

function MenuEditorTest() {
  cm.TestBase.call(this);
}
MenuEditorTest.prototype = new cm.TestBase();
registerTestSuite(MenuEditorTest);

/**
 * Constructs the MenuEditor and returns its parent.
 * @return {Element} An element containing the new MenuEditor.
 * @private
 */
MenuEditorTest.prototype.createEditor_ = function() {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.MenuEditor(
      parent, 'editor1', {choices: [{value: 'x', label: 'Choice X'},
                                    {value: 'y', label: 'Choice Y'}]});
  this.optionX_ = expectDescendantOf(parent, 'option', withText('Choice X'));
  this.optionY_ = expectDescendantOf(parent, 'option', withText('Choice Y'));
  return parent;
};

/** Tests construction of the MenuEditor. */
MenuEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectEq('x', this.editor_.get('value'));
};

/** Tests that selecting a menu option sets the 'value' property. */
MenuEditorTest.prototype.buttonsUpdateValueProperty = function() {
  var parent = this.createEditor_();

  this.editor_.select_.selectedIndex = 1;
  cm.events.emit(this.editor_.select_, 'change');
  expectEq('y', this.editor_.get('value'));

  this.editor_.select_.selectedIndex = 0;
  cm.events.emit(this.editor_.select_, 'change');
  expectEq('x', this.editor_.get('value'));
};

/** Tests that the 'value' property propagates to the dropdown menu. */
MenuEditorTest.prototype.valuePropertyUpdatesButtons = function() {
  var parent = this.createEditor_();

  this.editor_.set('value', 'x');
  expectEq(0, this.editor_.select_.selectedIndex);

  this.editor_.set('value', 'y');
  expectEq(1, this.editor_.select_.selectedIndex);
};

/**
 * Tests that changes to the editor's value with null or undefined values not in
 * the list cause the value to be set to the first option.
 */
MenuEditorTest.prototype.testInvalidValue = function() {
  var parent = this.createEditor_();

  this.editor_.select_.selectedIndex = 1;
  this.editor_.set('value', null);
  expectEq('x', this.editor_.get('value'));
  expectEq(0, this.editor_.select_.selectedIndex);

  this.editor_.select_.selectedIndex = 1;
  this.editor_.set('value', undefined);
  expectEq('x', this.editor_.get('value'));
  expectEq(0, this.editor_.select_.selectedIndex);
};
