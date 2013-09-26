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

// In order to show dates or times in the user's local time, we have to do the
// time conversion in the browser.  (Even if we sent the user's current time
// zone offset to the server, that wouldn't be enough to do conversion on the
// server, as different dates can have different time zone offsets due to DST).
//
// This window.onload handler fills in specially prepared DOM elements with
// formatted local times.  Each element with class "cm-date-template" has its
// "title" attribute and its content processed to replace placeholders of the
// form "[[short_date N]]" and "[[long_date N]]" with formatted local times,
// where N is a number of seconds since 1970-01-01 00:00:00 UTC.
//
// Here's an example:
//
//     <span class="cm-date-template">Modified [[short_date 1234567890]]</span>
//
// For users in Berkeley, this will be updated to say "Modified Feb 13, 2009".
// But for users in Beijing, it will say "Modified Feb 14, 2009", as it should.

var NOW = new Date();

/**
 * @param {number} n An integer.
 * @return {string} The number padded to two digits, with leading 0 if needed.
 */
function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/**
 * @param {number} t Seconds since 1970-01-01 00:00:00 UTC.
 * @return {string} The date in YYYY-MM-DD HH:MM:SS format in local time.
 */
function longDate(t) {
  var local = new Date();
  local.setTime(t * 1000);
  // getMonth returns ZERO for Jan, 11 for Dec.  getDate returns the DAY OF
  // THE MONTH, not the date.  I hate everything about the JS Date type.
  var result = local.getFullYear() + '-' + pad2(local.getMonth() + 1) + '-' +
      pad2(local.getDate()) + ' ' + pad2(local.getHours()) + ':' +
      pad2(local.getMinutes());
  return result.replace(/ /g, '\xa0');  // prevent line breaks
}

/**
 * @param {number} t Seconds since 1970-01-01 00:00:00 UTC.
 * @return {string} A short English string describing the time or date.
 */
function shortDate(t) {
  var time = NOW.getTime() / 1000;
  var result = 'Just now';
  if (time - t > 3600) {
    var local = new Date();
    local.setTime(t * 1000);
    if (local.toDateString() == NOW.toDateString()) {  // same date
      result = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11][local.getHours() % 12] +
          ':' + pad2(local.getMinutes()) + (local.getHours() < 12 ? 'a' : 'p');
    } else {
      result = local.toDateString().match(/\w+ \d+/)[0];
      if (local.getFullYear() != NOW.getFullYear()) {
        result += ', ' + local.getFullYear();
      }
    }
  } else if (time - t > 60) {
    result = Math.round((time - t) / 60) + 'm ago';
  }
  return result.replace(/ /g, '\xa0');  // prevent line breaks
}

/**
 * @param {string} format A string containing placeholders of the form
 *     [[short_date N]] or [[long_date N]], where N is a time in epoch seconds.
 * @return {string} The string with placeholders replaced by formatted times.
 */
function formatDates(format) {
  return format.replace(
      /\[\[short_date (\d+)]]/g, function(all, t) { return shortDate(t); }
  ).replace(
      /\[\[long_date (\d+)]]/g, function(all, t) { return longDate(t); });
}

/**
 * Replaces placeholders in "title" attributes and content of elements with the
 * class "cm-date-template", then removes the class from the processed elements.
 */
window.onload = function() {
  // getElementsByClassName returns a live NodeList, from which items vanish
  // when we change their classNames.  We convert to an Array to avoid this.
  var elements = Array.prototype.slice.call(
      document.getElementsByClassName('cm-date-template'));
  for (var i = 0; i < elements.length; i++) {
    var title = elements[i].getAttribute('title');
    if (title) {
      elements[i].setAttribute('title', formatDates(title));
    }
    elements[i].innerHTML = formatDates(elements[i].innerHTML);
    elements[i].className = (' ' + elements[i].className + ' ').replace(
        / cm-date-template /g, ' ');
  }
};
