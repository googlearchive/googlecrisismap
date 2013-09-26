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
 * @fileoverview A control button which shows the layers panel when clicked.
 */
goog.provide('cm.LayersButton');

goog.require('cm');
goog.require('cm.Analytics');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.dom.classes');


/**
 * @param {google.maps.Map} map The map to resize.
 * @param {Element} layersPanel The layers panel to open.
 * @constructor
 */
cm.LayersButton = function(map, layersPanel) {
  var button = cm.ui.create(
      'div', {'class': [cm.css.PANEL_BUTTON, cm.css.MAPBUTTON]},
      cm.MSG_LAYER_BUTTON);
  button.index = 2;

  cm.events.listen(button, 'click', function() {
    // If the button is not selected, open the panel.  Otherwise, close it.
    var closing = goog.dom.classes.has(button, cm.css.SELECTED);
    cm.Analytics.logAction(
        closing ? cm.Analytics.MapAction.LAYERS_PANEL_TOGGLED_OFF :
            cm.Analytics.MapAction.LAYERS_PANEL_TOGGLED_ON, null);
    cm.events.emit(this, closing ? 'panelclose' : 'panelopen');
  }, layersPanel);

  // Listens to the open/close events on the layers panel and selects the button
  // if the panel is opened and deselects if it is closed.
  cm.events.listen(layersPanel, 'panelopen', function() {
    goog.dom.classes.add(button, cm.css.SELECTED);
  });
  cm.events.listen(layersPanel, 'panelclose', function() {
    goog.dom.classes.remove(button, cm.css.SELECTED);
  });

  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(button);
};
