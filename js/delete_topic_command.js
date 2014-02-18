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
 * @fileoverview [MODULE: edit] Undoable command for deleting a layer.
 * @author shakusa@google.com (Steve Hakusa)
 */
goog.provide('cm.DeleteTopicCommand');

goog.require('cm.Command');
goog.require('cm.TopicModel');

/**
 * A command to delete a topic from a map.
 * @param {string} topicId The ID of the topic to delete.
 * @constructor
 * @implements cm.Command
 */
cm.DeleteTopicCommand = function(topicId) {
  /**
   * Index into the ordered list of the deleted topic's sibling topics.
   * @type number
   * @private
   */
  this.index_;

  /**
   * The deleted topic's MapRoot representation.
   * @type Object
   * @private
   */
  this.topicMapRoot_ = {
    id: topicId,
    layer_ids: []
  };
};

/** @override */
cm.DeleteTopicCommand.prototype.execute = function(appState, mapModel) {
  var id = /** @type string */(this.topicMapRoot_['id']);
  var topic = mapModel.getTopic(id);
  this.topicMapRoot_ = topic.toMapRoot();

  // Remove the topic from the model.
  this.index_ = goog.array.indexOf(mapModel.getTopicIds(), id);
  mapModel.get('topics').removeAt(this.index_);
  mapModel.notify('topics');
  return true;
};

/** @override */
cm.DeleteTopicCommand.prototype.undo = function(appState, mapModel) {
  var topic = cm.TopicModel.newFromMapRoot(this.topicMapRoot_,
                                           mapModel.getLayerIds());
  mapModel.get('topics').insertAt(this.index_, topic);
  mapModel.notify('topics');
  return true;
};
