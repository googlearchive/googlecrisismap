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
goog.require('cm.css');
goog.require('cm.editors');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.ui.Tooltip');

/* Time in ms to delay hiding an editor field tooltip. */
var TOOLTIP_HIDE_DELAY_MS = 500;

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

  this.popup_ = cm.ui.create('div', {'class': [cm.css.INSPECTOR, cm.css.POPUP]},
      cm.ui.create('div', undefined,
          this.titleElem_ = cm.ui.create('h2'),
          this.copyLayerLink_ = cm.ui.createLink(cm.MSG_IMPORT_LAYERS)),
      this.tableElem_ = cm.ui.create('table',
          {'class': cm.css.EDITORS, 'cellpadding': '0', 'cellspacing': '0'}),
      cm.ui.create('div', {'class': cm.css.BUTTON_AREA},
          this.okBtn_ = cm.ui.create(
              'button', {'class': [cm.css.BUTTON, cm.css.SUBMIT]},
              cm.MSG_OK),
          this.cancelBtn_ = cm.ui.create(
              'button', {'class': cm.css.BUTTON}, cm.MSG_CANCEL)));

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
 *                         tooltip: string,
 *                         conditions: Object}>>} editorSpecs
 *     An array of editor specifications.  Each element specifies the key of
 *     the property to edit, the label to show to the user, and the type of
 *     editor to use to edit the property, and the tooltip to display for it.
 *     The conditions object, if given,
 *     is a map from property keys to predicates (single-argument functions
 *     that take a property value and return a boolean); the editor is shown
 *     only when all the predicates are true.  Some editors accept other
 *     options, which are given as additional properties in the editorSpecs
 *     item; see the cm.*Editor constructors for details.
 * @param {cm.AppState} appState The application state.
 * @param {cm.MapModel|cm.LayerModel=} opt_object If specified, the MapModel or
 *     LayerModel whose properties will be edited. Otherwise, a blank inspector
 *     will be displayed, and a new LayerModel will be created on OK.
 */
cm.InspectorView.prototype.inspect = function(
    title, editorSpecs, appState, opt_object) {
  // We bind the editors to a separate "draft" copy of the object (instead of
  // the original object) so we can apply all the edits in a single Command.
  this.isNew_ = !opt_object;
  this.object_ = opt_object || new google.maps.MVCObject();
  this.draft_ = new google.maps.MVCObject();
  this.appState_ = appState;

  cm.ui.setText(this.titleElem_, title);
  goog.dom.classes.enable(this.copyLayerLink_, cm.css.HIDDEN, !this.isNew_);

  /** The table row DOM elements (each one holds a label and an editor). */
  this.rows_ = {};

  // A map from editor keys to conditions for showing that editor.  Each
  // condition object maps property keys to predicate functions.
  this.conditions_ = {};

  // The union of all the keys that appear in the condition objects (i.e. all
  // the keys on which the visibility of other editors can depend).
  var triggerKeys = {};

  if (this.editors_) {
    this.dispose_();
  }
  this.editors_ = [];
  cm.ui.clear(this.tableElem_);
  for (var i = 0; i < editorSpecs.length; i++) {
    var spec = editorSpecs[i];

    // Add a table row for each editor.  Each table row automatically gets
    // a CSS class name in lowercase-with-hyphens style based on the editor
    // type, e.g. cm.editors.Type.FOO gets the CSS class "cm-foo-editor".
    var id = cm.ui.generateId('editor');
    var cell, row;
    // TODO(user) figure out how to get goog.getCssName to work with
    // this
    var cls = 'cm-' + spec.type.toLowerCase().replace(/_/g, '-') + '-editor';
    var labelElem, helpIcon;
    cm.ui.append(this.tableElem_, row = cm.ui.create('tr', {'class': cls},
        cm.ui.create('th', {},
            labelElem = cm.ui.create('label', {'for': id}, spec.label),
            helpIcon = spec.tooltip ?
                cm.ui.create('div', {'class': cm.css.HELP_ICON}) : null),
        cell = cm.ui.create('td')));

    // Display a tooltip when user hovers over the help icon.
    if (spec.tooltip) {
      var tooltip = new goog.ui.Tooltip();
      tooltip.setHtml(spec.tooltip);
      tooltip.setHideDelayMs(TOOLTIP_HIDE_DELAY_MS);
      tooltip.className = cm.css.EDITORS_TOOLTIP;
      tooltip.attach(helpIcon);
      this.tooltips_.push(tooltip);
    }

    var editor = cm.editors.create(cell, spec.type, id, spec, this.draft_);
    this.editors_.push(editor);

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

  // Listen for changes that will affect conditional editors.
  this.updateConditionalEditors_();
  for (var key in triggerKeys) {
    cm.events.onChange(this.draft_, key, this.updateConditionalEditors_, this);
  }

  // Watch enabled_layer_ids and close the inspector if this layer is disabled.
  cm.events.onChange(this.appState_, 'enabled_layer_ids',
                     this.cancelIfLayerDisabled_, this);

  // Bring up the inspector dialog.
  cm.ui.showPopup(this.popup_);
  cm.events.emit(goog.global, cm.events.INSPECTOR_VISIBLE, {value: true});
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
  this.dispose_(true);
};

/**
 * Cancels the user's edits.
 * @private
 */
cm.InspectorView.prototype.handleCancel_ = function() {
  this.dispose_(true);
};

/**
 * Dispose of the inspector's various editors, and optionally the inspector
 * popup itself.
 * @param {boolean=} opt_disposeInspector If true, dispose of the inspector.
 * @private
 */
cm.InspectorView.prototype.dispose_ = function(opt_disposeInspector) {
  if (this.editors_) {
    goog.array.forEach(this.editors_, function(editor) {
      editor.dispose();
    });
    this.editors_ = null;
  }
  if (opt_disposeInspector) {
    cm.events.emit(goog.global, cm.events.INSPECTOR_VISIBLE, {value: false});
    cm.ui.remove(this.popup_);
  }

  goog.array.forEach(this.tooltips_, function(tooltip) {
    tooltip.dispose();
  });
};

/**
 * Closes the inspector view if the layer has been disabled.
 * @private
 */
cm.InspectorView.prototype.cancelIfLayerDisabled_ = function() {
  // Close the inspector view only if the layer isn't new and isn't enabled.
  if (this.object_ instanceof cm.LayerModel && !this.isNew_ &&
      !this.appState_.getLayerEnabled(this.object_.get('id'))) {
    this.handleCancel_();
  }
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
