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

/** Update the UI of the popup. */
function updateCreatePopup() {
  $('create-popup-submit').removeAttribute('disabled');
  // Require organization name only if the acceptable_org checkbox is checked.
  if ($('acceptable-org').checked) {
    $('organization-name').style.display = 'block';
    if ($('organization-input').value.replace(/^\s*/g, '') === '') {
      $('create-popup-submit').setAttribute('disabled', 'disabled');
    }
  } else {
    $('organization-name').style.display = 'none';
  }
  // Require at least one use-case checkbox to be selected.
  if (!$('acceptable-purpose').checked && !$('acceptable-org').checked) {
    $('create-popup-submit').setAttribute('disabled', 'disabled');
  }
}

/**
 * Hide an element.
 * @param {Element} element A DOM element to hide.
 */
function hide(element) {
  element.style.display = 'none';
}

/**
 * Show an element as a centered popup window.
 * @param {Element} popup A DOM element to show as a popup.
 */
function showPopup(popup) {
  popup.style.display = 'block';
  var x = Math.max(0, (document.body.offsetWidth - popup.offsetWidth) / 2);
  var y = Math.max(0, (document.body.offsetHeight - popup.offsetHeight) / 2);
  popup.style.left = Math.round(x) + 'px';
  popup.style.top = Math.round(y) + 'px';
}

/** Display the popup required before creating a map. */
function showCreatePopup() {
  showPopup($('create-popup'));
  var inputs = $('create-popup').getElementsByTagName('input');
  for (var i = 0; i < inputs.length; i++) {
    inputs[i].addEventListener('change', updateCreatePopup);
    inputs[i].addEventListener('keyup', updateCreatePopup);
  }
  updateCreatePopup();
}

/** Handle clicking on 'Create Map' in the popup. */
function submitCreatePopup() {
  $('create-popup-domain').value = $('domain').value;
}

/** Display popup that prompts for creating a domain. */
function showCreateDomainPopup() {
  showPopup($('create-domain-popup'));
}
