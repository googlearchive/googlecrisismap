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

goog.require('cm.css');
goog.require('cm.editors');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.ui.Tooltip');

/* Time in ms to delay hiding an editor field tooltip. */
var TOOLTIP_HIDE_DELAY_MS = 500;

/**
 * A specification of an Editor. Specifies the key of the property to edit,
 * the label to show to the user, and the type of editor to use to edit the
 * property, and the tooltip to display for it.
 * The conditions object, if given, is a map from property keys to predicates
 * (single-argument functions that take a property value and return a boolean);
 * the editor is shown only when all the predicates are true.  Some editors
 * accept other options, which are given as additional properties in the
 * editorSpecs item; see the cm.*Editor constructors for details.
 * @typedef {{key: string,
 *            label: string,
 *            type: cm.editors.Type,
 *            tooltip: (string|undefined),
 *            conditions: (Object|undefined)}}
 */
cm.EditorSpec;

/**
 * A property inspector.  Call inspect() to inspect an object's properties.
 * @param {Element} tableElem A <table> element, into which editors will be
 *   rendered.
 * @constructor
 */
cm.InspectorView = function(tableElem) {
  /**
   * @type Element
   * @private
   */
  this.tableElem_ = tableElem;

  /**
   * @type Array.<goog.ui.Tooltip>
   * @private
   */
  this.tooltips_ = [];

  /**
   * List of created editors, to dispose on close. Null if disposed.
   * @type {?Array.<cm.Editor>}
   * @private
   */
  this.editors_ = null;
};

/**
 * Builds an object property inspector.  Accepts a list of editor
 * specifications (indicating which properties to edit and the types of editors
 * to show), and optionally a MVCObject to populate the initial values with.
 * @param {Array.<cm.EditorSpec>} editorSpecs An array of editor specifications.
 * @param {google.maps.MVCObject|null|undefined} modelToEdit If not null, the
 *     model whose properties will be edited. Otherwise, a blank inspector
 *     will be displayed, and a new model will be created.
 * @return {Array.<cm.Editor>} The list of editors created.
 */
cm.InspectorView.prototype.inspect = function(editorSpecs, modelToEdit) {
  // We bind the editors to a separate "draft" copy of the modelToEdit (instead
  // of the original) so we can apply all the edits in a single Command.
  this.object_ = modelToEdit || new google.maps.MVCObject();
  this.draft_ = new google.maps.MVCObject();

  /** The table row DOM elements (each one holds a label and an editor). */
  this.rows_ = {};

  // A map from editor keys to conditions for showing that editor.  Each
  // condition object maps property keys to predicate functions.
  this.conditions_ = {};

  // The union of all the keys that appear in the condition objects (i.e. all
  // the keys on which the visibility of other editors can depend).
  this.triggerKeys_ = {};

  if (this.editors_) {
    this.dispose();
  }
  this.editors_ = [];
  this.editorMap_ = {};
  cm.ui.clear(this.tableElem_);
  for (var i = 0; i < editorSpecs.length; i++) {
    this.addEditor(editorSpecs[i], true);
  }

  // Listen for changes that will affect conditional editors.
  this.updateConditionalEditors_();
  for (var key in this.triggerKeys_) {
    cm.events.onChange(this.draft_, key, this.updateConditionalEditors_, this);
  }

  return this.editors_;
};

/**
 * Adds the given editor spec to the inspector.
 * This assumes you have already initialized the inspector by calling inspect.
 * @param {Object.<cm.EditorSpec>} editorSpec Spec for the editor to add.
 * @param {boolean=} opt_noUpdateConditionals If true, do not try to update
 *     conditional editors after adding the editor spec.  This should normally
 *     be set to false, and is only here to enable setting up editors in bulk
 *     from within inspect.
 * @return {cm.Editor} the editor corresponding to the given editorSpec.
 */
cm.InspectorView.prototype.addEditor = function(
    editorSpec, opt_noUpdateConditionals) {
  // Add a table row for each editor.  Each table row automatically gets
  // a CSS class name in lowercase-with-hyphens style based on the editor
  // type, e.g. cm.editors.Type.FOO gets the CSS class "cm-foo-editor".
  var id = cm.ui.generateId('editor');
  var cell, row;
  // TODO(user) figure out how to get goog.getCssName to work with
  // this
  var cls =
      'cm-' + editorSpec.type.toLowerCase().replace(/_/g, '-') + '-editor';
  var labelElem, helpIcon;
  cm.ui.append(this.tableElem_, row = cm.ui.create('tr', {'class': cls},
      cm.ui.create('th', {},
          labelElem = cm.ui.create('label', {'for': id}, editorSpec.label),
          helpIcon = editorSpec.tooltip ?
              cm.ui.create('div', {'class': cm.css.HELP_ICON}) : null),
      cell = cm.ui.create('td')));

  // Display a tooltip when user hovers over the help icon.
  if (editorSpec.tooltip) {
    var tooltip = new goog.ui.Tooltip();
    tooltip.setHtml(editorSpec.tooltip);
    tooltip.setHideDelayMs(TOOLTIP_HIDE_DELAY_MS);
    tooltip.className = cm.css.EDITORS_TOOLTIP;
    tooltip.attach(helpIcon);
    this.tooltips_.push(tooltip);
  }

  var editor = cm.editors.create(cell, editorSpec.type, id, editorSpec,
                                 this.draft_);
  this.editors_.push(editor);
  this.editorMap_[editorSpec.key] = editor;

  // Add a validation error indicator next to each editor.
  // TODO(kpy): When we figure out the exact UX we want, we might want to
  // replace this with an icon and a popup or something like that.
  var errorSpan = cm.ui.create('span', {'class': cm.css.VALIDATION_ERROR});
  cm.ui.append(cell, errorSpan);
  (function(errorSpan) {  // close over the local variable, errorSpan
    cm.events.onChange(editor, 'validation_error', function() {
      cm.ui.setText(errorSpan, this.get('validation_error') || '');
    }, editor);
  })(errorSpan);

  // Bind the editor to a property on our draft new version of the object.
  var value = this.object_.get(editorSpec.key);
  this.draft_.set(
      editorSpec.key, value === undefined ? editorSpec.default_value : value);
  editor.bindTo('value', this.draft_, editorSpec.key);
  this.rows_[editorSpec.key] = row;

  // Collect the set of property keys on which conditional editors depend.
  var newTriggerKeys = {};
  if (editorSpec.conditions) {
    for (var triggerKey in editorSpec.conditions) {
      this.triggerKeys_[triggerKey] = true;
      newTriggerKeys[triggerKey] = true;
    }
    this.conditions_[editorSpec.key] = editorSpec.conditions;
  }

  if (!opt_noUpdateConditionals) {
    // Listen for changes that will affect conditional editors.
    this.updateConditionalEditors_();
    for (var key in newTriggerKeys) {
      cm.events.onChange(
          this.draft_, key, this.updateConditionalEditors_, this);
      this.triggerKeys_[key] = newTriggerKeys[key];
    }
  }
  return editor;
};

/**
 * Deletes the editor with the given key to the inspector.
 *
 * @param {string} key The key of the property to delete.
 */
cm.InspectorView.prototype.deleteEditor = function(key) {
  if (!this.rows_[key]) {
    return;
  }
  goog.dom.removeNode(this.rows_[key]);
  var editor = this.editorMap_[key];
  editor.unbind(key);
  goog.array.remove(this.editors_, editor);
  this.draft_.set(key, undefined);
  delete this.editorMap_[key];
  delete this.rows_[key];
  delete this.conditions_[key];
};

/**
 * Collects and returns pending edits that have been made to the original model.
 *
 * @return {{oldValues: Object, newValues: Object, draftValues: Object}} An
 *     object with 3 properties, oldValues, newValues, and draftValues.
 *     oldValues and newValues will have the same keys. There are three cases:
 *     1. new value is added: oldValues[key] will be undefined,
 *                            newValues[key] and draftValues[key] will contain
 *                            the new value
 *     2. old value is removed: oldValues[key] will contain the old value,
 *                              newValues[key] and draftValues[key] will be
 *                              undefined
 *     3. old value is changed: oldValues[key] will contain the old value,
 *                              newValues[key] and draftValues[key] will
 *                              contain the new value
 *     Values in the original that have not been changed appear in
 *     draftValues, but neither oldValues nor newValues.
 */
cm.InspectorView.prototype.collectEdits = function() {
  var oldValues = {}, newValues = {}, draftValues = {};
  for (var key in this.rows_) {
    var oldValue = this.object_.get(key);
    var newValue = this.draft_.get(key);
    if (newValue !== undefined) {
      draftValues[key] = newValue;
    }
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

  return {oldValues: oldValues,
          newValues: newValues,
          draftValues: draftValues};
};

/**
 * @return {google.maps.MVCObject} Returns the unedited original object.
 */
cm.InspectorView.prototype.getOriginal = function() {
  return this.object_;
};

/**
 * Dispose of the inspector's various editors.
 */
cm.InspectorView.prototype.dispose = function() {
  if (this.editors_) {
    goog.array.forEach(this.editors_, function(editor) {
      editor.dispose();
    });
    this.editors_ = null;
  }
  goog.array.forEach(this.tooltips_, function(tooltip) {
    tooltip.dispose();
  });
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
 * @param {string=} opt_changedKey The property key that was changed.  If this
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
