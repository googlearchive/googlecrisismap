// Copyright 2014 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

goog.require('cm.xhr');

function XhrTest() {
  cm.TestBase.call(this);
}
XhrTest.prototype = new cm.TestBase();
registerTestSuite(XhrTest);

/** Exercises cm.xhr.post(). */
XhrTest.prototype.post = function() {
  this.setForTest_('goog.net.XhrIo.send', createMockFunction());
  expectCall(goog.net.XhrIo.send)('http://foo.com/', _, 'POST', 'a=b')
      .willOnce(function(url, callback, method, params) {
        callback({target: {
          isSuccess: function() { return true; },
          getResponseText: function() { return 'xyz'; }
        }});
      });

  var gotOk, gotResult;
  cm.xhr.post('http://foo.com/', {'a': 'b'}, function(ok, result) {
    gotOk = ok;
    gotResult = result;
  });

  expectEq(true, gotOk);
  expectEq('xyz', gotResult);
};

/** Exercises cm.xhr.postJson(). */
XhrTest.prototype.postJson = function() {
  this.setForTest_('goog.net.XhrIo.send', createMockFunction());
  expectCall(goog.net.XhrIo.send)('http://foo.com/', _, 'POST', 'a=%5B1%2C2%5D')
      .willOnce(function(url, callback, method, params) {
        callback({target: {
          isSuccess: function() { return true; },
          getResponseText: function() { return '[3,4]'; }
        }});
      });

  var gotOk, gotResult;
  cm.xhr.postJson('http://foo.com/', {'a': [1, 2]}, function(ok, result) {
    gotOk = ok;
    gotResult = result;
  });

  expectEq(true, gotOk);
  expectEq([3, 4], gotResult);
};
