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
 * @fileoverview An ExtraViewsPlugin which adds the NavigationView and LogoView.
 */

goog.provide('cm.NavigationAndLogoPlugin');

goog.require('MIN_DOCUMENT_WIDTH_FOR_SIDEBAR');
goog.require('cm.ExtraViewsPlugin');

/**
 * This ExtraViewPlugin instantiates, configures, and lays out the optional
 * NavigationView and LogoView relative to other views in the Map Viewer.
 * @implements {cm.ExtraViewsPlugin}
 * @constructor
 */
cm.NavigationAndLogoPlugin = function() {};

/**
 * Given the configuration object for the viewer, instantiate and configure the
 * NavigationView and LogoView.
 * @param {Element} frameElem The Element in which the map viewer is rendered.
 * @param {Object} config The configuration object for the Map Viewer.
 * @return {Object.<string, cm.ExtraView>} A map of 'navigation' and 'logo' to
 *     the NavigationView and LogoView instances.
 */
cm.NavigationAndLogoPlugin.prototype.maybeBuildExtraViews =
  function(frameElem, config) {
  var views = {};
  if (frameElem && config) {
    if (config['navigation_links']) {
      views.navigation = new cm.NavigationView(
        frameElem, config['navigation_links'], config['navigation_options']);
    }
    if (config['logo_watermark_image']) {
      goog.dom.classes.add(frameElem, cm.css.LOGO_BOTTOM_LEFT);
      views.logo = new cm.LogoView(frameElem, config['logo_watermark_image']);
    }
  }
  return views;
};

/**
 * Adjust the PanelView to make room for the NavigationView if the PanelView is
 * in floating position. Adjust the positions of the NavigationView and LogoView
 * based on the other views and the viewport size.
 * @param {Element} container The box which we render inside.
 * @param {cm.PanelView|cm.TabPanelView|{setMaxHeight:function(?number)}}
 *     panelView The PanelView instance.
 * @param {cm.PanelViewPosition} panelViewPosition The current layout state of
 *     the PanelView.
 * @param {Object.<string, cm.ExtraView>} extraViews The map of ExtraView short
 *     names to ExtraView instances.
 */
cm.NavigationAndLogoPlugin.prototype.sizeComponentsWithExtraViews = function(
    container, panelView, panelViewPosition, extraViews) {
  var navigationView = /** @type {cm.NavigationView} */ (extraViews.navigation);
  var logoView = /** @type {cm.LogoView} */ (extraViews.logo);
  // LogoView's layout is all done with CSS, so this method only needs to do
  // something when a NavigationView is present.
  if (!navigationView) {
    return;
  }

  if (panelViewPosition.isPanelFloating) {
    // Reserve space below the PanelView for the NavigationView
    // and a 5px margin.
    panelView.setMaxHeight(panelViewPosition.floatMaxHeight -
      (navigationView.getHeight() + 5));
  }
  // Things get crowded along the bottom edge of the map if there is a
  // NavigationView, a LogoView, and basemap attribution text all in a map
  // that's narrower than about 750px. So for that "medium-wide" window
  // size, the NavigationView has a compact layout that is triggered here.
  // For the narrowest width when the PanelView becomes embedded, or when
  // the floating Panel is collapsed, there is an even-more-compact layout
  // that is used, which shows links in a narrow vertical list.
  var navViewElem = navigationView.getElement();

  // wide: Used when window width > 750px.
  //   NavigationView is a horizonal list below the PanelView when
  //   isPanelFloating is true. If isPanelFloating is false, it's a small
  //   vertical list, in the bottom corner next to the docked panel (i.e.
  //   bottom right of the map when the panel is docked on the right).
  //
  // medium: Used when window is wide enough for the docked panel to be
  //   shown but < 750px (so things at the bottom edge of the map are
  //   starting to overlap).
  //   When the PanelView is docked, or when the PanelView is floating
  //   and in popup mode, the NavigationView is a compact vertical list.
  //   Otherwise the PanelView is floating and visible, so the
  //   NavigationView is a horizontal list under the PanelView.
  //   When the PanelView is docked on the right, NavigationView is moved
  //   up so that it doesn't overlap the LogoView.
  //
  // narrow: NavigationView is placed at inner bottom edge of map; links
  //   are in a small vertical list on the same side that the PanelView
  //   would be on in a wider window (i.e. it obeys the
  //   config['panel_side'] value even though the panel is not pinned to a
  //   side in this window width), so that the navigation view appears in
  //   the opposite corner from the map zoom control. Used when the window
  //   is not wide enough for the panel to be shown.

  var widthRange = 'wide';
  if (container.offsetWidth < 750) {
      widthRange = container.offsetWidth < MIN_DOCUMENT_WIDTH_FOR_SIDEBAR ?
          'narrow' : 'medium';
  }
  // The list items in the NavigationView can be displayed horizontally
  // (as a word-wrapped series of text links optionally separated by a
  // delimiter), or (if this is false) vertically with a hanging indent
  // for each item.
  var useCompactNavLayout = false;
  var isAboveAttribution = false;
  var setNavBottomAboveLogo = false;
  var setNavTopUnderPanel = false;
  var panelIsOnLeft = goog.dom.classes.has(container, cm.css.PANEL_LEFT);

  if (panelViewPosition.isPanelCollapsed || widthRange === 'narrow') {
      useCompactNavLayout = true;
  }
  if (panelViewPosition.isPanelFloating) {
      if (panelViewPosition.isPanelPopup ||
          panelViewPosition.isPanelCollapsed) {
          setNavBottomAboveLogo = true;
      } else {
          setNavTopUnderPanel = true;
      }
  } else { // !floating
      useCompactNavLayout = true;
      if (panelIsOnLeft) {
          setNavBottomAboveLogo = true;
          if (widthRange === 'narrow' || widthRange === 'medium') {
              isAboveAttribution = true;
          }
      } else { // panel is on the right
          if (widthRange === 'narrow') {
              isAboveAttribution = true;
              // overlap the logo to save space:
              setNavBottomAboveLogo = false;
          }
          if (widthRange === 'medium') {
              isAboveAttribution = true;
              setNavBottomAboveLogo = (!panelViewPosition.isPanelCollapsed);
          }
      }
  }

  if (setNavBottomAboveLogo) {
    // Pin the navigationView to the bottom, but leave room for the logoView
    // plus 5px above and below it if the logoView is present.
    var navViewBottom = logoView ? (logoView.getHeight() + 10) : 5;
      navViewElem.style.bottom = navViewBottom + 'px';
      navViewElem.style.top = 'auto';
  } else {
    if (setNavTopUnderPanel) {
        // Pin to 5px below the bottom of the panelView.
        var panelBottom = panelView.getBounds().height + 5;
        var navViewTop = panelBottom + 5;
        navViewElem.style.bottom = 'auto';
        navViewElem.style.top = navViewTop + 'px';
    } else { // no need for dynamic top/bottom
        navViewElem.style.bottom = '';
        navViewElem.style.top = '';
    }
  }

  /** @type {function(string, boolean)} */
  var enableNavClass = goog.partial(goog.dom.classes.enable, navViewElem);
  enableNavClass(cm.css.NAV_COMPACT, useCompactNavLayout);
  enableNavClass(cm.css.ABOVE_ATTRIBUTION, isAboveAttribution);
};

goog.exportSymbol('google.cm.NavigationAndLogoPlugin',
                  cm.NavigationAndLogoPlugin);
