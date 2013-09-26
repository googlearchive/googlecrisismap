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
 * @fileoverview Dropdown menu for choosing sublayers from a parent
 * time series folder.
 * @author romano@google.com (Raquel Romano)
 */

goog.provide('cm.SublayerPicker');

goog.require('cm.css');

/**
 * Dropdown menu listing all sublayers for a given parent layer. When
 * a sublayer is selected, an event is emitted for view classes to
 * update the parent and child layers' appearance in the panel and on
 * the map.
 * @param {Element} container The container in which to display the
 *     drop-down. The menu opens when this container is clicked.
 * @param {cm.LayerModel} parentLayer The parent folder's layer model.
 * @constructor
 */
cm.SublayerPicker = function(container, parentLayer) {
  /**
   * @type Element
   * @private
   */
  this.menu_;

  /**
   * @type cm.LayerModel
   * @private
   */
  this.parentLayer_ = parentLayer;

  /**
   * Dictionary of each menu item's DOM element keyed by layer id.
   * @type Object
   * @private
   */
  this.choices_ = {};

  var buttonElem = cm.ui.create('div', {'class': cm.css.CALENDAR_BUTTON});
  container.appendChild(buttonElem);
  this.menu_ = cm.ui.create('ul', {'class': cm.css.SUBLAYER_PICKER});
  this.menu_.style.display = 'none';
  buttonElem.appendChild(this.menu_);

  // By default the most recent sublayer is selected.
  var selectedId = cm.LayerEntryView.MULTIPLE_DATES_OPTION;
  var mostRecent = this.parentLayer_.getMostRecentSublayer();
  if (mostRecent && mostRecent.get('last_update')) {
    selectedId = /** @type string */(mostRecent.get('id'));
  }

  // Create a menu option for choosing from multiple dates in the time series.
  this.createMenuItem_(MSG_MULTIPLE_DATES,
                       cm.LayerEntryView.MULTIPLE_DATES_OPTION,
                       selectedId === cm.LayerEntryView.MULTIPLE_DATES_OPTION);

  // Create a menu element for each sublayer
  var me = this;
  this.parentLayer_.get('sublayers').forEach(function(sublayer) {
    var id = sublayer.get('id');
    var choice = me.createMenuItem_(sublayer.get('title'), id,
                                    id === selectedId);
  });

  // Set up listeners for opening and closing he menu.
  var menu = this.menu_;
  cm.events.listen(buttonElem, 'click', function() {
    cm.events.emit(this, menu.style.display == 'none' ?
        'menuopen' : 'menuclose');
  }, container);
  cm.events.listen(container, 'menuopen', function() {
    menu.style.display = 'inline-block';
  });
  cm.events.listen(container, 'menuclose', function() {
    menu.style.display = 'none';
  });
};

/**
 * Creates a single menu itemand attaches a click listener to it.
 * Does nothing if the menu already has an item with this id.
 *
 * @param {string} name The option name to display in the menu.
 * @param {string} id Layer id for this menu item.
 * @param {boolean} selected True if this item should be initially selected.
 * @return {Object} The newly created DOM element for this menu item.
 * @private
 */
cm.SublayerPicker.prototype.createMenuItem_ = function(name, id, selected) {
  var choice = this.choices_[id];
  if (!choice) {
    var liElem = cm.ui.create('li', {}, name);
    this.menu_.appendChild(liElem);
    choice = this.choices_[id] = liElem;
    choice.className = selected ? 'selected' : '';
    cm.events.listen(liElem, 'click', function() {
      for (var key in this.choices_) {
        this.choices_[key].className = key === id ? 'selected' : '';
      }
      cm.events.emit(this, cm.events.SELECT_SUBLAYER, {id: id,
                     value: id !== cm.LayerEntryView.MULTIPLE_DATES_OPTION});
    }, this);
  }
  return choice;
};
