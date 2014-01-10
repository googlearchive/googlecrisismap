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

/**
 * @fileoverview [MODULE: edit] A single-line text entry field for a URL.
 */
goog.provide('cm.UrlEditor');

goog.require('cm.TextEditor');
goog.require('cm.ui');

/**
 * @override
 * @extends cm.TextEditor
 * @constructor
 */
cm.UrlEditor = function(parentElem, id, options) {
  cm.TextEditor.call(this, parentElem, id, options);
};
goog.inherits(cm.UrlEditor, cm.TextEditor);

/**
 * @override
 */
cm.UrlEditor.prototype.validate = function(value) {
  // Ensure URLs start with a valid protocol scheme to avoid XSS attacks.
  // Allow whitespace-only entry to validate to avoid harassing the user
  // too much.  The TextEditor parent class throws away white-space so the
  // effect is to save an empty string.
  if (value && !value.toLowerCase().match('^\\s*(http://|https://|$)')) {
    this.setInvalid(cm.MSG_INVALID_URL);
  } else {
    cm.TextEditor.prototype.validate.call(this, value);
  }
};
