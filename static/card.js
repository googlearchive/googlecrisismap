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

function $(id) {
  return document.getElementById(id);
}

/**
 * @param {string} placeName The display name of the place, shown in
 *   the card subtitle.
 */
function updateLocationStatus(placeName) {
  var locationStatus = $('location-status');
  if (placeName) {
    locationStatus.innerHTML = placeName;
  } else {
    locationStatus.innerHTML = 'Near my location';
  }
}

/**
 *
 */
function updateSize() {
  var card = document.getElementById('card');
  window.parent.postMessage({
    type: 'resize',
    width: card.scrollWidth,
    height: card.scrollHeight
  }, '*');
  try {
    // This call is for older browsers don't support postMessage, but it
    // will only work if the parent frame has the same origin.
    window.parent.resizeIframe(window, card.scrollWidth, card.scrollHeight);
  } catch (e) {
  }
}

function clearSelectedLocation() {
  var checkmarks = document.getElementsByClassName(
      'location-menu option checkmark');
  for (var i = 0; i < checkmarks.length; i++) {
    checkmarks[i].style.visibility = 'hidden';
  }
}

/**
 * Populate the location menu for the card and select the option with the given
 * ID. Also set up click listeners for other options.
 * @param {string} baseUrl The base URL, stripped of any location
 *     parameters, to be loaded by the click handlers.
 * @param {Array.<Object>} places An array of places to be added to the location
 *   menu. Each array element is an object whose "id" field value is used as the
 *   element ID of the corresponding location menu option element. The name
 *   field of value is used as the display text for the menu option.
 * @param {?string} placeId The ID of the option to set as selected.
 */
function fillLocationMenu(baseUrl, places, placeId) {
  var locationMenu = $('location-menu');
  for (var i = 0; i < places.length; i++) {
    var place = places[i];
    var option = document.createElement('div');
    option.className = 'option';
    option.id = place.id;

    var checkmark = document.createElement('div');
    checkmark.className = 'checkmark';
    checkmark.style.visibility = (place.id === placeId) ? 'visible' : 'hidden';

    var displayText = document.createElement('div');
    displayText.className = 'location-text';
    displayText.textContent = place.name;
    option.appendChild(checkmark);
    option.appendChild(displayText);

    option.addEventListener('click', function(e) {
      clearSelectedLocation();
      var checkmarks = e.currentTarget.getElementsByClassName(
          'location-menu option checkmark');
      if (checkmarks.length) {
        checkmarks[0].style.visibility = 'visible';
      }
      var id = e.currentTarget.id;
      window.location = baseUrl + '&place=' + id;
    }, false);
    locationMenu.appendChild(option);
  }

  // Add an option for using the user's current location if browser
  // supports it.
  if (navigator.geolocation) {
    var option = document.createElement('div');
    option.className = 'option';

    var checkmark = document.createElement('div');
    checkmark.className = 'checkmark';
    checkmark.style.visibility = placeId ? 'hidden' : 'visible';

    var displayText = document.createElement('div');
    displayText.className = 'location-text';
    displayText.textContent = 'My location';
    option.appendChild(checkmark);
    option.appendChild(displayText);

    option.addEventListener('click', function(e) {
      clearSelectedLocation();
      var checkmarks = e.currentTarget.getElementsByClassName(
          'location-menu option checkmark');
      if (checkmarks.length) {
        checkmarks[0].style.visibility = 'visible';
      }

      // Let the parent frame know that the user may want to share
      // location, and what type of URL parameter encodes it.
      window.parent.postMessage({
        type: 'location',
        url: baseUrl
      }, '*');
      try {
        // This call is for older browsers don't support postMessage, but it
        // will only work if the parent frame has the same origin.
        window.parent.getLocationForIframe(window, baseUrl);
      } catch (e) {
      }

    }, false);
    locationMenu.appendChild(option);
  }
}

/**
 * Display the location menu.
 * @param {Object} e The event payload.
 */
function showLocationMenu(e) {
  $('location-menu').style.display = 'block';
  e.stopPropagation();
}

/**
 *
 */
function hideLocationMenu() {
  var locationMenu = $('location-menu');
  locationMenu.style.display = 'none';
}
