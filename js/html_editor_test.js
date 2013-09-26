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

goog.require('cm.css');

function HtmlEditorTest() {
  cm.TestBase.call(this);
  this.setForTest_('cm.Html.sanitize_', function(x) { return '*' + x + '*'; });
}
HtmlEditorTest.prototype = new cm.TestBase();
registerTestSuite(HtmlEditorTest);

/**
 * Constructs the HtmlEditor and returns its parent.
 * @return {Element} An element containing the new HtmlEditor.
 * @private
 */
HtmlEditorTest.prototype.createEditor_ = function() {
  var parent = cm.ui.create('div');
  this.editor_ = new cm.HtmlEditor(parent, 'editor1',
      {preview_class: 'foo', preview_prefix: 'pre', preview_postfix: 'post'});
  return parent;
};

/** Tests construction of the HtmlEditor. */
HtmlEditorTest.prototype.testConstructor = function() {
  var parent = this.createEditor_();
  expectDescendantOf(parent, 'textarea', withId('editor1'));
  expectDescendantOf(parent,
                     'div', withClass(cm.css.PREVIEW), withClass('foo'));
};

/** Tests that the textarea contents propagate to the 'value' property. */
HtmlEditorTest.prototype.textareaShouldUpdateValueProperty = function() {
  var parent = this.createEditor_();
  var textarea = expectDescendantOf(parent, 'textarea', withId('editor1'));
  textarea.value = 'abc',
  cm.events.emit(textarea, 'change');
  expectEq(new cm.Html('abc'), this.editor_.get('value'));
};

/** Tests that the 'value' property propagates to the textarea contents. */
HtmlEditorTest.prototype.valuePropertyShouldUpdateTextarea = function() {
  var parent = this.createEditor_();
  var textarea = expectDescendantOf(parent, 'textarea', withId('editor1'));
  this.editor_.set('value', new cm.Html('def'));
  expectEq('def', textarea.value);
  this.editor_.set('value', new cm.Html(''));
  expectEq('', textarea.value);
  this.editor_.set('value', new cm.Html('def'));
  expectEq('def', textarea.value);
  this.editor_.set('value', null);
  expectEq('', textarea.value);
};

/**
 * Tests that the 'value' property propagates, sanitized, to the preview,
 * and that preview prefix and postfix content appear as well.
 */
HtmlEditorTest.prototype.valueShouldAppearSanitizedInPreview = function() {
  var parent = this.createEditor_();
  var preview = expectDescendantOf(parent, 'div', withClass(cm.css.PREVIEW));
  this.editor_.set('value', new cm.Html('xyz'));
  var elems = preview.childNodes;
  expectEq(3, elems.length);
  expectEq('pre', elems[0].textContent);
  expectEq('*xyz*', elems[1].innerHTML);
  expectEq('post', elems[2].textContent);
};

/** Tests that clicking on the disclosure triangle toggles the preview. */
HtmlEditorTest.prototype.clickShouldTogglePreview = function() {
  // When the editor is initially created...
  var parent = this.createEditor_();
  var preview = expectDescendantOf(parent, 'div', withClass(cm.css.PREVIEW));

  // ...expect the preview to be hidden.
  expectEq('none', preview.style.display);

  // When the user clicks on the disclosure element...
  var toggle = expectDescendantOf(parent, 'div', withClass(cm.css.DISCLOSURE));
  cm.events.emit(toggle, 'click');

  // ...expect the preview to be shown.
  expectEq('', preview.style.display);

  // When the user clicks on the disclosure element again...
  cm.events.emit(toggle, 'click');

  // ...expect the preview to be hidden.
  expectEq('none', preview.style.display);
};
