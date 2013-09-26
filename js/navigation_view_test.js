// Copyright 2013 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

/** @constructor */
function NavigationViewTest() {
  cm.TestBase.call(this);
  this.items_ = [{
    label: 'Link 1',
    url: '//fake_link_host/fake_link_1'
  }, {
    label: 'Link 2',
    url: '//fake_link_host/fake_link_2'
  }];
}
NavigationViewTest.prototype = new cm.TestBase();
registerTestSuite(NavigationViewTest);

/** Verify constructor's element tree construction with no opt_config. */
NavigationViewTest.prototype.constructorWithNoConfigTest = function() {
  this.container_ = cm.ui.create('div');
  this.navigationView_ = new cm.NavigationView(this.container_, this.items_);
  this.checkElementTree_(true, cm.ui.SEPARATOR_DOT);
};

/** Verify constructor's element tree construction with a default opt_config. */
NavigationViewTest.prototype.constructorWithSeparatorTest = function() {
  this.container_ = cm.ui.create('div');
  this.navigationView_ = new cm.NavigationView(
      this.container_, this.items_, {show_horizontal_separator: true});
  this.checkElementTree_(true, cm.ui.SEPARATOR_DOT);
};

/**
 * Verify constructor's element tree construction with an opt_config that says
 * a separator should not be used.
 */
NavigationViewTest.prototype.constructorWithoutSeparatorTest = function() {
  this.container_ = cm.ui.create('div');
  this.navigationView_ = new cm.NavigationView(
      this.container_, this.items_, {show_horizontal_separator: false});
  this.checkElementTree_(false, null);
};

/**
 * Verify element tree construction.
 * @param {boolean} isSeparatorExpected Should this method expect that a
 *     span containing a separator character should be a child of the LIs
 *     (other than the LI that is the last child of the UL)?
 * @param {?string} expectedSeparator The separator string that is
 *     expected, if any.
 * @private
 */
NavigationViewTest.prototype.checkElementTree_ =
  function(isSeparatorExpected, expectedSeparator) {
  expectDescendantOf(this.container_, 'ul', withClass(cm.css.NAV_LIST));
  var navElement = this.navigationView_.getElement();
  var liElements = allDescendantsOf(navElement, isElement('li',
      withClass(cm.css.NAV_ITEM)));
  expectEq(this.items_.length, liElements.length);
  goog.object.forEach(this.items_, function(item) {
    expectDescendantOf(navElement, 'a', withClass(cm.css.NAV_LINK),
        withText(item.label), withHref(item.url));
  });
  var separatorSpans = allDescendantsOf(navElement, isElement('span',
      withClass(cm.css.NAV_ITEM_SEPARATOR), withText(expectedSeparator)));
  var expectedSeparatorCount = isSeparatorExpected ?
      (this.items_.length - 1) : 0;
  expectEq(expectedSeparatorCount, separatorSpans.length);
};
