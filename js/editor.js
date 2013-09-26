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
 * @fileoverview [MODULE: edit] The base class for all editors.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.Editor');

/**
 * The base class for all editors.  An editor is an MVCObject that manages a
 * piece of UI for editing a value and exposes the value in a 'value' property.
 * The usual pattern for implementing an editor is: (a) have the constructor
 * build the UI in the state corresponding to a value of null; (b) adorn the UI
 * elements with listeners that interpret the user input and call setValid()
 * or setInvalid() to update the internal state of the editor; (c) implement
 * updateUi() to update the UI according to the 'value' property.
 * @constructor
 * @extends google.maps.MVCObject
 * @implements {goog.disposable.IDisposable}
 */
cm.Editor = function() {
  google.maps.MVCObject.call(this);

  // The value of the editor.
  this.set('value', null);

  // A validation error message to display to the user.  This property is
  // guaranteed to be null if and only if the editor is in a valid state, and
  // guaranteed to be a non-empty string if and only if the editor is invalid.
  this.set('validation_error', null);

  // A flag we use to temporarily prevent this.updateUi from being called.
  this.suppressUiUpdates_ = false;

  this.disposed_ = false;

  cm.events.onChange(this, 'value', function() {
    if (!this.suppressUiUpdates_) {
      var value = this.get('value');
      this.updateUi(value === undefined ? null : value);
    }
  }, this);
};
goog.inherits(cm.Editor, google.maps.MVCObject);

/**
 * Sets the 'value' property of the editor and marks it valid, without
 * triggering updateUi.  (The assumption is that this is being called due to
 * user input, and we don't want to mess up the UI while the user is using it.)
 * @param {*} value The new value.
 * @protected
 */
cm.Editor.prototype.setValid = function(value) {
  this.suppressUiUpdates_ = true;
  this.set('validation_error', null);
  this.set('value', value);
  this.suppressUiUpdates_ = false;
};

/**
 * Marks the editor invalid and sets the validation error message, without
 * triggering updateUi.  (When the input is invalid, we want to null out the
 * 'value' property, but not to clear the UI while the user is typing into it.)
 * @param {string} message The validation error message.
 * @protected
 */
cm.Editor.prototype.setInvalid = function(message) {
  this.suppressUiUpdates_ = true;
  this.set('validation_error', message || 'input is invalid');
  this.set('value', null);
  this.suppressUiUpdates_ = false;
};

/**
 * Updates the editor's UI with a new value.  Subclasses should implement this.
 * @param {*} value The new value.  The caller should ensure this is
 *     never undefined.
 * @protected
 */
cm.Editor.prototype.updateUi = function(value) {
};

/** @override */
cm.Editor.prototype.dispose = function() {
  this.disposed_ = true;
};

/** @override */
cm.Editor.prototype.isDisposed = function() {
  return this.disposed_;
};
