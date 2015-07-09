// Copyright 2014 Google Inc.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at: http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distrib-
// uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
// specific language governing permissions and limitations under the License.

/** The crisis namespace for holding xpath expressions. */
var crisis = {};
var browser = {};

/**
 * Creates an XPath that looks for the presence of a class name in the
 * "class" attribute.  (Intentionally clobbers the definitions of xclass,
 * xclass.c, xclass.i, and xclass.ic, which are all incorrect in various ways
 * and are therefore nothing but sources of bugs.)
 * @param {string} className The class to look for.
 * @param {string} opt_context An optional prefix for the XPath.
 * @return {string} An XPath for an element in the given context that has the
 *     given class among the space-separated names in its "class" attribute,
 *     assuming that space ('\x20') is the only whitespace character.
 */
function xclass(className, opt_context) {
  return (opt_context || '//*') +
      '[contains(concat(" ", @class, " "), " ' + className + ' ")]';
}

// Use an anonymous function so that we can define helper functions without
// polluting the global namespace.
(function() {
  /**
   * Creates a link object containing a text and link field.
   * @param {string} container The container of this link.
   * @param {string} text The text for this link.
   * @param {string} href The link href. If null, just uses text. This is
   *     suitable for links that use javascript:void(0).
   * @return {Object.<text: string, link: string>} An object containg xpaths for
   *     the text and link.
   */
  function link(container, text, href) {
    var textXpath = container + xtext.c(text);
    var linkXpath = href ? xhref.c(href, textXpath) : textXpath;
    return {text: textXpath, link: linkXpath};
  }

  browser.isDesktop = !puppet.userAgent.isMobile();
  browser.isSingleTouch = puppet.userAgent.isBlackberry() ||
      /Android [12]\./.test(navigator.userAgent);
  browser.isMultiTouch = puppet.userAgent.isIPad() ||
      puppet.userAgent.isIPhone() || puppet.userAgent.isDolfin() ||
          (puppet.userAgent.isAndroid() && !browser.isSingleTouch);
  browser.isTouch = browser.isMultiTouch || browser.isSingleTouch;

  // Top-level frame containing the entire UI.
  crisis.frame = xclass('cm-frame');

  // Top-level elements.
  // The first cm-panel element is the layers panel; the second is the arranger.
  crisis.panel = xclass('cm-panel') + '[1]';
  crisis.arranger = xclass('cm-arranger');
  crisis.title = xclass('cm-map-title');
  crisis.description = xclass('cm-map-description');
  crisis.map = xclass('cm-map');
  crisis.footer = xclass('cm-footer');
  crisis.share = {};
  crisis.share.button = xtext('Share', crisis.map + xclass('cm-mapbutton'));
  crisis.share.popup = {};
  crisis.share.popup.box = xclass('cm-share');
  crisis.share.popup.close = crisis.share.popup.box + xclass('cm-close-button');
  crisis.share.popup.shorten = crisis.share.popup.box +
      xclass('cm-shorten-checkbox');
  crisis.share.popup.url = crisis.share.popup.box + xid('cm-share-url');
  crisis.share.popup.html = crisis.share.popup.box + xid('cm-share-html');
  crisis.share.twitter = xclass('cm-twitter-share-button', '//iframe');
  crisis.share.facebook = xclass('cm-facebook-like-button', '//iframe');
  crisis.share.gplus = xclass('cm-gplus-share-button', '//a');
  crisis.searchbox = {};
  crisis.searchbox.input = crisis.map + xclass('cm-searchbox') + '/input';
  crisis.searchbox.autocomplete = {};
  crisis.searchbox.autocomplete.container = xclass('pac-container');
  crisis.searchbox.autocomplete.items = xclass('pac-item');
  crisis.searchbox.autocomplete.item = function(i) {
    return crisis.searchbox.autocomplete.items + '[' + (i + 1) + ']';
  };

  // Tab-panel
  crisis.tab = {};
  crisis.tab.panel = xclass('cm-tab-panel');
  crisis.tab.tabbar = {};
  crisis.tab.tabbar.about = xclass('goog-tab-bar') + xtext('About');
  crisis.tab.tabbar.layers = xclass('goog-tab-bar') + xtext('Layers');
  crisis.tab.tabbar.legend = xclass('goog-tab-bar') + xtext('Legend');
  crisis.tab.tabbar.details = xclass('goog-tab-bar') + xtext('Details');
  crisis.tab.content = xclass('cm-tab-content');
  crisis.tab.selected = xclass('goog-tab-selected');
  crisis.tab.disabled = xclass('goog-tab-disabled');
  crisis.tab.chevronup = xclass('cm-chevron-up');
  crisis.tab.chevrondown = xclass('cm-chevron-down');
  crisis.tab.selectTab = function(tabPath) {
    var currentTab = puppet.elem(crisis.tab.selected);
    if (currentTab !== puppet.elem(tabPath)) {
       run(click, tabPath);
    }
  };

  // Crowd reports
  crisis.crowd = {};
  crisis.crowd.panel = xclass('cm-crowd');
  crisis.crowd.form = xclass('cm-crowd-report-form');
  var report_ = function(item) {
    return {
      item: item,
      upvote: item + xclass('cm-upvote'),
      upvoteCount: item + xclass('cm-vote-count') + '[1]',
      downvote: item + xclass('cm-downvote'),
      downvoteCount: item + xclass('cm-vote-count') + '[2]',
      abuse: item + xclass('cm-report-abuse')
    };
  };
  crisis.crowd.report = function(index) {
    return report_(crisis.crowd.panel + xclass('cm-report') +
        '[' + (index + 1) + ']');  // XPath starts counting from 1
  };

  crisis.tab.getLayerPaths = function(index) {
    var container = crisis.tab.content +
        xclass('cm-inner-tab-content', '/*') +
        xclass('cm-panel-layers', '//*') +
        xclass('cm-layer-entry', '/*') +
            '[' + (index + 1) + ']';  // XPath starts counting from 1
    return getLayerElements_(container);
  };

  // Crisis picker menu elements.
  crisis.picker = {};
  crisis.picker.button = crisis.panel + xclass('cm-map-picker-button');
  crisis.picker.tabbedButton = crisis.tab.panel +
      xclass('cm-map-picker-button');
  crisis.picker.menu = xclass('cm-map-picker');

  // Toolbar elements.
  crisis.toolbar = {};
  crisis.toolbar.undo = xclass('cm-toolbar') + xtext('Undo');
  crisis.toolbar.redo = xclass('cm-toolbar') + xtext('Redo');
  crisis.toolbar.arrange = xclass('cm-toolbar') + xtext('Arrange');
  crisis.toolbar.addLayers = xclass('cm-toolbar') + xtext('Add layer');
  crisis.toolbar.addFolder = xclass('cm-toolbar') + xtext('Add folder');
  crisis.toolbar.editTopics = xclass('cm-toolbar') + xtext('Edit topics');
  crisis.toolbar.save = xclass('cm-toolbar') + xtext('Save');
  crisis.toolbar.saved = xclass('cm-toolbar') + xtext('Saved');

  // Importer elements.
  crisis.importer = {};
  crisis.importer.newLayer = xclass('cm-importer') + xtext('\xab Back');
  crisis.importer.ok = xclass('cm-importer') + xtext('Import selected layers');
  crisis.importer.cancel = xclass('cm-importer') + xtext('Cancel');
  crisis.importer.list = xclass('cm-importer-list');
  crisis.importer.mapPreviewLink = xclass('cm-importer') +
      xclass('cm-map-title') + xclass('cm-preview-link');
  var layerItem_ = function(item) {
    return {
      item: item,
      triangle: item + xclass('cm-triangle', '/*'),
      previewLink: item + xclass('cm-preview-link'),
      sublayer: function(index) {
        return layerItem_(item + '/following-sibling::*' +
            xclass('cm-layer-item', '/*') + '[' + (index + 1) + ']');
      }
    };
  };
  crisis.importer.item = function(index) {
    return layerItem_(crisis.importer.list + xclass('cm-layer-item', '/*') +
        '[' + (index + 1) + ']');
  };

  // Inspector elements.
  crisis.inspector = {};
  crisis.inspector.editors = xclass('cm-inspector') + xclass('cm-editors');
  crisis.inspector.item = function(index) {
    return crisis.inspector.editors + '/tr' +
        '[' + (index + 1) + ']';  // effing XPath starts counting from 1
  };
  crisis.inspector.importLayer = xclass('cm-inspector') +
      xtext('Import published layers \xbb');
  // All the inspector fields for layers, in the same order as they are defined
  // in EditPresenter. crisis.inspector[field] keys are added using this object,
  // and these should be used instead of indices, since this is easily updated
  // when the order is changed in EditPresenter.
  var inspectorFields = [
    'title',
    'description',
    'attribution',
    'legend',
    'viewport',
    'minimumZoom',
    'maximumZoom',
    'type',
    'sourceUrl',
    'mapsEngineUrl',
    'showDownloadLink',
    'isTileIndexUrl',
    'titleTemplate',
    'descriptionTemplate',
    'latitudeField',
    'longitudeField',
    'iconUrlTemplate',
    'colorTemplate',
    'hotspotTemplate',
    'condition0',
    'condition1',
    'condition2',
    'ftTableId',
    'ftLocationColumn',
    'ftWhereClause',
    'ftHeatmap',
    'labelColor',
    'temperatureUnit',
    'windSpeedUnit',
    'gmeMapId',
    'gmeLayerKey',
    'wmsLayers',
    'tileCoordinateType',
    'folderType',
    'places_icon_url',
    'places_keyword',
    'places_name',
    'places_types'
  ];

  for (var i = 0, key; key = inspectorFields[i]; i++) {
    crisis.inspector[key] = crisis.inspector.item(i);
  }
  crisis.inspector.typeOption = function(type) {
    return crisis.inspector.type + '//select' + xtext(type);
  };
  crisis.inspector.ok = xclass('cm-inspector') + xtext('OK');
  crisis.inspector.cancel = xclass('cm-inspector') + xtext('Cancel');

  // Topic selector.
  crisis.topics = {};
  crisis.topics.newTopic =
      xclass('cm-topic-selector') + xtext('Create new topic');
  crisis.topics.cancel = xclass('cm-topic-selector') + xtext('Cancel');
  crisis.topics.list = xclass('cm-topic-selector-list');
  var topicItem_ = function(item) {
    return {
      item: item,
      deleteButton: item + xclass('cm-close-button')
    };
  };
  crisis.topics.item = function(index) {
    return topicItem_(crisis.topics.list + xclass('cm-topic-item', '/*') +
        '[' + (index + 1) + ']');
  };

  crisis.topicInspector = {};
  crisis.topicInspector.editors = xclass('cm-inspector') + xclass('cm-editors');
  crisis.topicInspector.item = function(index) {
    return crisis.topicInspector.editors + '/tr' +
        '[' + (index + 1) + ']';  // effing XPath starts counting from 1
  };
  // All the inspector fields for topics, in the same order as they are defined
  // in EditPresenter. crisis.topicInspector[field] keys are added using this
  // object, and these should be used instead of indices, since this is easily
  // updated when the order is changed in EditPresenter.
  var topicInspectorFields = [
    'title',
    'tags',
    'layer_ids',
    'viewport',
    'crowd_enabled',
    'cluster_radius',
    'questions'
  ];
  for (var i = 0, key; key = topicInspectorFields[i]; i++) {
    crisis.topicInspector[key] = crisis.topicInspector.item(i);
  }
  crisis.topicInspector.addQuestion =
      xclass('cm-inspector') + xtext('Add a question');
  var choice_ = function(item) {
    return {
      title: item + '/table/tr[1]',
      label: item + '/table/tr[2]',
      color: item + '/table/tr[3]',
      deleteButton: item + '/div[1]'
    };
  };
  var question_ = function(item) {
    return {
      text: item + '/table/tr[1]',
      title: item + '/table/tr[2]',
      type: item + '/table/tr[3]',
      choice: function(choiceIndex) {
        return choice_(item + '/table/tr[' + (choiceIndex + 4) + ']/td/div');
      },
      addChoice: item + xtext('Add a choice'),
      deleteButton: item + '/div[1]'
    };
  };
  crisis.topicInspector.question = function(questionIndex) {
    return question_(crisis.topicInspector.questions + '/td/div/table/tr' +
        '[' + (questionIndex + 1) + ']/td/div');
  };
  crisis.topicInspector.ok = xclass('cm-inspector') + xtext('OK');
  crisis.topicInspector.cancel = xclass('cm-inspector') + xtext('Cancel');

  // About popup.
  crisis.about = link(crisis.tab.content, 'Help', null);
  crisis.about.popup = {};
  crisis.about.popup.box = xid('cm-about');
  crisis.about.popup.close = crisis.about.popup.box + xclass('cm-close-button');
  crisis.about.popup.content = crisis.about.popup.box + xclass('cm-about-text');
  crisis.about.popup.feedback = link(crisis.about.popup.box, 'form',
                                     'http://goo.gl/MCJLS');

  // Sidebar/layers panel components.
  crisis.layers = {};
  crisis.layers.button = xtext('Layers', crisis.map + xclass('cm-mapbutton'));
  crisis.layers.panel = crisis.panel;
  crisis.layers.close = crisis.panel + xclass('cm-close-button');
  crisis.layers.header = crisis.panel + xclass('cm-panel-header');
  crisis.layers.description = crisis.panel + xclass('cm-map-description');
  crisis.layers.links = {};
  crisis.layers.links.setDefaultView = xclass('cm-panel-links') +
      xtext('Set current view as default');
  crisis.layers.links.resetView = xclass('cm-panel-links') +
      xtext('Reset view');
  crisis.layers.collapse = crisis.panel + xclass('cm-collapse');
  crisis.layers.expand = xclass('cm-expand');

  // Takes an index starting from 0, just like item() on a
  // DOM element collection, and can be chained in order to index into a nested
  // folder. E.g., item(1).item(0).item(2) returns the DOM elements for the
  // 2nd top levels folder's 1st sublayer's 3rd sublayer.
  crisis.layers.getLayerPaths = function(index) {
    var container = crisis.panel +
        xclass('cm-panel-inner', '/*') +
        xclass('cm-panel-layers', '//*') +
        xclass('cm-layer-entry', '/*') +
        '[' + (index + 1) + ']';  // effing XPath starts counting from 1
    return getLayerElements_(container);
  };

  // Return the XPaths for the components of a layer entry view by index,
  // customized according to isTabbed.  Makes it easier to write test code
  // that can be run in either the tabbed or non-tabbed UI.
  crisis.getLayerPaths = function(index, isTabbed) {
    return isTabbed ? crisis.tab.getLayerPaths(index) :
        crisis.layers.getLayerPaths(index);
  };

  // Some xpaths require an explicit prefix (as opposed to the default '//*'
  // to avoid matching multiple elements in the case of nested folders.
  var getLayerElements_ = function(container) {
    return {
      container: container,
      checkbox: container + xclass('cm-checkbox-container', '/*/*') + '/input',
      label: container + '/*/label',
      title: container + xclass('cm-layer-title', '/*/*/*'),
      lastUpdated: container + xtext.c('Last updated'),
      edit: container + xtext('Edit'),
      del: container + xtext('Delete'),  // IE8 doesn't allow a 'delete' key
      zoomToArea: container + xtext('Zoom to area', '/*/*/*/*'),
      downloadKML: container + xtext('Download KML'),
      description: container + xclass('cm-layer-description', '/*/*'),
      legendBox: container + xclass('cm-layer-legend-box', '/*/*'),
      legend: container + xclass('cm-layer-legend', '/*/*/*/*'),
      opacitySlider: container + xclass('goog-slider-horizontal'),
      opacityThumb: container + xclass('goog-slider-thumb'),
      sublayers: container + xclass('cm-sublayers', '/*'),
      item: function(index) {
        // Insert an extra div element between nested cm-layer-entry divs.
        return getLayerElements_(
          container + xclass('cm-layer-entry', '/*/*') +
          '[' + (index + 1) + ']');  // effing XPath starts counting from 1
      }
    };
  };

  // Image lookups for tiles on the map.
  crisis.tile = function(src, opt_tag) {
    return crisis.map + xsrc.c(src, opt_tag);
  };
  crisis.anyKmlTile = crisis.tile('kml%3A');
  crisis.anyFtTile = crisis.tile('ft%3A');
  crisis.ftTile = function(table_id) {
    return crisis.tile('ft%3A' + table_id);
  };
  crisis.anyVdbTile = crisis.tile('vdb%3A');

  // Looking for tiles that have image overlay and contain x/y coordinates and
  // zoom level of the tile in the img src. This can be a VectorDb tile from
  // a Maps Engine layer, for example.
  crisis.imgTile = function(x, y, z) {
    return crisis.tile('x=' + x + '&y=' + y + '&z=' + z, '//img');
  };

  crisis.mapsEngineImageTile = function(asset_id) {
    return crisis.tile(asset_id + '/maptile/maps');
  };

  // We're looking for tiles that contain markers to verify that a marker is
  // showing. This cannot tell us anything about how many or where markers are
  // showing, but gives us a rough approximation for whether there are markers
  // or not.
  var markerDiv = crisis.map + xstyle.c('103', '/div');
  crisis.markerTiles = markerDiv + '//canvas|' + markerDiv + '//img';

  // Event target layer for the map
  crisis.maptarget = xclass('gm-style') + '/div[1]/div[1]';
})();

// Builds a URL for for loading a static file served by the puppet server.
function staticFileUrl(filename) {
  return document.location.protocol + '//' + document.location.host +
      '/crisismap/.static/' + filename;
}
// Checks if the map object has been initialized. Stores the map and the google
// namespace on window so that they are accessible from within the tests.
function hasMapLoaded() {
  window.theMap = puppet.window().theMap;
  window.mapModel = puppet.window().mapModel;
  window.google = puppet.window().google;
  return !!window.theMap && !!window.theMap.getBounds();
}

// Utility functions.
function approxEquals(a, b) {
  if (a == 0 && b == 0) return true;
  return Math.abs(a - b) / (Math.abs(a) + Math.abs(b)) < 0.001;
}

function assertApproxEquals(a, b) {
  assert(approxEquals(a, b), 'Expected: ' + a + '\nActual:   ' + b);
}

function isChecked(xpath) {
  var elem = puppet.elem(xpath);
  return elem && elem.checked;
}

function hasClass(xpath, className) {
  var elem = puppet.elem(xpath);
  return elem && elem.className.indexOf(className) > -1;
}

function fireEvent(xpath, type) {
  var event = document.createEvent('Event');
  event.initEvent(type, true, true);
  puppet.elem(xpath).dispatchEvent(event);
}

// If you see "error from server: Script error. @http://maps.gstatic.com/..."
// at an action that loads a new page, use run(ignoreMapsApiExceptions) to
// suppress the error; the Maps API should not be letting exceptions escape.
// We sometimes see uncaught exceptions from Maps API code if we navigate to
// a new page while the Maps API is busy.  (Because the Maps API JS is loaded
// from a different origin, the true error message is hidden and all we see is
// "Script error."  See http://stackoverflow.com/questions/5913978/ for why.)
//
// NOTE(kpy): When this was happening in map_picker.html, I was able to trigger
// the problem reliably just by navigating to a static image rather than
// another map, and waiting for a 'tilesloaded' or 'idle' event from the Maps
// API doesn't seem to help.  Sleeping for 0.1 s reduced the failure rate of
// map_picker.html from ~40% to ~2%, but sleeping longer did not reduce the
// failure rate any further.  Because the error message gets masked as "Script
// error", we could never find out what the real error in Maps API is, so
// I had to resort to ignoring errors from the Maps API.
function ignoreMapsApiExceptions() {
  var puppetErrorHandler = puppet.window().onerror;
  puppet.window().onerror = function(message, url, lineno) {
    // On Android, the 'url' argument can be null.
    if (url && url.indexOf('//maps.gstatic.com/') > 0) {
      puppet.echo('Ignoring uncaught Maps API exception: ' + message +
                  ' at line ' + lineno + ' in script ' + url);
    } else {
      puppetErrorHandler(message, url, lineno);
    }
  };
}

// Returns an equivalent URL with the tabbed UI enabled
function tabbifyUrl(url) {
  if (url.indexOf('dev=1') !== -1) {
    if (url.indexOf('client=') !== -1) {
      return url + '&use_tab_panel=1';
    } else {
      return url + '&client=google-test-tab';
    }
  } else {
    return url + ((url.indexOf('?') === -1) ? '?' : '&') +
        'dev=1&client=google-test-tab';
  }
}

/**
 * Loads the given URL twice (once with the tabbed UI enabled; once without),
 * calling testFunc each time (passing as the sole argument whether this is
 * the tabbed UI run).
 * @param {string} url The URL to load to start the test.
 * @param {?string} firstSelectedTab The XPath to the tab that should be
 *   selected at the start of the test, or null to leave the default tab
 *   selected.  This reduces the amount of if (isTabbed) code needed in
 *   testFunc, since often the test code needs to ensure particular widgets
 *   are on the screen.
 * @param {function} testFunc The test to be run; it will be called like
 *     testFunc(true) under the tabbed UI and testFunc(false) under the
 *     untabbed UI.
 */
function runTest(url, firstSelectedTab, testFunc) {
  // These were in a small loop, but given the size, it seemed silly.
  // Run the untabbed version
  run(load, url);
  run(hasMapLoaded);
  testFunc(false);

  // Run the tabbed version.
  run(load, tabbifyUrl(url));
  run(hasMapLoaded);
  if (firstSelectedTab) {
    run(crisis.tab.selectTab, firstSelectedTab);
  }
  testFunc(true);
}

// Prevent the save dialog from appearing when navigating to a new page
function circumventSavePrompt() {
  var saveLink = null;
  run(function() { saveLink = puppet.elem(crisis.toolbar.save); });
  run(function() { if (saveLink) saveLink.className = 'cm-disabled'; });
}

/**
 * Clicks the center of the map.
 * @return {bool} true if the details tab is selected
 */
function clickCenterOfMap() {
  var mapDiv = puppet.elem(crisis.map);
  var center = new google.maps.Point(
      mapDiv.offsetWidth / 2, mapDiv.offsetHeight / 2);
  click(crisis.maptarget, center.x, center.y);
  return text(crisis.tab.selected, 'Details');
}

puppet.setCommandTimeoutSecs(15);
