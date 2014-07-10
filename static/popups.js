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
 * @fileoverview Functions for requiring the Acceptable Use Policy.
 * @author romano@google.com (Raquel Romano)
 */

/**
 * @param {string} id An element ID.
 * @return {Element} The DOM element with the given ID.
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * Hides an element.
 * @param {Element} element A DOM element to hide.
 */
function hide(element) {
  element.style.display = 'none';
}

/**
 * Shows an element as a centered popup window.
 * @param {Element} popup A DOM element to show as a popup.
 */
function showPopup(popup) {
  popup.style.display = 'block';
  var x = Math.max(0, (document.body.offsetWidth - popup.offsetWidth) / 2);
  var y = Math.max(0, (document.body.offsetHeight - popup.offsetHeight) / 2);
  popup.style.left = Math.round(x) + 'px';
  popup.style.top = Math.round(y) + 'px';
}

/** Creates a map. */
function createMap() {
  $('create-map-domain').value = $('domain').value;
  $('create-map-form').submit();
}

/** Updates the UI of the publish popup. */
function updatePublishPopup() {
  $('publish-popup-submit').disabled = isPublisherNameValid() ? '' : 'disabled';
}

/** @return {bool} True if the publisher name is acceptable to submit. */
function isPublisherNameValid() {
  return $('publisher-name').value.match(/\S/);
}

/**
 * Displays the popup required before publishing a map.
 * @param {string} mapId The map ID.
 */
function showPublishPopup(mapId) {
  showPopup($('publish-popup'));
  $('publish-popup-map').value = mapId;
  $('publisher-name').addEventListener('change', updatePublishPopup);
  $('publisher-name').addEventListener('keyup', updatePublishPopup);
  $('publish-popup-domain').value = $('domain-' + mapId).value;
  $('publish-popup-label').value = $('label-' + mapId).value;
  updatePublishPopup();
  $('publisher-name').focus();
}

/**
 * Displays the welcome popup if this is the first time this function has
 * been called in the current session for this uid within the last hour.
 * @param {string} uid The uid for the current user.
 */
function showWelcomePopup(uid) {
  var cookieName = 'welcome_popup_' + uid.replace(/\W/g, '');
  if (!(';' + document.cookie).match('; *' + cookieName + '=')) {
    showPopup($('welcome-popup'));
  }
  document.cookie = cookieName + '=shown; max-age=3600';
}
