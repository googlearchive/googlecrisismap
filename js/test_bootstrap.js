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

// Author: kpy@google.com (Ka-Ping Yee)

// These definitions are needed in order to load Maps API files in V8 without
// a browser.  This file should not depend on any other files.

window = this;
dummy = {
  appendChild: function() { },
  setAttribute: function() { },
  style: {}
};
document = {
  createElement: function() { return dummy; },
  documentElement: dummy,
  getElementsByTagName: function() { return [dummy]; }
};
location = {};
navigator = {userAgent: 'Mozilla/5.0'};
screen = {};
setTimeout = function(f) { f(); };

google = {maps: {Load: function(f) { f([], null); }}};
