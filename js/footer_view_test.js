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


function FooterViewTest() {
  cm.TestBase.call(this);
  this.mapModel_ = new google.maps.MVCObject();
  this.mapModel_.set('footer', cm.Html.EMPTY);
  this.footerParams_ = {
    'langs': ['en', 'es', 'bn', 'fr'],
    'publisher_name': 'Descartes'
  };
}
FooterViewTest.prototype = new cm.TestBase();
registerTestSuite(FooterViewTest);

/**
 * Constructs the FooterView and returns its parent.
 * @private
 */
FooterViewTest.prototype.createView_ = function(enable_editing) {
  var parent = new FakeElement('div');
  var popup = new FakeElement('div');
  if (enable_editing) {
    this.footerParams_.enableEditing = true;
  }
  this.footerView_ = new cm.FooterView(parent, popup, this.mapModel_,
    this.footerParams_);
  return parent;
};

/** Tests the constructor. */
FooterViewTest.prototype.testConstructor = function() {
  var parent = this.createView_();
  expectDescendantOf(parent, 'span', withText('Published by Descartes'));
  expectDescendantOf(parent, 'a', withText(cm.MSG_HELP));
  expectDescendantOf(parent, 'select', withValue(''));
};

/* Tests language selector */
FooterViewTest.prototype.changeUrlHlParamOnLangSelect = function() {
  this.createView_();
  var langSelect = this.footerView_.langSelect_;
  // Override location.replace to just set a 'url' instance variable with
  // the value it was given, since it's not defined in tests by default.
  this.setForTest_('goog.global.location', {
    replace: function(value) { this.href = value; }
  });

  langSelect.value = 'foo';
  cm.events.emit(langSelect, 'change');
  // goog.Uri just creates an empty href from our goog.global.location object,
  // so the result is just the URL parameter.
  expectEq('?hl=foo', goog.global.location.href);
  // Back to default.
  langSelect.value = '';
  cm.events.emit(langSelect, 'change');
  expectEq('', goog.global.location.href);
};
