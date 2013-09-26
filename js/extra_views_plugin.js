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
 * @fileoverview A plugin interface for adding optional views to the viewer UI.
 */

goog.provide('cm.ExtraView');
goog.provide('cm.ExtraViewsPlugin');
goog.provide('cm.PanelViewPosition');

/**
 * Object that describes the PanelView's position, for use by
 * ExtraViewPlugin.sizeComponentsWithExtraViews.
 *
 * isPanelCollapsed: Whether the PanelView is currently collapsed.
 * isPanelFloating: Whether the PanelView is configured to
 *     render in its floating position.
 * isPanelPopup: If the PanelView is in its popup state (where it
 *     minimizes into a "Layers" button initially).
 * floatMaxHeight: The max-height (in px) that sizeComponents has
 *     determined is appropriate for panelView.
 * @typedef {{isPanelCollapsed: boolean,
 *            isPanelFloating: boolean,
 *            isPanelPopup: boolean,
 *            floatMaxHeight: number}}
 */
cm.PanelViewPosition;

/**
 * @typedef {Object} A marker interface for an Object which is built by
 *     maybeBuildExtraViews and then handled by sizeComponentsWithExtraViews.
 *     An ExtraView has no required properties, so it's technically just an
 *     Object, but for human readability's sake, cm.ExtraView is used in this
 *     API.
 */
cm.ExtraView;

/**
 * Instances of this interface are responsible for instantiating, configuring,
 * and laying out any optional views that a particular developer using the
 * Map Viewer wants to add, but which are not part of the viewer's core
 * set of views.
 * @interface
 */
cm.ExtraViewsPlugin = function() {};

/**
 * Given the configuration object for the viewer, instantiate and configure
 * any optional views and return them as an object whose keys are short names
 * for the views.
 * @param {Element} frameElem The Element in which the map viewer is rendered.
 * @param {Object} config The configuration object for the Map Viewer.
 * @return {Object.<string, cm.ExtraView>} A map of short names of ExtraView
 *     types (whatever name makes sense to the plugin) to the instances of
 *     that type that are already configured.
 *     Implementations should use unquoted names so that the Closure Compiler
 *     can shorten them (they have no meaning outside of the plugin).
 *     Example: {foo: instanceOfFooView}
 *     This object can also be {} or null.
 */
cm.ExtraViewsPlugin.prototype.maybeBuildExtraViews =
  function(frameElem, config) {};

/**
 * Make any adjustments to views' sizes and positions that is needed to fit
 * optional views into the layout. This is called at the end of
 * sizeComponents() so most layout has already taken place and can just be
 * adjusted as needed.
 * @param {Element} container The box which we render inside.
 * @param {cm.PanelView|cm.TabPanelView} panelView The PanelView instance.
 * @param {cm.PanelViewPosition} panelViewPosition The current layout state
 *     of the PanelView.
 * @param {!Object.<string, cm.ExtraView>} extraViews The map of ExtraView
 *     short names to ExtraView instances.
 */
cm.ExtraViewsPlugin.prototype.sizeComponentsWithExtraViews = function(
    container, panelView, panelViewPosition, extraViews) {};

/**
 * Call maybeBuildExtraViews on all plugins and return a map of all ExtraView
 * instances they made.
 * @param {Element} frameElem The Element in which the map viewer is rendered.
 * @param {Object} config The configuration object for the Map Viewer.
 * @param {Array.<cm.ExtraViewsPlugin>} extraViewsPlugins An array of
 *     cm.ExtraViewsPlugin instances to be set up by this method.
 * @return {!Object.<string, cm.ExtraView>} The map of ExtraView short names to
 *     ExtraView instances, or null if extraViewsPlugins was null or empty.
 *     Implementations should use unquoted names so that the Closure Compiler
 *     can shorten them (they have no meaning outside of the plugin).
 */
cm.ExtraViewsPlugin.initAll = function(frameElem, config, extraViewsPlugins) {
  var extraViews = {};
  goog.array.forEach(extraViewsPlugins || [],
    /** @param {cm.ExtraViewsPlugin} plugin The plugin to set up. */
    function(plugin) {
      goog.object.extend(
        extraViews, plugin.maybeBuildExtraViews(frameElem, config));
  });
  return extraViews;
};
