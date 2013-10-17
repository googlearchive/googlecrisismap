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
 * @fileoverview Initializes the map.
 */

goog.provide('MIN_DOCUMENT_WIDTH_FOR_SIDEBAR');
goog.provide('cm.Map');

goog.require('cm.Analytics');
goog.require('cm.AppState');
goog.require('cm.BuildInfoView');
goog.require('cm.ExtraView');
goog.require('cm.ExtraViewsPlugin');
goog.require('cm.FooterView');
goog.require('cm.LayersButton');
goog.require('cm.LoginView');
goog.require('cm.MapModel');
goog.require('cm.MapPicker');
goog.require('cm.MapView');
goog.require('cm.MetadataModel');
goog.require('cm.MyLocationButton');
goog.require('cm.PanelView');
goog.require('cm.Presenter');
goog.require('cm.SearchBox');
goog.require('cm.ShareButton');
goog.require('cm.TabPanelView');
goog.require('cm.UrlShortener');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('cm.util');
goog.require('goog.Uri');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.dom.classes');
goog.require('goog.i18n.bidi');
goog.require('goog.module');
goog.require('goog.ui.Component');

/** @const */var MIN_DOCUMENT_WIDTH_FOR_SIDEBAR = 690;
/** @const */var MIN_MAP_WIDTH_FOR_SEARCHBOX = 450;
/** @const */var BOTTOM_TAB_PANEL_FRAME_HEIGHT_FRACTION = 0.5;

/**
 * Sizes the map and panel elements to fit the window.
 * @param {google.maps.Map} map The map to resize.
 * @param {Element} container The box which we render inside.
 * @param {?cm.SearchBox} searchbox The searchbox control to hide on very small
 * screens.
 * @param {boolean} embedded This map should be embedded.
 * @param {boolean} touch True if the map is displayed on a touch device.
 * @param {boolean} preview True if the map is being displayed as a preview.
 * @param {Element} mapWrapperElem The box around the map to resize.
 * @param {Element} footerElem The footer element.
 * @param {cm.PanelView|cm.TabPanelView} panelView The panel view.
 * @param {Element} panelElem The panel element.
 * @param {Array.<cm.ExtraViewsPlugin>} extraViewsPlugins An array of
 *     cm.ExtraViewsPlugin instances to be set up by this method.
 * @param {!Object.<string, cm.ExtraView>} extraViews A map of ExtraView
 *     short names to ExtraView instances. This can be empty but not null.
 * @param {boolean} useTabPanel Use tabbed UI.
 */
function sizeComponents(map, container, searchbox, embedded, touch, preview,
                        mapWrapperElem, footerElem, panelView, panelElem,
                        extraViewsPlugins, extraViews, useTabPanel) {
  /**
   * Returns the value of the given style property for an element.  Assumes the
   * numerical value for the property.
   * @param {Element} element The element to inspect.
   * @param {string} property The property of interest.
   * @return {number} Returns the property's value.
   */
  function getValue(element, property) {
    var styles;
    if (element.currentStyle) {
      styles = element.currentStyle;
    } else if (document.defaultView && document.defaultView.getComputedStyle) {
      styles = document.defaultView.getComputedStyle(element, '') || {};
    } else {
      styles = element.style;
    }

    var value = styles[property];
    if (value) {
      return parseInt(value, 10);
    } else {
      return 0;
    }
  }

  /**
   * Dynamically calculates the height of the body, minus the footer.  Should be
   * called after the appropriate class name has been set.
   * @return {number} The height of the body.
   */
  function getMapHeight() {
    var margins = getValue(mapWrapperElem, 'margin-top') +
        getValue(mapWrapperElem, 'margin-bottom');
    if (!margins) {
      margins = 0;
    }
    var borders = getValue(mapWrapperElem, 'border-top') +
        getValue(mapWrapperElem, 'border-bottom');
    var mapHeight = container.offsetHeight - margins - borders -
        footerElem.offsetHeight;
    if (useTabPanel && goog.dom.classes.has(panelElem,
                                            cm.css.TAB_PANEL_BELOW)) {
      mapHeight = mapHeight - panelElem.offsetHeight;
    }
    return mapHeight;
  }

  goog.dom.classes.enable(container, cm.css.TOUCH, touch);
  embedded = embedded || container.offsetWidth < MIN_DOCUMENT_WIDTH_FOR_SIDEBAR;
  if (useTabPanel) {
    resizeTabPanel(panelElem, container, footerElem);
  } else {
    if (!embedded) {
      cm.events.emit(panelElem, 'panelclose');
    }
  }
  goog.dom.classes.enable(container, cm.css.EMBEDDED, embedded);
  var floating = goog.dom.classes.has(container, cm.css.PANEL_FLOAT);
  if (!useTabPanel) {
    goog.dom.classes.enable(container, cm.css.PANEL_DOCK,
                            !embedded && !floating);
  }

  // In floating or embedded mode, the panel has variable height based on its
  // content, but we need to limit its maximum height to fit over the map.
  mapWrapperElem.style.height = getMapHeight() + 'px';
  var floatMaxHeight = getMapHeight() - 10;  // allow 5px top and bottom margin
  panelView.setMaxHeight(embedded || floating ? floatMaxHeight : null);

  if (extraViewsPlugins) {
    var panelViewPosition = {
      isPanelCollapsed: goog.dom.classes.has(container, cm.css.PANEL_COLLAPSED),
      isPanelFloating: floating,
      isPanelPopup: embedded,
      floatMaxHeight: floatMaxHeight
    };
    goog.array.forEach(extraViewsPlugins, function(plugin) {
      plugin.sizeComponentsWithExtraViews(container, panelView,
                                          panelViewPosition, extraViews);
    });
  }

  // TODO(kpy): Rework this value.  The relevant Maps API bug, which hid the
  // search box behind other controls, has since been fixed.
  if (searchbox) {
    var uncoveredMapWidth =
        mapWrapperElem.offsetWidth - (floating ? panelElem.offsetWidth : 0);
    if (uncoveredMapWidth < MIN_MAP_WIDTH_FOR_SEARCHBOX || preview) {
      searchbox.hide();
    } else {
      searchbox.show();
    }
  }

  if (!useTabPanel) {
    // Though the API checks the window resize itself, it's good practice to
    // trigger the resize event any time we change the map container's size.
    cm.events.emit(map, 'resize');
  }
}

/**
 * Adjust the tab panel height to a fixed fraction of the frame when the tab
 * bar is below the map and the tab panel is expanded. This isn't a
 * TabPanelView method because it needs access to the footer height.
 * @param {Element} panelElem The panel element.
 * @param {Element} frameElem The frame element surrounding the entire UI.
 * @param {Element} footerElem The footer element.
 */
function resizeTabPanel(panelElem, frameElem, footerElem) {
  var expanded = goog.dom.classes.has(panelElem, cm.css.TAB_PANEL_EXPANDED);
  var below = goog.dom.classes.has(panelElem, cm.css.TAB_PANEL_BELOW);
  goog.dom.classes.enable(frameElem, cm.css.PANEL_BELOW, below);

  // For now, the left/right-side tab panel are nearly full-height. This should
  // later change so that the panel height depends on its content.
  var fraction = below ? BOTTOM_TAB_PANEL_FRAME_HEIGHT_FRACTION : 0.9;

  // Compute the target map height as a percentage of frame element height.
  var targetPanelHeight = fraction * frameElem.offsetHeight;

  panelElem.style.height = expanded ?
      Math.min(targetPanelHeight,
               frameElem.offsetHeight - footerElem.offsetHeight) + 'px' : '';
}

/**
 * Installs the HTML sanitizer on all cm.Html objects.
 * @param {Object} html The 'html' object provided by sanitizer_module.js.
 */
function installHtmlSanitizer(html) {
  var tagPolicy = function(tagName, attribs) {
    // attribs is an array of alternating names and values; convert to a map.
    var attrDict = {};
    for (var i = 0; i < attribs.length; i += 2) {
      attrDict[attribs[i]] = attribs[i + 1];
    }
    // html-sanitizer.js accepts only absolute http, https, and mailto URLs.
    // This tag policy accepts all such URLs and passes through all IDs, names,
    // and classes (in 'id', 'for', 'headers', 'name', 'class', and 'usemap'
    // attributes) unchanged.
    // TODO(kpy): We're using dictionary lookups for 'makeTagPolicy' and
    // 'sanitizeWithPolicy' because a recent change in Caja disabled renaming.
    // When fixed, revert to html.makeTagPolicy and html.sanitizeWithPolicy.
    var decision = html['makeTagPolicy'](
        function(uri) { return uri; })(tagName, attribs);
    // A tag policy can return null to mean "delete this tag"; we pass that on.
    if (!decision) {
      return null;
    }
    // The HTML sanitizer normally deletes 'target' attributes.  We want to
    // allow the particular value target="_blank", though, so we add it back.
    attribs = decision['attribs'] || [];
    if (attrDict['target'] === '_blank') {
      attribs.push('target');
      attribs.push('_blank');
    }
    return {'attribs': attribs};
  };
  cm.Html.installSanitizer(function(unsanitizedHtml) {
    return html['sanitizeWithPolicy'](unsanitizedHtml, tagPolicy);
  });
}

/**
 * Stub initialize function for existing dependent code.
 * @param {Object} mapRoot The MapRoot JSON to parse and render.
 * @param {string|Element} frame The DOM element in which to render the UI,
 *     or the ID of such a DOM element.
 * @param {string} jsBaseUrl The path component of the URL for loading
 *     additional JS modules.
 * @param {Array} opt_menuItems An array of items for the map menu, with keys:
 *     title: The title to display in the menu.
 *     url: The URL to navigate to when the item is clicked.
 * @param {Object=} opt_config The configuration settings.
 * @param {string=} opt_unused Used to be the publication label for a map,
 *     which differentiated between draft maps and published maps.  However,
 *     it is now unused.  It should be removed outright, but chasing down the
 *     callsites is non-trivial, so that was deferred.
 * @param {string} opt_language The (optional) BCP 47 language code.
 */
function initialize(mapRoot, frame, jsBaseUrl, opt_menuItems, opt_config,
                    opt_unused, opt_language) {
  var config = opt_config || {};
  config['map_root'] = mapRoot;
  config['map_picker_items'] = opt_menuItems;
  config['lang'] = opt_language || 'en';

  // The new API uses a getModuleUrl signature that takes (module, lang) but
  // the old API matched the goog.module.Loader.init API's opt_urlFunction
  // method which takes (baseUrl, moduleName). So if the caller has defined
  // a get_module_url function, wrap it with an adapter using the new API.
  var legacyGetModuleUrl = config['get_module_url'];
  if (legacyGetModuleUrl) {
    config['get_module_url'] = function(module) {
      return legacyGetModuleUrl(jsBaseUrl, module);
    };
  } else {
    config['get_module_url'] = function(module, lang) {
      return jsBaseUrl.replace(/\/$/, '') + '/.js/crisismap_' + module + '__' +
          lang + '.js';
    };
  }

  var map = new cm.Map(frame, config);
}

/**
 * Constructs a map: loads the HTML sanitizer, then builds the map viewer UI.
 * TODO(kpy): This adds a 9-kb HTTP fetch to each pageview.  Speed up pageviews
 * by loading the sanitizer dynamically or moving sanitization to the server.
 * @constructor
 * @param {string|Element} frame The DOM element in which to render the UI,
 *     or the ID of such a DOM element.
 * @param {Object=} opt_config The configuration settings.
 */
cm.Map = function(frame, opt_config) {
  /**
   * Queue of callbacks that are waiting for the Map instance to be made.
   * @type {Array.<function(google.maps.Map)>}
   * @private
   */
  this.getMapCallbacks_ = [];

  var config = opt_config || {};
  var getModuleUrl = config['get_module_url'];

  // Wrap the getModuleUrl function in an adapter for the goog.module API.
  var googModuleGetModuleUrl = function(baseUrl, module) {
    return getModuleUrl(module, config['lang']);
  };

  goog.module.initLoader('', googModuleGetModuleUrl);
  var self = this;
  goog.module.require('sanitizer', 'html', function(html) {
    installHtmlSanitizer(html);
    // We need to defer buildUi until after sanitizer_module.js is loaded,
    // so we call buildUi inside this callback.
    self.buildUi_(config['map_root'], frame, config['map_picker_items'], config,
                  config['lang']);
  });
};

/**
 * Constructs the map viewer UI.
 * @param {Object} mapRoot The MapRoot JSON to parse and render.
 * @param {string|Element} frame The DOM element in which to render the UI,
 *     or the ID of such a DOM element.
 * @param {Array} opt_menuItems An array of items for the map menu, with keys:
 *     title: The title to display in the menu.
 *     url: The URL to navigate to when the item is clicked.
 * @param {Object=} opt_config The configuration settings.
 * @param {string} opt_language The (optional) BCP 47 language code.
 * @private
 */
cm.Map.prototype.buildUi_ = function(mapRoot, frame, opt_menuItems, opt_config,
                                     opt_language) {
  var config = opt_config || {};

  // Create the AppState and the model; set up configuration flags.
  var appState = new cm.AppState(opt_language);
  var mapModel = cm.MapModel.newFromMapRoot(mapRoot);
  var metadataModel = new cm.MetadataModel(
      mapModel, config['metadata'], config['metadata_url']);

  var touch = cm.util.browserSupportsTouch();
  var uri = new goog.Uri(window.location);
  var embedded = !!uri.getParameterValue('embedded');
  var preview = !!uri.getParameterValue('preview');

  // Forward model changes to global scope.
  cm.events.forward(mapModel, cm.events.MODEL_CHANGED, goog.global);

  // Set up Analytics.
  cm.Analytics.initialize(config['analytics_id'] || '',
                          /** @type string */(mapModel.get('id')));
  cm.Analytics.logAction(cm.Analytics.PassiveAction.PAGE_LOADED, null);

  // Create the DOM tree within the frame.
  var frameElem = (typeof frame == 'string') ? cm.ui.get(frame) : frame;
  goog.dom.classes.add(frameElem, cm.css.FRAME);
  var footerElem = cm.ui.create('div', {'class': cm.css.FOOTER});
  var useTabPanel = !!config['use_tab_panel'];
  var panelElem = cm.ui.create('div', {'class':
      useTabPanel ? cm.css.TAB_PANEL : cm.css.PANEL});

  var arrangerElem = cm.ui.create(
      'div', {'class': [cm.css.PANEL, cm.css.ARRANGER, cm.css.HIDDEN]});
  var mapElem = cm.ui.create('div', {'class': cm.css.MAP, 'id': 'map'});
  var mapWrapperElem = cm.ui.create('div', {'class': cm.css.MAP_WRAPPER},
                                    mapElem);
  var narrow = frameElem.offsetWidth < MIN_DOCUMENT_WIDTH_FOR_SIDEBAR;
  var narrowOrEmbedded = narrow || embedded;
  if (useTabPanel && narrowOrEmbedded) {
    cm.ui.append(mapWrapperElem, panelElem);
  }
  cm.ui.append(mapWrapperElem, footerElem);
  var aboutTextElem = cm.ui.create(
      'div', {'class': cm.css.ABOUT_TEXT, 'id': 'cm-aboutText'});
  if (!useTabPanel || !narrowOrEmbedded) {
    cm.ui.append(frameElem, panelElem);
  }
  cm.ui.append(frameElem, arrangerElem, mapWrapperElem, aboutTextElem);
  if (goog.i18n.bidi.IS_RTL) {
    goog.ui.Component.setDefaultRightToLeft(true);
    goog.dom.classes.add(frameElem, cm.css.LAYOUT_RTL);
  }

  // Create all the views and UI elements.
  // The MapView must be created first because it replaces the contents of the
  // map <div> element, and other views add stuff within that <div> element.
  var mapView = new cm.MapView(mapElem, mapModel, appState, metadataModel,
                               touch, config, preview, embedded);
  this.map_ = mapView.getMap();
  var self = this;
  goog.array.forEach(this.getMapCallbacks_, function(callback) {
    callback(self.map_);
  });
  this.getMapCallbacks_ = [];

  var searchbox = null;
  if (!config['hide_search_box']) {
    searchbox = new cm.SearchBox(mapView.getMap());
  }
  if (!preview) {
    if (!useTabPanel) {
      new cm.LayersButton(mapView.getMap(), panelElem);
    }
    if (!config['hide_share_button'] && !config['enable_editing']) {
      var urlShortener = new cm.UrlShortener(
          config['json_proxy_url'], config['google_api_key']);
      new cm.ShareButton(mapView.getMap(), appState,
                         !config['hide_facebook_button'],
                         !config['hide_google_plus_button'],
                         !config['hide_twitter_button'], urlShortener);
    }
  }
  if (!(config['hide_my_location_button'] || preview)) {
    new cm.MyLocationButton(mapView.getMap());
  }
  if (config['show_login']) {
    new cm.LoginView(panelElem, config);
  }

  if (config['panel_side'] === 'left') {
    goog.dom.classes.add(frameElem, cm.css.PANEL_LEFT);
  } else {
    goog.dom.classes.add(frameElem, cm.css.PANEL_RIGHT);
  }
  var panelView;
  if (useTabPanel) {
    goog.dom.classes.add(frameElem, cm.css.TABBED);
    panelView = new cm.TabPanelView(frameElem, panelElem, mapElem, mapModel,
                                    metadataModel, appState, narrowOrEmbedded,
                                    config);
  } else {
    if (config['panel_float']) {
      goog.dom.classes.add(frameElem, cm.css.PANEL_FLOAT);
    }
    panelView = new cm.PanelView(frameElem, panelElem, mapElem, mapModel,
                                 metadataModel, appState, config);
  }
  if (opt_menuItems && opt_menuItems.length && !config['draft_mode'] &&
      !config['enable_editing'] && panelView.getHeader()) {
      panelView.enableMapPicker(new cm.MapPicker(panelView.getHeader(),
                                                 opt_menuItems));
  }
  var footerParams = {
    'publisher_name': config['publisher_name'],
    'langs': config['langs']
  };
  var footerView = new cm.FooterView(footerElem, mapWrapperElem, mapModel,
                                     footerParams);
  goog.style.setElementShown(footerElem, !config['hide_footer'] && !preview);

  var extraViewsPlugins = /** @type {Array.<cm.ExtraViewsPlugin>} */
      (config['extra_views_plugins']);
  var extraViews =
      cm.ExtraViewsPlugin.initAll(frameElem, config, extraViewsPlugins);

  new cm.BuildInfoView(mapElem);

  // Lay out the UI components.  This needs to happen (in order to determine
  // the size of the map's DOM element) before we set up the viewport.
  sizeComponents(mapView.getMap(), frameElem, searchbox, embedded, touch,
                 preview, mapWrapperElem, footerElem, panelView, panelElem,
                 extraViewsPlugins, extraViews, useTabPanel);

  if (!useTabPanel) {
    // We readjust the layout whenever the ViewportSizeMonitor detects that the
    // window resized, and also when anything emits 'resize' on goog.global.
    cm.events.forward(new goog.dom.ViewportSizeMonitor(), 'resize',
                      goog.global);
  }
  cm.events.listen(goog.global, 'resize', function() {
    sizeComponents(mapView.getMap(), frameElem, searchbox, embedded, touch,
                   preview, mapWrapperElem, footerElem, panelView, panelElem,
                   extraViewsPlugins, extraViews, useTabPanel);
  });
  if (useTabPanel) {
    resizeTabPanel(panelElem, frameElem, footerElem);
  }

  // If allowed, pass the google.maps.Map element to the parent frame.
  if (window != window.parent && config['allow_embed_map_callback']) {
    var callback = uri.getParameterValue('callback');
    if (callback && typeof window.parent[callback] === 'function') {
      window.parent[callback](google.maps, mapView.getMap());
    }
  }

  // Create the Presenter and let it set up the view based on the model and URI.
  var presenter = new cm.Presenter(
      appState, mapView, panelView, panelElem, config['map_id'] || '');
  presenter.resetView(mapModel, window.location);

  // If "#gz=..." is specified, get the user's geolocation and zoom to it.
  var match = window.location.hash.match('gz=([0-9]+)');
  if (match) {
    presenter.zoomToUserLocation(match[1] - 0);
  }

  // Load the 'edit' module only if editing is enabled.
  if (config['enable_editing']) {
    var arranger;
    goog.module.require('edit', 'cm.ArrangeView', function(ArrangeView) {
        arranger = new ArrangeView(arrangerElem, panelElem, appState, mapModel);
    });

    // Mark the body as editable so other styles can adjust accordingly.
    goog.dom.classes.add(frameElem, cm.css.EDIT);

    goog.module.require('edit', 'cm.EditPresenter', function(EditPresenter) {
      var edit_presenter = new EditPresenter(
          appState, mapModel, arranger, config);
    });
  }

  // Trigger resizing of the panel components when initialization is done.
  cm.events.emit(goog.global, 'resize');

  // Expose the google.maps.Map and the MapModel for testing and debugging.
  window['theMap'] = this.map_;
  window['mapModel'] = mapModel;
};

/**
 * Get the google.maps.Map managed by the Map Viewer.
 * @param {!function(!google.maps.Map)} callback Will be called when the
 *     map is available.
 */
cm.Map.prototype.getMap = function(callback) {
  if (this.map_) {
    callback(this.map_);
  } else {
    this.getMapCallbacks_.push(callback);
  }
};

/**
 * Centers the map on the place specified by the autocomplete widget bounds.
 * @param {google.maps.LatLngBounds} bounds The object from
 *     google.maps.places.Autocomplete().getPlace().geometry.viewport.
 */
cm.Map.prototype.fitBounds = function(bounds) {
  this.map_.fitBounds(bounds);
};

// window doesn't exist in gjstests
if (typeof window !== 'undefined') {
  window['cm_initialize'] = initialize;
  (window['google'] = window['google'] || {})['cm'] = {'Map': cm.Map};
}
