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
 * @param {boolean=} opt_multi If true, create a multi-select menu editor.
 * @return {Element} An element containing the new MenuEditor.
 * @private
 */
MenuEditorTest.prototype.createEditor_ = function(opt_multi) {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.MenuEditor(
      parent, 'editor1', {choices: [{value: 'x', label: 'Choice X'},
                                    {value: 'y', label: 'Choice Y'},
                                    {value: 'z', label: 'Choice Z'}],
                          multiple: opt_multi});
  this.optionX_ = expectDescendantOf(parent, 'option', withText('Choice X'));
  this.optionY_ = expectDescendantOf(parent, 'option', withText('Choice Y'));
  this.optionZ_ = expectDescendantOf(parent, 'option', withText('Choice Z'));
  return parent;
};

/**
 * Expect the given select input's options to have the given values.
 * @param {Array.<boolean>} selected The expected values.
 * @private
 */
MenuEditorTest.prototype.expectSelected_ = function(selected) {
  goog.array.forEach(selected, function(s, i) {
    expectEq(s, this.editor_.selectElem.options[i].selected);
  }, this);
};

/** Tests construction of the MenuEditor. */
MenuEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectEq('x', this.editor_.get('value'));
  this.expectSelected_([true, false, false]);
};

/** Tests construction of a multi-select MenuEditor. */
MenuEditorTest.prototype.testConstructorMulti = function() {
  var parent = this.createEditor_(true);
  expectThat(this.editor_.get('value'), elementsAre([]));
  this.expectSelected_([false, false, false]);
};

/** Tests that selecting a menu option sets the 'value' property. */
MenuEditorTest.prototype.buttonsUpdateValueProperty = function() {
  var parent = this.createEditor_();

  this.editor_.selectElem.options[0].selected = false;
  this.editor_.selectElem.options[1].selected = true;
  cm.events.emit(this.editor_.selectElem, 'change');
  expectEq('y', this.editor_.get('value'));

  this.editor_.selectElem.options[0].selected = true;
  this.editor_.selectElem.options[1].selected = false;
  cm.events.emit(this.editor_.selectElem, 'change');
  expectEq('x', this.editor_.get('value'));
};

/** Tests selecting multiple menu options. */
MenuEditorTest.prototype.buttonsUpdateValuePropertyMulti = function() {
  var parent = this.createEditor_(true);

  this.editor_.selectElem.options[0].selected = false;
  this.editor_.selectElem.options[1].selected = true;
  this.editor_.selectElem.options[2].selected = true;
  cm.events.emit(this.editor_.selectElem, 'change');
  expectThat(this.editor_.get('value'), elementsAre(['y', 'z']));
};

/** Tests that the 'value' property propagates to the dropdown menu. */
MenuEditorTest.prototype.valuePropertyUpdatesButtons = function() {
  var parent = this.createEditor_();

  this.editor_.set('value', 'x');
  this.expectSelected_([true, false, false]);

  this.editor_.set('value', 'y');
  this.expectSelected_([false, true, false]);
};

/** Tests that the 'value' property propagates to a multi-select menu. */
MenuEditorTest.prototype.valuePropertyUpdatesButtonsMulti = function() {
  var parent = this.createEditor_(true);

  this.editor_.set('value', ['y', 'z']);
  this.expectSelected_([false, true, true]);

  this.editor_.set('value', ['x', 'y', 'z']);
  this.expectSelected_([true, true, true]);
};

/**
 * Tests that setting the editor's value to null or undefined
 * results in the value being set to the first option.
 */
MenuEditorTest.prototype.testInvalidValue = function() {
  var parent = this.createEditor_();

  this.editor_.set('value', null);
  expectEq('x', this.editor_.get('value'));
  this.expectSelected_([true, false, false]);

  this.editor_.selectElem.options[0].selected = false;
  this.editor_.selectElem.options[1].selected = true;
  this.editor_.selectElem.options[2].selected = false;
  this.editor_.set('value', undefined);
  expectEq('x', this.editor_.get('value'));
  this.expectSelected_([true, false, false]);
};

/**
 * For multi-select menus, tests that setting the editor's value to null or
 * undefined results in the value being set to the first option.
 */
MenuEditorTest.prototype.testInvalidValueMulti = function() {
  var parent = this.createEditor_(true);

  this.editor_.set('value', ['y', 'z']);
  this.expectSelected_([false, true, true]);

  this.editor_.set('value', undefined);
  expectThat(this.editor_.get('value'), elementsAre([]));
  this.expectSelected_([false, false, false]);
};
