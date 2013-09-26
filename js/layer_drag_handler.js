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
 * @fileoverview [MODULE: edit] Drag handler for layer arranger.
 * @author romano@google.com (Raquel Romano)
 */
goog.provide('cm.LayerDragHandler');

goog.require('cm');
goog.require('cm.css');
goog.require('cm.events');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.fx.DragEvent');
goog.require('goog.fx.Dragger');
goog.require('goog.math');
goog.require('goog.style');

/**
 * Half of the indentation of each folder's sublayer list, i.e. half
 * of margin-left of a cm-draggable-sublayer-container.
 */
var HALF_INDENT = 10;

/**
 * Drag and drop behavior for the layer arranger. The layerListElem
 * is constructed by the ArrangeView, and each of its children is a
 * draggable component with the following recursive structure:
 * <div class='cm-draggable-layer'>
 *   <div class='cm-draggable-layer-title' id=id> Layer Title</div>
 *   <div class='cm-draggable-sublayer-container'>
 *     <div class='cm-draggable-layer'>...</div>
 *     <div class='cm-draggable-layer'>...</div>
 *   </div>
 * </div>
 * @param {Element} layerListElem The parent node holding the list of
 *    draggable layers and folders.
 * @param {Array.<Element>} draggableElements Flat list of the
 *    draggable elements.
 * @constructor
 */
cm.LayerDragHandler = function(layerListElem, draggableElements) {
  /**
   * The element holding the tree of draggable elements.
   * @type Element
   * @private
   */
  this.layerListElem_ = layerListElem;

  /**
   * The draggable elements.
   * @type Array.<Element>
   * @private
   */
  this.draggableElements_ = draggableElements;

  /**
   * The element currently being dragged.
   * @type Element
   * @private
   */
  this.draggedElem_;

  /**
   * A clone of the dragged element to display.
   * @type Element
   * @private
   */
  this.draggedClone_;

  /**
   * @type goog.math.Coordinate
   * @private
   */
  this.clonePosition_;

  /**
   * Offset between the cursor position and the dragged element's
   * upper-left corner.
   * @type goog.math.Coordinate
   * @private
   */
  this.cursorCloneOffset_;

  /**
   * The coordinates to use for computing the drag target.
   * @type goog.math.Coordinate
   * @private
   */
  this.dragPoint_;

  /**
   * Horizontal line used to  indicate the current drop location.
   * @type Element
   * @private
   */
  this.targetLine_ = cm.ui.create('div', {'class': cm.css.DROP_TARGET_LINE});

  /**
   * The active Dragger object.
   * @type goog.fx.Dragger
   * @private
   */
  this.dragger_;

  /**
   * The list of initialized draggers, one per draggable element.
   * @type Array.<goog.fx.Dragger>
   * @private
   */
  this.draggerList_ = [];

  /**
   * A specification of where the currently dragged object would be
   * dropped if the drag were to end.
   * @type Object.<cm.LayerDragHandler.DropTarget>
   * @private
   */
  this.currentDropTarget_ = {
    target: null,
    relation: undefined
  };

  // Create a dragger for each draggable element and attach listeners.
  goog.array.forEach(this.draggableElements_, function(elem) {
    var dragger = new goog.fx.Dragger(
        elem, cm.ui.getByClass(cm.css.DRAGGABLE_LAYER_TITLE, elem));
    goog.array.insert(this.draggerList_, dragger);
    cm.events.listen(dragger, goog.fx.Dragger.EventType.START, function(e) {
      this.draggedElem_ = elem;
      this.dragger_ = dragger;
      this.handleDragStart_(e);
    }, this);
    cm.events.listen(dragger, goog.fx.Dragger.EventType.DRAG,
                     this.handleDrag_, this);
    cm.events.listen(dragger, goog.fx.Dragger.EventType.END,
                     this.handleDragEnd_, this);
  }, this);
};

/**
 * Relation of an element to a target element. A CHILD relation indicates
 * that the element will be appended to the end of the target element's
 * child list.
 * @enum {string}
 */
cm.LayerDragHandler.TargetRelation = {
  PREVIOUS_SIBLING: 'PREVIOUS_SIBLING',
  NEXT_SIBLING: 'NEXT_SIBLING',
  CHILD: 'CHILD'
};

/**
 * A specification of where in the DOM a dragged element should be inserted.
 *     target: The target element relative to which the dragged element
 *         should be inserted.
 *     relation: The relation of the dragged element with respect to the
 *         target.
 * @typedef {{
 *     target: Element,
 *     relation: (cm.LayerDragHandler.TargetRelation|undefined)}}
 */
cm.LayerDragHandler.DropTarget;

/**
 * Returns the next draggable layer element that is a sibling of the given
 * draggable layer element, or null if this is the last draggable layer of
 * its siblings.
 * @param {Element} element The draggable layer element.
 * @return {?Element} The next draggable layer sibling if it exists.
 * @private
 */
cm.LayerDragHandler.getNextDraggableLayer_ = function(element) {
  for (var sibling = element.nextSibling; sibling;
       sibling = sibling.nextSibling) {
    if (goog.dom.classes.has(sibling, cm.css.DRAGGABLE_LAYER)) {
      return /** @type Element */(sibling);
    }
  }
  return null;
};

/**
 * Returns the first sibling of the given draggable layer element that
 * is a draggable layer element and appears before it as a sibling,
 * or null if this is the first draggable layer of its siblings.
 * @param {Element} element The draggable layer element.
 * @return {?Element} The previous draggable layer sibling if it exists.
 * @private
 */
cm.LayerDragHandler.getPreviousDraggableLayer_ = function(element) {
  for (var sibling = element.previousSibling; sibling;
       sibling = sibling.previousSibling) {
    if (goog.dom.classes.has(sibling, cm.css.DRAGGABLE_LAYER)) {
      return /** @type Element */(sibling);
    }
  }
  return null;
};

/**
 * Returns the given draggable layer element's nearest draggable layer ancestor,
 * or null if this is a "top-level" draggable layer.
 * @param {Element} element The draggable layer element.
 * @return {?Element} The parent draggable layer if it exists.
 * @private
 */
cm.LayerDragHandler.getDraggableParent_ = function(element) {
  var grandparent = /** @type Element */(element.parentNode.parentNode);
  return goog.dom.classes.has(grandparent, cm.css.DRAGGABLE_LAYER) ?
      grandparent : null;
};

/**
 * Handler for drag start event.
 * @param {goog.fx.DragEvent} e Drag start event.
 * @private
 */
cm.LayerDragHandler.prototype.handleDragStart_ = function(e) {
  // Clone the element containing the dragged element's title and
  // hide it until the user begins dragging.
  this.draggedClone_ = cm.ui.getByClass(cm.css.DRAGGABLE_LAYER_TITLE,
                                        this.draggedElem_).cloneNode(true);
  goog.dom.classes.add(this.draggedElem_, cm.css.ACTIVE_DRAGGABLE_LAYER);
  goog.dom.classes.add(this.draggedClone_, cm.css.DRAGGED_CLONE, cm.css.HIDDEN);
  goog.dom.classes.remove(this.draggedClone_,
                          cm.css.DRAGGABLE_LAYER_BG,
                          cm.css.DRAGGABLE_FOLDER_BG);
  cm.ui.append(cm.ui.document.body, this.draggedClone_);

  // Compute the cursor's offset relative to the dragged element's upper-left
  // corner.
  var draggedElemBounds = goog.style.getBounds(this.draggedElem_);
  this.cursorCloneOffset_ = new goog.math.Coordinate(
      e.clientX - draggedElemBounds.left,
      e.clientY - draggedElemBounds.top);

  // Set dragger limits to have the vertical extent of the draggable element
  // list and the horizontal extent of the arranger element plus some padding.
  var innerLimits = goog.style.getBounds(this.layerListElem_);
  var limits = goog.style.getBounds(
      goog.dom.getAncestorByTagNameAndClass(this.layerListElem_, 'div',
                                            cm.css.ARRANGER));
  limits.top = innerLimits.top;
  limits.height = innerLimits.height;
  // Expand the limits to the left to allow some slack when the drag point
  // leaves the panel. We do not expand to the right because the drag
  // point is at the left edge of the dragged element.
  limits.left = limits.left - 100;
  limits.width = limits.width + 100;
  this.dragger_.setLimits(limits);
};

/**
 * Handler for drag event.
 * @param {goog.fx.DragEvent} e Drag event.
 * @private
 */
cm.LayerDragHandler.prototype.handleDrag_ = function(e) {
  goog.dom.classes.remove(this.draggedClone_, cm.css.HIDDEN);
  this.updateDragInfo_(e);

  // If drag point is outside of dragger limits, reset the drop target
  // to null so that if the drag ends outside of the limits, no action
  // is taken, but if the drag point re-enters the limits, the drag is
  // not canceled.
  if (!this.dragger_.limits.contains(this.dragPoint_)) {
    this.currentDropTarget_ = {
      target: null,
      relation: undefined
    };
    cm.ui.remove(this.targetLine_);
  } else {
    // Compute the drop target.
    var dropTarget = cm.LayerDragHandler.computeDropTarget_(
        this.dragPoint_, this.dragger_, this.draggedElem_,
        this.draggableElements_);
    if (dropTarget.target !== null) {
      this.currentDropTarget_ = dropTarget;
      // Update the target line.
      if (this.currentTargetIsIllegalForElement_(this.draggedElem_)) {
        cm.ui.remove(this.targetLine_);
      } else {
        this.moveElementToCurrentTarget_(this.targetLine_);
      }
    }
  }
};

/**
 * Update the clone position, depending on the current cursor position
 * and clone dimensions. TODO(romano): handle the case when a
 * scrollbar is present.
 * @param {goog.fx.DragEvent} e Drag event.
 * @private
 */
cm.LayerDragHandler.prototype.updateDragInfo_ = function(e) {
  // Move the clone to track the cursor position, adjusted by the
  // offset when the drag began.
  var clonePosition = new goog.math.Coordinate(
      e.clientX - this.cursorCloneOffset_.x,
      e.clientY - this.cursorCloneOffset_.y);
  goog.style.setPosition(this.draggedClone_, clonePosition);

  // Set the point to use for drag target computation as the vertical midpoint
  // of the dragged clone's left edge.
  this.dragPoint_ = new goog.math.Coordinate(
      clonePosition.x,
      clonePosition.y + goog.style.getSize(this.draggedClone_).height / 2);
};

/**
 * Determines whether the current drop target is illegal for the given
 * source element. The target is illegal if either the resulting drop
 * would be a no-op, or if the drop would require moving the element
 * into one of its descendants.
 * @param {Element} elem The element to be dropped.
 * @return {boolean} True iff the target is illegal relative to the element.
 * @private
 */
cm.LayerDragHandler.prototype.currentTargetIsIllegalForElement_ = function(
    elem) {
  var target = this.currentDropTarget_.target;
  var relation = this.currentDropTarget_.relation;
  return goog.dom.contains(elem, target) ||
      (target === elem && (
       relation === cm.LayerDragHandler.TargetRelation.NEXT_SIBLING ||
       relation === cm.LayerDragHandler.TargetRelation.PREVIOUS_SIBLING)) ||
      (target === cm.LayerDragHandler.getPreviousDraggableLayer_(elem) &&
       relation === cm.LayerDragHandler.TargetRelation.NEXT_SIBLING) ||
      (target === cm.LayerDragHandler.getNextDraggableLayer_(elem) &&
       relation === cm.LayerDragHandler.TargetRelation.PREVIOUS_SIBLING);
};

/**
 * Removes the element from the DOM and inserts it according to the
 * specifications in the current drop target.
 * @param {Element} element The element to be moved.
 * @private
 */
cm.LayerDragHandler.prototype.moveElementToCurrentTarget_ = function(element) {
  if (this.currentDropTarget_.target !== null) {
    cm.ui.remove(element);
    var target = this.currentDropTarget_.target;
    var relation = this.currentDropTarget_.relation;
    switch (relation) {
      case cm.LayerDragHandler.TargetRelation.PREVIOUS_SIBLING:
        goog.dom.insertSiblingBefore(element, target);
        break;
      case cm.LayerDragHandler.TargetRelation.NEXT_SIBLING:
        goog.dom.insertSiblingAfter(element, target);
        break;
      case cm.LayerDragHandler.TargetRelation.CHILD:
      var sublayers =
          cm.ui.getByClass(cm.css.DRAGGABLE_SUBLAYER_CONTAINER, target);
      if (sublayers) {
        goog.dom.appendChild(sublayers, element);
      }
      break;
    }
  }
};

/**
 * Handler for drag end event.
 * @param {goog.fx.DragEvent} e Drag end event.
 * @private
 */
cm.LayerDragHandler.prototype.handleDragEnd_ = function(e) {
  goog.dom.classes.remove(this.draggedElem_, cm.css.ACTIVE_DRAGGABLE_LAYER);
  cm.ui.remove(this.targetLine_);
  cm.ui.remove(this.draggedClone_);

  var target = this.currentDropTarget_.target;
  if (!e.dragCanceled &&
      !this.currentTargetIsIllegalForElement_(this.draggedElem_)) {
    this.moveElementToCurrentTarget_(this.draggedElem_);
  }
  this.currentDropTarget_ = {
    target: null,
    relation: undefined
  };

  this.draggedClone_ = null;
  this.dragger_ = null;
};

/**
 *
 */
cm.LayerDragHandler.prototype.dispose = function() {
  goog.array.forEach(this.draggerList_, function(dragger) {
    dragger.dispose();
  });
};

/**
 * Computes the drop target from the given drag point and dragged element.
 * @param {goog.math.Coordinate} dragPoint The coordinates of the drag point.
 * @param {goog.fx.Dragger} dragger The dragger object corresponding
 *     to the dragged element.
 * @param {Element} draggedElem The element currently being dragged.
 * @param {Array.<Element>} targetElems A flat array of possible target
 *     elements. All are assumed to have the 'cm-draggable-layer' class.
 * @return {cm.LayerDragHandler.DropTarget} dropTarget A specification of
 *     where in the DOM the dragged element should be inserted.
 * @private
 */
cm.LayerDragHandler.computeDropTarget_ = function(
    dragPoint, dragger, draggedElem, targetElems) {
  var target = null;
  var relation = undefined;

  // Local storage for testing cursor membership in various regions,
  // reused in various places to avoid instantiating a Rect every iteration.
  var region = new goog.math.Rect(0, 0, 0, 0);
  var elemBounds, elemMargin, yCenter, titleElem;

  // Iterate over the target elements until we find the first qualifying
  // drop target.
  if (dragger.limits.contains(dragPoint)) {
    goog.array.some(targetElems, function(elem) {
      titleElem = cm.ui.getByClass(cm.css.DRAGGABLE_LAYER_TITLE, elem);
      elemBounds = goog.style.getBounds(/** @type Element */(titleElem));
      elemMargin = goog.style.getMarginBox(/** @type Element */(titleElem));

      // Set target region to match drag handle's top and height,
      // including its margin, and extend its left/right extents to
      // the full panel width.
      region.top = elemBounds.top - elemMargin.top;
      region.height = elemBounds.height + elemMargin.top + elemMargin.bottom;
      region.left = dragger.limits.left;
      region.width = dragger.limits.width;
      yCenter = region.top + (region.height / 2);

      if (region.contains(dragPoint)) {
        // If this element is the first top-level layer/folder, the previous
        // sibling drop target is a special case.
        if (!cm.LayerDragHandler.getDraggableParent_(elem) &&
            !cm.LayerDragHandler.getPreviousDraggableLayer_(elem) &&
            dragPoint.y < yCenter) {
          target = elem;
          relation = cm.LayerDragHandler.TargetRelation.PREVIOUS_SIBLING;
          return true;
        }
        var sublayerContainer =
            cm.ui.getByClass(cm.css.DRAGGABLE_SUBLAYER_CONTAINER, elem);
        var firstSublayer = sublayerContainer ?
            cm.ui.getByClass(cm.css.DRAGGABLE_LAYER, sublayerContainer) : null;
        var nextSibling = cm.LayerDragHandler.getNextDraggableLayer_(elem);

        if (sublayerContainer) {
          // Treat empty and non-empty folders differently.
          if (firstSublayer && elem !== draggedElem) {
            // Folder is not empty, and this isn't an outdenting action.
            target = firstSublayer;
            relation = cm.LayerDragHandler.TargetRelation.PREVIOUS_SIBLING;
            return true;
          } else if (!firstSublayer &&
              dragPoint.x > elemBounds.left + HALF_INDENT) {
            // Folder is empty, and drag point is indented enough to
            // indicate child target.
            target = elem;
            relation = cm.LayerDragHandler.TargetRelation.CHILD;
            return true;
          }
        }
        if (nextSibling !== null ||
            dragPoint.x > elemBounds.left + HALF_INDENT) {
          // When this element is not the last sibling, or drag point
          // is far enough to the right, drop target is this element's
          // next sibling.
          target = elem;
          relation = cm.LayerDragHandler.TargetRelation.NEXT_SIBLING;
          return true;
        }
        var candidate = elem;
        var candidateBounds = elemBounds;
        // Outdenting: walk up nested folder tree to find previous sibling.
        while (candidate) {
          if (dragPoint.x > candidateBounds.left - HALF_INDENT &&
              dragPoint.x <= candidateBounds.left + HALF_INDENT) {
            target = candidate;
            relation = cm.LayerDragHandler.TargetRelation.NEXT_SIBLING;
            return true;
          }
          // Update candidate to the next draggable parent.
          candidate = cm.LayerDragHandler.getDraggableParent_(candidate);
          titleElem = candidate ? cm.ui.getByClass(cm.css.DRAGGABLE_LAYER_TITLE,
                                                   candidate) : null;
          candidateBounds = titleElem ? goog.style.getBounds(
              /** @type Element */(titleElem)) : null;
        }
      }
    });
  }
  return {target: target, relation: relation};
};
