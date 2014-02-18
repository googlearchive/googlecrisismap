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

function UrlEditorTest() {
  cm.TestBase.call(this);
}
UrlEditorTest.prototype = new cm.TestBase();
registerTestSuite(UrlEditorTest);

UrlEditorTest.prototype.assertValid_ = function(expectedValidity, url) {
  var editor = new cm.UrlEditor(cm.ui.create('div'), 'editor', {});
  editor.validate(url);
  expectEq(expectedValidity, !editor.validation_error, 'Invalid url: ' + url);
};

/** Tests that URLs without a valid protocol scheme fail to validate. */
UrlEditorTest.prototype.testValidate = function() {
  this.assertValid_(false, 'javascript:alert(\'XSS\');');
  this.assertValid_(true, 'http://foo.com');
  this.assertValid_(true, ' http://foo.com ');
  this.assertValid_(true, 'https://foo.com');
  this.assertValid_(true, 'HtTpS://foo.com');
  this.assertValid_(true, 'docs://foo.com');

  // Don't harrass a user about entering just whitespace.
  this.assertValid_(true, '');
  this.assertValid_(true, '    ');
};
