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

/**
 * @type {number} Current index of the caret indicating the row to receive
 *     keyboard shortcuts.
 */
var caretIndex = 1;

/**
 * @type {Array.<function(?Object)>} Set of callbacks, one per row. Calling the
 *     callback at index i opens the info window for the report at row i.
 */
var infoWindowTriggers = [];

/**
 * Sets up globals assumed to exist, generally populted by a django template.
 * @param {Array.<Object>} reports The array of reports being displayed
 *     on the page.
 * @param {Array.<string>} params The array of params
 */
function setGlobals(reports, params) {
  window.reports = reports;
  window.params = params;
}

function $(id) {
  return document.getElementById(id);
}

/**
 * Updates the row color at index based on the state of the checkboxes
 * @param {number} index The index of the row for which to retrieve a color.
 * @return {string} A hex color string for the row background.
 */
function rowColor(index) {
  var accept = $('report-' + index + '-accept').checked;
  var downvote = $('report-' + index + '-downvote').checked;
  var upvote = $('report-' + index + '-upvote').checked;
  var current = index == caretIndex;
  return accept ? '#dfd' : // green
      downvote ? '#fdd' : // red
      upvote ? '#ddf' : // purple
      current ? '#ffd' : // yellow
      '#fff'; // white
}

/**
 * Moves the keyboard-shortcut caret to the row with the new index.
 * @param {number} newIndex The row index to which the caret should move.
 */
function moveCaret(newIndex) {
  var oldIndex = caretIndex;
  var row = $('caret-' + newIndex);
  if (row) {
    caretIndex = newIndex;
    updateRowStyle(oldIndex);
    updateRowStyle(newIndex);
    scrollIntoView(row);
    infoWindowTriggers[newIndex] && infoWindowTriggers[newIndex]();
  } else if ($('caret-' + oldIndex)) {
    updateRowStyle(oldIndex);
  }
}

/**
 * Scrolls the given element into view.
 * @param {Element} element The element to scroll into view.
 */
function scrollIntoView(element) {
  var viewportTop = (document.body.scrollTop +
                      document.documentElement.scrollTop);
  var viewportHeight = window.innerHeight;
  var elementBox = element.getBoundingClientRect();
  var pixelsToOverlap = elementBox.bottom - elementBox.top + 8;

  var scrollTo;
  if (elementBox.top < 0) {
    scrollTo = viewportTop +
                pixelsToOverlap + elementBox.bottom - viewportHeight;
  } else if (elementBox.bottom > viewportHeight) {
    scrollTo = viewportTop + elementBox.top - pixelsToOverlap;
  } else {
    return;
  }

  scrollTo = Math.min(document.body.scrollHeight - viewportHeight,
                       Math.max(0, scrollTo));
  window.scroll(document.body.scrollLeft +
                document.documentElement.scrollLeft,
                scrollTo);
}

/**
 * Updates the caret and background color of the row at the given index.
 * @param {number} index The index of the row to update.
 */
function updateRowStyle(index) {
  $('caret-' + index).innerHTML = (index == caretIndex) ? '\u25b6' : '';
  $('report-' + index).style.backgroundColor = rowColor(index);
}

/**
 * Updates the checkboxes and display of this row to guarantee only
 * one checkbox is checked at a time.
 * @param {number} index The row index.
 * @param {string} name The checkbox name.
 * @param {boolean} opt_toggle True to toggle the state of the named checkbox.
 */
function updateRow(index, name, opt_toggle) {
  updateRowStyle(index);

  var accept = $('report-' + index + '-accept');
  var downvote = $('report-' + index + '-downvote');
  var upvote = $('report-' + index + '-upvote');

  if (name == 'accept') {
    if (opt_toggle) accept.checked = !accept.checked;
    if (accept.checked) {
      downvote.checked = false;
      upvote.checked = false;
    }
  } else if (name == 'downvote') {
    if (opt_toggle) downvote.checked = !downvote.checked;
    if (downvote.checked) {
      accept.checked = false;
      upvote.checked = false;
    }
  } else if (name == 'upvote') {
    if (opt_toggle) upvote.checked = !upvote.checked;
    if (upvote.checked) {
      accept.checked = false;
      downvote.checked = false;
    }
  }
  moveCaret(index + 1);
}

/**
 * Document-wide keydown handler.
 * @param {Event} event The keydown event.
 */
function keydown(event) {
  // If keydown in a text box, just handle Enter
  if (event.target && event.target.type == 'text') {
    if (event.keyCode == 13) {  // Enter
      window.setTimeout(reload, 0);
    }
    return;
  }

  switch (event.keyCode) {
    case 74:  // j
      moveCaret(caretIndex + 1);
      break;
    case 75:  // k
      moveCaret(caretIndex - 1);
      break;
    case 65:  // a
      updateRow(caretIndex, 'accept', true);
      break;
    case 68:  // d
      updateRow(caretIndex, 'downvote', true);
      break;
    case 85:  // u
      updateRow(caretIndex, 'upvote', true);
      break;
    case 79:  // o
      window.open($('link-' + caretIndex).href, '_blank');
      break;
    case 13:  // Enter
      $('review-form').submit();
      break;
  }
}

/**
 * Reloads the page setting CGI parameters based on the data specified
 * in the form inputs.
 * @param {Object} overrides A map of (id, value) pairs to use instead
 *     of the value set in the input parameter with the given id.
 */
function reload(overrides) {
  overrides = overrides || {};
  var kvs = [];
  for (var i = 0; i < params.length; i++) {
    var param = params[i];
    var value = overrides[param] !== undefined ?
        overrides[param] : $(param).value;
    if (value) {
      kvs.push(param + '=' + encodeURIComponent(value));
    }
  }
  window.location.href = '?' + kvs.join('&');
}

/**
 * Returns a callback to show an info window for a marker.
 * @param {google.maps.Map} map The map to attach the marker and infoWindow.
 * @param {google.maps.Marker} marker The marker to attach the infoWindow
 * @param {google.maps.InfoWindow} infoWindow Info window in which to render
 *     the report
 * @param {Object} report The report object
 * @param {number} index The row index of the report
 * @return {function(Object)} the callback.
 */
function makeShowInfoWindowCallback(map, marker, infoWindow, report, index) {
  return function(e) {
    var content = '<table style="min-width: 300px">' +
        '<tr><td>Updated</td><td>' + report.updated + '</td></tr>' +
        '<tr><td>Answers</td><td>' + report.answers_escaped + '</td></tr>' +
        '<tr><td>Text</td><td>' + report.text_escaped + '</td></tr>' +
        '<tr><td>Votes</td><td>' + report.votes + '</td></tr>' +
        '<tr><td>Author</td><td>' + report.updated + '</td></tr>' +
        '<tr><td>Location</td><td><a href="' + report.url +
            '" target="_blank">' + report.location + '</a></td></tr>' +
        '</table>';
    infoWindow.setContent(content);
    infoWindow.open(map, marker);
    if (e) {
      moveCaret(index);
    }
  }
}

function initialize() {
  var map = new google.maps.Map(document.getElementById('map-canvas'));
  var infoWindow = new google.maps.InfoWindow();
  var bounds = new google.maps.LatLngBounds();
  for (var index in reports) {
    var report = reports[index];
    report.ll = new google.maps.LatLng(report.lat, report.lng);
    bounds.extend(report.ll);
    var marker = new google.maps.Marker({
      position: report.ll,
      map: map,
      title: report.text_escaped || '(No text) sent ' + report.updated,
      icon: report.icon_url
    });
    var callback = makeShowInfoWindowCallback(
        map, marker, infoWindow, report, index);
    google.maps.event.addListener(marker, 'click', callback);
    infoWindowTriggers.push(callback);
  }
  map.fitBounds(bounds);

  moveCaret(1);
}

google.maps.event.addDomListener(window, 'load', initialize);
google.maps.event.addDomListener(document, 'keydown', keydown);
