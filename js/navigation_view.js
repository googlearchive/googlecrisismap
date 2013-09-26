// Copyright 2013 Google Inc.  All Rights Reserved.
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
 * @fileoverview A small horizontal list of links.
 */

goog.provide('cm.NavigationItem');
goog.provide('cm.NavigationView');
goog.provide('cm.NavigationViewConfig');

goog.require('cm');
goog.require('cm.ExtraView');
goog.require('cm.css');
goog.require('cm.ui');
goog.require('goog.object');


/** @typedef {{label: string, url: string}} */
cm.NavigationItem;


/**
 * Configuration options for behavior of the NavigationView.
 *
 * The show_horizontal_separator option controls whether a small separator
 * character is shown between links in the horizontal layout. If the links
 * look better without the separator, set this to false to prevent the
 * separator character from being displayed; a similar amount of margin will
 * be reserved between items. The default value of show_horizontal_separator
 * is true. The default value of horizontal_separator is cm.ui.SEPARATOR_DOT.
 * @typedef {{show_horizontal_separator: boolean}}
 */
cm.NavigationViewConfig;


/**
 * A horizontal list of links (to pages other than the Map Viewer page) in a
 * floating rectangle that is positioned directly below the PanelView.
 * @param {!Element} element The parent element into which to place the
 *     NavigationView.
 * @param {!Array.<cm.NavigationItem>} items The links to render in the
 *     NavigationView. Each element is an object with keys 'label' and 'url'.
 *     The label value is used as the link text; the url value is used as the
 *     href value of the link tag.
 * @param {cm.NavigationViewConfig} opt_config Configuration specific to the
 *     navigation view. Values from cm.NavigationView.DEFAULT_CONFIG will be
 *     used unless explicitly overridden in opt_config.
 * @constructor
 * @extends {cm.ExtraView}
 */
cm.NavigationView = function(element, items, opt_config) {
  /**
   * @type {!Element}
   * @private
   */
  this.listContainer_ = cm.ui.create('ul', {'class': cm.css.NAV_LIST});

  var mergedConfig = goog.object.clone(cm.NavigationView.DEFAULT_CONFIG);
  goog.object.extend(mergedConfig, opt_config || {});
  /**
   * @type {!cm.NavigationViewConfig}
   * @private
   */
  this.config_ = /** @type {!cm.NavigationViewConfig} */ (mergedConfig);

  this.buildNavLinks_(this.listContainer_, items);
  cm.ui.append(element, this.listContainer_);
};

/**
 * Default values for configuration options.
 * @type {!cm.NavigationViewConfig}
 * @const
 */
cm.NavigationView.DEFAULT_CONFIG = {show_horizontal_separator: true};

/**
 * Get the height of the .cm-nav-list element, not including exterior margin.
 * @return {number} The height in pixels.
 */
cm.NavigationView.prototype.getHeight = function() {
  return this.listContainer_.offsetHeight;
};

/**
 * Get the .cm-nav-list element that this view wraps.
 * @return {!Element} The element that this view wraps.
 */
cm.NavigationView.prototype.getElement = function() {
  return this.listContainer_;
};

/**
 * Add links to the containerElement.
 * @param {Element} element The element into which to add links.
 * @param {Array.<cm.NavigationItem>} items The item describing a link that
 *     should be added to the containerElement.
 * @private
 */
cm.NavigationView.prototype.buildNavLinks_ = function(element, items) {
  var lastIndex = items.length - 1;
  var self = this;
    goog.array.forEach(items, function(item, index) {
    var link = cm.ui.createLink(item.label, item.url);
    goog.dom.classes.add(link, cm.css.NAV_LINK);
    var listItem = cm.ui.create('li', {'class': cm.css.NAV_ITEM}, link);
    if (self.config_.show_horizontal_separator) {
      if (lastIndex > index) {
        // Insert a span that contains the visible separator.
        cm.ui.append(listItem, cm.ui.create(
          'span', {'class': cm.css.NAV_ITEM_SEPARATOR}, cm.ui.SEPARATOR_DOT));
      }
    } else {
      // Add a class that the stylesheet will use to add margins in
      // between elements of the list, instead of visible separators.
      goog.dom.classes.add(listItem, cm.css.NAV_ITEM_UNDELIMITED);
    }
    cm.ui.append(element, listItem);
  });
};
