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

goog.require('goog.ui.FlatMenuButtonRenderer');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Select');

goog.provide('cm.SublayerPicker');

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
   * @type goog.ui.Select
   * @private
   */
  this.select_ = new goog.ui.Select(
      '', null, goog.ui.FlatMenuButtonRenderer.getInstance());
  this.select_.render(parentElem);

  // Create a menu element for each sublayer.
  var sublayers = this.layerModel_.get('sublayers');
  this.layerModel_.get('sublayers').forEach(goog.bind(function(sublayer) {
    var id = sublayer.get('id');
    var item = new goog.ui.MenuItem(sublayer.get('title'), id);
    this.select_.addItem(item);
    if (id === selectedId) {
      this.select_.setSelectedItem(item);
      this.select_.setCaption(/** @type string */(sublayer.get('title')));
    }
  }, this));

  cm.events.listen(this.select_, goog.ui.Component.EventType.CHANGE,
                   this.handleMenuChange_, this);
};

/**
 * Handle menu selection changes.
 * @param {Object} e The event payload.
 * @private
 */
cm.SublayerPicker.prototype.handleMenuChange_ = function(e) {
  cm.events.emit(this, cm.events.SELECT_SUBLAYER,
                 {id: this.select_.getSelectedItem().getModel()});
};

/**
 * Remove the element containing the menu from the DOM.
 */
cm.SublayerPicker.prototype.dispose = function() {
  this.select_.dispose();
};
