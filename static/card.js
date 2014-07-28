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
 * This is also used as the subtitle of the card, when the results displayed are
 * customized to the user's current location.
 */
var MSG_NEAR_YOU = 'Near you';

/**
 * The disabled menu option when the user has previously dismissed or
 * disabled location-sharing.
 */
var MSG_YOUR_LOCATION_NOT_AVAILABLE = 'Your location not available';

/** The message in the menu instructing users how to enable location sharing. */
var MSG_LOCATION_HOW_TO = 'How to enable location sharing';

/**
 * A URL for a page with instructions about how to enable location-
 * sharing in various browsers. TODO(romano): update this link with something
 * specific to Crisis Landing Pages.
 */
var HOW_TO_ENABLE_LOCATION_SHARING_URL =
    'https://support.google.com/gmm/answer/1250068';

/** Minimum height of an iframed card that is dynamically resized. */
var MIN_RESIZED_CARD_HEIGHT = 200;

/** Action to log for clicks on the "Near you" location menu option. */
var ACTION_NEAR_YOU_OPTION_CLICK = '"Near you" option clicked';

/**
 * Action to log for clicks on the "Your location not available"
 * location menu option.
 */
var ACTION_LOCATION_NOT_AVAILABLE_OPTION_CLICK =
    '"Your location not available" option clicked';

/** Action to log for clicks on all other location menu options. */
var ACTION_LOCATION_MENU_OPTION_CLICK = 'Location menu option clicked';

/**
 * Card name; temporarily defined here until the cardify provider can
 * pass it in.
 */
var CARD_NAME = 'Place list';


function $(id) {
  return document.getElementById(id);
}

/**
 * Browser-independent function to get elements that are descendants of
 * the given element that have the given class.
 * @param {string} names A string of whitespace-separated class names
 *     to be matched.
 * @param {Element} elem The root DOM element in which to search.
 * @return {Array.<Element>} The array of elements that have the class name.
 */
function getElementsByClassName(names, elem) {
  if (elem.getElementsByClassName) {
    return elem.getElementsByClassName(names);
  } else if (elem) {
    return elem.querySelectorAll((' ' + names).replace(/ +/g, '.'));
  }
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
    setTextContent(locationName, placeName || MSG_NEAR_YOU);
  }
}
/**
 * Log click events with the given action and label.
 * @param {string} action The action to log.
 * @param {string} label The label to attach to the logged event.
 * @param {string=} opt_mapIdLayerId An optional custom variable to
 *     attach to the event.
 */
function logEvent(action, label, opt_mapIdLayerId) {
  if (opt_mapIdLayerId) {
    window._gaq.push(['_setCustomVar', 1, 'Layer ID', opt_mapIdLayerId]);
  }
  window._gaq.push(['_trackEvent', CARD_NAME, action, label]);
  // Clear custom variables so subsequent events do not pick them up.
  window._gaq.push(['_setCustomVar', 1, 'Layer ID', null]);
}

/**
 * Log click events for links on the card.
 * @param {string} mapId The Maproot map ID of the map in which the
 *    card topic is defined.
 */
function addClickEventTrackingToLinks(mapId) {
  // For now, don't log clicks for browsers that don't support
  // Function.prototype.bind(); eventually we'll use Closure's goog.bind()
  var links = document.getElementsByTagName('a');
  for (var i = 0; i < links.length; i++) {
    var action = null;
    var layerId = null;
    var className = links[i].className;
    var label = links[i].href;
    if (className.match('place-link')) {
      action = 'Place link clicked';
      // The layer ID is the first alphanumeric string in the element ID.
      layerId = links[i].id.match(/\w+/);
    } else if (className.match('directions-link')) {
      action = 'Directions link clicked';
      // The layer ID is the first alphanumeric string in the element ID.
      layerId = links[i].id.match(/\w+/);
    } else if (links[i].parentNode.className.match('unit-menu')) {
      action = 'Unit menu option clicked';
    } else {
      // Avoid double-counting clicks on links in the location menu,
      // which are already logged in the menu option click handlers.
      // (e.g., "How to enable location sharing")
      if (!links[i].parentNode.parentNode.className.match('location-text')) {
        action = 'Link clicked';
      }
    }
    if (action) {
      addClickListener(links[i], function() {
        logEvent(action, label, mapId + ':' + layerId);
      });
    }
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
 * Set up a browser-independent listener for several event types.
 * @param {Element} source The element to which to attach the listener.
 * @param {string} type The event type.
 * @param {function(Object)} handler The event handler.
 */
function addListener(source, type, handler) {
  switch (type) {
    case 'click':
      addClickListener(source, handler);
      return;
    case 'resize':
      if (source.addEventListener) {
        source.addEventListener('resize', handler);
      } else {
        source.attachEvent('onresize', handler);
      }
      return;
    case 'message':
      if (source.addEventListener) {
        source.addEventListener(type, handler);
      }
      // For IE8, don't listen for 'message' events.
      return;
  }
}

/**
 * Browser-independent click-listener set-up.
 * @param {Element} source The element to which to attach the click listener.
 * @param {function(Object)} handler The click handler.
 */
function addClickListener(source, handler) {
  if (source.addEventListener) {
    source.addEventListener('click', function(e) {
      handler(e);
    }, false);
  } else {
    // For IE8, e.currentTarget is not defined. Setting the onlick
    // property binds the clicked element to this, so we set onclick
    // instead of attachEvent().
    source.onclick = function(e) {
      e = e || window.event;
      e.currentTarget = this;
      handler(e);
    };
  }
}

/**
 * Populate the location menu for the card, select the option with the given
 * ID, and set up click listeners for the options.
 * @param {Array.<Object>} places An array of places to be added to the location
 *   menu. Each array element is an object whose "id" field value is used as the
 *   element ID of the corresponding location menu option element. The name
 *   field of value is used as the display text for the menu option.
 * @param {?string} placeId The ID of the option to set as selected.
 * @param {string} baseUrl The base URL, stripped of any location
 *        parameters, to be loaded by the click handlers.
 * @param {boolean} locationUnavailable True if the user has disabled
 *        or dismissed location-sharing.
 */
function updateLocationMenu(places, placeId, baseUrl, locationUnavailable) {
  var locationMenu = $('location-menu');
  locationMenu.innerHTML = '';
  for (var i = 0; i < places.length; i++) {
    var place = places[i];
    var option = createLocationOption(place.id, 'option', place.name,
                                      place.id === placeId);
    addClickListener(option, function(e) {
      handleLocationClick(e, place.name, baseUrl, locationUnavailable);
    });
    locationMenu.appendChild(option);
  }

  // Add an option for using the user's current location if browser
  // supports it.
  if (navigator.geolocation) {
    var option = createLocationOption(
        '', 'option your-location', locationUnavailable ?
        MSG_YOUR_LOCATION_NOT_AVAILABLE : MSG_NEAR_YOU, !placeId);

    // Add instructions for enabling location sharing.
    var howToEnable = document.createElement('div');
    howToEnable.className = 'location-text no-checkmark';
    howToEnable.style.display = locationUnavailable ? 'block' : 'none';
    var howToEnableLink = document.createElement('a');
    howToEnableLink.setAttribute('href', HOW_TO_ENABLE_LOCATION_SHARING_URL);
    setTextContent(howToEnableLink, MSG_LOCATION_HOW_TO);
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
  var checkmarks = getElementsByClassName('location-menu option checkmark',
                                          document);
  for (var i = 0; i < checkmarks.length; i++) {
    checkmarks[i].style.visibility = 'hidden';
  }
}

/**
 * Click handler for the location menu options.
 * @param {Object} e The event payload.
 * @param {string} placeName The display name of the clicked menu option.
 * @param {string} baseUrl The base URL, stripped of any location
 *        parameters, to be loaded by the click handlers.
 * @param {boolean} locationUnavailable True if the user has disabled
 *        or dismissed location-sharing.
 */
function handleLocationClick(e, placeName, baseUrl, locationUnavailable) {
  logEvent(ACTION_LOCATION_MENU_OPTION_CLICK, placeName);
  clearSelectedLocation();
  var checkmarks = getElementsByClassName('location-menu option checkmark',
                                          e.currentTarget);
  if (checkmarks.length) {
    checkmarks[0].style.visibility = 'visible';
  }
  var id = e.currentTarget.id;
  window.location = baseUrl + '&place=' + id +
      (locationUnavailable ? '&location_unavailable=1' : '');
}

/**
 * Click handler for the "Near you" menu option.
 * @param {Object} e The event payload.
 * @param {string} baseUrl The base URL, stripped of any location
 *        parameters, to be loaded by the click handlers.
 * @param {boolean} locationUnavailable True if the user has disabled
 *        or dismissed location-sharing.
 */
function handleMyLocationClick(e, baseUrl, locationUnavailable) {
  if (locationUnavailable) {
    logEvent(ACTION_LOCATION_NOT_AVAILABLE_OPTION_CLICK, null);
    window.open(HOW_TO_ENABLE_LOCATION_SHARING_URL);
    return;
  }
  logEvent(ACTION_NEAR_YOU_OPTION_CLICK, null);
  clearSelectedLocation();
  var checkmarks = getElementsByClassName('location-menu option checkmark',
                                          e.currentTarget);
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

/** Fires when the user has clicked anywhere in the document. */
function documentClickHandler() {
  hideLocationMenu();
}
