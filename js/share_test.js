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

// The URL returned by the mock AppState's getUri() method.
var APPSTATE_URL = new goog.Uri('http://appstate.url/');

// The APPSTATE_URL encoded as a query parameter.
var APPSTATE_URL_ENCODED = encodeURIComponent(APPSTATE_URL.toString());

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
  browserDetect = this.expectNew_('cm.BrowserDetect');
  stubReturn(browserDetect, 'supportsTouch', false);

  // Create the cm.SharePopup.
  stubReturn(goog.style, 'showElement', null);
  var appState = stubInstance(cm.AppState, {'getUri': APPSTATE_URL});
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
  expectEq(APPSTATE_URL.toString(), urlField.value);

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

  // Note that gjsmock's willOnce action can take a function that will allow
  // you to act on the arguments. Neat. Not very clear from the gjsdocs.
  goog.net.XhrIo.send = createMockFunction('goog.net.XhrIo.send');
  expectCall(goog.net.XhrIo.send)(cm.ShareBox.GOOG_SHORTENER_URI_, _, 'POST', _)
      .willOnce(function(url, callback, method, data) {
        callback({'target': {
          'getResponseJson': function() {
            return {'id': SHORTENED_URL};
          }
        }});
      });

  var checkbox = expectDescendantOf(parent, withClass('cm-shorten-checkbox'));
  checkbox.checked = true;
  cm.events.emit(checkbox, 'click');

  // Now check that the fields are set correctly.
  var urlField = expectDescendantOf(parent, withId('cm-share-url'));
  expectEq(SHORTENED_URL, urlField.value);

  // GPlus isn't shortened or else it fails whitelisting.
  var link = expectDescendantOf(parent, withClass('cm-gplus-share-button'));
  expectEq('//plus.google.com/share?hl=en&url=' + APPSTATE_URL_ENCODED,
           link.href);

  var iframe = expectDescendantOf(parent, withClass('cm-twitter-share-button'));
  expectEq('//platform.twitter.com/widgets/tweet_button.html' +
           '?lang=en&count=none&counturl=http%3A%2F%2Fgoogle.org%2Fcrisismap' +
           '&url=' + SHORTENED_URL_ENCODED, iframe.src);

  iframe = expectDescendantOf(parent, withClass('cm-facebook-like-button'));
  expectEq('//www.facebook.com/plugins/like.php?layout=button_count' +
           '&width=90&show_faces=false&action=like&colorscheme=light' +
           '&font=arial&height=21&href=' + SHORTENED_URL_ENCODED, iframe.src);

  // And check that unchecking the field does the right thing.
  checkbox.checked = false;
  cm.events.emit(checkbox, 'click');
  expectEq(APPSTATE_URL.toString(), urlField.value);
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
