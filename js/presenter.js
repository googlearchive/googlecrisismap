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

/** Default zoom level for "my location" button clicks */
/** @const */var DEFAULT_MY_LOCATION_ZOOM_LEVEL = 11;

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
   * @type string
   * @private
   */
  this.mapId_ = mapId;

  cm.events.listen(goog.global, cm.events.RESET_VIEW, function(event) {
    this.logEvent_('reset_view');
    this.resetView(event.model);
  }, this);

  cm.events.listen(panelView, cm.events.TOGGLE_LAYER, function(event) {
    this.logEvent_(event.value ? 'toggle_on' : 'toggle_off', event.id,
                   event.value ? 1 : 0);
    appState.setLayerEnabled(event.id, event.value);
  }, this);

  cm.events.listen(goog.global, cm.events.CHANGE_OPACITY, function(event) {
    appState.setLayerOpacity(event.id, event.opacity);
  });

  cm.events.listen(panelView, cm.events.PROMOTE_LAYER, function(event) {
    this.logEvent_(event.value ? 'promote_on' : 'promote_off', event.id,
                   event.value ? 1 : 0);
    if (event.value) {
      appState.promoteLayer(event.object);
    } else {
      appState.demoteSublayers(event.object);
    }
  }, this);

  cm.events.listen(panelView, cm.events.ZOOM_TO_LAYER, function(event) {
    this.logEvent_('zoom_to', event.id);
    appState.setLayerEnabled(event.id, true);
    mapView.zoomToLayer(event.id);
    cm.events.emit(panelElem, 'panelclose');
  }, this);

  cm.events.listen(panelElem, 'panelopen', function(event) {
    cm.Analytics.logEvent('panel', 'open', mapId, 1);
    // TODO(kpy): Open/close the cm.PanelView here, consistent with the way
    // we handle other events.  At the moment, the cm.LayersButton emits an
    // event directly on the cm.PanelView's DOM element.
  });

  cm.events.listen(panelElem, 'panelclose', function(event) {
    cm.Analytics.logEvent('panel', 'close', mapId, 0);
  });

  cm.events.listen(goog.global, cm.events.SHARE_BUTTON, function(event) {
    cm.Analytics.logEvent('share', 'open', mapId);
    // TODO(kpy): Open the cm.SharePopup here, consistent with the way we
    // handle other events.  At the moment, the cm.SharePopup is tightly
    // coupled to cm.ShareButton (cm.ShareButton owns a private this.popup_).
  });

  cm.events.listen(goog.global, cm.events.LOCATION_SEARCH, function(event) {
    cm.Analytics.logEvent('search', 'geocode', mapId, event.marker ? 1 : 0);
  });

  cm.events.listen(goog.global, cm.events.GO_TO_MY_LOCATION, function(event) {
    cm.Analytics.logEvent('mylocation', 'click', mapId);
    this.zoomToUserLocation(DEFAULT_MY_LOCATION_ZOOM_LEVEL);
  }, this);
};

/**
 * Logs a layer action or map-level action with Analytics.
 * @param {string} action An action label to record in Analytics.
 * @param {string=} opt_layerId A layer ID, if the event is specific to a layer.
 * @param {number=} opt_value An optional numeric value to record in Analytics.
 * @private
 */
cm.Presenter.prototype.logEvent_ = function(action, opt_layerId, opt_value) {
  if (opt_layerId) {
    cm.Analytics.logEvent(
        'layer', action, this.mapId_ + '.' + opt_layerId, opt_value);
  } else {
    cm.Analytics.logEvent('map', action, this.mapId_, opt_value);
  }
};

/**
 * Resets all views to the default view specified by a map model.  Optionally
 * also applies adjustments according to query parameters in a given URI.
 * @param {cm.MapModel} mapModel A map model.
 * @param {!goog.Uri|!Location|string} opt_uri An optional URI whose query
 *     parameters are used to adjust the view settings.
 * @param {boolean=} opt_initial If true, log Analytics events for each visible
 *     layer as an initial page load.  Otherwise, log events for layers that
 *     changed visibility as triggered by a user "reset view" action.
 */
cm.Presenter.prototype.resetView = function(mapModel, opt_uri, opt_initial) {
  var oldIds = this.appState_.get('enabled_layer_ids').getValues();
  this.appState_.setFromMapModel(mapModel);
  this.mapView_.matchViewport(
      /** @type cm.LatLonBox */(mapModel.get('viewport')) ||
      cm.LatLonBox.ENTIRE_MAP);
  this.mapView_.updateMapType();
  if (opt_uri) {
    this.mapView_.adjustViewportFromUri(opt_uri);
    this.appState_.setFromUri(opt_uri);
  }
  var newIds = this.appState_.get('enabled_layer_ids').getValues();
  if (opt_initial) {
    goog.array.forEach(newIds, function(id) {
      this.logEvent_('load_on', id, 1);
    }, this);
  } else {
    var added = (new goog.structs.Set(newIds)).difference(oldIds).getValues();
    var removed = (new goog.structs.Set(oldIds)).difference(newIds).getValues();
    goog.array.forEach(added, function(id) {
      this.logEvent_('reset_on', id, 1);
    }, this);
    goog.array.forEach(removed, function(id) {
      this.logEvent_('reset_off', id, 0);
    }, this);
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
