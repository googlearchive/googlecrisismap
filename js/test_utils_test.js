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


function TestUtilTest() {
}
registerTestSuite(TestUtilTest);

/** Tests construction of a FakeElement. */
TestUtilTest.prototype.fakeElementConstructor = function() {
  var element = new FakeElement('div', {'id': 'abc', 'class': 'xyz'});
  expectEq('DIV', element.nodeName);
  expectEq('abc', element.id);
  expectEq('xyz', element.className);
  expectEq(element, FakeElement.elementsById_['abc']);
};

/** Exercises FakeElement.appendChild(). */
TestUtilTest.prototype.fakeElementAppendChild = function() {
  var parent = new FakeElement('div');
  var child1 = new FakeElement('img');
  var child2 = new FakeElement('p');
  parent.appendChild(child1);
  expectEq(parent, child1.parentNode);
  expectEq(1, parent.childNodes.length);
  expectEq(child1, parent.childNodes[0]);

  parent.appendChild(child2);
  expectEq(parent, child2.parentNode);
  expectEq(2, parent.childNodes.length);
  expectEq(child2, parent.childNodes[1]);
  expectEq(child2, child1.nextSibling);
  expectEq(child1, child2.previousSibling);

  parent.appendChild('ABC');
  expectEq(3, parent.childNodes.length);
  expectEq('ABC', parent.childNodes[2]);
  expectEq('ABC', child2.nextSibling);
};

/** Exercises FakeUi.getText() with both innerHTML and child text nodes. */
TestUtilTest.prototype.uiTestGetText = function() {
  var element = new FakeElement('div');
  element.innerHTML = 'dogs &amp; <i>cats</i>';
  expectEq('dogs & cats', FakeUi.getText(element));
  element = new FakeElement('div');
  var textNode = new FakeElement('#text');
  textNode.textContent = 'dogs &amp; cats';
  element.appendChild(textNode);
  expectEq('dogs &amp; cats', FakeUi.getText(element));
};

/** Verifies that FakeUi.create() creates a proper DOM hierarchy. */
TestUtilTest.prototype.uiTestCreate = function() {
  var element = FakeUi.create('div', {'id': 'a'},
      FakeUi.create('ul', {}, FakeUi.create('li', {}, 'one')),
      FakeUi.create('ol', {}, FakeUi.create('li', {}, 'two')),
      null,
      FakeUi.create('div', cm.Html.fromSanitizedHtml('abc')));
  expectEq(3, element.childNodes.length);
  expectEq('UL', element.childNodes[0].nodeName);
  expectEq('OL', element.childNodes[1].nodeName);
  expectEq(
      'one', element.childNodes[0].childNodes[0].childNodes[0].textContent);
};

/** Verifies that FakeElement.toString() draws a nice DOM tree. */
TestUtilTest.prototype.fakeElementToString = function() {
  var element = FakeUi.create('div', {'id': 'a'},
      FakeUi.create('ul', {}, FakeUi.create('li', {}, 'one')),
      FakeUi.create('ol', {}, FakeUi.create('li', {}, 'two')));
  // Make sure that class name changes are reflected on {@code toString()}.
  element.className = 'xyz';
  expectEq('\n<DIV id="a" class="xyz">' +
           '\n|-<UL>' +
           '\n| \'-<LI>' +
           '\n|   \'-"one"' +
           '\n\'-<OL>' +
           '\n  \'-<LI>' +
           '\n    \'-"two"', element.toString());
};

/** Exercises the FakeElement matchers. */
TestUtilTest.prototype.fakeElementMatchers = function() {
  var grandchild = FakeUi.create('li', {'foo': 'bar'}, 'two');
  var element = FakeUi.create('div', {'id': 'a'},
      FakeUi.create('ul', {}, FakeUi.create('li', {}, 'one')),
      FakeUi.create('ol', {}, grandchild));
  element.style.visibility = 'hidden';
  expectThat(element, isElement('div', withId('a')));
  expectThat(element, not(isElement(withClass('b'))));
  expectThat(element, isElement(withAttr('id', 'a')));
  expectThat(element, isElement(withStyle('visibility', 'hidden')));
  expectThat(element, hasDescendant('li', withText('one')));
  expectEq(grandchild, expectDescendantOf(element, withAttr('foo', 'bar')));
  expectEq(grandchild, expectDescendantOf(element, withText('two')));
};
