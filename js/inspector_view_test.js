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

// Author: kpy@google.com (Ka-Ping Yee)

goog.require('cm.css');

function InspectorViewTest() {
  cm.TestBase.call(this);
  this.tableElem_ = cm.ui.create('table');
  this.view_ = new cm.InspectorView(this.tableElem_);
}
InspectorViewTest.prototype = new cm.TestBase();
registerTestSuite(InspectorViewTest);

/**
 * Inspects.
 * @private
 */
InspectorViewTest.prototype.inspect_ = function(opt_object) {
  // Open the inspector on a sample MVCObject.
  var object = opt_object || new google.maps.MVCObject();
  object.setValues({a: 'x', b: 5, id: 'layer0'});

  this.view_.inspect([
    {key: 'a', label: 'First field', type: cm.editors.Type.TEXT},
    {key: 'b', label: 'Second field', type: cm.editors.Type.NUMBER,
     conditions: {'a': function(x) { return x == 'yes'; }}}
  ], object);
};

/** Tests that the inspect() method works properly. */
InspectorViewTest.prototype.testInspect = function() {
  this.inspect_();

  // Confirm that there are two properly labelled input fields.
  var rows = allDescendantsOf(this.tableElem_, isElement('tr'));
  expectEq(2, rows.length);
  expectDescendantOf(rows[0], 'label', withText('First field'));
  var aInput = expectDescendantOf(rows[0], 'input');
  expectEq('x', aInput.value);
  expectDescendantOf(rows[1], 'label', withText('Second field'));
  var bInput = expectDescendantOf(rows[1], 'input');
  expectEq('5', bInput.value);

  // Confirm that the 'b' field is initially hidden, since its condition
  // is not satisfied (property 'a' is not 'yes').
  expectEq('none', rows[1].style.display);
};

/** Tests a conditional editor under conditions when it should be hidden. */
InspectorViewTest.prototype.testConditionalHidden = function() {
  this.inspect_();

  var rows = allDescendantsOf(this.tableElem_, isElement('tr'));
  expectEq(2, rows.length);
  var aInput = expectDescendantOf(rows[0], 'input');

  // The 'b' editor should be initially hidden, since the initial
  // value of property 'a' is 'x', not 'yes'.
  expectEq('none', rows[1].style.display);

  aInput.value = 'no';
  cm.events.emit(aInput, 'keyup');
  // Since 'no' fails the predicate, the 'b' editor should now be
  // hidden.
  expectEq('none', rows[1].style.display);

  var edits = this.view_.collectEdits();
  expectEq({a: 'x', b: 5}, edits.oldValues);
  // The 'b' property should be undefined because its editor was disabled.
  expectEq({a: 'no', b: undefined}, edits.newValues);
};

/** Tests a conditional editor under conditions when it should be shown. */
InspectorViewTest.prototype.testConditionalShown = function() {
  this.inspect_();

  var rows = allDescendantsOf(this.tableElem_, isElement('tr'));
  expectEq(2, rows.length);
  var aInput = expectDescendantOf(rows[0], 'input');
  var bInput = expectDescendantOf(rows[1], 'input');

  // The 'b' editor should be initially hidden, since the initial
  // value of property 'a' is 'x', not 'yes'.
  expectEq('none', rows[1].style.display);

  aInput.value = 'yes';
  cm.events.emit(aInput, 'keyup');
  // Since 'yes' satisfies the predicate, the 'b' editor should now
  // be shown.
  expectEq('', rows[1].style.display);

  // Make a change in the 'b' editor.
  bInput.value = ' 6 ';
  cm.events.emit(bInput, 'keyup');

  var edits = this.view_.collectEdits();
  expectEq({a: 'x', b: 5}, edits.oldValues);
  // The 'b' property should be present because its editor was enabled
  expectEq({a: 'yes', b: 6}, edits.newValues);
};

/** Tests that validation error messages are shown by the inspector. */
InspectorViewTest.prototype.testValidationErrorShown = function() {
  this.inspect_();

  var rows = allDescendantsOf(this.tableElem_, isElement('tr'));
  var bInput = expectDescendantOf(rows[1], 'input');
  bInput.value = ' xxx ';  // invalid, should be a number
  cm.events.emit(bInput, 'keyup');

  expectDescendantOf(rows[1], withClass(cm.css.VALIDATION_ERROR),
                     withText('should be a number'));
};

/** Tests adding and deleting an editor from the inspector. */
InspectorViewTest.prototype.testAddDeleteEditor = function() {
  this.inspect_();

  var edits = this.view_.collectEdits();
  expectEq({b: 5}, edits.oldValues);
  expectEq({b: undefined}, edits.newValues);

  this.view_.addEditor(
      {key: 'c', label: 'Third field', type: cm.editors.Type.TEXT});

  // Confirm that there are three properly labelled input fields.
  var rows = allDescendantsOf(this.tableElem_, isElement('tr'));
  expectEq(3, rows.length);
  expectDescendantOf(rows[0], 'label', withText('First field'));
  var aInput = expectDescendantOf(rows[0], 'input');
  expectEq('x', aInput.value);
  expectDescendantOf(rows[1], 'label', withText('Second field'));
  var bInput = expectDescendantOf(rows[1], 'input');
  expectEq('5', bInput.value);
  expectDescendantOf(rows[2], 'label', withText('Third field'));
  var cInput = expectDescendantOf(rows[2], 'input');
  expectEq('', cInput.value);

  // Confirm that the 'b' field is still hidden, since its condition
  // is not satisfied (property 'a' is not 'yes').
  expectEq('none', rows[1].style.display);

  cInput.value = 'y';
  cm.events.emit(cInput, 'keyup');

  edits = this.view_.collectEdits();
  expectEq({b: 5, c: undefined}, edits.oldValues);
  expectEq({b: undefined, c: 'y'}, edits.newValues);

  this.view_.deleteEditor('a');

  // Confirm that there are two input fields left.
  rows = allDescendantsOf(this.tableElem_, isElement('tr'));
  expectEq(2, rows.length);
  expectDescendantOf(rows[0], 'label', withText('Second field'));
  bInput = expectDescendantOf(rows[0], 'input');
  expectEq('5', bInput.value);
  expectDescendantOf(rows[1], 'label', withText('Third field'));
  cInput = expectDescendantOf(rows[1], 'input');
  expectEq('y', cInput.value);

  edits = this.view_.collectEdits();
  expectEq({b: 5, c: undefined}, edits.oldValues);
  expectEq({b: undefined, c: 'y'}, edits.newValues);
};
