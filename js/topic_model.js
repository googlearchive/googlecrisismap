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

/** @enum {string} */
cm.TopicModel.QuestionType = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  CHOICE: 'CHOICE'
};

/**
 * @param {Object} maproot A MapRoot JS topic object.
 * @param {Array.<string>} valid_layer_ids A list of the layer IDs to allow.
 * @return {cm.TopicModel} A newly constructed TopicModel, or null if the
 *     'type' member was not a recognized type name.
 */
cm.TopicModel.newFromMapRoot = function(maproot, valid_layer_ids) {
  var source = maproot['source'] || {};
  var model = new cm.TopicModel();

  var id = maproot['id'];
  // If there's no ID in the MapRoot, try to create a sensible ID from the
  // title.  If it's still empty, it will be set by cm.MapModel.registerTopic_.
  if (!id) {
    var title = (maproot['title'] || '').replace(/[^\w.-]+/g, ' ');
    id = goog.string.trim(title).replace(/ /g, '_').toLowerCase();
  }

  /** {string} An ID unique among topics in this MapModel. */
  model.set('id', id);

  /** {string} Title for this topic. */
  model.set('title', maproot['title'] || '');

  /** {string} Default viewport for this topic. */
  model.set('viewport', cm.LatLonBox.fromMapRoot(
      (maproot['viewport'] || {})['lat_lon_alt_box']));

  /** {Array.<string>} IDs of the layers associated with this topic. */
  model.set('layer_ids',
            new goog.structs.Set(valid_layer_ids)
                .intersection(maproot['layer_ids'] || []).getValues());

  /** {Array.<string>} Tags associated with this topic. */
  model.set('tags', maproot['tags'] || []);

  /** {boolean} True to enable crowd reporting for this topic's layers. */
  model.set('crowd_enabled', maproot['crowd_enabled'] || false);

  /** {number} Radius within which to cluster reports, in metres. */
  model.set('cluster_radius', maproot['cluster_radius'] || 0);

  /** {Array.<{id: string,
   *           text: string,
   *           title: string,
   *           type: cm.TopicModel.QuestionType,
   *           choices: Array.<{id: string,
   *                            title: string,
   *                            label: string,
   *                            color: string}>
   *          }>} Definitions of the survey questions for this topic.
   *              Each question has an ID unique among questions in this topic,
   *              the text of the question, and a short title to use as a
   *              column heading when exporting data.  Questions can have type
   *              STRING (taking a textual answer), NUMBER (taking a numeric
   *              answer), or CHOICE (taking one of a set of possible answers).
   *              For questions of type CHOICE, there is an array of possible
   *              choices; each choice has an ID unique among choices for that
   *              question, a title string, a stand-alone label, and a symbol
   *              color in #rrggbb format. */
  model.set('questions',
      goog.array.map(maproot['questions'] || [], function(question) {
        if (!question['id']) return null;
        return {
          id: question['id'],
          text: question['text'] || '',
          title: question['title'] || '',
          type: question['type'] || cm.TopicModel.QuestionType.STRING,
          choices: goog.array.map(question['choices'] || [], function(choice) {
            if (!choice['id']) return null;
            return {id: choice['id'],
                    title: choice['title'] || '',
                    label: choice['label'] || '',
                    color: choice['color'] || ''};
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
    'layer_ids': this.get('layer_ids'),
    'tags': this.get('tags'),
    'crowd_enabled': this.get('crowd_enabled') || null,
    'cluster_radius':
        this.get('crowd_enabled') && this.get('cluster_radius') || null,
    'questions': goog.array.map(
        /** @type Array */(this.get('questions')), function(question) {
      var choices = question.type === cm.TopicModel.QuestionType.CHOICE &&
          question.choices || [];
      return {
        'id': question.id,
        'title': question.title,
        'text': question.text,
        'type': question.type,
        'choices': goog.array.map(choices, function(choice) {
          return {'id': choice.id,
                  'title': choice.title,
                  'label': choice.label,
                  'color': choice.color};
        })
      };
    })
  }));
};

/** @override */
cm.TopicModel.prototype.changed = function(key) {
  cm.events.emit(this, cm.events.MODEL_CHANGED);
};

// Export this method so it can be called by the MVCObject machinery.
goog.exportProperty(cm.TopicModel.prototype, 'changed',
                    cm.TopicModel.prototype.changed);

