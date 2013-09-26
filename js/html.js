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
 * @fileoverview An Html object encapsulates a string of HTML.  Use this
 * to wrap strings of unsanitized HTML so that they don't inadvertently get
 * exposed, and use the {Html} type in JsDoc annotations to prevent HTML from
 * getting mixed up with plain strings.  Call getHtml() to get sanitized
 * HTML, safe for use as innerHTML content.
 *
 * @author kpy@google.com (Ka-Ping Yee)
 */

// NOTE(kpy): The HTML sanitizer is not included and must be installed with
// cm.Html.installSanitizer.  Until that point, attempts to sanitize HTML will
// not yield unsafe HTML; they will just yield <!-- no sanitizer available -->.

goog.provide('cm.Html');

goog.require('cm');
goog.require('goog.string');

/**
 * Wraps some unsanitized HTML to make a new Html object.
 * @param {string} unsanitizedHtml A string of unsanitized HTML.
 * @constructor
 */
cm.Html = function(unsanitizedHtml) {
  /**
   * The string of unsanitized, possibly unsafe HTML.
   * @type {string}
   * @private
   */
  this.unsanitizedHtml_ = unsanitizedHtml || '';

  /**
   * The sanitized HTML (populated the first time getHtml() is called).
   * @type {?string}
   * @private
   */
  this.sanitizedHtml_ = null;
};


/**
 * The HTML sanitizer.  Because the sanitizer is large (about 9 kb), we don't
 * include it initially; it is installed using cm.Html.installSanitizer().
 * @param {string} unsanitizedHtml Unsanitized, possibly unsafe HTML.
 * @return {string} The sanitized HTML.
 * @private
 */
cm.Html.sanitize_ = function(unsanitizedHtml) {
  var escapedHtml = goog.string.htmlEscape(unsanitizedHtml);
  return '<!-- no sanitizer available: ' + escapedHtml + ' -->';
};


/**
 * Installs the global HTML sanitizer.
 * @param {function(string): string} sanitizer A function that takes a string
 *     of raw HTML and returns a string of sanitized HTML.
 */
cm.Html.installSanitizer = function(sanitizer) {
  cm.Html.sanitize_ = sanitizer;
};


/**
 * A handy constant for an empty string of HTML.
 * @type {!cm.Html}
 * @const
 */
cm.Html.EMPTY = new cm.Html('');


/**
 * @param {string} text A string of plain text.
 * @return {!cm.Html} The text safely encoded as HTML, in an Html object.
 */
cm.Html.fromText = function(text) {
  var html = goog.string.htmlEscape(text || '').replace(/\n/g, '<br>');
  return cm.Html.fromSanitizedHtml(html);
};


/**
 * Only use this method when you are certain the input is sanitized!
 * @param {string} sanitizedHtml A string of sanitized, known safe HTML.
 * @return {!cm.Html} The HTML wrapped in an Html object.
 */
cm.Html.fromSanitizedHtml = function(sanitizedHtml) {
  var html = new cm.Html(sanitizedHtml || '');
  html.sanitizedHtml_ = sanitizedHtml || '';
  return html;
};


/**
 * @param {Element} element A DOM element.
 * @return {!cm.Html} The HTML content of the element, in an Html object.
 */
cm.Html.fromElement = function(element) {
  return new cm.Html(element.innerHTML || '');
};


/** @return {boolean} True if the underlying string is empty. */
cm.Html.prototype.isEmpty = function() {
  return this.unsanitizedHtml_ === '';
};


/**
 * Compares this object with another Html object.  (To use this for comparison
 * in tests, set cm.Html.prototype.gjstestEquals = cm.Html.prototype.equals.)
 * @param {cm.Html} other An Html object or null.
 * @return {boolean} True if this object and 'other' have identical observable
 *     behaviour.
 */
cm.Html.prototype.equals = function(other) {
  if (other) {
    // Sanitization happens lazily; may need to do it now in order to compare.
    if (this.sanitizedHtml_ === null && other.sanitizedHtml_ !== null) {
      this.getHtml();
    }
    if (other.sanitizedHtml_ === null && this.sanitizedHtml_ !== null) {
      other.getHtml();
    }
    return this.unsanitizedHtml_ === other.unsanitizedHtml_ &&
        this.sanitizedHtml_ === other.sanitizedHtml_;
  }
  return false;
};


/**
 * Returns something safe if the object is used as a string (e.g. with '+').
 * @return {string} The escaped HTML in an HTML comment.
 */
cm.Html.prototype.toString = function() {
  // We (safely) expose the HTML content so that the assert error message
  // gives more useful information when a test fails.
  var escapedHtml = goog.string.htmlEscape(this.unsanitizedHtml_);
  return '<!-- unsanitized: ' + escapedHtml + ' -->';
};


/**
 * Converts the HTML to plain text.  (This is only a crude conversion --
 * it strips the tags and handles only &lt; &gt; &quot; and &amp; entities.)
 * @return {string} The HTML converted to plain text.
 */
cm.Html.prototype.toText = function() {
  return goog.string.unescapeEntities(
      this.unsanitizedHtml_.replace(/<[^>]*>/g, ''));
};


/** @return {string} The unsanitized, possibly unsafe HTML. */
cm.Html.prototype.getUnsanitizedHtml = function() {
  return this.unsanitizedHtml_;
};


/** @return {string} HTML that's safe for innerHTML content. */
cm.Html.prototype.getHtml = function() {
  if (this.sanitizedHtml_ === null) {
    this.sanitizedHtml_ = cm.Html.sanitize_(this.unsanitizedHtml_);
  }
  return this.sanitizedHtml_;
};


/**
 * Sets the innerHTML of the given element to the sanitized HTML.
 * @param {Element} element The element whose content will be replaced.
 */
cm.Html.prototype.pasteInto = function(element) {
  element.innerHTML = this.getHtml();
};
