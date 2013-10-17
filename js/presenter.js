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
goog.require('cm.TabPanelView');
goog.require('cm.events');
goog.require('cm.ui');

/** Default zoom level for "my location" button clicks */
/** @const */var DEFAULT_MY_LOCATION_ZOOM_LEVEL = 11;

/**
 * The Presenter translates user actions into effects on the application,
 * and also logs those actions as Analytics events.
 * @param {cm.AppState} appState The application state model.
 * @param {cm.MapView} mapView The map view.
 * @param {cm.PanelView|cm.TabPanelView} panelView The panel view.
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
   * @type string
   * @private
   */
  this.mapId_ = mapId;

  cm.events.listen(goog.global, cm.events.RESET_VIEW, function(event) {
    this.resetView(event.model);
  }, this);

  cm.events.listen(panelView, cm.events.TOGGLE_LAYER, function(event) {
    appState.setLayerEnabled(event.id, event.value);
  }, this);

  cm.events.listen(goog.global, cm.events.CHANGE_OPACITY, function(event) {
    appState.setLayerOpacity(event.id, event.opacity);
  });

  cm.events.listen(panelView, cm.events.ZOOM_TO_LAYER, function(event) {
    appState.setLayerEnabled(event.id, true);
    mapView.zoomToLayer(event.id);
    cm.events.emit(panelElem, 'panelclose');
  }, this);

  cm.events.listen(panelView, cm.events.SELECT_SUBLAYER, function(event) {
    appState.selectSublayer(event.model, event.id);
    appState.setLayerEnabled(event.model.get('id'), true);
  });

  // TODO(kpy): Listen for panelopen & panelclose, and open/close the
  // cm.PanelView here, consistent with the way
  // we handle other events.  At the moment, the cm.LayersButton emits an
  // event directly on the cm.PanelView's DOM element.

  // TODO(kpy): Open the cm.SharePopup in response to cm.events.SHARE_BUTTON,
  // consistent with the way we
  // handle other events.  At the moment, the cm.SharePopup is tightly
  // coupled to cm.ShareButton (cm.ShareButton owns a private this.popup_).

  cm.events.listen(goog.global, cm.events.GO_TO_MY_LOCATION, function(event) {
    this.zoomToUserLocation(DEFAULT_MY_LOCATION_ZOOM_LEVEL);
  }, this);

  cm.events.listen(panelView, cm.events.FILTER_QUERY_CHANGED, function(event) {
    // TODO(user): Figure out when to log an analytics event
    // (after a delay, on a backspace press, etc) so we don't
    // get an analytics log per keypress.
    appState.setFilterQuery(event.query);
  });
  cm.events.listen(panelView, cm.events.FILTER_MATCHES_CHANGED,
    function(event) {
      appState.setMatchedLayers(event.matches);
  });

  if (panelView instanceof cm.TabPanelView) {
    cm.events.listen(mapView, cm.events.SELECT_FEATURE, function(event) {
      panelView.selectFeature(event);
    });
    cm.events.listen(mapView, cm.events.DESELECT_FEATURE, function(event) {
      panelView.deselectFeature();
    });
  }
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
  if (opt_uri) {
    this.mapView_.adjustViewportFromUri(opt_uri);
    this.appState_.setFromUri(opt_uri);
  }
};

/**
 * Zoom to the user's geolocation.
 * @param {number} zoom The zoom level to apply when the geolocation is found.
 */
cm.Presenter.prototype.zoomToUserLocation = function(zoom) {
  var mapView = this.mapView_;
  if (navigator && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      mapView.set('zoom', zoom);
      mapView.set('center', new google.maps.LatLng(
          position.coords.latitude, position.coords.longitude));
    });
  }
};
