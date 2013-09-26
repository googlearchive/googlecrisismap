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
goog.require('cm.css');

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
  goog.style.showElement = function() { return null; };
  var appState = createMockInstance(cm.AppState);
  stub(appState.getUri)().is(APPSTATE_URI_OBJECT);
  stub(appState.get)('language').is('en');
  var fakeUrlShortener = {'shorten': function(url, callback) {
    callback(SHORTENED_URL);
  }};
  this.sharePopup_ = new cm.SharePopup(
      appState, cm.ui.create('button'), showFacebookButton,
      showGooglePlusButton, showTwitterButton, fakeUrlShortener);

  // Show the popup.
  expectCall(this.popup_.setVisible)(true);
  this.sharePopup_.show();
  return this.sharePopup_.element_;
};


/** Tests basic popup functionality. */
SharePopupTest.prototype.openPopup = function() {
  // Fronting the popup shouldn't cause SHARE_TOGGLED_ON
  this.expectLogAction(cm.Analytics.MapAction.SHARE_TOGGLED_ON, null, 0);
  this.createPopup_(true, true, true);
};

/** Tests that links are set correctly when URL shortening is off. */
SharePopupTest.prototype.nonShortenedLinks = function() {
  var parent = this.createPopup_(true, true, true);

  // Check that the URL field is populated correctly.
  var urlField = expectDescendantOf(parent, withId(cm.css.SHARE_URL));
  expectEq(APPSTATE_URL, urlField.value);

  var link = expectDescendantOf(parent, withClass(cm.css.GPLUS_SHARE_BUTTON));
  expectEq('//plus.google.com/share?hl=en&url=' + APPSTATE_URL_ENCODED,
           link.href);

  var iframe = expectDescendantOf(parent,
                                  withClass(cm.css.TWITTER_SHARE_BUTTON));
  expectEq('//platform.twitter.com/widgets/tweet_button.html' +
           '?lang=en&count=none&counturl=http%3A%2F%2Fgoogle.org%2Fcrisismap' +
           '&url=' + APPSTATE_URL_ENCODED, iframe.src);

  iframe = expectDescendantOf(parent, withClass(cm.css.FACEBOOK_LIKE_BUTTON));
  expectEq('//www.facebook.com/plugins/like.php?layout=button_count' +
           '&width=90&show_faces=false&action=like&colorscheme=light' +
           '&font=arial&height=21&href=' + APPSTATE_URL_ENCODED, iframe.src);
};

/** Tests that links are set correctly when URL shortening is on. */
SharePopupTest.prototype.shortenUrl = function() {
  var parent = this.createPopup_(true, true, true);

  // Confirm that checking the box puts the shortened URL in the text field...
  var checkbox = expectDescendantOf(parent, withClass(cm.css.SHORTEN_CHECKBOX));
  this.expectLogAction(cm.Analytics.SharePopupAction.SHORTEN_URL_ON, null);
  checkbox.checked = true;
  cm.events.emit(checkbox, 'click');
  expectDescendantOf(parent,
                     withId(cm.css.SHARE_URL),
                     withValue(SHORTENED_URL));

  // ...and in the Twitter button...
  expectDescendantOf(parent, withClass(cm.css.TWITTER_SHARE_BUTTON), withSrc(
      '//platform.twitter.com/widgets/tweet_button.html' +
      '?lang=en&count=none&counturl=http%3A%2F%2Fgoogle.org%2Fcrisismap' +
      '&url=' + SHORTENED_URL_ENCODED));

  // ...and in the Facebook button...
  expectDescendantOf(parent, withClass(cm.css.FACEBOOK_LIKE_BUTTON), withSrc(
      '//www.facebook.com/plugins/like.php?layout=button_count' +
      '&width=90&show_faces=false&action=like&colorscheme=light' +
      '&font=arial&height=21&href=' + SHORTENED_URL_ENCODED));

  // ...but Google+ doesn't use the shortened URL because it fails whitelisting.
  expectDescendantOf(parent, withClass(cm.css.GPLUS_SHARE_BUTTON), withHref(
      '//plus.google.com/share?hl=en&url=' + APPSTATE_URL_ENCODED));

  // Confirm that unchecking the box restores the unshortened URL.
  this.expectLogAction(cm.Analytics.SharePopupAction.SHORTEN_URL_OFF, null);
  checkbox.checked = false;
  cm.events.emit(checkbox, 'click');
  expectDescendantOf(parent, withId(cm.css.SHARE_URL), withValue(APPSTATE_URL));
};

/** Tests that the popup can be made to show only the Facebook button. */
SharePopupTest.prototype.showFacebookButtonOnly = function() {
  var parent = this.createPopup_(true, false, false);
  expectDescendantOf(parent, withClass(cm.css.FACEBOOK_LIKE_BUTTON));
  expectNoDescendantOf(parent, withClass(cm.css.GPLUS_SHARE_BUTTON));
  expectNoDescendantOf(parent, withClass(cm.css.TWITTER_SHARE_BUTTON));
};

/** Tests that the popup can be made to show only the Google+ button. */
SharePopupTest.prototype.showGooglePlusButtonOnly = function() {
  var parent = this.createPopup_(false, true, false);
  expectNoDescendantOf(parent, withClass(cm.css.FACEBOOK_LIKE_BUTTON));
  expectDescendantOf(parent, withClass(cm.css.GPLUS_SHARE_BUTTON));
  expectNoDescendantOf(parent, withClass(cm.css.TWITTER_SHARE_BUTTON));
};

/** Tests that the popup can be made to show only the Twitter button. */
SharePopupTest.prototype.showTwitterButtonOnly = function() {
  var parent = this.createPopup_(false, false, true);
  expectNoDescendantOf(parent, withClass(cm.css.FACEBOOK_LIKE_BUTTON));
  expectNoDescendantOf(parent, withClass(cm.css.GPLUS_SHARE_BUTTON));
  expectDescendantOf(parent, withClass(cm.css.TWITTER_SHARE_BUTTON));
};

/**
 * Tests for the ShareButton class
 * @constructor
 */
function ShareButtonTest() {
  cm.TestBase.call(this);  // set up the fake DOM
}
ShareButtonTest.prototype = new cm.TestBase();
registerTestSuite(ShareButtonTest);

ShareButtonTest.prototype.createButton_ = function() {
  var appState = createMockInstance(cm.AppState);
  stub(appState.getUri)().is(APPSTATE_URI_OBJECT);
  var map = createMockInstance(google.maps.Map);
  var mapControls = [];
  for (var key in google.maps.ControlPosition) {
    mapControls[google.maps.ControlPosition[key]] = [];
  }
  map.controls = mapControls;

  this.popup_ = this.expectNew_('cm.SharePopup', _, _, _, _, _, _);
  var shareButton = new cm.ShareButton(map, appState, true, true, true);
  expectThat(mapControls, contains([withClass(cm.css.MAPBUTTON)]));
  var matches = filterMatches(
      mapControls, contains(withClass(cm.css.MAPBUTTON)));
  expectEq(1, matches.length);
  expectEq(1, matches[0].length);
  this.button_ = matches[0][0];
};

ShareButtonTest.prototype.testToggleOn = function() {
  this.createButton_();

  stub(this.popup_.isVisible)().is(false);
  expectCall(this.popup_.show)();
  this.expectLogAction(cm.Analytics.MapAction.SHARE_TOGGLED_ON, null);
  cm.events.emit(this.button_, 'mousedown');
};

ShareButtonTest.prototype.testToggleOff = function() {
  this.createButton_();
  stub(this.popup_.isVisible)().is(true);
  this.expectLogAction(cm.Analytics.MapAction.SHARE_TOGGLED_OFF, null);
  cm.events.emit(this.button_, 'mousedown');
};
