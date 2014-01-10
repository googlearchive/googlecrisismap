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

/** @fileoverview Model for a topic. */
goog.provide('cm.TopicModel');

goog.require('cm');
goog.require('cm.LatLonBox');
goog.require('goog.structs.Set');

/**
 * Model for a topic.  Clients are free to get and set properties of this
 * MVCObject and insert or remove elements of the 'questions' property.
 * @constructor
 * @extends google.maps.MVCObject
 */
cm.TopicModel = function() {
  google.maps.MVCObject.call(this);
};
goog.inherits(cm.TopicModel, google.maps.MVCObject);

/**
 * An internal counter used to generate unique IDs.
 * @type number
 * @private
 */
cm.TopicModel.nextId_ = 0;

/**
 * @param {Object} maproot A MapRoot JS topic object.
 * @param {Array.<string>} valid_layer_ids A list of the layer IDs to allow.
 * @return {cm.TopicModel} A newly constructed TopicModel, or null if the
 *     'type' member was not a recognized type name.
 */
cm.TopicModel.newFromMapRoot = function(maproot, valid_layer_ids) {
  var source = maproot['source'] || {};
  var model = new cm.TopicModel();

  /** {string} An ID unique among topics in this MapModel. */
  model.set('id', maproot['id'] || ('topic' + cm.TopicModel.nextId_++));

  /** {string} Title for this topic. */
  model.set('title', maproot['title'] || '');

  /** {string} Default viewport for this topic. */
  model.set('viewport', cm.LatLonBox.fromMapRoot(
      (maproot['viewport'] || {})['lat_lon_alt_box']));

  /** {Array.<string>} IDs of the layers associated with this topic. */
  model.set('layer_ids',
            new goog.structs.Set(valid_layer_ids)
                .intersection(maproot['layer_ids'] || []));

  /** {Array.<string>} Tags associated with this topic. */
  model.set('tags', maproot['tags'] || []);

  /** {boolean} True to enable crowd reporting for this topic's layers. */
  model.set('crowd_enabled', maproot['crowd_enabled'] || false);

  /** {number} Radius within which to cluster reports, in metres. */
  model.set('cluster_radius', maproot['cluster_radius'] || 0);

  /** {Array.<{id: string,
   *           text: string,
   *           answers: Array.<{id: string,
   *                            title: string,
   *                            color: string}>
   *          }>} Definitions of the survey questions for this topic.
   *              Each question has an ID unique among questions in this topic,
   *              the text of the question, and an array of answers.  Each
   *              answer has an ID unique among answers for that question, a
   *              title string, and a symbol color in #rrggbb format. */
  model.set('questions',
      goog.array.map(maproot['questions'] || [], function(question) {
        if (!question['id']) return null;
        return {
          id: question['id'],
          text: question['text'] || '',
          answers: goog.array.map(question['answers'] || [], function(answer) {
            if (!answer['id']) return null;
            return {id: answer['id'],
                    title: answer['title'] || '',
                    color: answer['color'] || ''};
          })
        };
      })
  );
  return model;
};

/** @return {Object} This topic as a MapRoot JS topic object. */
cm.TopicModel.prototype.toMapRoot = function() {
  // In this MapRoot object, we set values to null for missing fields.
  var box = /** @type cm.LatLonBox */(this.get('viewport'));
  return /** @type Object */(cm.util.removeNulls({
    'id': this.get('id'),
    'title': this.get('title'),
    'viewport': box ? {'lat_lon_alt_box': box.round(4).toMapRoot()} : null,
    'layer_ids': this.get('layer_ids').getValues(),
    'tags': this.get('tags'),
    'crowd_enabled': this.get('crowd_enabled') || null,
    'cluster_radius':
        this.get('crowd_enabled') && this.get('cluster_radius') || null,
    'questions': goog.array.map(
        /** @type Array */(this.get('questions')), function(question) {
      return {
        'id': question.id,
        'text': question.text,
        'answers': goog.array.map(question.answers, function(answer) {
          return {'id': answer.id,
                  'title': answer.title,
                  'color': answer.color};
        })
      };
    })
  }));
};
