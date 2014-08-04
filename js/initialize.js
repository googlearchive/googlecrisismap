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
goog.require('goog.math.Size');
goog.require('goog.module.Loader');
goog.require('goog.ui.Component');

/** @const */var MIN_DOCUMENT_WIDTH_FOR_SIDEBAR = 690;

/** @const */var MIN_DOCUMENT_HEIGHT_FOR_SEARCHBOX = 400;

// TODO(kpy): This value should probably be tuned since it was originally tuned
// to handle a Maps API bug (b/5194073) that has since been fixed.
/** @const */var MIN_MAP_WIDTH_FOR_SEARCHBOX = 450;

/** @const */var BOTTOM_TAB_PANEL_HEIGHT_FRACTION = 0.5;

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
 * @param {Array=} opt_menuItems An array of items for the map menu, with keys:
 *     title: The title to display in the menu.
 *     url: The URL to navigate to when the item is clicked.
 * @param {Object=} opt_config The configuration settings.
 * @param {string=} opt_unused Used to be the publication label for a map,
 *     which differentiated between draft maps and published maps.  However,
 *     it is now unused.  It should be removed outright, but chasing down the
 *     callsites is non-trivial, so that was deferred.
 * @param {string=} opt_language The (optional) BCP 47 language code.
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

  new cm.Map(frame, config);
}

/**
 * Constructs a map: loads the HTML sanitizer, then builds the map viewer UI.
 * TODO(kpy): This adds a 9-kb HTTP fetch to each pageview.  Speed up pageviews
 * by loading the sanitizer dynamically or moving sanitization to the server.
 * @constructor
 * @param {string|Element} frame The DOM element in which to render the UI,
 *     or the ID of such a DOM element.
 * @param {Object=} opt_config The configuration settings. If not given,
 *     the map is initialized with an empty MapRoot object.
 */
cm.Map = function(frame, opt_config) {
  /**
   * Queue of callbacks that are waiting for the Map instance to be made.
   * @type {Array.<function(google.maps.Map)>}
   * @private
   */
  this.getMapCallbacks_ = [];

  /**
   * The client configuration.
   * @type Object
   * @private
   */
  this.config_ = opt_config || {'map_root': {}};

  /**
   * @type boolean
   * @private
   */
  this.touch_ = cm.util.browserSupportsTouch();

  /**
   * In the old UI, whether to suppress dynamic resizing and pop-up a layers
   * panel only when the user clicks on the "Layers" button.
   * @type boolean
   * @private
   */
  this.embedded_;
  /**
   *
   * In the new UI, whether on initial load, the panel should be closed.
   * @type boolean
   * @private
   */
  this.panelClosed_;

  /**
   * @type Element
   * @private
   */
  this.frameElem_;

  /**
   * @type Element
   * @private
   */
  this.panelElem_;

  /**
   * @type Element
   * @private
   */
  this.arrangerElem_;

  /**
   * @type Element
   * @private
   */
  this.aboutElem_;

  /**
   * @type Element
   * @private
   */
  this.mapElem_;

  /**
   * @type Element
   * @private
   */
  this.footerElem_;

  /**
   * @type Element
   * @private
   */
  this.mapWrapperElem_;

  /**
   * @type cm.SearchBox
   * @private
   */
  this.searchbox_ = null;

  /**
   * @type {cm.PanelView|cm.TabPanelView}
   * @private
   */
  this.panelView_;

  /**
   * @type {goog.math.Size}
   * @private
   */
  this.footerSize_;

  /**
   * @type {goog.math.Size}
   * @private
   */
  this.frameSize_;

  // Wrap the getModuleUrl function in an adapter for the goog.module API.
  var lang = this.config_['lang'];
  var getModuleUrl = this.config_['get_module_url'];
  var googModuleGetModuleUrl = function(baseUrl, module) {
    return getModuleUrl(module, lang);
  };

  goog.module.Loader.init('', googModuleGetModuleUrl);
  var self = this;
  goog.module.Loader.require('sanitizer', 'html', function(html) {
    installHtmlSanitizer(html);
    // We need to defer buildUi until after sanitizer_module.js is loaded,
    // so we call buildUi inside this callback.
    self.buildUi_(frame);
  });
};

/**
 * Constructs the map viewer UI.
 * @param {string|Element} frame The DOM element in which to render the UI,
 *     or the ID of such a DOM element.
 * @private
 */
cm.Map.prototype.buildUi_ = function(frame) {
  var mapRoot = this.config_['map_root'] || {};
  var language = this.config_['lang'];

  // Create the models and application state.
  var mapModel = cm.MapModel.newFromMapRoot(mapRoot);
  var metadataModel = new cm.MetadataModel(
      mapModel, this.config_['metadata'], this.config_['metadata_url']);

  // After construction, the app state is not finalized because it must wait for
  // construction of the MapView, which waits for the Maps API 'bounds' to
  // be initialized and then exposes the viewport to the app state.
  var appState = new cm.AppState(mapModel, window.location, language);

  // Forward model changes to global scope.
  cm.events.forward(mapModel, cm.events.MODEL_CHANGED, cm.app);

  // Set up analytics.
  cm.Analytics.initialize(this.config_['analytics_id'] || '',
                          /** @type string */(mapModel.get('id')));
  cm.Analytics.logAction(cm.Analytics.PassiveAction.PAGE_LOADED, null);

  var uri = new goog.Uri(window.location);
  var preview = !!uri.getParameterValue('preview');
  this.embedded_ = !!uri.getParameterValue('embedded');
  this.panelClosed_ = !!uri.getParameterValue('panel_closed');

  // Set up the DOM structure.
  this.constructDom_(frame);

  // Construct the views.
  // The MapView should be created first, or early, because it replaces the
  // contents of the map div, and other views will add content to that div.
  var mapView = new cm.MapView(this.mapElem_, mapModel, appState, metadataModel,
                               this.touch_, this.config_, preview,
                               this.embedded_ || this.panelClosed_);
  this.map_ = mapView.getMap();
  var self = this;
  goog.array.forEach(this.getMapCallbacks_, function(callback) {
    callback(self.map_);
  });
  this.getMapCallbacks_ = [];
  this.constructButtons_(preview, appState);

  if (this.config_['show_login']) {
    new cm.LoginView(this.panelElem_, this.config_);
  }

  this.constructPanelView_(appState, mapModel, metadataModel);
  var showFooter = !this.config_['hide_footer'] && !preview;
  if (showFooter) {
    new cm.FooterView(this.footerElem_, this.mapWrapperElem_, mapModel,
                      {'publisher_name': this.config_['publisher_name'],
                       'langs': this.config_['langs']});
  }
  goog.style.setElementShown(this.footerElem_, showFooter);

  var extraViewsPlugins = /** @type {Array.<cm.ExtraViewsPlugin>} */
      (this.config_['extra_views_plugins']);
  var extraViews =
      cm.ExtraViewsPlugin.initAll(this.frameElem_, this.config_,
                                  extraViewsPlugins);
  cm.events.listen(cm.app, 'resize', function() {
    self.handleResize_(preview, extraViewsPlugins, extraViews);
  });
  new cm.BuildInfoView(this.mapElem_);

  // Call the resize handler to determine the map size and to resize the panel
  // components before setting up the viewport.
  cm.events.emit(cm.app, 'resize');

  // We readjust the layout whenever the ViewportSizeMonitor detects that the
  // window resized, and also when anything emits 'resize' on cm.app.
  cm.events.forward(
      new goog.dom.ViewportSizeMonitor(goog.global), 'resize', cm.app);

  // If allowed, pass the google.maps.Map element to the parent frame.
  if (window != window.parent && this.config_['allow_embed_map_callback']) {
    var callback = uri.getParameterValue('callback');
    if (callback && typeof window.parent[callback] === 'function') {
      window.parent[callback](google.maps, this.map_);
    }
  }

  this.constructPresenter_(appState, mapModel, mapView);
  this.constructEditor_(appState, mapModel);

  // Expose the google.maps.Map and the MapModel for testing and debugging.
  window['theMap'] = this.map_;
  window['mapModel'] = mapModel;

  // Record how long it took to get the UI to load.
  var startTimeMs = goog.getObjectByName('cmStartTimeMs');
  var endTimeMs = goog.now();
  if (startTimeMs && 0 < startTimeMs && startTimeMs < endTimeMs) {
    cm.Analytics.logTime('Load', 'Page', endTimeMs - startTimeMs);
  }
};

/**
 * Measures the size of the footer element and stores it.
 * We store the footer size in order to prevent computing the offsetWidth and
 * offsetHeight unnecessarily. This should be called only upon initialization or
 * if the footer may have changed size, e.g., if the viewport was resized.
 * @private
 */
cm.Map.prototype.captureFooterSize_ = function() {
  this.footerSize_ = new goog.math.Size(
      this.footerElem_.offsetWidth, this.footerElem_.offsetHeight);
};

/**
 * Measures the size of the frame element and stores it.
 * We store the frame size in order to prevent computing the offsetWidth and
 * offsetHeight unnecessarily. This should be called only upon initialization or
 * if the frame may have changed size, e.g., if the viewport was resized.
 * @private
 */
cm.Map.prototype.captureFrameSize_ = function() {
  this.frameSize_ = new goog.math.Size(
      this.frameElem_.offsetWidth, this.frameElem_.offsetHeight);
};

/**
 * Determines whether the frame is narrow by checking the frame width. Lazily
 * computes the frame size if it hasn't been measured.
 * @return {boolean} Whether the frame is narrow.
 * @private
 */
cm.Map.prototype.isNarrow_ = function() {
  if (!this.frameSize_) {
    this.captureFrameSize_();
  }
  return this.frameSize_.width < MIN_DOCUMENT_WIDTH_FOR_SIDEBAR;
};

/**
 * Dynamically calculates the current height of the map.
 * @return {number} The computed map height.
 * @private_
 */
 cm.Map.prototype.getMapHeight_ = function() {
   /**
    * Returns the value of the given style property for an element.  Assumes the
    * numerical value for the property.
    * @param {Element} element The element to inspect.
    * @param {string} property The property of interest.
    * @return {number} Returns the property's value.
    */
   function getStylePropertyValue(element, property) {
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

   var margins = getStylePropertyValue(this.mapWrapperElem_, 'margin-top') +
       getStylePropertyValue(this.mapWrapperElem_, 'margin-bottom');
   if (!margins) {
     margins = 0;
   }
   var borders = getStylePropertyValue(this.mapWrapperElem_, 'border-top') +
       getStylePropertyValue(this.mapWrapperElem_, 'border-bottom');
   var mapHeight = this.frameSize_.height - margins - borders -
       this.footerSize_.height;
   if (this.config_['use_tab_panel'] && this.isNarrow_()) {
     // The frame is narrow, so the tab bar is positioned below the map.
     mapHeight = mapHeight - this.panelElem_.offsetHeight;
   }
   return mapHeight;
 };

/**
 * Sizes the map and panel elements to fit the window.
 * @param {boolean} preview True if the map is being displayed as a preview.
 * @param {Array.<cm.ExtraViewsPlugin>} extraViewsPlugins An array of
 *     cm.ExtraViewsPlugin instances to be set up by this method.
 * @param {!Object.<string, cm.ExtraView>} extraViews A map of ExtraView
 *     short names to ExtraView instances. This can be empty but not null.
 * @private_
 */
cm.Map.prototype.handleResize_ = function(preview, extraViewsPlugins,
                                          extraViews) {
  this.captureFrameSize_();
  this.captureFooterSize_();
  if (this.config_['use_tab_panel']) {
    this.resizeTabPanel_();
  } else {
    this.resizePanel_();
  }

  var floating = goog.dom.classes.has(this.frameElem_, cm.css.PANEL_FLOAT) ||
      this.config_['use_tab_panel'];
  if (extraViewsPlugins) {
    var panelViewPosition = {
      isPanelCollapsed: goog.dom.classes.has(this.frameElem_,
                                             cm.css.PANEL_COLLAPSED),
      isPanelFloating: floating,
      isPanelPopup: this.embedded_,
      floatMaxHeight: this.getMapHeight_() - 10
    };
    goog.array.forEach(extraViewsPlugins, goog.bind(function(plugin) {
      plugin.sizeComponentsWithExtraViews(this.frameElem_, this.panelView_,
                                          panelViewPosition, extraViews);
    }, this));
  }
  if (this.searchbox_) {
    var uncoveredMapWidth = this.mapWrapperElem_.offsetWidth -
        (floating ? this.panelElem_.offsetWidth : 0);
    var smallTabbedUi = this.config_['use_tab_panel'] && this.isNarrow_() &&
        this.frameSize_.height < MIN_DOCUMENT_HEIGHT_FOR_SEARCHBOX;
    if (uncoveredMapWidth < MIN_MAP_WIDTH_FOR_SEARCHBOX || preview ||
        smallTabbedUi) {
      this.searchbox_.hide();
    } else {
      this.searchbox_.show();
    }
  }

  // Though the API checks the window resize itself, it's good practice to
  // trigger the resize event any time we change the map container's size.
  cm.events.emit(this.map_, 'resize');
};

/**
 * Resize handler for the old UI.
 * @private
 */
cm.Map.prototype.resizePanel_ = function() {
  var narrowOrEmbedded = this.embedded_ || this.isNarrow_();
  var floating = goog.dom.classes.has(this.frameElem_, cm.css.PANEL_FLOAT);
  if (!narrowOrEmbedded) {
    // Ensure that the pop-up panel is closed when the window is resized.
    cm.events.emit(this.panelElem_, 'panelclose');
  }
  goog.dom.classes.enable(this.frameElem_, cm.css.EMBEDDED, narrowOrEmbedded);
  goog.dom.classes.enable(this.frameElem_, cm.css.PANEL_DOCK,
                          !narrowOrEmbedded && !floating);

  // When the panel has variable height based on its content, its maximum
  // height should be limited to fit within the map. This happens when either
  //   1) the panel is explicitly configured to be floating with
  //      '?panel_float=1', or
  //   2) the map is currently narrow or it was initialized with '?embedded=1'
  //      so the panel is a dismissable pop-up opened from the 'Layers' button
  this.mapWrapperElem_.style.height = this.getMapHeight_() + 'px';
  var maxPanelHeight = this.getMapHeight_() - 10;  // 5px top and bottom margin
  this.panelView_.setMaxHeight(narrowOrEmbedded || floating ?
      maxPanelHeight : null);
};

/**
 * Resize handler for the tabbed UI. Adjusts the tab panel height to a
 * fixed fraction of the frame when the tab bar is below the map and
 * the tab panel is expanded.
 * @private
 */
cm.Map.prototype.resizeTabPanel_ = function() {
  var narrow = this.isNarrow_();
  goog.dom.classes.enable(this.frameElem_, cm.css.EMBEDDED, narrow);
  goog.dom.classes.enable(this.frameElem_, cm.css.PANEL_BELOW, narrow);
  if (this.config_['panel_side'] === 'left') {
    goog.dom.classes.enable(this.frameElem_, cm.css.PANEL_LEFT, !narrow);
  }

  var maxPanelHeight;
  if (narrow) {
    maxPanelHeight = BOTTOM_TAB_PANEL_HEIGHT_FRACTION * this.frameSize_.height;
  } else {
    // When panel is on left or right, leave 5px top and bottom margins.
    // When panel is on right, lave an additional 15px bottom margin for
    // the map copyright text.
    maxPanelHeight = this.getMapHeight_() - 10;
    if (this.config_['panel_side'] !== 'left') {
      maxPanelHeight = maxPanelHeight - 15;
    }
  }
  this.panelView_.resize(maxPanelHeight, narrow);
  this.mapWrapperElem_.style.height = this.getMapHeight_() + 'px';
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

/**
 * Create the DOM elements.
 * @param {string|Element} frame The DOM element in which to render the UI,
 *     or the ID of such a DOM element.
 * @private
 */
cm.Map.prototype.createElements_ = function(frame) {
  this.frameElem_ = (typeof frame == 'string') ? cm.ui.get(frame) : frame;
  goog.dom.classes.add(this.frameElem_, cm.css.FRAME);
  this.mapElem_ = cm.ui.create('div', {'class': cm.css.MAP, 'id': 'map'});
  this.footerElem_ = cm.ui.create('div', {'class': cm.css.FOOTER});
  this.mapWrapperElem_ = cm.ui.create('div', {'class': cm.css.MAP_WRAPPER},
      this.mapElem_);
  this.arrangerElem_ = cm.ui.create('div',
      {'class': [cm.css.PANEL, cm.css.ARRANGER]});
  this.aboutElem_ = cm.ui.create(
      'div', {'class': cm.css.ABOUT_TEXT, 'id': 'cm-aboutText'});
  if (!!this.config_['use_tab_panel']) {
    this.panelElem_ = cm.ui.create('div', {'class': cm.css.TAB_PANEL});
  } else {
    this.panelElem_ = cm.ui.create('div', {'class': cm.css.PANEL});
  }
};

/**
 * @private
 */
cm.Map.prototype.layoutTabbedPanelUi_ = function() {
  var narrow = this.isNarrow_();
  if (narrow) {
    goog.dom.classes.add(this.frameElem_, cm.css.EMBEDDED);
    goog.dom.classes.add(this.frameElem_, cm.css.PANEL_BELOW);
  }
  cm.ui.append(this.mapWrapperElem_, this.footerElem_);
  cm.ui.append(
      this.frameElem_, this.mapWrapperElem_, this.aboutElem_, this.footerElem_,
      this.panelElem_);
  goog.dom.classes.add(this.frameElem_, cm.css.FOOTER_SHADOW);
};

/**
 * @private
 */
cm.Map.prototype.layoutUntabbedPanelUi_ = function() {
  cm.ui.append(this.mapWrapperElem_, this.footerElem_);
  cm.ui.append(this.frameElem_, this.panelElem_, this.arrangerElem_,
               this.mapWrapperElem_, this.aboutElem_);
  if (this.config_['panel_float']) {
    goog.dom.classes.add(this.frameElem_, cm.css.PANEL_FLOAT);
  }
  // Hide the arranger now, even though the ArrangeView constructor
  // also hides if this is an editable draft. Otherwise it can interfere
  // with the layout of other elements while waiting for the
  // ArrangeView to be instantiated when the editor module loads.
  goog.dom.classes.add(this.arrangerElem_, cm.css.HIDDEN);
};


/**
 * @param {string|Element} frame The DOM element in which to render the UI,
 *     or the ID of such a DOM element.
 * @private
 */
cm.Map.prototype.constructDom_ = function(frame) {
  this.createElements_(frame);

  if (!!this.config_['use_tab_panel']) {
    this.layoutTabbedPanelUi_();
  } else {
    this.layoutUntabbedPanelUi_();
  }

  if (this.config_['panel_side'] === 'left') {
    goog.dom.classes.add(this.frameElem_, cm.css.PANEL_LEFT);
  } else {
    goog.dom.classes.add(this.frameElem_, cm.css.PANEL_RIGHT);
  }

  goog.dom.classes.enable(this.frameElem_, cm.css.TOUCH, this.touch_);

  if (goog.i18n.bidi.IS_RTL) {
    goog.ui.Component.setDefaultRightToLeft(true);
    goog.dom.classes.add(this.frameElem_, cm.css.LAYOUT_RTL);
  }
};

/**
 * @param {boolean} preview Whether the map is a preview.
 * @param {!cm.AppState} appState
 * @private
 */
cm.Map.prototype.constructButtons_ = function(preview, appState) {
  if (!this.config_['hide_search_box']) {
    this.searchbox_ = new cm.SearchBox(this.map_);
  }

  if (!preview && !this.config_['use_tab_panel']) {
    new cm.LayersButton(this.map_, this.panelElem_);
  }
  if (!preview && !this.config_['hide_share_button'] &&
      !this.config_['enable_editing']) {
    var urlShortener = new cm.UrlShortener(
        this.config_['json_proxy_url'], this.config_['google_api_key']);
    new cm.ShareButton(this.map_, appState,
                       !this.config_['hide_facebook_button'],
                       !this.config_['hide_google_plus_button'],
                       !this.config_['hide_twitter_button'], urlShortener);
  }
  if (!this.config_['hide_my_location_button'] && !preview) {
    new cm.MyLocationButton(this.map_);
  }
};

/**
 * @param {!cm.AppState} appState
 * @param {!cm.MapModel} mapModel
 * @param {!cm.MetadataModel} metadataModel
 * @private
 */
cm.Map.prototype.constructPanelView_ = function(appState, mapModel,
                                                metadataModel) {
  var narrow = this.isNarrow_();
  if (!!this.config_['use_tab_panel']) {
    goog.dom.classes.add(this.frameElem_, cm.css.TABBED);
    this.panelView_ = new cm.TabPanelView(
        this.frameElem_, this.panelElem_, this.mapElem_, mapModel,
        metadataModel, appState, narrow, !this.embedded_ && !this.panelClosed_,
        this.config_);
    cm.events.listen(
        this.panelView_,
        [cm.events.TAB_PANEL_OPENED, cm.events.TAB_PANEL_CLOSED],
        this.handleTabPanelOpenedClosed_,
        this);
  } else {
    this.panelView_ = new cm.PanelView(
        this.frameElem_, this.panelElem_, this.mapElem_, mapModel,
        metadataModel, appState, this.config_);
  }
};

/**
 * @private
 */
cm.Map.prototype.handleTabPanelOpenedClosed_ = function() {
  if (this.isNarrow_()) {
    this.resizeTabPanel_();
    cm.events.emit(this.map_, 'resize');
  }
};

/**
 * @param {cm.AppState} appState
 * @param {cm.MapModel} mapModel
 * @param {cm.MapView} mapView
 * @private
 */
cm.Map.prototype.constructPresenter_ = function(appState, mapModel, mapView) {
  var presenter = new cm.Presenter(
      appState, mapView, this.panelView_, this.panelElem_,
      this.config_['map_id'] || '');
  presenter.resetView(mapModel, window.location);

  // If "#gz=..." is specified, get the user's geolocation and zoom to it.
  var match = cm.ui.document.location.hash.match('gz=([0-9]+)');
  if (match) {
    presenter.zoomToUserLocation(match[1] - 0);
  }

  if (this.isNarrow_()) {
    // On narrow maps, the first time the user expands or collapses the panel
    // we re-center the viewport to use the available space.
    var token = cm.events.listen(
        this.panelView_,
        [cm.events.TAB_PANEL_OPENED, cm.events.TAB_PANEL_CLOSED],
        function() {
          mapView.matchViewport(
              /** @type cm.LatLonBox */(mapView.get('viewport')));
          cm.events.unlisten(token);
        });
  }
};

/**
 * Load the 'edit' module if editing is enabled.
 * @param {cm.AppState} appState
 * @param {cm.MapModel} mapModel
 * @private
 */
cm.Map.prototype.constructEditor_ = function(appState, mapModel) {
  if (!this.config_['enable_editing']) {
    return;
  }
  var self = this;
  var arranger;
  goog.module.Loader.require(
      'edit', 'cm.ArrangeView', function(ArrangeView) {
    arranger = new ArrangeView(self.arrangerElem_, self.panelElem_,
                               appState, mapModel,
                               self.config_['use_tab_panel']);
  });
  // Mark the body as editable so other styles can adjust accordingly.
  goog.dom.classes.add(this.frameElem_, cm.css.EDIT);

  goog.module.Loader.require(
      'edit', 'cm.EditPresenter', function(EditPresenter) {
    new EditPresenter(appState, mapModel, arranger, self.config_);
  });
};

// window doesn't exist in gjstests
if (typeof window !== 'undefined') {
  window['cm_initialize'] = initialize;
  (window['google'] = window['google'] || {})['cm'] = {'Map': cm.Map};
}
