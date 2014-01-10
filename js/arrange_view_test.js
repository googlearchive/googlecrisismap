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

// Author: romano@google.com (Raquel Romano)

goog.require('cm.css');

function ArrangeViewTest() {
  cm.TestBase.call(this);

  this.arrangerElem_ = new FakeElement('div');
  this.panelElem_ = new FakeElement('div', {'class': cm.css.PANEL});
  this.mapModel_ = new google.maps.MVCObject();
  this.mapModel_.set('layers', new google.maps.MVCArray());
  this.appState_ = createMockInstance(cm.AppState);
}
ArrangeViewTest.prototype = new cm.TestBase();
registerTestSuite(ArrangeViewTest);

/**
 * Constructs the ArrangeView and returns the arranger element.
 * @param {boolean=} opt_useTabPanel If true, apply tab panel layout
 *     rules to the arranger.
 * @private
 */
ArrangeViewTest.prototype.createView_ = function(opt_useTabPanel) {
  this.arrangeView_ = new cm.ArrangeView(
      this.arrangerElem_, this.panelElem_, this.appState_, this.mapModel_,
      !!opt_useTabPanel);
};

/**
 * @param {string} id The layer ID.
 * @return {google.maps.MVCObject} A trivial fake for a LayerModel.
 * @private
 */
ArrangeViewTest.createLayerModel_ = function(id) {
  var layerModel = new google.maps.MVCObject();
  layerModel.set('id', id);
  layerModel.set('sublayers', new google.maps.MVCArray());
  return layerModel;
};

/** Tests the constructor. */
ArrangeViewTest.prototype.testConstructor = function() {
  // Add layers to the model.
  var layerModel1 = ArrangeViewTest.createLayerModel_('layer1');
  var layerModel2 = ArrangeViewTest.createLayerModel_('layer2');
  var layers = new google.maps.MVCArray([layerModel1, layerModel2]);
  this.mapModel_.set('layers', layers);

  this.createView_();
  expectDescendantOf(this.arrangerElem_, withClass(cm.css.BUTTON),
      withText(cm.MSG_OK));
  expectDescendantOf(this.arrangerElem_, withClass(cm.css.BUTTON),
      withText(cm.MSG_CANCEL));
  expectDescendantOf(this.arrangerElem_, withClass(cm.css.ARRANGER_INNER));

  // The arranger element should be empty until the ARRANGE event is fired.
  expectNoDescendantOf(this.arrangerElem_, withClass(cm.css.DRAGGABLE_LAYER));
};

/**
 * Tests that open() creates the draggable layers (untabbed UI).
 */
ArrangeViewTest.prototype.testArrangeEvent = function() {
  // Add layers to the model.
  var layerModel1 = ArrangeViewTest.createLayerModel_('layer1');
  var layerModel2 = ArrangeViewTest.createLayerModel_('layer2');
  var layers = new google.maps.MVCArray([layerModel1, layerModel2]);
  this.mapModel_.set('layers', layers);

  this.createView_();
  var layerListElem = expectDescendantOf(this.arrangerElem_,
                                         withClass(cm.css.ARRANGER_INNER));
  this.layerDragHandler_ = this.expectNew_('cm.LayerDragHandler',
                                           layerListElem, _);

  // When arranger is opened, draggable layers are created and the arranger
  // replaces the layers panel.
  expectThat(this.arrangerElem_, withClass(cm.css.HIDDEN));
  expectThat(this.panelElem_, not(withClass(cm.css.HIDDEN)));
  this.arrangeView_.open();
  expectThat(this.arrangerElem_, not(withClass(cm.css.HIDDEN)));
  expectThat(this.panelElem_, withClass(cm.css.HIDDEN));
  expectDescendantOf(layerListElem, withClass(cm.css.DRAGGABLE_LAYER),
                     withId('layer1'));
  expectDescendantOf(layerListElem, withClass(cm.css.DRAGGABLE_LAYER),
                     withId('layer2'));
};

/**
 * Tests that open() creates a popup in the tabbed UI.
 */
ArrangeViewTest.prototype.testArrangePopup = function() {
  // Add layers to the model.
  this.createView_(true);

  // When arranger is opened, the arranger popup should be added to the DOM.
  expectNoDescendantOf(cm.ui.document.body, withClass(cm.css.ARRANGER_POPUP));
  this.arrangeView_.open();
  expectDescendantOf(cm.ui.document.body, withClass(cm.css.ARRANGER_POPUP));

  // When the arranger is closed, the arranger popup should be removed.
  var button = expectDescendantOf(this.arrangerElem_, withClass(cm.css.BUTTON),
                                  withText(cm.MSG_CANCEL));
  cm.events.emit(button, 'click');
  expectNoDescendantOf(cm.ui.document.body, withClass(cm.css.ARRANGER_POPUP));
};

/**
 * Tests the OK button handler.
 */
ArrangeViewTest.prototype.testOKHandler = function() {
  // Add layers to the model.
  var layerModel1 = ArrangeViewTest.createLayerModel_('layer1');
  var layerModel2 = ArrangeViewTest.createLayerModel_('layer2');
  var layers = new google.maps.MVCArray([layerModel1, layerModel2]);
  this.mapModel_.set('layers', layers);

  this.createView_();
  var layerListElem = expectDescendantOf(this.arrangerElem_,
                                         withClass(cm.css.ARRANGER_INNER));
  this.layerDragHandler_ = this.expectNew_(
      'cm.LayerDragHandler', layerListElem, _);
  expectCall(this.layerDragHandler_.dispose)();

  // Open the arranger and then switch the layer order.
  this.arrangeView_.open();
  var draggableLayer1 = expectDescendantOf(layerListElem, withId('layer1'));
  var draggableLayer2 = expectDescendantOf(layerListElem, withId('layer2'));
  layerListElem.removeChild(draggableLayer1);
  layerListElem.appendChild(draggableLayer1);

  // Listen for LAYERS_ARRANGED to be emitted by the OK handler.
  var oldOrdering = [];
  var newOrdering = [];
  cm.events.listen(goog.global, cm.events.LAYERS_ARRANGED, function(e) {
    oldOrdering = e.oldValue;
    newOrdering = e.newValue;
  });

  // When OK is clicked, the draggable layers are destroyed and the layers panel
  // replaces arranger.
  var button = expectDescendantOf(this.arrangerElem_, withClass(cm.css.BUTTON),
                                  withText(cm.MSG_OK));
  cm.events.emit(button, 'click');
  expectThat(this.arrangerElem_, withClass(cm.css.HIDDEN));
  expectThat(this.panelElem_, not(withClass(cm.css.HIDDEN)));
  expectNoDescendantOf(layerListElem, withClass(cm.css.DRAGGABLE_LAYER));

  // Verify the event fired properly.
  expectEq([{id: 'layer1', sublayerIds: []}, {id: 'layer2', sublayerIds: []}],
           oldOrdering);
  expectEq([{id: 'layer2', sublayerIds: []}, {id: 'layer1', sublayerIds: []}],
           newOrdering);
};

/**
 * Tests the Cancel button handler.
 */
ArrangeViewTest.prototype.testCancelHandler = function() {
  // Add layers to the model.
  var layerModel1 = ArrangeViewTest.createLayerModel_('layer1');
  var layerModel2 = ArrangeViewTest.createLayerModel_('layer2');
  var layers = new google.maps.MVCArray([layerModel1, layerModel2]);
  this.mapModel_.set('layers', layers);

  this.createView_();
  var layerListElem = expectDescendantOf(this.arrangerElem_,
                                         withClass(cm.css.ARRANGER_INNER));
  this.layerDragHandler_ = this.expectNew_('cm.LayerDragHandler',
                                           layerListElem, _);
  expectCall(this.layerDragHandler_.dispose)();

  // Open the arranger and then switch the layer order.
  this.arrangeView_.open();
  var draggableLayer1 = expectDescendantOf(layerListElem, withId('layer1'));
  var draggableLayer2 = expectDescendantOf(layerListElem, withId('layer2'));
  layerListElem.removeChild(draggableLayer1);
  layerListElem.appendChild(draggableLayer1);

  // Verify that LAYERS_ARRANGED is never fired.
  var layersArranged = false;
  var token = cm.events.listen(goog.global, cm.events.LAYERS_ARRANGED,
                               function(e) {
    layersArranged = true;
  });

  // When Cancel is clicked, the draggable layers are destroyed and the layers
  // panel replaces arranger, but the layers are not rearranged.
  var button = expectDescendantOf(this.arrangerElem_, withClass(cm.css.BUTTON),
                                  withText(cm.MSG_CANCEL));
  cm.events.emit(button, 'click');
  expectThat(this.arrangerElem_, withClass(cm.css.HIDDEN));
  expectThat(this.panelElem_, not(withClass(cm.css.HIDDEN)));
  expectNoDescendantOf(layerListElem, withClass(cm.css.DRAGGABLE_LAYER));
  expectFalse(layersArranged);

  // Clean up the event listener.
  cm.events.unlisten(token);
};

/**
 * Tests the OK handler when the map has nested folders.
 */
ArrangeViewTest.prototype.testOKHandlerNestedFolders = function() {
  // Add layers to the model.
  var layerModel1 = ArrangeViewTest.createLayerModel_('layer1');
  var layerModel2 = ArrangeViewTest.createLayerModel_('layer2');
  layerModel1.set('type', cm.LayerModel.Type.FOLDER);
  layerModel1.set('sublayers', new google.maps.MVCArray([layerModel2]));
  var layers = new google.maps.MVCArray([layerModel1]);
  this.mapModel_.set('layers', layers);

  this.createView_();
  var layerListElem = expectDescendantOf(this.arrangerElem_,
                                         withClass(cm.css.ARRANGER_INNER));
  this.layerDragHandler_ = this.expectNew_('cm.LayerDragHandler',
                                           layerListElem, _);
  expectCall(this.layerDragHandler_.dispose)();

  // Open the arranger and then rearrange the layers.
  this.arrangeView_.open();
  var draggableLayer1 = expectDescendantOf(layerListElem, withId('layer1'));
  var draggableLayer2 = expectDescendantOf(draggableLayer1, withId('layer2'));
  var sublayerContainer = expectDescendantOf(
      draggableLayer1, withClass(cm.css.DRAGGABLE_SUBLAYER_CONTAINER));
  sublayerContainer.removeChild(draggableLayer2);
  layerListElem.appendChild(draggableLayer2);

  // Listen for LAYERS_ARRANGED to be emitted by the OK handler.
  var oldOrdering = [];
  var newOrdering = [];
  cm.events.listen(goog.global, cm.events.LAYERS_ARRANGED, function(e) {
    oldOrdering = e.oldValue;
    newOrdering = e.newValue;
  });

  // Click OK and verify the event fired properly.
  var button = expectDescendantOf(this.arrangerElem_, withClass(cm.css.BUTTON),
                                  withText(cm.MSG_OK));
  cm.events.emit(button, 'click');

  expectEq([{id: 'layer1', sublayerIds: [{id: 'layer2', sublayerIds: []}]}],
           oldOrdering);
  expectEq([{id: 'layer1', sublayerIds: []}, {id: 'layer2', sublayerIds: []}],
           newOrdering);
};
