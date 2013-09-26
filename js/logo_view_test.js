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

/**
 * @type {cm.LogoViewConfig}
 * @const
 */
FAKE_LOGO_VIEW_CONFIG = {
  height: 100,
  width: 50,
  url: '//fake_image_host/fake_image.png'
};

/** @constructor */
function LogoViewTest() {
  cm.TestBase.call(this);
  this.container_ = new FakeElement('div');
  this.logoView_ = new cm.LogoView(this.container_, FAKE_LOGO_VIEW_CONFIG);
}
LogoViewTest.prototype = new cm.TestBase();
registerTestSuite(LogoViewTest);

/** Verify img element construction. */
LogoViewTest.prototype.constructorTest = function() {
  expectDescendantOf(this.container_, 'img',
      withClass(cm.css.LOGO_WATERMARK),
      withSrc(FAKE_LOGO_VIEW_CONFIG.url),
      withAttr('width', '50px'),
      withAttr('height', '100px'));
};

/** Verify that the getHeight method works. */
LogoViewTest.prototype.constructorTest = function() {
  expectEq(100, this.logoView_.getHeight());
};
