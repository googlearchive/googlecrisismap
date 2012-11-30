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
 * @fileoverview The Presenter translates user actions into effects on the
 *     application.  User actions are events emitted from Views; the resulting
 *     effects are changes in the AppState (application state) or manipulation
 *     of Views that cause changes in the AppState.  The Presenter handles
 *     just the read-only actions; actions that edit the document are handled
 *     by the EditPresenter, which will be separately loaded.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.Presenter');

goog.require('cm');
goog.require('cm.Analytics');
goog.require('cm.AppState');
goog.require('cm.MapView');
goog.require('cm.PanelView');
goog.require('cm.events');
goog.require('cm.ui');

/**
 * The Presenter translates user actions into effects on the application,
 * and also logs those actions as Analytics events.
 * @param {cm.AppState} appState The application state model.
 * @param {cm.MapView} mapView The map view.
 * @param {cm.PanelView} panelView The panel view.
 * @param {Element} panelElem The panel element.
 * @param {string} mapId The map ID, for logging with Analytics.
 * @constructor
 */
cm.Presenter = function(appState, mapView, panelView, panelElem, mapId) {
  /**
   * @type cm.AppState
   * @private
   */
  this.appState_ = appState;

  /**
   * @type cm.MapView
   * @private
   */
  this.mapView_ = mapView;

  /**
   * Logs a layer action with Analytics.
   * @param {string} id A layer ID (will be logged with the map ID in front).
   * @param {string} action An action label to record in Analytics.
   * @param {number} opt_value An optional numeric value to record in Analytics.
   */
  function logLayerEvent(id, action, opt_value) {
    cm.Analytics.logEvent('layer', action, mapId + '.' + id);
  }

  cm.events.listen(goog.global, cm.events.RESET_VIEW, function(event) {
    this.resetView(event.model);
  }, this);

  cm.events.listen(panelView, cm.events.TOGGLE_LAYER, function(event) {
    logLayerEvent(event.id, event.value ? 'toggle_on' : 'toggle_off',
                  event.value ? 1 : 0);
    appState.setLayerEnabled(event.id, event.value);
  });

  cm.events.listen(goog.global, cm.events.CHANGE_OPACITY, function(event) {
    appState.setLayerOpacity(event.id, event.opacity);
  });

  cm.events.listen(panelView, cm.events.PROMOTE_LAYER, function(event) {
      logLayerEvent(event.object.get('id'),
                    event.value ? 'promote_on' : 'promote_off',
                    event.value ? 1 : 0);
      if (event.value) {
        appState.promoteLayer(event.object);
      } else {
        appState.demoteSublayers(event.object);
      }
    });

  cm.events.listen(panelView, cm.events.ZOOM_TO_LAYER, function(event) {
    logLayerEvent(event.id, 'zoom_to');
    appState.setLayerEnabled(event.id, true);
    mapView.zoomToLayer(event.id);
    cm.events.emit(panelElem, 'panelclose');
  });

  cm.events.listen(goog.global, cm.events.SHARE_BUTTON, function(event) {
    cm.Analytics.logEvent('share', 'open', mapId);
    // TODO(kpy): Open the cm.SharePopup here, consistent with the way we
    // handle other events.  At the moment, the cm.SharePopup is tightly
    // coupled to cm.ShareButton (cm.ShareButton owns a private this.popup_).
  });
};

/**
 * Resets all views to the default view specified by a map model.  Optionally
 * also applies adjustments according to query parameters in a given URI.
 * @param {cm.MapModel} mapModel A map model.
 * @param {!goog.Uri|!Location|string} opt_uri An optional URI whose query
 *     parameters are used to adjust the view settings.
 */
cm.Presenter.prototype.resetView = function(mapModel, opt_uri) {
  this.appState_.setFromMapModel(mapModel);
  this.mapView_.matchViewport(
      /** @type cm.LatLonBox */(mapModel.get('viewport')) ||
      cm.LatLonBox.ENTIRE_MAP);
  this.mapView_.updateMapType();
  if (opt_uri) {
    this.mapView_.adjustViewportFromUri(opt_uri);
    this.appState_.setFromUri(opt_uri);
  }
};
