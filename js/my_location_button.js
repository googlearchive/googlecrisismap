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
 * @fileoverview Creates the button for the "my location" functionality.
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.MyLocationButton');

goog.require('cm.Analytics');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.dom.classes');

/**
 * A button that when clicked zooms and pans the map to the user's location,
 * via the html5 geolocation API.
 * @param {!google.maps.Map} map The map on which to place the
 * @constructor
 */
cm.MyLocationButton = function(map) {
  // A negative index places the control between the edge of the map and the
  // default controls. See
  // developers.google.com/maps/documentation/javascript/controls#CustomPositioning
  var button = cm.ui.create('div',
                            {'class': [cm.css.MAPBUTTON,
                                       cm.css.MY_LOCATION_BUTTON],
                             'index': -1});
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(button);

  cm.events.listen(button, 'click', function() {
    cm.Analytics.logAction(cm.Analytics.MapAction.MY_LOCATION_CLICKED, null);
    cm.events.emit(goog.global, cm.events.GO_TO_MY_LOCATION);
  }, this);
};
