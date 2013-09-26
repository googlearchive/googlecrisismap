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
 * Return the element with the given ID.
 * @param {string} id The element ID.
 * @return {Element} The element.
 */
function $(id) {
  return document.getElementById(id) || {};
}

/** Handle clicking on 'Create Map' in the popup. */
function handleCreate() {
  $('create-popup-domain').value = $('domain').value;
}

/** Update the UI of the popup. */
function updateCreatePopup() {
  var orgNameInput = $('org-name');
  var orgNameRequired = $('required');
  var createButton = $('create-from-popup');
  createButton.removeAttribute('disabled');
  // Require organization name only if the checkbox indicating an acceptable
  // organization is selected.
  if ($('acceptable-org').checked) {
    orgNameInput.style.display = 'inline';
    orgNameRequired.style.display = 'inline';
    if (orgNameInput.value.replace(/^\s+|\s+$/g, '').length === 0) {
      createButton.setAttribute('disabled', 'disabled');
    }
  } else {
    orgNameInput.style.display = 'none';
    orgNameRequired.style.display = 'none';
  }
  // Require at least one use case checkbox to be selected.
  if (!$('acceptable-purpose').checked && !$('acceptable-org').checked) {
    createButton.setAttribute('disabled', 'disabled');
  }
}

/**
 * Position the popup div containing the form.
 * @param {Element} popup The div to position.
 */
function positionCreatePopup(popup) {
  popup.style.display = 'block';
  var x = Math.max(0, (document.body.offsetWidth - popup.offsetWidth) / 2);
  var y = Math.max(0, (document.body.offsetHeight - popup.offsetHeight) / 2);
  popup.style.left = Math.round(x) + 'px';
  popup.style.top = Math.round(y) + 'px';
}

/** Display the popup required before creating a map. */
function showCreatePopup() {
  positionCreatePopup($('create-popup'));
  updateCreatePopup();
}

/** Hide the popup. */
function hideCreatePopup() {
  $('create-popup').style.display = 'none';
}
