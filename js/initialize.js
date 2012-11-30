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
goog.require('cm.Analytics');
goog.require('cm.AppState');
goog.require('cm.BuildInfoView');
goog.require('cm.FooterView');
goog.require('cm.LayersButton');
goog.require('cm.LoginView');
goog.require('cm.MapModel');
goog.require('cm.MapPicker');
goog.require('cm.MapView');
goog.require('cm.MetadataModel');
goog.require('cm.MetadataUpdater');
goog.require('cm.MyLocationButton');
goog.require('cm.PanelView');
goog.require('cm.Presenter');
goog.require('cm.SearchBox');
goog.require('cm.ShareButton');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('cm.util');
goog.require('goog.Uri');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.dom.classes');
goog.require('goog.i18n.bidi');
goog.require('goog.module');
goog.require('goog.ui.Component');

/** @const */var MIN_DOCUMENT_WIDTH_FOR_SIDEBAR = 600;
/** @const */var MIN_MAP_WIDTH_FOR_SEARCHBOX = 500;

/**
 * Sizes the map and panel elements to fit the window.
 * @param {google.maps.Map} map The map to resize.
 * @param {Element} container The box which we render inside.
 * @param {cm.SearchBox} searchbox The searchbox control to hide on very small
 * screens.
 * @param {boolean} embedded This map should be embedded.
 * @param {boolean} touch True if the map is displayed on a touch device.
 * @param {Element} mapWrapperElem The box around the map to resize.
 * @param {Element} footerElem The footer element.
 * @param {Element} panelElem The panel element.
 */
function sizeComponents(map, container, searchbox, embedded, touch,
                        mapWrapperElem, footerElem, panelElem) {

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
    return container.offsetHeight - footerElem.offsetHeight -
        margins - borders;
  }

  goog.dom.classes.enable(container, 'cm-touch', touch);

  var embed_action = embedded ||
      container.offsetWidth < MIN_DOCUMENT_WIDTH_FOR_SIDEBAR;
  if (!embed_action) {
    cm.events.emit(panelElem, 'panelclose');
  }
  goog.dom.classes.enable(container, 'cm-embedded', embed_action);

  mapWrapperElem.style.height = getMapHeight() + 'px';

  // In floating mode, the panel has variable height based on its content,
  // but we need to limit its maximum height to fit over the map.
  var panelFloat = goog.dom.classes.has(container, 'cm-panel-float');
  var floatMaxHeight = getMapHeight() - 10;  // allow 5px top and bottom margin
  panelElem.style.maxHeight = panelFloat ? floatMaxHeight + 'px' : '';

  // TODO(kpy): Rework this value.  The relevant Maps API bug, which hid the
  // searchbox behind other controls, has since been fixed.
  var uncoveredMapWidth =
      mapWrapperElem.offsetWidth - (panelFloat ? panelElem.offsetWidth : 0);
  if (uncoveredMapWidth < MIN_MAP_WIDTH_FOR_SEARCHBOX) {
    searchbox.hide();
  } else {
    searchbox.show();
  }

  // Though the API checks the window resize itself, it's good practice to
  // trigger the resize event any time we change the map container's size.
  cm.events.emit(map, 'resize');
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
    // The HTML sanitizer normally deletes 'style' attributes.  We add back the
    // original 'style' attribute if there is one, since we want to keep it.
    attribs = decision['attribs'] || [];
    if (attrDict['style']) {
      attribs.push('style');
      attribs.push(attrDict['style']);  // TODO(kpy): Sanitize the CSS too.
    }
    return {'attribs': attribs};
  };
  cm.Html.installSanitizer(function(unsanitizedHtml) {
    return html['sanitizeWithPolicy'](unsanitizedHtml, tagPolicy);
  });
}


/**
 * @param {Object} mapRoot The MapRoot JSON to parse and render.
 * @param {string|Element} frame The DOM element in which to render the UI,
 *     or the ID of such a DOM element.
 * @param {string} jsBaseUrl The path component of the URL for loading
 *     additional JS modules.
 * @param {Array} opt_menuItems An array of items for the map menu, with keys:
 *     title: The title to display in the menu.
 *     url: The URL to navigate to when the item is clicked.
 * @param {Object=} opt_config The configuration settings.
 * @param {string=} opt_mapName The (optional) map_name for Analytics logging.
 * @param {string} opt_language The (optional) BCP 47 language code.
 */
function initialize(mapRoot, frame, jsBaseUrl, opt_menuItems,
                    opt_config, opt_mapName, opt_language) {
  // Create the AppState and the model; set up configuration flags.
  var config = opt_config || {};
  var appState = new cm.AppState(opt_language);
  var metadataModel = new cm.MetadataModel();
  var mapModel = cm.MapModel.newFromMapRoot(mapRoot);
  document.title = /** @type string */ (mapModel.get('title'));
  var touch = (new cm.BrowserDetect()).supportsTouch();
  var uri = new goog.Uri(window.location);
  var embedded = !!uri.getParameterValue('embedded');

  // Forward model changes to global scope.
  cm.events.forward(mapModel, cm.events.MODEL_CHANGED, goog.global);

  // Set up Analytics.
  cm.Analytics.initialize(config['analytics_id'] || '');
  if (opt_mapName) {
    cm.Analytics.logEvent('map', 'load', config['map_id'], embedded ? 1 : 0);
  }

  // Create the DOM tree within the frame.
  var frameElem = (typeof frame == 'string') ? cm.ui.get(frame) : frame;
  goog.dom.classes.add(frameElem, 'cm-frame');
  var footerElem = cm.ui.create('div', {'class': 'cm-footer'});
  var panelElem = cm.ui.create('div', {'class': 'cm-panel'});
  var arrangerElem = cm.ui.create(
      'div', {'class': 'cm-panel cm-arranger cm-hidden'});
  var mapElem = cm.ui.create('div', {'class': 'cm-map', 'id': 'map'});
  var mapWrapperElem = cm.ui.create(
      'div', {'class': 'cm-map-wrapper'}, mapElem, footerElem);
  var aboutTextElem = cm.ui.create(
      'div', {'class': 'cm-aboutText', 'id': 'cm-aboutText'});
  cm.ui.append(frameElem, panelElem, arrangerElem, mapWrapperElem,
               aboutTextElem);
  if (goog.i18n.bidi.IS_RTL) {
    goog.ui.Component.setDefaultRightToLeft(true);
    goog.dom.classes.add(frameElem, 'cm-layout-rtl');
  }

  // Create all the views and UI elements.
  // The MapView must be created first because it replaces the contents of the
  // map <div> element, and other views add stuff within that <div> element.
  var mapView = new cm.MapView(mapElem, mapModel, appState, touch, config);
  var searchbox = new cm.SearchBox(mapView.getMap());
  new cm.LayersButton(mapView.getMap(), panelElem);
  if (!config['hide_share_button']) {
    new cm.ShareButton(mapView.getMap(), appState,
                       !config['hide_facebook_button'],
                       !config['hide_google_plus_button'],
                       !config['hide_twitter_button']);
  }
  if (!config['hide_mylocation_button']) {
    new cm.MyLocationButton(mapView.getMap());
  }

  if (config['panel_float']) {
    goog.dom.classes.add(frameElem, 'cm-panel-float');
  }
  if (config['panel_side'] === 'left') {
    goog.dom.classes.add(frameElem, 'cm-panel-left');
  }
  if (config['show_login']) {
    new cm.LoginView(panelElem, config);
  }
  var panelView = new cm.PanelView(
      frameElem, panelElem, mapElem, mapModel, metadataModel, appState, config);
  if (opt_menuItems && opt_menuItems.length &&
      !config['draft_mode'] && !config['enable_editing']) {
    panelView.enableMapPicker(new cm.MapPicker(panelView.getHeader(),
                                               opt_menuItems));
  }
  var footerView = new cm.FooterView(footerElem, mapWrapperElem, mapModel);
  goog.style.showElement(footerElem, !config['hide_footer']);

  new cm.BuildInfoView(mapElem);

  // Lay out the UI components.  This needs to happen (in order to determine
  // the size of the map's DOM element) before we set up the viewport.
  sizeComponents(mapView.getMap(), frameElem, searchbox, embedded, touch,
                 mapWrapperElem, footerElem, panelElem);
  // We readjust the layout whenever the ViewportSizeMonitor detects that the
  // window resized, and also when anything emits 'resize' on goog.global.
  cm.events.forward(new goog.dom.ViewportSizeMonitor(), 'resize', goog.global);
  cm.events.listen(goog.global, 'resize', function() {
      sizeComponents(mapView.getMap(), frameElem, searchbox, embedded, touch,
                     mapWrapperElem, footerElem, panelElem);
  });

  // If allowed, pass the google.maps.Map element to the parent frame.
  if (embedded && config['allow_embed_map_callback']) {
    var callback = uri.getParameterValue('callback');
    if (callback && typeof window.parent[callback] === 'function') {
      window.parent[callback](google.maps, mapView.getMap());
    }
  }

  // Create the Presenter and let it set up the view based on the model and URI.
  var presenter = new cm.Presenter(
      appState, mapView, panelView, panelElem, config['map_id'] || '');
  presenter.resetView(mapModel, window.location, true);

  // If "#gz=..." is specified, get the user's geolocation and zoom to it.
  var match = window.location.hash.match('gz=([0-9]+)');
  if (match) {
    presenter.zoomToUserLocation(match[1] - 0);
  }

  // Initialize the dynamic module loader and tell it how to find module URLs.
  var getModuleUrl = config['get_module_url'] || function(baseUrl, module) {
    return baseUrl + '/crisismap_' + module + '__' + opt_language + '.js';
  };
  goog.module.initLoader(jsBaseUrl, getModuleUrl);

  // Load the 'edit' module only if editing is enabled.
  if (config['enable_editing']) {
    var arranger;
    goog.module.require('edit', 'cm.ArrangeView', function(ArrangeView) {
        arranger = new ArrangeView(arrangerElem, panelElem, appState, mapModel);
    });

    // Mark the body as editable so other styles can adjust accordingly.
    goog.dom.classes.add(frameElem, 'cm-edit');

    // This loads the 'edit' module, then calls the function in arg 3, passing
    // it the object that the module exported with the name 'cm.ToolbarView'.
    goog.module.require('edit', 'cm.ToolbarView', function(ToolbarView) {
      var toolbarView = new ToolbarView(
          panelElem, mapModel, config['save_url'], config['dev_mode'], touch);
    });
    goog.module.require('edit', 'cm.EditPresenter', function(EditPresenter) {
      var edit_presenter = new EditPresenter(
          appState, mapModel, arranger, config);
    });
    goog.module.require('sanitizer', 'html', installHtmlSanitizer);
  }

  if (config['metadata_url'] && config['enable_metadata_pipeline']) {
    var metadataUpdater = new cm.MetadataUpdater(mapModel, metadataModel,
                                                 config['metadata_url']);
  }

  // Expose the google.maps.Map and the MapModel for Puppet tests.
  window['theMap'] = mapView.getMap();
  window['mapModel'] = mapModel;
}

// window doesn't exist in gjstests
if (typeof window !== 'undefined') {
  window['initialize'] = initialize;
}
