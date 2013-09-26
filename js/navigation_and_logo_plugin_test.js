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
 * @type {cm.LogoViewConfig}
 * @const
 */
FAKE_LOGO_VIEW_CONFIG = {
  height: 100,
  width: 50,
  url: '//fake_image_host/fake_image.png'
};

/** @constructor */
function NavigationAndLogoPluginTest() {
  cm.TestBase.call(this);
}
NavigationAndLogoPluginTest.prototype = new cm.TestBase();
registerTestSuite(NavigationAndLogoPluginTest);

/** Verify that maybeBuildExtraViews with an empty config object is a no-op. */
NavigationAndLogoPluginTest.prototype.maybeBuildExtraViews_emptyConfig =
    function() {
  var plugin = new cm.NavigationAndLogoPlugin();
  var extraViews = plugin.maybeBuildExtraViews(cm.ui.create('div'), {});
  expectEq({}, extraViews);
};

/**
 * Verify that maybeBuildExtraViews with logo_watermark_image makes a LogoView.
 */
NavigationAndLogoPluginTest.prototype.maybeBuildExtraViews_justLogoView =
    function() {
  var plugin = new cm.NavigationAndLogoPlugin();
  var extraViews = plugin.maybeBuildExtraViews(cm.ui.create('div'),
    {logo_watermark_image: FAKE_LOGO_VIEW_CONFIG});
  expectThat(extraViews['navigation'], isUndefined);
  expectThat(extraViews['logo'], not(isUndefined));
  expectTrue(extraViews['logo'] instanceof cm.LogoView);
};

/**
 * Verify that maybeBuildExtraViews with navigation_options makes a
 * NavigationView.
 */
NavigationAndLogoPluginTest.prototype.maybeBuildExtraViews_justNavigationView =
    function() {
  var plugin = new cm.NavigationAndLogoPlugin();
  var extraViews = plugin.maybeBuildExtraViews(cm.ui.create('div'), {
      navigation_links: []
  });
  expectThat(extraViews['logo'], isUndefined);
  expectThat(extraViews['navigation'], not(isUndefined));
  expectEq(cm.NavigationView.prototype.getHeight,
           extraViews['navigation'].getHeight);
};

/**
 * Verify that maybeBuildExtraViews with navigation_options and
 * logo_watermark_image makes a NavigationView and a LogoView.
 */
NavigationAndLogoPluginTest.prototype.maybeBuildExtraViews_justNavigationView =
    function() {
  var plugin = new cm.NavigationAndLogoPlugin();
  var extraViews = plugin.maybeBuildExtraViews(cm.ui.create('div'), {
      logo_watermark_image: FAKE_LOGO_VIEW_CONFIG,
      navigation_links: []
  });
  expectThat(extraViews['logo'], not(isUndefined));
  expectThat(extraViews['navigation'], not(isUndefined));
  expectEq(cm.LogoView.prototype.getHeight, extraViews['logo'].getHeight);
  expectTrue(extraViews['navigation'] instanceof cm.NavigationView);
};

/**
 * @return {{setMaxHeight:function(?number)}} A mock PanelView that just
 *     supports setMaxHeight.
 * @private
 */
NavigationAndLogoPluginTest.prototype.makeMockPanelView_ = function() {
  var mockPanelView = {maxHeight: null};
  mockPanelView.setMaxHeight = function(height) {
    mockPanelView.maxHeight = height;
  };
  mockPanelView.getBounds = function() {
    return {height: 77};
  };
  return mockPanelView;
};

/** @private */
NavigationAndLogoPluginTest.prototype.checkClassesOnNavigationView_ = function(
      navViewElem, expectCompact, expectAboveAttribution) {
  var navElemHas = goog.partial(goog.dom.classes.has, navViewElem);
  expectEq(expectCompact, navElemHas(cm.css.NAV_COMPACT));
  expectEq(expectAboveAttribution, navElemHas(cm.css.ABOVE_ATTRIBUTION));
};

/** @private */
NavigationAndLogoPluginTest.prototype.sizeComponentsSetup_ = function() {
  this.frameElem_ = cm.ui.create('div');
  this.plugin_ = new cm.NavigationAndLogoPlugin();
  this.extraViews_ = this.plugin_.maybeBuildExtraViews(this.frameElem_, {
      logo_watermark_image: FAKE_LOGO_VIEW_CONFIG,
      navigation_links: []
  });
  this.navView_ = this.extraViews_.navigation;
  this.navViewElem_ = this.navView_.getElement();
  this.mockPanelView_ = this.makeMockPanelView_();

  this.panelViewPosition_ = {
    isPanelCollapsed: false,
    isPanelFloating: false,
    isPanelPopup: false,
    floatMaxHeight: 250
  };
};

/** @private */
NavigationAndLogoPluginTest.prototype.callSizeComponents_ = function() {
  this.plugin_.sizeComponentsWithExtraViews(
    this.frameElem_, this.mockPanelView_, this.panelViewPosition_,
    this.extraViews_);
};

/**
 * Verify that when the panel is docked on the left,
 * sizeComponentsWithExtraViews always keeps the NavigationView compact and
 * vertical, and that it leaves room for the logo. In narrow and medium widths,
 * it should also be positioned vertically to leave room for attribution text.
 */
NavigationAndLogoPluginTest.prototype.sizeComponentsWithExtraViews_leftPanel =
    function() {
  var self = this;
  var checkNavViewTopAndBottom = function() {
    var navViewElement = self.navView_.getElement();
    expectEq('110px', navViewElement.style.bottom);
    expectEq('auto', navViewElement.style.top);
  };

  this.sizeComponentsSetup_();
  this.frameElem_.setAttribute('class', cm.css.PANEL_LEFT);
  this.frameElem_.offsetWidth = 800; // wide
  this.callSizeComponents_();
  // expect !compact && vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, false);
  expectThat(this.mockPanelView_.maxHeight, isNull);
  checkNavViewTopAndBottom();

  this.frameElem_.offsetWidth = 700; // medium
  this.callSizeComponents_();
  // expect compact && vertical && aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, true);
        checkNavViewTopAndBottom();

        this.frameElem_.offsetWidth = 350; // narrow
  this.panelViewPosition_.isPanelPopup = true; // to mimic sizeComponents
  this.callSizeComponents_();
  // expect compact && vertical && aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, true);
        checkNavViewTopAndBottom();

        // check behavior with the panel collapsed
  this.panelViewPosition_.isPanelPopup = false;
  this.panelViewPosition_.isPanelCollapsed = true;

  this.frameElem_.offsetWidth = 800; // wide
  this.callSizeComponents_();
  // expect compact && vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, false);

  this.frameElem_.offsetWidth = 700; // medium
  this.callSizeComponents_();
  // expect compact && vertical && aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, true);
};

/**
 * Verify that when the panel is docked on the right,
 * sizeComponentsWithExtraViews always keeps the NavigationView compact and
 * vertical, and that it leaves room for the logo. In narrow and medium widths,
 * it should also be positioned vertically to leave room for attribution text.
 */
NavigationAndLogoPluginTest.prototype.sizeComponentsWithExtraViews_rightPanel =
function() {
  this.sizeComponentsSetup_();
  this.frameElem_.setAttribute('class', cm.css.PANEL_RIGHT);

  this.frameElem_.offsetWidth = 800; // wide
  this.callSizeComponents_();
  // expect compact && vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, false);
  expectThat(this.mockPanelView_.maxHeight, isNull);

  this.frameElem_.offsetWidth = 700; // medium
  this.callSizeComponents_();
  // expect compact && vertical && aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, true);

  this.frameElem_.offsetWidth = 350; // narrow
  this.panelViewPosition_.isPanelPopup = true; // to mimic sizeComponents
  this.callSizeComponents_();
  // expect compact && vertical && aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, true);

  // check behavior with the panel collapsed
  this.panelViewPosition_.isPanelPopup = false;
  this.panelViewPosition_.isPanelCollapsed = true;

  this.frameElem_.offsetWidth = 800; // wide
  this.callSizeComponents_();
  // expect compact && vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, false);

  this.frameElem_.offsetWidth = 700; // medium
  this.callSizeComponents_();
  // expect compact && vertical && aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, true);
};

/**
 * Verify that when the panel is floating (on the left),
 * sizeComponentsWithExtraViews puts NavigationView under the PanelView in
 * horizontal layout, and that it leaves room for the logo. In narrow and medium
 * widths, it should also be positioned vertically to leave room for attribution
 * text.
 */
NavigationAndLogoPluginTest.prototype.sizeComponentsWithExtraViews_floatPanel =
function() {
  this.sizeComponentsSetup_();
  this.frameElem_.setAttribute('class', cm.css.PANEL_LEFT);
  // Hardcoded since there is no rendering engine to determine its height
  this.navView_.getHeight = function() {
    return 38;
  };
  // maxHeight = 250px initial value from sizeComponents
  //            - 38px for navView's height
  //             - 5px for a margin between the navView and panelView
  var expectedPanelMaxHeight = 250 - 38 - 5;
  this.panelViewPosition_.isPanelFloating = true;

  this.frameElem_.offsetWidth = 800; // wide
  this.callSizeComponents_();
  // expect !compact && !vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, false, false);
  expectEq(expectedPanelMaxHeight, this.mockPanelView_.maxHeight);

  this.frameElem_.offsetWidth = 700; // medium
  this.callSizeComponents_();
  // expect !compact && !vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, false, false);
  expectEq(expectedPanelMaxHeight, this.mockPanelView_.maxHeight);

  this.frameElem_.offsetWidth = 350; // narrow
  this.panelViewPosition_.isPanelPopup = true; // to mimic sizeComponents
  this.callSizeComponents_();
  // expect compact && vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, false);

  // check behavior with the panel collapsed
  this.panelViewPosition_.isPanelPopup = false;
  this.panelViewPosition_.isPanelCollapsed = true;

  this.frameElem_.offsetWidth = 800; // wide
  this.callSizeComponents_();
  // expect compact && vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, false);

  this.frameElem_.offsetWidth = 700; // medium
  this.callSizeComponents_();
  // expect compact && vertical && !aboveAttribution
  this.checkClassesOnNavigationView_(this.navViewElem_, true, false);
};
