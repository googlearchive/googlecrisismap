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
 * @fileoverview Utility functions for UI construction.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.ui');

goog.require('cm');
goog.require('cm.Html');
goog.require('cm.css');
goog.require('cm.events');
goog.require('goog.dom');
goog.require('goog.format');
goog.require('goog.string');
goog.require('goog.style');

/** A centered dot with a non-breaking space before and breaking space after. */
cm.ui.SEPARATOR_DOT = '\xa0\xb7\x20';

/** The document.  In tests, cm.ui.document will be a fake. */
cm.ui.document = (typeof document !== 'undefined') ? document : null;

/**
 * Creates a close button and appends it to the given parent and calls the given
 * callback when clicked.
 * @param {Element} container Parent of the close button.
 * @param {!Function} callback The callback to call when clicked.
 */
cm.ui.createCloseButton = function(container, callback) {
  var close = cm.ui.create('div', {'class': cm.css.CLOSE_BUTTON});
  container.appendChild(close);

  // Hides the layers panel and deselects the layers button.
  cm.events.listen(close, 'click', callback);
};

/**
 * Makes the given element appear as a popup box, centered on a given container
 * element.  If the popup is already visible, it is repositioned to be centered
 * on the given container element.  The popup is centered on the document body
 * if no container element is specified.
 * @param {Element} popup An element to display in a popup box.
 * @param {Element=} opt_container An element on which to center the popup box.
 *     The CSS styles from opt_container's document are used for the purpose
 *     of estimating the size of the popup, unless the popup is already shown.
 */
cm.ui.showPopup = function(popup, opt_container) {
  var container = opt_container || cm.ui.document.body;
  // Note that we used to compare popup.parentNode with cm.ui.document.body,
  // however this fails on IE8 for no apparent reason.
  var size = popup.parentNode ?
      goog.style.getBorderBoxSize(popup) : // already visible
      cm.ui.offscreenSize(popup, container);  // not yet visible
  var x = Math.max(0, (container.offsetWidth - size.width) / 2);
  var y = Math.max(0, (container.offsetHeight - size.height) / 2);
  popup.style.left = Math.round(x) + 'px';
  popup.style.top = Math.round(y) + 'px';
  if (popup.parentNode !== container) {
    container.appendChild(popup);
  }
};

/**
 * Creates a DOM element.  This works just like goog.dom.createDom but also
 * fixes some of IE's bad behaviour.
 * @param {string} tag The tag name of the element to create.
 * @param {Object=} opt_attributes Attributes to set on the new element. 'style'
 *     attributes may be strings or objects; the former will be applied as a DOM
 *     attribute, while the latter will be applied as JavaScript properties.
 * @param {...(cm.Html|string|Node|Array.<string|Node>)} var_args Text strings,
 *     Html objects, or DOM nodes to add as children of the new element.
 * @return {!Element} The newly created element.
 */
cm.ui.create = function(tag, opt_attributes, var_args) {
  var args = [];
  var styleDict = null;
  if (opt_attributes) {
    if (opt_attributes['style'] && !goog.isString(opt_attributes['style'])) {
      styleDict = opt_attributes['style'];
      delete opt_attributes['style'];
    }
    if (opt_attributes['class'] && goog.isArray(opt_attributes['class'])) {
      opt_attributes['class'] = opt_attributes['class'].join(' ');
    }
  }
  for (var a = 0; a < arguments.length; a++) {
    if (arguments[a] instanceof cm.Html) {  // Convert Html objects to elements.
      var span = goog.dom.createDom('span');
      arguments[a].pasteInto(span);
      args.push(span);
    } else {
      args.push(arguments[a]);
    }
  }
  var element = goog.dom.createDom.apply(null, args);
  if (styleDict) {
    goog.object.extend(element.style, styleDict);
  }
  if (tag === 'input' && (opt_attributes || {})['checked']) {
    element.setAttribute('defaultChecked', true);  // Shakes fist at IE.
  }
  return element;
};

/**
 * Removes all the children from a DOM element.
 * @param {Element} elem The element to clear.
 */
cm.ui.clear = function(elem) {
  while (elem.firstChild) {
    elem.removeChild(elem.firstChild);
  }
};

/**
 * Removes an element from the DOM; doesn't complain if it's already removed.
 * @param {Element} elem The element to remove.
 */
cm.ui.remove = function(elem) {
  elem.parentNode && elem.parentNode.removeChild(elem);
};

/**
 * Appends one or more children to a DOM element.
 * @param {Element} elem The element to append to.
 * @param {...Element|string} var_args The child elements to append.
 */
cm.ui.append = function(elem, var_args) {
  for (var i = 1; i < arguments.length; i++) {
    var arg = arguments[i];
    elem.appendChild(goog.isString(arg) ?
        cm.ui.document.createTextNode(arg) : arg);
  }
};

/**
 * Creates a link element.
 * @param {string|Element} anchor The text or DOM element to use as the anchor.
 * @param {string=} opt_url The URL of the link.
 * @param {string=} opt_target The target attribute for the link.
 * @return {Element} A newly created link element.
 */
cm.ui.createLink = function(anchor, opt_url, opt_target) {
  var url = opt_url || 'javascript:void(0)';
  var attributes = {'href': url};
  if (opt_target) {
    attributes['target'] = opt_target;
  }
  return cm.ui.create('a', attributes, anchor);
};

/**
 * @param {string} id A DOM element ID.
 * @return {Element} The DOM element with the given ID.
 */
cm.ui.get = function(id) {
  return document.getElementById(id);
};

/**
 * Returns the first element in the document with the given class name.
 * If opt_parent is given, limit search to its descendants.
 * @param {string} className A class name.
 * @param {Element=} opt_parent A DOM element to look in.
 * @return {?Element} The element with the given class name, if found.
 */
cm.ui.getByClass = function(className, opt_parent) {
  return goog.dom.getElementByClass(className, opt_parent);
};

/**
 * Returns all the elements in the document with the given class name.
 * If opt_parent is given, limit search to its descendants.
 * @param {string} className A class name.
 * @param {Element=} opt_parent A DOM element to look in.
 * @return { {length: number} } The elements with the given class name.
 */
cm.ui.getAllByClass = function(className, opt_parent) {
  return goog.dom.getElementsByClass(className, opt_parent);
};

/**
 * Gets the text content of an element.
 * @param {Element} element A DOM element.
 * @return {string} The text content of the element.
 */
cm.ui.getText = function(element) {
  return goog.dom.getRawTextContent(element);
};

/**
 * Sets the content of an element to a string of plain text.  Optionally
 * inserts word breaks to prevent very long words from messing up page layout.
 * @param {Element} element A DOM element.
 * @param {string} text A string of plain text.
 * @param {number?} opt_wordBreakMaxLen If this is specified, word breaks are
 *     inserted; this is the maximum length after which to add a word break.
 */
cm.ui.setText = function(element, text, opt_wordBreakMaxLen) {
  if (opt_wordBreakMaxLen) {
    new cm.Html(goog.format.insertWordBreaksBasic(
        goog.string.htmlEscape(text), opt_wordBreakMaxLen)).pasteInto(element);
  } else {
    goog.dom.setTextContent(element, text);
  }
};

/**
 * @type Element
 */
cm.ui.sizingDiv_;

/**
 * Measures the size of a DOM element, as rendered into a box of a given size,
 * by temporarily rendering the given element offscreen.
 * @param {Element} elem The element whose size to measure.
 * @param {Element} container A container element that provides two pieces of
 *     context for the measurement: (a) the container should belong to the
 *     document in which 'elem' will be used, so that the same CSS rules apply
 *     during measurement; (b) the element will be rendered into a box of the
 *     same size as the given container.
 * @return {goog.math.Size} The rendered size of the given element.
 */
cm.ui.offscreenSize = function(elem, container) {
  // We want to apply the CSS rules from the given container's document.
  var ownerDocument = container.ownerDocument;

  if (!cm.ui.sizingDiv_ || cm.ui.sizingDiv_.ownerDocument !== ownerDocument) {
    cm.ui.sizingDiv_ = ownerDocument.createElement('div');
    cm.ui.sizingDiv_.style.position = 'absolute';
    cm.ui.sizingDiv_.style.left = (-2 * ownerDocument.body.offsetWidth) + 'px';
    ownerDocument.body.appendChild(cm.ui.sizingDiv_);
  }

  // Cap the offscreen div at the size of the container.
  goog.style.setContentBoxSize(
      cm.ui.sizingDiv_, goog.style.getContentBoxSize(container));

  cm.ui.sizingDiv_.appendChild(elem);
  var size = goog.style.getBorderBoxSize(elem);
  cm.ui.sizingDiv_.removeChild(elem);

  return size;
};

/**
 * @type {number}
 * @private
 */
cm.ui.idCounter_ = 0;

/**
 * Generates a unique element ID.
 * @param {string} prefix A string prefix for the ID.
 * @return {string} A unique element ID that begins with the given prefix.
 */
cm.ui.generateId = function(prefix) {
  return prefix + '' + (++cm.ui.idCounter_);
};
