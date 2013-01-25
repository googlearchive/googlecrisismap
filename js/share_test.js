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

// Author: arb@google.com (Anthony Baxter)

// The URI object returned by the mock AppState's getUri() method.
var APPSTATE_URI_OBJECT = new goog.Uri('http://appstate.url/');

// The AppState URL as a string.
var APPSTATE_URL = APPSTATE_URI_OBJECT.toString();

// The APPSTATE_URL encoded as a query parameter.
var APPSTATE_URL_ENCODED = encodeURIComponent(APPSTATE_URL);

// The URL returned by the mock URL shortener.
var SHORTENED_URL = 'http://shortened.url/';

// The SHORTENED_URL encoded as a query parameter.
var SHORTENED_URL_ENCODED = encodeURIComponent(SHORTENED_URL);

/**
 * Tests for the SharePopup class
 * @constructor
 */
function SharePopupTest() {
  cm.TestBase.call(this);  // set up the fake DOM
}
SharePopupTest.prototype = new cm.TestBase();
registerTestSuite(SharePopupTest);

/**
 * Creates and shows the SharePopup.
 * @private
 * @param {boolean} showFacebookButton Passed to constructor.
 * @param {boolean} showGooglePlusButton Passed to constructor.
 * @param {boolean} showTwitterButton Passed to constructor.
 * @return {FakeElement} the share popup's container.
 */
SharePopupTest.prototype.createPopup_ = function(
    showFacebookButton, showGooglePlusButton, showTwitterButton) {
  // Mock out goog.ui.Popup.
  this.popup_ = this.expectNew_('goog.ui.Popup', _);
  expectCall(this.popup_.setHideOnEscape)(true);
  expectCall(this.popup_.setAutoHide)(true);
  expectCall(this.popup_.setEnableCrossIframeDismissal)(false);

  // Create the cm.SharePopup.
  stubReturn(goog.style, 'showElement', null);
  var appState = stubInstance(cm.AppState, {'getUri': APPSTATE_URI_OBJECT});
  expectCall(appState.get)('language')
      .willRepeatedly(returnWith('en'));
  this.sharePopup_ = new cm.SharePopup(
      appState, cm.ui.create('button'), showFacebookButton,
      showGooglePlusButton, showTwitterButton);

  // Show the popup.
  expectCall(this.popup_.setVisible)(true);
  this.sharePopup_.show();
  return this.sharePopup_.element_;
};


/** Tests basic popup functionality. */
SharePopupTest.prototype.openPopup = function() {
  this.createPopup_(true, true, true);
};


/** Tests that links are set correctly when URL shortening is off. */
SharePopupTest.prototype.nonShortenedLinks = function() {
  var parent = this.createPopup_(true, true, true);

  // Check that the URL field is populated correctly.
  var urlField = expectDescendantOf(parent, withId('cm-share-url'));
  expectEq(APPSTATE_URL, urlField.value);

  var link = expectDescendantOf(parent, withClass('cm-gplus-share-button'));
  expectEq('//plus.google.com/share?hl=en&url=' + APPSTATE_URL_ENCODED,
           link.href);

  var iframe = expectDescendantOf(parent, withClass('cm-twitter-share-button'));
  expectEq('//platform.twitter.com/widgets/tweet_button.html' +
           '?lang=en&count=none&counturl=http%3A%2F%2Fgoogle.org%2Fcrisismap' +
           '&url=' + APPSTATE_URL_ENCODED, iframe.src);

  iframe = expectDescendantOf(parent, withClass('cm-facebook-like-button'));
  expectEq('//www.facebook.com/plugins/like.php?layout=button_count' +
           '&width=90&show_faces=false&action=like&colorscheme=light' +
           '&font=arial&height=21&href=' + APPSTATE_URL_ENCODED, iframe.src);
};

/** Tests that links are set correctly when URL shortening is on. */
SharePopupTest.prototype.shortenUrl = function() {
  var parent = this.createPopup_(true, true, true);

  // Set up a mock for the JSONP request.
  var jsonp = this.expectNew_('goog.net.Jsonp', cm.ShareBox.JSON_PROXY_URL);
  expectCall(jsonp.send)({
    'url': cm.ShareBox.GOOGL_API_URL,
    'post_json': goog.json.serialize({'longUrl': APPSTATE_URL})
  }, _).willOnce(function(_, callback) { callback({'id': SHORTENED_URL}); });

  // Confirm that checking the box puts the shortened URL in the text field...
  var checkbox = expectDescendantOf(parent, withClass('cm-shorten-checkbox'));
  checkbox.checked = true;
  cm.events.emit(checkbox, 'click');
  expectDescendantOf(parent, withId('cm-share-url'), withValue(SHORTENED_URL));

  // ...and in the Twitter button...
  expectDescendantOf(parent, withClass('cm-twitter-share-button'), withSrc(
      '//platform.twitter.com/widgets/tweet_button.html' +
      '?lang=en&count=none&counturl=http%3A%2F%2Fgoogle.org%2Fcrisismap' +
      '&url=' + SHORTENED_URL_ENCODED));

  // ...and in the Facebook button...
  expectDescendantOf(parent, withClass('cm-facebook-like-button'), withSrc(
      '//www.facebook.com/plugins/like.php?layout=button_count' +
      '&width=90&show_faces=false&action=like&colorscheme=light' +
      '&font=arial&height=21&href=' + SHORTENED_URL_ENCODED));

  // ...but Google+ doesn't use the shortened URL because it fails whitelisting.
  expectDescendantOf(parent, withClass('cm-gplus-share-button'), withHref(
      '//plus.google.com/share?hl=en&url=' + APPSTATE_URL_ENCODED));

  // Confirm that unchecking the box restores the unshortened URL.
  checkbox.checked = false;
  cm.events.emit(checkbox, 'click');
  expectDescendantOf(parent, withId('cm-share-url'), withValue(APPSTATE_URL));
};

/** Tests that the popup can be made to show only the Facebook button. */
SharePopupTest.prototype.showFacebookButtonOnly = function() {
  var parent = this.createPopup_(true, false, false);
  expectDescendantOf(parent, withClass('cm-facebook-like-button'));
  expectNoDescendantOf(parent, withClass('cm-gplus-share-button'));
  expectNoDescendantOf(parent, withClass('cm-twitter-share-button'));
};

/** Tests that the popup can be made to show only the Google+ button. */
SharePopupTest.prototype.showGooglePlusButtonOnly = function() {
  var parent = this.createPopup_(false, true, false);
  expectNoDescendantOf(parent, withClass('cm-facebook-like-button'));
  expectDescendantOf(parent, withClass('cm-gplus-share-button'));
  expectNoDescendantOf(parent, withClass('cm-twitter-share-button'));
};

/** Tests that the popup can be made to show only the Twitter button. */
SharePopupTest.prototype.showTwitterButtonOnly = function() {
  var parent = this.createPopup_(false, false, true);
  expectNoDescendantOf(parent, withClass('cm-facebook-like-button'));
  expectNoDescendantOf(parent, withClass('cm-gplus-share-button'));
  expectDescendantOf(parent, withClass('cm-twitter-share-button'));
};
