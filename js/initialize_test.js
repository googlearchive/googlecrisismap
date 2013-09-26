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

// Author: kpy@google.com (Ka-Ping Yee)

function InitializeTest() {
  cm.TestBase.call(this);
}
InitializeTest.prototype = new cm.TestBase();
registerTestSuite(InitializeTest);

/** Verifies our customizations to the HTML sanitizer. */
InitializeTest.prototype.htmlSanitizer = function() {
  // setForTest_ ensures that cm.Html.sanitize_ is restored after the test.
  this.setForTest_('cm.Html.sanitize_', null);
  installHtmlSanitizer(html);  // sets cm.Html.sanitize_

  // <script> tags and javascript URLs should be removed.  This is not a
  // complete test of the sanitizer, since it's already a tested component;
  // this is just a basic test to ensure that the sanitizer is being invoked.
  expectEq('<div>helloworld</div>',
           cm.Html.sanitize_('<div onclick="javascript:alert(1)">hello' +
                             '<script>alert(2)</script>world</div>'));

  // TODO(romano): The html_css_sanitizer library properly leaves in
  // style attributes and sanitizes the CSS when running in a browser,
  // but incorrectly strips out style attributes when run outside the
  // browser. This should have been fixed by cr/51556988, but is still
  // not working. Once working, the below check can be uncommented. (b/9413480).
  // style attributes should be preserved.
  // expectEq('<div style="color: red">foo</div>',
  //          cm.Html.sanitize_('<div style="color: red">foo</div>'));

  // Ordinary links should be preserved.
  expectEq('<a href="http://x.y/">z</a>',
           cm.Html.sanitize_('<a href="http://x.y/">z</a>'));

  // target="_blank" should be preserved, but not other values of target.
  expectEq('<a href="http://x.y/" target="_blank">z</a>',
           cm.Html.sanitize_('<a href="http://x.y/" target="_blank">z</a>'));
  expectEq('<a href="http://x.y/">z</a>',
           cm.Html.sanitize_('<a href="http://x.y/" target="_top">z</a>'));
};
