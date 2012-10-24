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
 * @fileoverview [MODULE: edit] A table-driven property inspector.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.InspectorView');

goog.require('cm.LayerModel');
goog.require('cm.editors');
goog.require('cm.events');
goog.require('cm.ui');

/** @desc Label for the OK button on a dialog with OK and Cancel buttons. */
var MSG_OK = goog.getMsg('OK');

/** @desc Label for the Cancel button on a dialog with OK and Cancel buttons. */
var MSG_CANCEL = goog.getMsg('Cancel');

/** @desc Link to import/copy an existing layer. */
var MSG_COPY_EXISTING = goog.getMsg('Copy an existing layer');

/**
 * A property inspector.  Call inspect() to inspect an object's properties.
 * @constructor
 */
cm.InspectorView = function() {
  /**
   * @type Element
   * @private
   */
  this.popup_;

  /**
   * @type Element
   * @private
   */
  this.titleElem_;

  /**
   * @type Element
   * @private
   */
  this.copyLayerLink_;

  /**
   * @type Element
   * @private
   */
  this.tableElem_;

  /**
   * @type Element
   * @private
   */
  this.okBtn_;

  /**
   * @type Element
   * @private
   */
  this.cancelBtn_;

  /**
   * Whether or not this dialog is for a newly created layer.
   * @type {boolean}
   * @private
   */
  this.isNew_;

  this.popup_ = cm.ui.create('div', {'class': 'cm-inspector cm-popup'},
      cm.ui.create('div', undefined,
          this.titleElem_ = cm.ui.create('h2'),
          this.copyLayerLink_ = cm.ui.createLink(MSG_COPY_EXISTING)),
      this.tableElem_ = cm.ui.create('table',
          {'class': 'cm-editors', 'cellpadding': '0', 'cellspacing': '0'}),
      cm.ui.create('div', {'class': 'cm-button-area'},
          this.okBtn_ = cm.ui.create(
              'button', {'class': 'cm-button cm-submit'}, MSG_OK),
          this.cancelBtn_ = cm.ui.create(
              'button', {'class': 'cm-button'}, MSG_CANCEL)));

  cm.events.listen(this.copyLayerLink_, 'click', this.handleCopyClick_, this);
  cm.events.listen(this.okBtn_, 'click', this.handleOk_, this);
  cm.events.listen(this.cancelBtn_, 'click', this.handleCancel_, this);
};

/**
 * Build and show an object property inspector.  Accepts a list of editor
 * specifications (indicating which properties to edit and the types of editors
 * to show), and optionally a MapModel or LayerModel to populate the initial
 * values with.  If the user presses "OK", the edits are applied all at once in
 * a single EditCommand, or a new LayerModel is created if no object was given.
 * @param {string} title The title to show on the dialog.
 * @param {Array.<Object.<{key: string,
 *                         label: string,
 *                         type: cm.editors.Type,
 *                         conditions: Object}>>} editorSpecs
 *     An array of editor specifications.  Each element specifies the key of
 *     the property to edit, the label to show to the user, and the type of
 *     editor to use to edit the property.  The conditions object, if given,
 *     is a map from property keys to predicates (single-argument functions
 *     that take a property value and return a boolean); the editor is shown
 *     only when all the predicates are true.  Some editors accept other
 *     options, which are given as additional properties in the editorSpecs
 *     item; see the cm.*Editor constructors for details.
 * @param {cm.MapModel|cm.LayerModel=} opt_object If specified, the MapModel or
 *     LayerModel whose properties will be edited. Otherwise, a blank inspector
 *     will be displayed, and a new LayerModel will be created on OK.
 */
cm.InspectorView.prototype.inspect = function(title, editorSpecs, opt_object) {
  // We bind the editors to a separate "draft" copy of the object (instead of
  // the original object) so we can apply all the edits in a single Command.
  this.isNew_ = !opt_object;
  this.object_ = opt_object || new google.maps.MVCObject();
  this.draft_ = new google.maps.MVCObject();

  cm.ui.setText(this.titleElem_, title);
  goog.dom.classes.enable(this.copyLayerLink_, 'cm-hidden', !this.isNew_);

  /** The table row DOM elements (each one holds a label and an editor). */
  this.rows_ = {};

  // A map from editor keys to conditions for showing that editor.  Each
  // condition object maps property keys to predicate functions.
  this.conditions_ = {};

  // The union of all the keys that appear in the condition objects (i.e. all
  // the keys on which the visibility of other editors can depend).
  var triggerKeys = {};

  cm.ui.clear(this.tableElem_);
  for (var i = 0; i < editorSpecs.length; i++) {
    var spec = editorSpecs[i];

    // Add a table row for each editor.  Each table row automatically gets
    // a CSS class name in lowercase-with-hyphens style based on the editor
    // type, e.g. cm.editors.Type.FOO gets the CSS class "cm-foo-editor".
    var id = cm.ui.generateId('editor');
    var cell, row;
    var cls = 'cm-' + spec.type.toLowerCase().replace(/_/g, '-') + '-editor';
    cm.ui.append(this.tableElem_, row = cm.ui.create('tr', {'class': cls},
        cm.ui.create('th', {},
            cm.ui.create('label', {'for': id}, spec.label)),
        cell = cm.ui.create('td')));
    var editor = cm.editors.create(cell, spec.type, id, spec);

    // Add a validation error indicator next to each editor.
    // TODO(kpy): When we figure out the exact UX we want, we might want to
    // replace this with an icon and a popup or something like that.
    var errorSpan = cm.ui.create('span', {'class': 'cm-validation-error'});
    cm.ui.append(cell, errorSpan);
    (function(errorSpan) {  // close over the local variable, errorSpan
      cm.events.onChange(editor, 'validation_error', function() {
        cm.ui.setText(errorSpan, this.get('validation_error') || '');
      }, editor);
    })(errorSpan);

    // TODO(kpy): Offer some help text next to each editor.

    // Bind the editor to a property on our draft new version of the object.
    this.draft_.set(spec.key, this.object_.get(spec.key));
    editor.bindTo('value', this.draft_, spec.key);
    this.rows_[spec.key] = row;

    // Collect the set of property keys on which conditional editors depend.
    if (spec.conditions) {
      for (var triggerKey in spec.conditions) {
        triggerKeys[triggerKey] = true;
      }
      this.conditions_[spec.key] = spec.conditions;
    }
  }

  // Bring up the inspector dialog.
  cm.ui.showPopup(this.popup_);
  cm.events.emit(goog.global, cm.events.INSPECTOR_VISIBLE, {value: true});
  this.updateConditionalEditors_();

  // Listen for changes that will affect conditional editors.
  for (var key in triggerKeys) {
    cm.events.onChange(this.draft_, key, this.updateConditionalEditors_, this);
  }
};

/**
 * Switches to importer dialog.
 * @private
 */
cm.InspectorView.prototype.handleCopyClick_ = function() {
  cm.events.emit(goog.global, cm.events.IMPORT);
  cm.events.emit(goog.global, cm.events.INSPECTOR_VISIBLE, {value: false});
  cm.ui.remove(this.popup_);
};

/**
 * Applies the user's edits by emitting an undoable EditCommand.
 * @private
 */
cm.InspectorView.prototype.handleOk_ = function() {
  var oldValues = {}, newValues = {};
  for (var key in this.rows_) {
    var oldValue = this.object_.get(key);
    var newValue = this.draft_.get(key);
    if (!this.editorIsActive_(key)) {
      // The editor's conditions determine whether a key is active or not, but
      // we currently have only one notion of conditionality to determine
      // both whether to display the field in the editor UI and whether the
      // field should be modified when the command is executed. We should
      // separate these concepts so that a field may be hidden in the UI but
      // retain its value (e.g. a folder's 'type' property). For now, we set an
      // inactive key's new value to undefined instead of null, even though some
      // inactive fields that we would prefer to clear during an editing session
      // will linger.
      newValue = undefined;
    }
    if (newValue !== oldValue) {
      oldValues[key] = oldValue;
      newValues[key] = newValue;
    }
  }
  if (this.isNew_) {
    cm.events.emit(goog.global, cm.events.NEW_LAYER, {properties: newValues});
  } else {
    var object = this.object_;
    cm.events.emit(goog.global, cm.events.OBJECT_EDITED, {
      oldValues: oldValues,
      newValues: newValues,
      layerId: object instanceof cm.LayerModel ? object.get('id') : null
    });
  }
  cm.events.emit(goog.global, cm.events.INSPECTOR_VISIBLE, {value: false});
  cm.ui.remove(this.popup_);
};

/**
 * Cancels the user's edits.
 * @private
 */
cm.InspectorView.prototype.handleCancel_ = function() {
  cm.events.emit(goog.global, cm.events.INSPECTOR_VISIBLE, {value: false});
  cm.ui.remove(this.popup_);
};

/**
 * Checks an editor's conditions and returns true if it should be shown for
 * editing.  For editors that have no conditions, this always returns true.
 * @param {string} key A property key for one of the editors.
 * @return {boolean} True if the editor should be shown for editing.
 * @private
 */
cm.InspectorView.prototype.editorIsActive_ = function(key) {
  var conditions = this.conditions_[key] || {};
  for (var triggerKey in conditions) {
    if (!conditions[triggerKey](this.draft_.get(triggerKey))) {
      return false;
    }
  }
  return true;
};

/**
 * Shows and hides editors according to their display conditions.
 * @param {string} opt_changedKey The property key that was changed.  If this
 *     is given, only the editors affected by that key will be updated;
 *     otherwise, the visibility of all editors will be updated.
 * @private
 */
cm.InspectorView.prototype.updateConditionalEditors_ =
    function(opt_changedKey) {
  for (var editorKey in this.conditions_) {
    if (!opt_changedKey || (opt_changedKey in this.conditions_[editorKey])) {
      this.rows_[editorKey].style.display =
          this.editorIsActive_(editorKey) ? '' : 'none';
    }
  }
};
