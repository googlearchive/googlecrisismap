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
 * @fileoverview [MODULE: edit] Undoable command for creating a variable number
 *     of topics.
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.CreateTopicsCommand');

goog.require('cm.Command');
goog.require('cm.TopicModel');
goog.require('goog.array');

/**
 * A command to create new topic from MapRoot objects and add them to a map.
 * @param {Object|Array.<Object>} topicMapRoots One or more topic objects in
 *     MapRoot format, specifying the topic to create. These are created in
 *     order, as well as positioned in the map model in the same order.
 * @constructor
 * @implements cm.Command
 */
cm.CreateTopicsCommand = function(topicMapRoots) {
  /**
   * @type {Array.<Object>}
   * @private
   */
  this.topicMapRoots_ = /** @type {Array.<Object>} */
      (goog.isArray(topicMapRoots) ? topicMapRoots : [topicMapRoots]);
};

/** @override */
cm.CreateTopicsCommand.prototype.execute = function(appState, mapModel) {
  goog.array.forEach(this.topicMapRoots_, function(topicMapRoot, i) {
    // The topic's ID is auto-assigned the first time execute() is called.
    var topic = cm.TopicModel.newFromMapRoot(topicMapRoot,
                                             mapModel.getLayerIds());
    // Inserting the topic into the map causes its 'id' property to be
    // populated. We save the ID so that redo() will create the topic again
    // with the same ID.
    topicMapRoot.id = /** @type string */(topic.get('id'));
    mapModel.get('topics').push(topic);
    mapModel.notify('topics');
  }, this);
  return true;
};

/** @override */
cm.CreateTopicsCommand.prototype.undo = function(appState, mapModel) {
  for (var i = this.topicMapRoots_.length - 1; i >= 0; i--) {
    mapModel.get('topics').pop();
    mapModel.notify('topics');
  }
  return true;
};
