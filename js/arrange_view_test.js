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

  this.panelElem_ = new FakeElement('div', {'class': cm.css.PANEL});
  this.mapModel_ = new google.maps.MVCObject();
  this.mapModel_.set('layers', new google.maps.MVCArray());
  this.appState_ = createMockInstance(cm.AppState);
}
ArrangeViewTest.prototype = new cm.TestBase();
registerTestSuite(ArrangeViewTest);

/**
 * Constructs the ArrangeView and returns its parent.
 * @return {Element} An element containing the new ArrangeView.
 * @private
 */
ArrangeViewTest.prototype.createView_ = function() {
  var parent = new FakeElement('div',
                               {'class': [cm.css.ARRANGER,
                                          cm.css.HIDDEN].join(' ')});
  this.arrangeView_ = new cm.ArrangeView(
      parent, this.panelElem_, this.appState_, this.mapModel_);
  return parent;
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

  var parent = this.createView_();
  expectDescendantOf(parent, withClass(cm.css.BUTTON),
      withText(cm.MSG_OK));
  expectDescendantOf(parent, withClass(cm.css.BUTTON),
      withText(cm.MSG_CANCEL));
  expectDescendantOf(parent, 'div', withClass(cm.css.ARRANGER_INNER));

  // The arranger element should be empty until the ARRANGE event is fired.
  expectNoDescendantOf(parent, 'div', withClass(cm.css.DRAGGABLE_LAYER));
};

/**
 * Tests that open() creates the draggable layers.
 */
ArrangeViewTest.prototype.testArrangeEvent = function() {
  // Add layers to the model.
  var layerModel1 = ArrangeViewTest.createLayerModel_('layer1');
  var layerModel2 = ArrangeViewTest.createLayerModel_('layer2');
  var layers = new google.maps.MVCArray([layerModel1, layerModel2]);
  this.mapModel_.set('layers', layers);

  var parent = this.createView_();
  var layerListElem = expectDescendantOf(parent, 'div',
                                         withClass(cm.css.ARRANGER_INNER));
  this.layerDragHandler_ = this.expectNew_(
      'cm.LayerDragHandler', layerListElem, _);

  // When arranger is opened, draggable layers are created and the arranger
  // replaces the layers panel.
  this.arrangeView_.open();
  expectThat(parent, isElement('div', not(withClass(cm.css.HIDDEN))));
  expectThat(this.panelElem_, isElement('div', withClass(cm.css.HIDDEN)));
  expectDescendantOf(layerListElem, 'div', withClass(cm.css.DRAGGABLE_LAYER),
                     withId('layer1'));
  expectDescendantOf(layerListElem, 'div', withClass(cm.css.DRAGGABLE_LAYER),
                     withId('layer2'));
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

  var parent = this.createView_();
  var layerListElem = expectDescendantOf(parent, 'div',
                                         withClass(cm.css.ARRANGER_INNER));
  this.layerDragHandler_ = this.expectNew_(
      'cm.LayerDragHandler', layerListElem, _);
  expectCall(this.layerDragHandler_.dispose)();

  // Open the arranger and then switch the layer order.
  this.arrangeView_.open();
  var draggableLayer1 = expectDescendantOf(layerListElem, 'div',
                                           withId('layer1'));
  var draggableLayer2 = expectDescendantOf(layerListElem, 'div',
                                           withId('layer2'));
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
  var button = expectDescendantOf(parent, withClass(cm.css.BUTTON),
                                  withText(cm.MSG_OK));
  cm.events.emit(button, 'click');
  expectThat(parent, isElement('div', withClass(cm.css.HIDDEN)));
  expectThat(this.panelElem_, isElement('div', not(withClass(cm.css.HIDDEN))));
  expectNoDescendantOf(layerListElem, 'div', withClass(cm.css.DRAGGABLE_LAYER));

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

  var parent = this.createView_();
  var layerListElem = expectDescendantOf(
      parent, 'div', withClass(cm.css.ARRANGER_INNER));
  this.layerDragHandler_ = this.expectNew_(
      'cm.LayerDragHandler', layerListElem, _);
  expectCall(this.layerDragHandler_.dispose)();

  // Open the arranger and then switch the layer order.
  this.arrangeView_.open();
  var draggableLayer1 = expectDescendantOf(layerListElem, 'div',
                                           withId('layer1'));
  var draggableLayer2 = expectDescendantOf(layerListElem, 'div',
                                           withId('layer2'));
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
  var button = expectDescendantOf(parent, withClass(cm.css.BUTTON),
                                  withText(cm.MSG_CANCEL));
  cm.events.emit(button, 'click');
  expectThat(parent, isElement('div', withClass(cm.css.HIDDEN)));
  expectThat(this.panelElem_, isElement('div', not(withClass(cm.css.HIDDEN))));
  expectNoDescendantOf(layerListElem, 'div', withClass(cm.css.DRAGGABLE_LAYER));
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

  var parent = this.createView_();
  var layerListElem = expectDescendantOf(parent, 'div',
                                         withClass(cm.css.ARRANGER_INNER));
  this.layerDragHandler_ = this.expectNew_(
      'cm.LayerDragHandler', layerListElem, _);
  expectCall(this.layerDragHandler_.dispose)();

  // Open the arranger and then rearrange the layers.
  this.arrangeView_.open();
  var draggableLayer1 = expectDescendantOf(layerListElem, 'div',
                                           withId('layer1'));
  var draggableLayer2 = expectDescendantOf(draggableLayer1, 'div',
                                           withId('layer2'));
  var sublayerContainer = expectDescendantOf(
      draggableLayer1, 'div', withClass(cm.css.DRAGGABLE_SUBLAYER_CONTAINER));
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
  var button = expectDescendantOf(parent, withClass(cm.css.BUTTON),
                                  withText(cm.MSG_OK));
  cm.events.emit(button, 'click');

  expectEq([{id: 'layer1', sublayerIds: [{id: 'layer2', sublayerIds: []}]}],
           oldOrdering);
  expectEq([{id: 'layer1', sublayerIds: []}, {id: 'layer2', sublayerIds: []}],
           newOrdering);
};
