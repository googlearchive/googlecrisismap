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
 * @fileoverview Dropdown menu for choosing sublayers from a single-select
 * parent folder.
 * @author romano@google.com (Raquel Romano)
 */

goog.provide('cm.SublayerPicker');

goog.require('cm.Analytics');

/**
 * Dropdown menu listing all sublayers for a given parent layer. When
 * a sublayer is selected, an event is emitted for view classes to
 * update the parent folder and child layers' appearance in the panel
 * and on the map.
 * @param {Element} parentElem The DOM element to which to add the menu.
 * @param {cm.LayerModel} layerModel The parent folder's layer model.
 * @param {string} selectedId The layer ID of the selected sublayer, or the
 *   empty string if the folder has no layers.
 * @constructor
 */
cm.SublayerPicker = function(parentElem, layerModel, selectedId) {
  /**
   * @type cm.LayerModel
   * @private
   */
  this.layerModel_ = layerModel;

  /**
   * @type Element
   * @private
   */
  this.select_ = cm.ui.create('select', {});
  cm.ui.append(parentElem, this.select_);

  // Create a menu element for each sublayer.
  var sublayers = this.layerModel_.get('sublayers');
  var me = this;
  this.layerModel_.get('sublayers').forEach(function(sublayer) {
    var id = sublayer.get('id');
    var option = cm.ui.create('option', {'value': id},
        sublayer.get('title'));
    option.selected = (id === selectedId);
    cm.ui.append(me.select_, option);
  });
  cm.events.listen(this.select_, 'change', this.handleMenuChange_, this);
};

/**
 * Handle menu selection changes.
 * @private
 */
cm.SublayerPicker.prototype.handleMenuChange_ = function() {
  goog.array.forEach(this.select_.options, function(option) {
    option.selected = (option.value === this.select_.value);
  }, this);
  cm.Analytics.logAction(
      cm.Analytics.LayersPanelAction.SUBLAYER_SELECTED, this.select_.value);
  cm.events.emit(this, cm.events.SELECT_SUBLAYER, {id: this.select_.value});
};

/**
 * Remove the element containing the menu from the DOM.
 */
cm.SublayerPicker.prototype.dispose = function() {
  cm.ui.remove(this.select_);
};
