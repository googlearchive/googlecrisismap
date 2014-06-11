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
 * TODO(romano): We need to set up i18n/l14n for cardify. For now, we prefix
 * these with MSG only as a reminder that they *should* be messages.
 */

/**
 * The menu option for customizing card results to the user's current location.
 */
var MSG_MY_LOCATION = 'My location';

/**
 * The disabled menu option when the user has previously dismissed or
 * disabled location-sharing.
 */
var MSG_MY_LOCATION_NOT_AVAILABLE = 'My location not available';

/** The message in the menu instructing users how to enable location sharing. */
var MSG_MY_LOCATION_HOW_TO = 'How to enable location sharing';

/**
 * The subtitle of a card when results are customized to the user's location.
 */
var MSG_NEAR_MY_LOCATION = 'Near my location';

/**
 * A URL for a page with instructions about how to enable location-
 * sharing in various browsers. TODO(romano): update this link with something
 * specific to Crisis Landing Pages.
 */
var HOW_TO_ENABLE_LOCATION_SHARING_URL =
    'https://support.google.com/gmm/answer/1250068';

/** Minimum height of an iframed card that is dynamically resized. */
var MIN_RESIZED_CARD_HEIGHT = 200;

function $(id) {
  return document.getElementById(id);
}

/** Inform the parent window that the card's content size has changed. */
function updateSize() {
  var card = $('card');
  window.parent.postMessage({
    type: 'resize',
    width: card.scrollWidth,
    height: card.scrollHeight
  }, '*');
  try {
    // This call is for older browsers that don't support postMessage, but it
    // will only work if the parent frame has the same origin.
    window.parent.resizeIframe(
        window, card.scrollWidth,
        Math.max(card.scrollHeight, MIN_RESIZED_CARD_HEIGHT));
  } catch (e) {
  }
}

/**
 * Browser-independent setting of an element's text content.
 * @param {Element} element The element whose text content to change.
 * @param {string} text The text content.
 */
function setTextContent(element, text) {
  if ('textContent' in element) {
    element.textContent = text;
  } else {
    element.innerHtml = '';
    element.appendChild(document.createTextNode(text));
  }
}

/**
 * Update the card's location name, displayed in the card subtitle.
 * @param {string} placeName The display name of the place.
 */
function updateLocationName(placeName) {
  var locationName = $('location-name');
  if (locationName) {
    setTextContent(locationName, placeName || MSG_NEAR_MY_LOCATION);
  }
}

/**
 * Create an option element to be added to the location menu.
 * @param {string} id The element ID of the option; the caller should
 *   ensure that these are unique.
 * @param {string} optionClassName The value to give the option's DOM
 *   'className' property.
 * @param {string} text The display text for the option.
 * @param {boolean} isSelected Whether the option is initially selected.
 * @return {Element} The option element.
 */
function createLocationOption(id, optionClassName, text, isSelected) {
  var option = document.createElement('div');
  option.id = id;
  option.className = optionClassName;

  var checkmark = document.createElement('div');
  checkmark.className = 'checkmark';
  checkmark.style.visibility = isSelected ? 'visible' : 'hidden';

  var optionText = document.createElement('div');
  optionText.className = 'location-text';
  setTextContent(optionText, text);
  option.appendChild(checkmark);
  option.appendChild(optionText);
  return option;
}

/**
 * Browser-independent click-listener set-up.
 * @param {Element} option The element to which to attach the click listener.
 * @param {function(Object)} handler The click handler.
 */
function addClickListener(option, handler) {
  if (option.addEventListener) {
    option.addEventListener('click', function(e) {
      handler(e);
    }, false);
  } else {
    option.onclick = function(e) {
      e.currentTarget = this;
      handler(e);
    };
  }
}

/**
 * Populate the location menu for the card, select the option with the given
 * ID, and set up click listeners for the options.
 * @param {string} baseUrl The base URL, stripped of any location
 *     parameters, to be loaded by the click handlers.
 * @param {Array.<Object>} places An array of places to be added to the location
 *   menu. Each array element is an object whose "id" field value is used as the
 *   element ID of the corresponding location menu option element. The name
 *   field of value is used as the display text for the menu option.
 * @param {?string} placeId The ID of the option to set as selected.
 * @param {boolean} locationUnavailable True if the user has disabled or
 *   dismissed location-sharing.
 */
function updateLocationMenu(baseUrl, places, placeId, locationUnavailable) {
  var locationMenu = $('location-menu');
  locationMenu.innerHTML = '';
  for (var i = 0; i < places.length; i++) {
    var place = places[i];
    var option = createLocationOption(place.id, 'option', place.name,
                                      place.id === placeId);
    addClickListener(option, function(e) {
      handleLocationClick(e, baseUrl, locationUnavailable);
    });
    locationMenu.appendChild(option);
  }

  // Add an option for using the user's current location if browser
  // supports it.
  if (navigator.geolocation) {
    var option = createLocationOption(
        '', 'option my-location', locationUnavailable ?
        MSG_MY_LOCATION_NOT_AVAILABLE : MSG_MY_LOCATION, !placeId);

    // Add instructions for enabling location sharing.
    var howToEnable = document.createElement('div');
    howToEnable.className = 'location-text no-checkmark';
    howToEnable.style.display = locationUnavailable ? 'block' : 'none';
    var howToEnableLink = document.createElement('a');
    howToEnableLink.setAttribute('href', HOW_TO_ENABLE_LOCATION_SHARING_URL);
    setTextContent(howToEnableLink, MSG_MY_LOCATION_HOW_TO);
    howToEnable.appendChild(howToEnableLink);
    option.appendChild(howToEnable);

    addClickListener(option, function(e) {
      handleMyLocationClick(e, baseUrl, locationUnavailable);
    });
    locationMenu.appendChild(option);
  }
}

/** Hide all checkmarks associated with the location menu options. */
function clearSelectedLocation() {
  var checkmarks = document.getElementsByClassName(
      'location-menu option checkmark');
  for (var i = 0; i < checkmarks.length; i++) {
    checkmarks[i].style.visibility = 'hidden';
  }
}

/**
 * Click handler for the location menu options.
 * @param {Object} e The event payload.
 * @param {string} baseUrl The base URL, stripped of any location
 *     parameters, to be loaded by the click handlers.
 * @param {boolean} locationUnavailable True if the user has disabled or
 *   dismissed location-sharing.
 */
function handleLocationClick(e, baseUrl, locationUnavailable) {
  clearSelectedLocation();
  var checkmarks = e.currentTarget.getElementsByClassName(
      'location-menu option checkmark');
  if (checkmarks.length) {
    checkmarks[0].style.visibility = 'visible';
  }
  var id = e.currentTarget.id;
  var newUrl = baseUrl + '&place=' + id;
  if (locationUnavailable) {
    newUrl += '&location_unavailable=1';
  }
  window.location = newUrl;
}

/**
 * Click handler for the "My Location" menu option.
 * @param {Object} e The event payload.
 * @param {string} baseUrl The base URL, stripped of any location
 *     parameters, to be loaded by the click handlers.
 * @param {boolean} locationUnavailable True if the user has disabled or
 *   dismissed location-sharing.
 */
function handleMyLocationClick(e, baseUrl, locationUnavailable) {
  if (locationUnavailable) {
    window.open(HOW_TO_ENABLE_LOCATION_SHARING_URL);
    return;
  }
  clearSelectedLocation();
  var checkmarks = e.currentTarget.getElementsByClassName(
      'location-menu option checkmark');
  if (checkmarks.length) {
    checkmarks[0].style.visibility = 'visible';
  }

  // Let the parent frame know that the user may want to share location.
  window.parent.postMessage({
    type: 'location',
    url: baseUrl
  }, '*');
  try {
    // This call is for older browsers that don't support postMessage, but
    // it will only work if the parent frame has the same origin.
    window.parent.getLocationForIframe(window, baseUrl);
  } catch (e) {
  }
}

/**
 * Display the location menu.
 * @param {Object} e The event payload.
 */
function showLocationMenu(e) {
  $('location-menu').style.display = 'block';
  e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
}

/** Stop displaying the location menu. */
function hideLocationMenu() {
  $('location-menu').style.display = 'none';
}
