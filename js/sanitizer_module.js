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
 * @fileoverview [MODULE: html_sanitizer] Export declarations.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.require('goog.module');

// This module exports the 'html' symbol from html-sanitizer.js, provided by
// //third_party/java/caja:html_css_sanitizer.  There is no goog.require(...)
// here because html-sanitizer.js doesn't have a goog.provide declaration.

// One provide() line for each object to export.
goog.module.provide('sanitizer', 'html', html);

// Last, announce that the module has finished loading.
goog.module.provide('sanitizer');
