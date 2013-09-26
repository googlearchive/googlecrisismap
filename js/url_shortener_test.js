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
 * Tests for cm.UrlShortener.
 * @constructor
 */
function UrlShortenerTest() {
  cm.TestBase.call(this);
}
UrlShortenerTest.prototype = new cm.TestBase();
registerTestSuite(UrlShortenerTest);

UrlShortenerTest.prototype.shorten = function() {
  var urlShortener = new cm.UrlShortener('/.jsonp', 'key123');

  // Simulate the behavior of the URL Shortener API.
  var jsonp = this.expectNew_('goog.net.Jsonp', '/.jsonp');
  expectCall(jsonp.send)({
    'url': cm.UrlShortener.SERVICE_URL_ + '?key=key123',
    'post_json': goog.json.serialize({'longUrl': 'http://long'})
  }, _).willOnce(function(_, callback) { callback({'id': 'http://short'}); });

  // Call the cm.UrlShortener and confirm that we got the result from the API.
  var actual = null;
  urlShortener.shorten('http://long', function(result) { actual = result; });
  expectEq('http://short', actual);
};
