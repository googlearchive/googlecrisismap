// Copyright 2014 Google Inc.  All Rights Reserved.
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
 * @fileoverview [MODULE: edit] A topic selector dialog.
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.TopicSelectorView');

goog.require('cm.MapModel');
goog.require('cm.TopicModel');
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');

/**
 * A dialog to select from a list of map topics to edit, or create a new topic.
 * @param {cm.MapModel} mapModel The map model.
 *
 * @constructor
 */
cm.TopicSelectorView = function(mapModel) {
  /**
   * @type Element
   * @private
   */
  this.popup_;

  /**
   * @type Element
   * @private
   */
  this.headerElem_;

  /**
   * @type Element
   * @private
   */
  this.topicListElem_;

  /**
   * Listener token for the window's 'resize' event.
   * @type {cm.events.ListenerToken}
   * @private
   */
  this.windowResizeListener_;

  /**
   * @type {cm.MapModel}
   * @private
   */
  this.mapModel_ = mapModel;

  var newTopicBtn;
  var closeBtn;

  this.popup_ = cm.ui.create('div', [cm.css.TOPIC_SELECTOR, cm.css.POPUP],
      this.headerElem_ = cm.ui.create('div', undefined,
          cm.ui.create('h2', cm.css.TOPIC_SELECTOR_TITLE,
              cm.MSG_TOPICS_FOR_THIS_MAP_TITLE),
          cm.ui.create('div', cm.css.TOPIC_SELECTOR_DESCRIPTION,
              cm.MSG_TOPICS_DESCRIPTION)),
      this.topicListElem_ = cm.ui.create('div',
          {'class': cm.css.TOPIC_SELECTOR_LIST, 'tabIndex': 0}),
      cm.ui.create('div', {'class': cm.css.BUTTON_AREA},
          newTopicBtn = cm.ui.create('button',
              {'class': [cm.css.BUTTON, cm.css.CREATE]},
              cm.MSG_CREATE_NEW_TOPIC),
          closeBtn = cm.ui.create('button', cm.css.BUTTON, cm.MSG_CANCEL)));

  cm.events.listen(newTopicBtn, 'click', this.handleNewTopic_, this);
  cm.events.listen(closeBtn, 'click', this.handleCancel_, this);
};

/**
 * Fraction of the window size that the selector can expand to, at maximum.
 * @type {number}
 * @private
 */
cm.TopicSelectorView.MAX_HEIGHT_ = 0.9;

/**
 * Total number of pixels from element CSS properties that contribute to the
 * popup's total height.
 * TODO(shakusa) Look into simplifying this to just keep the max list height to
 * 80% of the window height.
 * @type {number}
 * @private
 */
cm.TopicSelectorView.TOTAL_EXTRA_HEIGHT_ =
    1 + 24 +      // cm-popup top border and padding, respectively
    8 +           // cm-importer-header bottom margin
    11 + 29 + 5 + // cm-button-area top margin, height, and bottom margin
    20 + 1;       // cm-popup bottom padding and border, respectively

/**
 * @return {boolean} Whether or not the dialog is open.
 */
cm.TopicSelectorView.prototype.isOpen = function() {
  return this.popup_.parentNode != null;
};

/**
 * Build and show a topic selector dialog.
 */
cm.TopicSelectorView.prototype.open = function() {
  var topics = this.mapModel_.get('topics').getArray();

  cm.ui.showPopup(this.popup_);
  this.handleResize_();
  this.windowResizeListener_ = /** @type {cm.events.ListenerToken} */
        (cm.events.listen(window, 'resize',
            // Fails on IE8 if you do not bind cm.ui.document.body here
            goog.bind(this.handleResize_, this, cm.ui.document.body)));

  cm.ui.clear(this.topicListElem_);
  goog.array.forEach(topics, function(topicModel) {
    var topicElem;
    var deleteBtn;
    cm.ui.append(this.topicListElem_,
        topicElem = cm.ui.create('div', {'class': cm.css.TOPIC_ITEM},
            cm.ui.create('span', {},
                /** @type {string} */(topicModel.get('title'))),
            deleteBtn = cm.ui.create('div', {'class': cm.css.CLOSE_BUTTON})));
    cm.events.listen(topicElem, 'click',
        goog.bind(this.handleTopicClick_, this, topicModel), this);
    cm.events.listen(deleteBtn, 'click',
        goog.bind(this.handleDeleteTopicClick_, this, topicElem, topicModel),
        this);
  }, this);
};

/**
 * Handles a click on a topic.
 * @param {cm.TopicModel} topicModel The topic that was clicked.
 * @private
 */
cm.TopicSelectorView.prototype.handleTopicClick_ = function(topicModel) {
  this.close_();
  cm.events.emit(cm.app, cm.events.INSPECT, {object: topicModel});
};

/**
 * Handles a click on the delete button for a topic.
 * @param {Element} topicElem The topic element whose delete button was clicked.
 * @param {cm.TopicModel} topicModel The topic model to be deleted.
 * @param {Event} e The mouse event.
 * @private
 */
cm.TopicSelectorView.prototype.handleDeleteTopicClick_ = function(
    topicElem, topicModel, e) {
  cm.events.emit(cm.app, cm.events.DELETE_TOPIC, {id: topicModel.get('id')});
  goog.dom.removeNode(topicElem);
  e.stopPropagation(); // Prevent handleTopicClick_ from firing
};

/** @private Handler for the link to create a new topic. */
cm.TopicSelectorView.prototype.handleNewTopic_ = function() {
  this.close_();
  cm.events.emit(cm.app, cm.events.INSPECT, {isNewTopic: true});
};

/**
 * Updates the maximum height of the topic list based on the defined maximum
 * height of the popup (cm.TopicSelectorView.MAX_HEIGHT_), and repositions the
 * popup to center it, assuming it is its maximum size.
 * Should be called whenever the size of the popup's container has changed,
 * or dynamic elements of the popup have changed (this.headerElem_).
 * @param {Element=} opt_container Parent container of the popup; defaults to
 *     cm.ui.document.body.
 * @private
 */
cm.TopicSelectorView.prototype.handleResize_ = function(opt_container) {
  var container = opt_container || cm.ui.document.body;
  var maxPopupHeight = Math.round(
      container.offsetHeight * cm.TopicSelectorView.MAX_HEIGHT_);

  // Calculate the maximum height the list may be.
  var maxListHeight = maxPopupHeight -
      cm.TopicSelectorView.TOTAL_EXTRA_HEIGHT_ -
      this.headerElem_.offsetHeight;
  this.topicListElem_.style.maxHeight = maxListHeight + 'px';

  // Anchor popup such that it is centered in the case of maximum
  // width and height. This is so that may grow to this size without going
  // offscreen.
  this.popup_.style.top = Math.round((container.offsetHeight -
      maxPopupHeight) / 2) + 'px';
  this.popup_.style.left = Math.round((container.offsetWidth -
      this.popup_.offsetWidth) / 2) + 'px'; // width == max-width for importer
};

/**
 * Closes the dialog.
 * @private
 */
cm.TopicSelectorView.prototype.handleCancel_ = function() {
  this.close_();
};

/**
 * Disposes of the popup by clearing the listener token and closing the popup.
 * @private
 */
cm.TopicSelectorView.prototype.close_ = function() {
  cm.events.unlisten(this.windowResizeListener_, this);
  cm.ui.remove(this.popup_);
  cm.ui.clear(this.topicListElem_);
};
