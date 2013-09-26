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


goog.require('cm.css');

function PanelViewTest() {
  cm.TestBase.call(this);
  this.setForTest_('cm.ui.document.body.offsetWidth', 500);
  this.mapDiv_ = new FakeElement('div');
  this.mapModel_ = new google.maps.MVCObject();
  this.mapModel_.set('title', 'Monster Attack 2000');
  this.mapModel_.set('layers', new google.maps.MVCArray());
  this.mapModel_.set('description',
      cm.Html.fromSanitizedHtml('A giant green monster attacked!'));
  this.mapModel_.getLayerIds = function() { return []; };
  this.mapModel_.getAllLayerIds = function() { return []; };
  this.metadataModel_ = new google.maps.MVCObject();
  this.appState_ = new cm.AppState();
  this.config_ = {
    'enable_editing': false,
    'enable_layer_filter': true
  };
}
PanelViewTest.prototype = new cm.TestBase();
registerTestSuite(PanelViewTest);

/**
 * Constructs the PanelView and returns its parent.
 * @return {Element} An element containing the new PanelView.
 * @private
 */
PanelViewTest.prototype.createView_ = function() {
  var parent = new FakeElement('div');
  this.panelView_ = new cm.PanelView(
      cm.ui.document.body, parent, this.mapDiv_, this.mapModel_,
      this.metadataModel_, this.appState_, this.config_);
  return parent;
};

/** Tests the constructor. */
PanelViewTest.prototype.testConstructor = function() {
  var parent = this.createView_();
  expectDescendantOf(parent, 'h1', withText('Monster Attack 2000'));
  expectDescendantOf(parent, withClass(cm.css.MAP_DESCRIPTION),
                     withText('A giant green monster attacked!'));
};

/** Tests the config flag that hides the map title and description. */
PanelViewTest.prototype.testConstructorHiddenHeader = function() {
  this.config_ = {
    'enable_editing': false,
    'enable_layer_filter': true,
    'hide_panel_header': true
  };
  var parent = this.createView_();
  var title = expectDescendantOf(parent, withClass(cm.css.PANEL_HEADER));
  expectEq('none', title.style.display);
  var description = expectDescendantOf(parent,
                                       withClass(cm.css.MAP_DESCRIPTION));
  expectEq('none', description.style.display);
};

/** Tests the link to reset the current view of the map. */
PanelViewTest.prototype.testResetViewLink = function() {
  var parent = this.createView_();
  var link = expectDescendantOf(parent, withText(cm.MSG_RESET_VIEW_LINK));
  this.expectLogAction(cm.Analytics.LayersPanelAction.VIEW_RESET, null);
  this.expectEvent(goog.global, cm.events.RESET_VIEW);
  cm.events.emit(link, 'click');
};

/**
 * @param {string} id A layer ID.
 * @return {google.maps.MVCObject} A trivial fake for a LayerModel.
 * @private
 */
PanelViewTest.createLayerModel_ = function(id) {
  var layerModel = new google.maps.MVCObject();
  layerModel.set('id', id);
  layerModel.isSingleSelect = function() { return false; };
  return layerModel;
};

/** Tests the constructor with two layers in the model. */
PanelViewTest.prototype.testConstructorWithLayers = function() {
  var layerModel1 = PanelViewTest.createLayerModel_('layer1');
  var layerModel2 = PanelViewTest.createLayerModel_('layer2');
  var layers = new google.maps.MVCArray([layerModel1, layerModel2]);
  this.mapModel_.set('layers', layers);

  this.expectNew_('cm.LayerEntryView', _, layerModel1, _, _, this.config_, _);
  this.expectNew_('cm.LayerEntryView', _, layerModel2, _, _, this.config_, _);
  this.createView_();
};

/**
 * Tests that events forwarded from LayerEntryViews to the PanelView
 * trigger listeners.
 */
PanelViewTest.prototype.testLayerEventsForwarded = function() {
  this.mapModel_.set('layers', new google.maps.MVCArray([
      PanelViewTest.createLayerModel_('1')
  ]));
  var layerEntry = this.expectNew_('cm.LayerEntryView', _, _, _, _,
                                   this.config_, _);
  this.createView_();

  // Set up listeners on the panel for the events that should be forwarded from
  // the layer entry views.
  var layerToggled = false;
  cm.events.listen(this.panelView_, cm.events.TOGGLE_LAYER, function() {
    layerToggled = true;
  });
  var zoomToLayer = false;
  cm.events.listen(this.panelView_, cm.events.ZOOM_TO_LAYER, function() {
    zoomToLayer = true;
  });
  var layerDeleted = false;
  cm.events.listen(goog.global, cm.events.DELETE_LAYER, function() {
    layerDeleted = true;
  });

  cm.events.emit(layerEntry, cm.events.TOGGLE_LAYER);
  expectTrue(layerToggled);
  cm.events.emit(layerEntry, cm.events.ZOOM_TO_LAYER);
  expectTrue(zoomToLayer);
  cm.events.emit(layerEntry, cm.events.DELETE_LAYER);
  expectTrue(layerDeleted);
};

/**
 * Tests that a LayerEntryView is created when a layer is added to the MapModel.
 */
PanelViewTest.prototype.testInsertLayer = function() {
  // Start with an empty layer array.
  var layers = new google.maps.MVCArray();
  this.mapModel_.set('layers', layers);
  this.createView_();

  // Append two layers to the end of the layer array.
  var layerModel1 = PanelViewTest.createLayerModel_('layer1');
  this.expectNew_('cm.LayerEntryView', _, layerModel1, _, _, this.config_, 0);
  layers.push(layerModel1);

  var layerModel2 = PanelViewTest.createLayerModel_('layer2');
  this.expectNew_('cm.LayerEntryView', _, layerModel2, _, _, this.config_, 1);
  layers.push(layerModel2);

  // Insert a layer at the beginning of the layer array.
  var layerModel3 = PanelViewTest.createLayerModel_('layer3');
  this.expectNew_('cm.LayerEntryView', _, layerModel3, _, _, this.config_, 0);
  layers.insertAt(0, layerModel3);
};

/**
 * Tests that when a layer is removed from the MapModel, its
 * LayerEntryView is destroyed.
 */
PanelViewTest.prototype.testRemoveLayer = function() {
  // Start with two layers.
  var layerModel1 = PanelViewTest.createLayerModel_('layer1');
  var layerModel2 = PanelViewTest.createLayerModel_('layer2');
  var layers = new google.maps.MVCArray([layerModel1, layerModel2]);
  this.mapModel_.set('layers', layers);
  var layerEntry1 = this.expectNew_(
      'cm.LayerEntryView', _, layerModel1, _, _, this.config_, _);
  var layerEntry2 = this.expectNew_(
      'cm.LayerEntryView', _, layerModel2, _, _, this.config_, _);
  this.createView_();

  // Remove both layers.
  expectCall(layerEntry2.dispose)();
  layers.removeAt(1);

  expectCall(layerEntry1.dispose)();
  layers.pop();

  // Check that calling pop again on the layers array does not cause errors.
  layers.pop();
};

/** Tests the placement of the layers panel when it is opened. */
PanelViewTest.prototype.testPanelOpen = function() {
  var parent = this.createView_();
  var scroll = expectDescendantOf(parent, withClass('cm-panel-scroll'));

  parent.offsetWidth = 49;
  this.panelView_.setMaxHeight(500);
  this.panelView_.scrollTop_.offsetTop = 100;  // for positionPanelScroll_

  cm.events.emit(parent, 'panelopen');
  expectEq(cm.css.OPEN, parent.className);
  expectEq(Math.round((500 - 49) / 2) + 'px', parent.style.left);
  expectEq('400px', scroll.style.maxHeight);

  // And if the container is wider than the body...
  parent.offsetWidth = 502;
  cm.events.emit(parent, 'panelopen');
  expectEq('0px', parent.style.left);
};

/** Tests that the panel disappears when it is closed. */
PanelViewTest.prototype.testPanelClose = function() {
  var parent = this.createView_();

  cm.events.emit(parent, 'panelclose');
  expectEq('', parent.className);
  expectEq('auto', parent.style.left);
};

/** Tests clicking the close button. */
PanelViewTest.prototype.testCloseButtonCallback = function() {
  var parent = this.createView_();
  expectEq('', parent.className);
  expectThat(parent.style.left, isUndefined);

  var button = expectDescendantOf(parent, withClass(cm.css.CLOSE_BUTTON));
  cm.events.emit(button, 'click');
  expectEq('', parent.className);
  expectEq('auto', parent.style.left);
};

/** Tests clicking on the panel collapse/expand button. */
PanelViewTest.prototype.testCollapseAndExpand = function() {
  var parent = this.createView_();

  var button = expectDescendantOf(parent, withClass(cm.css.COLLAPSE));
  this.expectLogAction(
      cm.Analytics.LayersPanelAction.PANEL_TOGGLED_CLOSED, null);
  cm.events.emit(button, 'click');
  expectEq(cm.css.PANEL_COLLAPSED, cm.ui.document.body.className);

  button = expectDescendantOf(this.mapDiv_, withClass(cm.css.EXPAND));
  this.expectLogAction(
      cm.Analytics.LayersPanelAction.PANEL_TOGGLED_OPEN, null);
  cm.events.emit(button, 'click');
  expectEq('', cm.ui.document.body.className);
};

/** Tests that map title changes propagate to document title changes. */
PanelViewTest.prototype.testUpdateTitle = function() {
  var parent = this.createView_();
  expectDescendantOf(parent, 'h1', withText('Monster Attack 2000'));
  this.panelView_.model_.set('title', 'New Title');
  expectDescendantOf(parent, 'h1', withText('New Title'));
  expectEq('New Title', cm.ui.document.title);
};

/**
 * Tests the binding between the AppState's query and the layer filter's
 * input value.
 */
PanelViewTest.prototype.testFilterLayers = function() {
  var parent = this.createView_();
  var query = 'some query';
  var newQuery = 'something else';
  var layerFilterInput = findDescendantOf(parent,
    withClass(cm.css.LAYER_FILTER));

  // Test two-way binding: when appState changes, input box value changes.
  this.appState_.setFilterQuery(query);
  expectEq(query, layerFilterInput.value);

  // But only activates once since in practice, this should only happen on
  // page load.
  this.appState_.setFilterQuery(newQuery);
  expectEq(query, layerFilterInput.value);

  // Test that when the input box changes, the app state changes.
  // However, since the Presenter acts as a proxy for the
  // FILTER_QUERY_CHANGED event, we test that that event is fired on the
  // panel view and trust the presenter to update the app state.
  layerFilterInput.value = query;
  cm.events.listen(this.panelView_, cm.events.FILTER_QUERY_CHANGED,
    function(event) {
      newQuery = event.query;
  });
  cm.events.emit(layerFilterInput, 'input');
  expectEq(newQuery, query);
};

/** Tests that the layer filter is controlled by the config variable. */
PanelViewTest.prototype.testFilterLayersDisabled = function() {
  this.config_ = {'enable_layer_filter': false};
  var parent = this.createView_();
  expectNoDescendantOf(parent, withClass(cm.css.LAYER_FILTER));
};

/**
 * Tests that the set default view link is not shown by default (because
 * enable_editing is false).
 */
PanelViewTest.prototype.testSetDefaultViewHidden = function() {
  var parent = this.createView_();
  var link = expectNoDescendantOf(parent,
      withText('Set current view as default'));
};

/**
 * Test that the set default view link is shown when enable_editing is true, and
 * fires the appropriate event.
 */
PanelViewTest.prototype.testSetDefaultView = function() {
  this.config_['enable_editing'] = true;
  var parent = this.createView_();
  var link = expectDescendantOf(parent,
      withText('Set current view as default'));

  var event = undefined;
  cm.events.listen(goog.global, cm.events.DEFAULT_VIEW_SET, function(e) {
    event = e;
  });
  cm.events.emit(link, 'click', {});
  expectThat(event.oldDefault, not(isUndefined));
  expectThat(event.newDefault, not(isUndefined));
};
