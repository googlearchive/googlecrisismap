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
 * @fileoverview Google Analytics interface code.
 * @author arb@google.com (Anthony Baxter)
 */

goog.provide('cm.Analytics');

goog.require('cm');

// The default Crisis Maps Analytics account
// TODO(kpy): Move this to the datastore and pass it in via cm_config.
/** @const */var DEFAULT_ANALYTICS_ID = 'UA-8630973-2';

/**
 * Google Analytics command queue. Each element (command) is an array of
 * strings to be dispatched to the Analytics backend. More:
 * http://code.google.com/apis/analytics/docs/gaJS/gaJSApi_gaq.html
 * @type Array.<Array.<string>>
 */
var _gaq = _gaq || [];  // Google Analytics command queue

/**
 * Interface to Google Analytics operations.
 * @constructor
 */
cm.Analytics = function() { };

/**
 * Permissible action categories; these essentially record the kind of page
 * the user is visiting.
 * @enum {string}
 */
cm.Analytics.Category = {
  DRAFT_MAP: 'Draft map',
  PUBLISHED_MAP: 'Published map'
};

/**
 * Separator for concatenated strings like uiElement + uiEvent and
 * map ID + layer ID.
 * @private
 * @type {string}
 */
cm.Analytics.SEPARATOR_ = ' - ';

/**
 * Prepends the uiElement on all the event strings.
 * @private
 * @param {string} uiElement The UI element where these events are taking place.
 * @param {Object.<string, string>} uiEvents The mapping of symbolic constants
 *   to event strings; the event strings are the ones being prepended.
 * @return {Object.<string, string>} A new dictionary where the event strings
 *   from uiEvents have been prepended with the uiElement.
 */
cm.Analytics.prependUiElement_ = function(uiElement, uiEvents) {
  var actions = {};
  for (var event in uiEvents) {
    actions[event] = uiElement + cm.Analytics.SEPARATOR_ + uiEvents[event];
  }
  return actions;
};

/**
 * CrisisMap actions concatenate the name of the UI element being manipulated
 * and the precise manipulation, so for instance 'Map - Displayed' or
 * 'Layer - Selected'.  The enums that follow list the actions by their
 * associated UI.
 *
 * Naming guidelines - Action strings should read like English and include a
 * verb in the past tense.  For user events, they should accurately describe
 * the user's actions - link clicked, checkbox toggled, etc.  Passive events
 * should avoid words that are suggestive of UI actions. In particular, use
 * "revealed" and "hidden" for the passive events, not the more active "opened"
 *  and "closed."
 *
 * Use sentence-case, capitalize proper nouns, and fully capitalize acronyms.
 * Do not repeat the name of the UI element; that will be concatenated
 * automatically.  Remove articles (the, a, an).  The name of the constant is
 * looser - concatenate the important words from the english description with
 * underlines in between.
 */

/** @type {Object.<string, string>} */
cm.Analytics.LayersPanelAction = cm.Analytics.prependUiElement_(
    'Layers panel', {
      DOWNLOAD_DATA_LINK_CLICKED: 'Layer download data link clicked',
      EMBEDDED_LINK_CLICKED: 'Link embedded in layer description clicked',
      MAP_PICKER_ITEM_SELECTED: 'Map picker menu item selected',
      OPACITY_SLIDER_MOVED: 'Layer opacity slider moved',
      PANEL_TOGGLED_CLOSED: 'Panel toggled closed',
      PANEL_TOGGLED_OPEN: 'Panel toggled open',
      SUBLAYER_SELECTED: 'Sublayer menu item selected',
      TOGGLED_OFF: 'Layer checkbox toggled off',
      TOGGLED_ON: 'Layer checkbox toggled on',
      VIEW_RESET: '"View reset" clicked',
      ZOOM_TO_AREA: 'Layer "Zoom to area" clicked'
    });

/** @type {Object.<string, string>} */
cm.Analytics.MapAction = cm.Analytics.prependUiElement_('Map', {
  BASE_MAP_SELECTED: 'Base map menu item selected',
  LAYERS_PANEL_TOGGLED_ON: 'Layers panel button toggled on',
  LAYERS_PANEL_TOGGLED_OFF: 'Layers panel button toggled off',
  MY_LOCATION_CLICKED: 'My location button clicked',
  SEARCH_QUERY_ENTERED: 'Search query entered',
  SHARE_TOGGLED_OFF: 'Share button toggled off',
  SHARE_TOGGLED_ON: 'Share button toggled on'
});

// TODO(rew): These aren't tested; need tests to verify they are being
// emitted.
/** @type {Object.<string, string>} */
cm.Analytics.PassiveAction = cm.Analytics.prependUiElement_('Passive', {
  LAYER_DISPLAYED: 'Layer displayed',  // Not working after first load
  LAYER_HIDDEN: 'Layer hidden',   // Not working
  MAP_ZOOM_CHANGED: 'Map zoom level changed',
  PAGE_LOADED: 'Page loaded'
});

/** @type {Object.<string, string>} */
cm.Analytics.SharePopupAction = cm.Analytics.prependUiElement_('Share popup', {
  SHORTEN_URL_OFF: '"Shorten URLs" toggled off',
  SHORTEN_URL_ON: '"Shorten URLs" toggled on'
});


/**
 * The ID of the map currently being viewed/edited; set in initialize().
 * @private
 * @type {(string|null)}
 */
cm.Analytics.currentMapId_ = null;

/**
 * Initialize Google Analytics.
 * @param {string} analyticsId The Analytics account ID that should be
 *     associated with this logged session.
 * @param {string} mapId The ID of the map being viewed/edited.
 */
cm.Analytics.initialize = function(analyticsId, mapId) {
  analyticsId = analyticsId || DEFAULT_ANALYTICS_ID;
  cm.Analytics.currentMapId_ = mapId;
  _gaq.push(['_setAccount', analyticsId]);
  _gaq.push(['_trackPageview']);

  var ga = document.createElement('script');
  ga.type = 'text/javascript';
  ga.async = true;
  ga.src = ('https:' == document.location.protocol ?
      'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(ga, s);
};

/**
 * Returns the correct category for the given action.
 * @param {string} action The action being logged; should be a member of one
 *     of the cm.Analytics.FooAction lists above.
 * @return {string} The category.
 * @private
 */
cm.Analytics.categoryForAction_ = function(action) {
  // TODO(rew): this needs to become more sophisticated when we
  // track DRAFT_MAP v PUBLISHED_MAP
  return cm.Analytics.Category.PUBLISHED_MAP;
};

/**
 * Push an action onto the analytics command queue.
 * @param {string} action A string identifying the user action; taken from
 *     the correct cm.Analytics.<UI Element>Action list, above.
 * @param {?string} layerId  The ID of a layer associated with
 *     the action.  If no layer is associated with the action, pass null.
 * @param {number=} opt_value An optional numeric value for the event (Analytics
 *     will compute sums and averages of these values).
 */
cm.Analytics.logAction = function(action, layerId, opt_value) {
  if (layerId) {
    _gaq.push(['_setCustomVar', 1, 'Layer ID',
               cm.Analytics.currentMapId_ + cm.Analytics.SEPARATOR_ + layerId,
               3]);
  }
  _gaq.push(['_trackEvent', cm.Analytics.categoryForAction_(action), action,
             cm.Analytics.currentMapId_, opt_value,
             (action in cm.Analytics.PassiveAction)]);
  if (layerId) {
    // Best practices per the Analytics team - clear custom variables
    // that are tied to events immediately after the event has been
    // pushed.  This avoids them being inadvertently carried on other
    // events.
    _gaq.push(['_setCustomVar', 1, 'Layer ID', null, 3]);
  }
};

/**
 * Push a timing event onto the analytics command queue. See
 * https://developers.google.com/analytics/devguides/collection/gajs/gaTrackingTiming
 * @param {string} category A short string identifying the event category
 *     (usually a noun for the object or category of object that was affected,
 *     e.g. "wms"), used for easier viewing of reports.  Our
 *     convention is to use lowercase_with_underscores.
 * @param {string} variable A short string  identifying the type event being
 *     timed (similar to an action, e.g. "tile_fetch"). Our convention
 *     is to use lowercase_with_underscores.
 * @param {number} time The number of ellapsed milliseconds to report.
 * @param {string=} opt_label An optional more specific label (usually a unique
 *     programmatic ID, e.g. tilset ID, layer ID, URL, etc.).
 * @param {number=} opt_sample An optional numeric value for the percentage
 *     of visitors whose timing hits are tracked. Each hit counts
 *     against the limit of 500 hits per session, after which no hits
 *     are processed for a given session.
 */
cm.Analytics.logTime = function(category, variable, time,
                                opt_label, opt_sample) {
  _gaq.push(['_trackTiming', category, variable, time, opt_label, opt_sample]);
};
