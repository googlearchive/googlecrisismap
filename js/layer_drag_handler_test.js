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

function LayerDragHandlerTest() {
  cm.TestBase.call(this);

  this.setForTest_('goog.math.Rect.prototype.equals', function(other) {
    return other && other.x === this.x && other.y === this.y &&
        other.h === this.h && other.w === this.w;
  });
  this.setForTest_('goog.style.getBounds', createMockFunction());
  this.setForTest_('goog.style.getMarginBox', createMockFunction());
  this.setForTest_('goog.style.setPosition', function() { return null; });
  this.setForTest_('goog.style.getSize',
      function() { return {'width': 0, 'height': 0}; });

  this.cloneElem_ = new FakeElement('span', {'class': cm.css.DRAGGED_CLONE});
  this.layerListElem_ =
      new FakeElement('div', {'class': cm.css.ARRANGER_INNER});
  var container = new FakeElement('div', {'class': cm.css.ARRANGER});
  container.appendChild(this.layerListElem_);

  this.draggableElements_ = [];
  this.draggers_ = [];
  var layer, spec;

  // Build a list of fake draggable nested layers with the following hierarchy:
  // > layer0           (empty folder)
  //   layer1           (plain layer)
  // > layer2           (folder)
  //   > layer4         (folder)
  //       layer5       (plain layer)
  //     > layer6       (empty folder)
  //   layer3           (plain layer)

  // Top-level draggable elements.
  this.layerSpecs_ = [
    {'parent': this.layerListElem_, 'id': 'layer0', 'title': 'Layer 0',
     'isFolder': true, 'bounds': new goog.math.Rect(500, 100, 100, 20)},
    {'parent': this.layerListElem_, 'id': 'layer1', 'title': 'Layer 1',
     'isFolder': false, 'bounds': new goog.math.Rect(500, 200, 100, 20)},
    {'parent': this.layerListElem_, 'id': 'layer2', 'title': 'Layer 2',
     'isFolder': true, 'bounds': new goog.math.Rect(500, 300, 100, 20)},
    {'parent': this.layerListElem_, 'id': 'layer3', 'title': 'Layer 3',
     'isFolder': false, 'bounds': new goog.math.Rect(500, 700, 100, 20)}
  ];
  // Create fake layers and folders and set up expectations.
  // Top-level layers.
  goog.array.forEach(this.layerSpecs_, function(spec) {
    layer = this.createDraggableLayer_(spec['parent'], spec['id'],
                                       spec['title'], spec['isFolder']);
    this.draggableElements_.push(layer);
    this.draggers_.push(this.expectNew_('goog.fx.Dragger', layer, _));
  }, this);
  // Nested layers.
  var layer2Sublayers = this.draggableElements_[2].childNodes[1];
  spec = {'parent': layer2Sublayers, 'id': 'layer4', 'title': 'Layer 4',
          'isFolder': true,
          'bounds': new goog.math.Rect(500, 400, 100, 20)};
  var layer4 = this.createDraggableLayer_(spec['parent'], spec['id'],
                                          spec['title'], spec['isFolder']);
  this.draggableElements_.push(layer4);
  this.draggers_.push(this.expectNew_('goog.fx.Dragger', layer4, _));
  this.layerSpecs_.push(spec);

  var layer4Sublayers = layer4.childNodes[1];
  spec = {'parent': layer4Sublayers, 'id': 'layer5', 'title': 'Layer 5',
          'isFolder': false,
          'bounds': new goog.math.Rect(500, 500, 100, 20)};
  var layer5 = this.createDraggableLayer_(spec['parent'], spec['id'],
                                          spec['title'], spec['isFolder']);
  this.draggableElements_.push(layer5);
  this.draggers_.push(this.expectNew_('goog.fx.Dragger', layer5, _));
  this.layerSpecs_.push(spec);

  spec = {'parent': layer4Sublayers, 'id': 'layer6', 'title': 'Layer 6',
          'isFolder': true,
          'bounds': new goog.math.Rect(500, 600, 100, 20)};
  var layer6 = this.createDraggableLayer_(spec['parent'], spec['id'],
                                          spec['title'], spec['isFolder']);
  this.draggableElements_.push(layer6);
  this.draggers_.push(this.expectNew_('goog.fx.Dragger', layer6, _));
  this.layerSpecs_.push(spec);

  // Call this after this.expectNew_() has been called on 'goog.fx.Dragger'
  this.setForTest_('goog.fx.Dragger.EventType',
                   {START: 'START', DRAG: 'DRAG', END: 'END'});

}
LayerDragHandlerTest.prototype = new cm.TestBase();
registerTestSuite(LayerDragHandlerTest);

/**
 * @param {Element} parentElem The element to whose child list the draggable.
 *   layer element should be appended.
 * @param {string} id The layer ID.
 * @param {string} title The layer title (useful for debugging).
 * @param {boolean} isFolder True if this element should have sublayers.
 * @return {Element} The new draggable layer element.
 * @private
 */
LayerDragHandlerTest.prototype.createDraggableLayer_ = function(
    parentElem, id, title, isFolder) {
  var elem = cm.ui.create('div', {'class': cm.css.DRAGGABLE_LAYER, 'id': id},
      cm.ui.create('span', {'class': cm.css.DRAGGABLE_LAYER_TITLE}, title));
  if (isFolder) {
    elem.appendChild(new FakeElement(
        'div', {'class': cm.css.DRAGGABLE_SUBLAYER_CONTAINER}));
  }
  parentElem.appendChild(elem);
  return elem;
};

/**
 * Returns the index into the element's sibling array where the
 * element appears.
 * @param {Element} element The element.
 * @return {number} The index into the element's sibling array.
 * @private
 */
LayerDragHandlerTest.prototype.siblingIndexOf_ = function(element) {
  return goog.array.findIndex(element.parentNode.childNodes, function(elem) {
    return elem === element;
  });
};

/**
 * @param {number} index An index into the layer specs indicating
 *     which element to start dragging.
 * @private
 */
LayerDragHandlerTest.prototype.expectDragStart_ = function(index) {
  var draggedElem = this.draggableElements_[index];
  var titleElem = draggedElem.firstChild;
  var cloneElem = this.cloneElem_;
  titleElem.cloneNode = function() { return cloneElem; };

  // Bounds of dragged element and inner and outer arranger elements.
  stub(goog.style.getBounds)(draggedElem).is(this.layerSpecs_[index].bounds);
  var bounds = new goog.math.Rect(100, 0, 1000, 1000);
  stub(goog.style.getBounds)(draggedElem.parentNode).is(bounds);
  stub(goog.style.getBounds)(draggedElem.parentNode.parentNode).is(bounds);
  // Cursor clone offset.
  this.cloneOffset_ = this.expectNew_('goog.math.Coordinate', _, _);
  // Dragger limits.
  var dragger = this.draggers_[index];
  this.limits_ = new goog.math.Rect(0, 0, 1100, 1000);
  expectCall(dragger.setLimits)(this.limits_);
  // Fake limits member, since there is no getter for goog.fx.Dragger
  dragger.limits = this.limits_;
};

/**
 * Sets up expectations for computeDropTarget_() to return the target element
 * specified by the given index. If the index is negative, no calls to
 * computeDropTarget_() are expected, and the drag point coordinates
 * are just set to (xOffset, yOffset)
 * @param {number} targetIndex An index into the fake layer specs.
 * @param {number} xOffset The horizontal offset from the target
 *     element's upper left corner.
 * @param {number} yOffset The vertical offset from the target
 *     element's upper left corner.
 * @private
 */
LayerDragHandlerTest.prototype.expectComputeDropTarget_ = function(
    targetIndex, xOffset, yOffset) {
  for (var i = 0; i <= targetIndex; i++) {
    stub(goog.style.getBounds)(this.draggableElements_[i].firstChild)
        .is(this.layerSpecs_[i]['bounds']);
  }
  this.expectNew_('goog.math.Coordinate', _, _);
  this.dragPoint_ = this.expectNew_('goog.math.Coordinate', _, _);
  if (targetIndex >= 0) {
    this.dragPoint_.x = this.layerSpecs_[targetIndex]['bounds'].left + xOffset;
    this.dragPoint_.y = this.layerSpecs_[targetIndex]['bounds'].top + yOffset;
    stub(goog.style.getMarginBox)(_).is(new goog.math.Box(10, 10, 10, 10));
  } else {
    this.dragPoint_.x = xOffset;
    this.dragPoint_.y = yOffset;
  }
};

/**
 * Tests the drag start handler.
 */
LayerDragHandlerTest.prototype.testStartHandler = function() {
  new cm.LayerDragHandler(this.layerListElem_, this.draggableElements_);
  var event = {'clientX': 0, 'clientY': 0};

  // Emit the start event on layer0.
  this.expectDragStart_(0);
  var draggedElem = this.draggableElements_[0];
  var dragger = this.draggers_[0];
  cm.events.emit(dragger, goog.fx.Dragger.EventType.START, event);

  // Verify the expected element is active.
  expectEq(draggedElem, findDescendantOf(
      this.layerListElem_, withClass(cm.css.ACTIVE_DRAGGABLE_LAYER)));
  // Verify the clone is added to the DOM.
  expectEq(this.cloneElem_, findDescendantOf(
      cm.ui.document.body, withClass(cm.css.DRAGGED_CLONE)));
};

/**
 * Tests the drag handler when the drag point is within the dragger
 * limits and the computed drop target is legal or illegal for the
 * dragged element.
 */
LayerDragHandlerTest.prototype.testDragHandlerInLimits = function() {
  var handler = new cm.LayerDragHandler(
      this.layerListElem_, this.draggableElements_);
  var event = {'clientX': 50, 'clientY': 50};

  // Emit the start event on layer1.
  this.expectDragStart_(1);
  var dragger = this.draggers_[1];
  cm.events.emit(dragger, goog.fx.Dragger.EventType.START, event);

  // Verify the target line is not in the DOM.
  expectNoDescendantOf(this.layerListElem_, withClass(cm.css.DROP_TARGET_LINE));

  // Set drag point to be within layer0's bounds (a legal target).
  this.expectComputeDropTarget_(0, 5, 5);

  // Emit the drag event.
  cm.events.emit(dragger, goog.fx.Dragger.EventType.DRAG, event);

  // Verify the target line has been added to the DOM.
  expectDescendantOf(this.layerListElem_, withClass(cm.css.DROP_TARGET_LINE));

  // Now set the drag point to be within layer1's bounds (an illegal target).
  this.expectComputeDropTarget_(1, 5, 5);

  // Emit the drag event.
  cm.events.emit(dragger, goog.fx.Dragger.EventType.DRAG, event);

  // Verify the target line has been removed.
  expectNoDescendantOf(this.layerListElem_, withClass(cm.css.DROP_TARGET_LINE));
};

/**
 * Tests the drag handler when the drag point is within the limits but
 * a null target is returned.
 */
LayerDragHandlerTest.prototype.testDragHandlerInLimitsAndNull = function() {
  var handler = new cm.LayerDragHandler(
      this.layerListElem_, this.draggableElements_);
  var event = {'clientX': 50, 'clientY': 50};

  // Emit the start event on layer0.
  this.expectDragStart_(0);
  var dragger = this.draggers_[0];
  cm.events.emit(dragger, goog.fx.Dragger.EventType.START, event);

  // Set drag point to be within layer1's bounds (a legal target).
  this.expectComputeDropTarget_(1, 5, 5);

  // Emit the drag event.
  cm.events.emit(dragger, goog.fx.Dragger.EventType.DRAG, event);

  // Verify the target line has been added to the DOM.
  var targetLine = findDescendantOf(this.layerListElem_,
                                    withClass(cm.css.DROP_TARGET_LINE));
  expectThat(targetLine, not(isNull));
  var targetParent = targetLine.parentNode;
  var targetIndex = this.siblingIndexOf_(targetLine);

  // Set drag point to be within dragger limits but outside of any
  // layer's bounds.
  this.expectComputeDropTarget_(this.layerSpecs_.length - 1, 400, 300);

  // Emit the drag event.
  cm.events.emit(dragger, goog.fx.Dragger.EventType.DRAG, event);

  // Verify that the target line was not moved or removed.
  expectEq(targetLine, findDescendantOf(
      this.layerListElem_, withClass(cm.css.DROP_TARGET_LINE)));
  expectEq(targetParent, targetLine.parentNode);
  expectEq(targetIndex, this.siblingIndexOf_(targetLine));
};

/**
 * Tests the drag handler when the drag point leaves the dragger limits.
 */
LayerDragHandlerTest.prototype.testDragHandlerOutsideLimits = function() {
  var handler = new cm.LayerDragHandler(
      this.layerListElem_, this.draggableElements_);
  var event = {'clientX': 50, 'clientY': 50};

  // Emit the start event on layer0.
  this.expectDragStart_(0);
  var dragger = this.draggers_[0];
  cm.events.emit(dragger, goog.fx.Dragger.EventType.START, event);

  // Set drag point to be withinlayer1's bounds (a legal target).
  this.expectComputeDropTarget_(1, 5, 5);

  // Emit the drag event.
  cm.events.emit(dragger, goog.fx.Dragger.EventType.DRAG, event);

  // Verify the target line has been added to the DOM.
  expectDescendantOf(this.layerListElem_, withClass(cm.css.DROP_TARGET_LINE));

  // Set drag point to be outside the dragger limits.
this.expectComputeDropTarget_(-1, 2000, 2000);

  // Emit the drag event.
  cm.events.emit(dragger, goog.fx.Dragger.EventType.DRAG, event);

  // Verify the target line has been removed.
  expectNoDescendantOf(this.layerListElem_, withClass(cm.css.DROP_TARGET_LINE));
};

/**
 * Tests the drag end handler.
 *
 * TODO(romano): Currently our DOM fake does not support the goog.dom.*
 * functions that are used by the drag handler's helper functions, so
 * we cannot easily verify that the element was moved. This test
 * should verify that the dragged element was moved, and another test
 * should verify that when the event has dragCanceled set, the dragged
 * element is not moved.
 */
LayerDragHandlerTest.prototype.testEndHandler = function() {
  var handler = new cm.LayerDragHandler(
      this.layerListElem_, this.draggableElements_);
  var event = {'clientX': 50, 'clientY': 50};

  // Emit the start event on layer0.
  this.expectDragStart_(0);
  var dragger = this.draggers_[0];
  cm.events.emit(dragger, goog.fx.Dragger.EventType.START, event);

  // Verify the expected element is active.
  expectEq(this.draggableElements_[0], findDescendantOf(
      this.layerListElem_, withClass(cm.css.ACTIVE_DRAGGABLE_LAYER)));
  // Verify the clone is added to the DOM.
  expectEq(this.cloneElem_, findDescendantOf(
      cm.ui.document.body, withClass(cm.css.DRAGGED_CLONE)));

  // Set drag point to be within layer1's bounds (a legal target).
  this.expectComputeDropTarget_(1, 5, 5);

  // Emit the drag event.
  cm.events.emit(dragger, goog.fx.Dragger.EventType.DRAG, event);

  // Verify the target line has been added to the DOM.
  expectDescendantOf(this.layerListElem_, withClass(cm.css.DROP_TARGET_LINE));

  // Emit the end event.
  cm.events.emit(dragger, goog.fx.Dragger.EventType.END, event);

  // Verify there is no longer an active element, and the target line
  // and clone are removed from the DOM.
  expectNoDescendantOf(this.layerListElem_,
                       withClass(cm.css.ACTIVE_DRAGGABLE_LAYER));
  expectNoDescendantOf(this.layerListElem_, withClass(cm.css.DRAGGED_CLONER));
  expectNoDescendantOf(this.layerListElem_, withClass(cm.css.DROP_TARGET_LINE));
};


/**
 * Tests the computation of drop targets from the drag point.
 * This test is ugly in that it reaches in to inspect the handler's
 * private currentDropTarget_ member.
 */
LayerDragHandlerTest.prototype.testComputeDropTarget = function() {
  var handler = new cm.LayerDragHandler(
      this.layerListElem_, this.draggableElements_);
  var event = {'clientX': 50, 'clientY': 50};

  // Drag layer 3.
  this.expectDragStart_(3);
  var dragger = this.draggers_[3];
  var draggedElem = this.draggableElements_[3];
  cm.events.emit(dragger, goog.fx.Dragger.EventType.START, event);

  // When the drag point is in the top half of layer0 (the first
  // top-level layer or folder)...
  this.expectComputeDropTarget_(0, 5, 5);
  var dropTarget = cm.LayerDragHandler.computeDropTarget_(
      this.dragPoint_, dragger, draggedElem, this.draggableElements_);
  // ...the drop target is layer0's previous sibling.
  expectEq(this.draggableElements_[0], dropTarget.target);
  expectEq(cm.LayerDragHandler.TargetRelation.PREVIOUS_SIBLING,
           dropTarget.relation);

  // When the drag point is in the bottom half of layer0 (an empty folder) and
  // and is not indented....
  this.expectComputeDropTarget_(0, 5, 25);
  dropTarget = cm.LayerDragHandler.computeDropTarget_(
      this.dragPoint_, dragger, draggedElem, this.draggableElements_);
  // ...the drop target is layer0's next sibling.
  expectEq(this.draggableElements_[0], dropTarget.target);
  expectEq(cm.LayerDragHandler.TargetRelation.NEXT_SIBLING,
           dropTarget.relation);

  // When the drag point is in the bottom half layer0 (an empty folder) and
  // is indented...
  this.expectComputeDropTarget_(0, 20, 25);
  dropTarget = cm.LayerDragHandler.computeDropTarget_(
      this.dragPoint_, dragger, draggedElem, this.draggableElements_);
  // ...the drop target is layer0's child.
  expectEq(this.draggableElements_[0], dropTarget.target);
  expectEq(cm.LayerDragHandler.TargetRelation.CHILD, dropTarget.relation);

  // When the drag point is in the bottom half of layer2, a non-empty folder,
  // and is not indented...
  this.expectComputeDropTarget_(2, 5, 25);
  dropTarget = cm.LayerDragHandler.computeDropTarget_(
      this.dragPoint_, dragger, draggedElem, this.draggableElements_);
  // ...the drop target is the previous sibling of layer2's first
  // child, layer4.
  expectEq(this.draggableElements_[4], dropTarget.target);
  expectEq(cm.LayerDragHandler.TargetRelation.PREVIOUS_SIBLING,
           dropTarget.relation);

  // When the drag point is in the bottom half of layer1 (a plain layer)...
  this.expectComputeDropTarget_(1, 5, 25);
  dropTarget = cm.LayerDragHandler.computeDropTarget_(
      this.dragPoint_, dragger, draggedElem, this.draggableElements_);
  // ...the drop target is layer1's next sibling.
  expectEq(this.draggableElements_[1], dropTarget.target);
  expectEq(cm.LayerDragHandler.TargetRelation.NEXT_SIBLING,
           dropTarget.relation);

  // Outdenting behaviors.
  // When the drag point is in the bottom half of layer6 (a folder that
  // is the last of its siblings, and is indented)...
  this.expectComputeDropTarget_(6, 20, 25);
  dropTarget = cm.LayerDragHandler.computeDropTarget_(
      this.dragPoint_, dragger, draggedElem, this.draggableElements_);
  // ...the drop target is the child of layer6.
  expectEq(this.draggableElements_[6], dropTarget.target);
  expectEq(cm.LayerDragHandler.TargetRelation.CHILD, dropTarget.relation);

  // When the drag point is in the bottom halfof a layer6 (a folder that is
  // the last of its siblings) and is not indented...
  this.expectComputeDropTarget_(6, 5, 25);
  dropTarget = cm.LayerDragHandler.computeDropTarget_(
      this.dragPoint_, dragger, draggedElem, this.draggableElements_);
  // ...the drop target is the next sibling of layer6.
  expectEq(this.draggableElements_[6], dropTarget.target);
  expectEq(cm.LayerDragHandler.TargetRelation.NEXT_SIBLING,
           dropTarget.relation);

  // TODO(romano): Figure out why the expectations on parent elements
  // don't work below.
  /*
  // When the drag point is in the bottom half of layer6 (a folder
  // that is the last of its siblings) and is outdented 1 level...
  this.expectComputeDropTarget_(6, -11, 25);
  // Expect an extra call to getBounds on layer4.
  expectCall(goog.style.getBounds)(this.draggableElements_[4].firstChild)
      .willOnce(returnWith(this.layerSpecs_[4]['bounds']));
  dropTarget = cm.LayerDragHandler.computeDropTarget_(
      this.dragPoint_, dragger, draggedElem, this.draggableElements_);
  // ...the drop target is the next sibling of layer4.
  expectEq(this.draggableElements_[4], dropTarget.target);
  expectEq(cm.LayerDragHandler.TargetRelation.NEXT_SIBLING,
           dropTarget.relation);
  */
};
