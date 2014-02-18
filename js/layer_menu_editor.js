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
 * @fileoverview [MODULE: edit] A dropdown menu selector for MapRoot layers.
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.LayerMenuEditor');

goog.require('cm.MapModel');
goog.require('cm.MenuEditor');
goog.require('cm.css');
goog.require('cm.ui');

/**
 * A multi-select list of layers that are populated from the given MapModel.
 * The editor's 'value' property will default to an empty array if its value
 * is set to null, undefined, or an array of elements none of which are in the
 * array of choices returned by the query.
 * When no layer choices exist, 'value' defaults to an empty array.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {{div_class: string, menu_class: string, multiple: boolean,
 *          map_model: cm.MapModel}} options
 *     options.div_class: a CSS class for the div containing all the buttons.
 *     options.menu_class: a CSS class for the dropdown menu.
 *     options.multiple: if true, create a multi-select menu.
 *     options.map_model: the current map model.
 * @extends cm.MenuEditor
 * @constructor
 */
cm.LayerMenuEditor = function(parentElem, id, options) {
  /**
   * The map model.
   * @type {cm.MapModel}
   * @private
   */
  this.mapModel_ = options.map_model;

  // Create the menu with an empty list of choices.
  goog.base(this, parentElem, id,
            {choices: [], div_class: options.div_class,
             menu_class: options.menu_class, multiple: options.multiple});

  cm.events.listen(this.mapModel_,
      [cm.events.LAYERS_ADDED, cm.events.LAYERS_REMOVED],
      this.updateMenuOptions_, this);
  this.updateMenuOptions_();
};
goog.inherits(cm.LayerMenuEditor, cm.MenuEditor);

/**
 * Repopulate the select menu choices and update the UI with the current value.
 * @private
 */
cm.LayerMenuEditor.prototype.updateMenuOptions_ = function() {
  var layerIds = /** @type {Array.<string>} */(this.mapModel_.getAllLayerIds());
  var choices = goog.array.map(layerIds, function(layerId) {
    var layer = this.mapModel_.getLayer(layerId);
    return {value: layerId, label: /** @type {string} */(layer.get('title'))};
  }, this);
  cm.ui.clear(this.selectElem);
  goog.array.clear(this.values);
  this.populate(choices);
  // Update UI to correct any invalid selections.
  this.updateUi(this.get('value'));
};
