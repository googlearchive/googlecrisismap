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

// Author: romano@google.com (Raquel Romano)

goog.require('cm.css');

function AboutPopupTest() {
  cm.TestBase.call(this);
  this.setForTest_('goog.dom.htmlToDocumentFragment', function(html) {
    var e = new FakeElement('fragment');
    e.innerHtml = html;
    return e;
  });
  this.container_ = cm.ui.create('div');
  this.aboutText_ = cm.ui.create('div', {'class': cm.css.ABOUT_TEXT});
  this.about_ = new cm.AboutPopup(this.container_, this.aboutText_);
  this.popup_ = cm.ui.get('cm-about');
}
AboutPopupTest.prototype = new cm.TestBase();
registerTestSuite(AboutPopupTest);

/** Verifies that the popup window is constructed properly. */
AboutPopupTest.prototype.testConstructor = function() {
  expectThat(this.popup_,
             isElement(goog.dom.TagName.DIV, withClass(cm.css.POPUP)));
  expectDescendantOf(this.popup_, withClass(cm.css.ABOUT_TEXT));
};

/** Verifies that the close button callback removes the popup window. */
AboutPopupTest.prototype.testCloseButtonCallback = function() {
  var parent = cm.ui.create('div', {}, this.popup_);
  var button = expectDescendantOf(this.popup_, withClass(cm.css.CLOSE_BUTTON));
  cm.events.emit(button, 'click');
  expectThat(parent, not(hasDescendant(this.popup_)));
};

/** Verifies that show() makes the popup appear with the correct dimensions. */
AboutPopupTest.prototype.testShow = function() {
  this.setForTest_('cm.ui.offscreenSize', createMockFunction());
  stub(cm.ui.offscreenSize)(this.popup_, this.container_)
      .is({width: 100, height: 100});

  this.container_.offsetWidth = 200;
  this.container_.offsetHeight = 201;
  this.about_.show();

  expectThat(cm.ui.document.body, hasDescendant(this.popup_));
  expectEq('50px', this.popup_.style.left);
  expectEq('51px', this.popup_.style.top);
};
