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

// Test input: a topic in MapRoot format.
var TOPIC_MAP_ROOT_JSON = {
  'id': 'shelter',
  'title': 'Shelter',
  'viewport': {
    'lat_lon_alt_box': {'north': 3, 'south': 2, 'east': 8, 'west': 7}
  },
  'layer_ids': ['1', '2', '3', '4', '5'],
  'tags': ['shelter', 'warming', 'beds'],
  'crowd_enabled': true,
  'cluster_radius': 123,
  'questions': [{
    'id': '1',
    'text': 'Is there space available at this shelter?',
    'title': 'space',
    'type': 'CHOICE',
    'choices': [
      {'id': '1', 'title': 'Yes', 'label': 'space', 'color': '#00c000'},
      {'id': '2', 'title': 'No', 'label': 'no space', 'color': '#c00000'}
    ]
  }, {
    'id': '2',
    'text': 'Does this shelter allow overnight stays?',
    'title': 'overnight',
    'type': 'CHOICE',
    'choices': [
      {'id': '1', 'title': 'Yes', 'label': 'overnight', 'color': '#00c080'},
      {'id': '2', 'title': 'No', 'label': 'day only', 'color': '#c00080'}
    ]
  }]
};

function TopicModelTest() {
  cm.TestBase.call(this);
}
TopicModelTest.prototype = new cm.TestBase();
registerTestSuite(TopicModelTest);

TopicModelTest.prototype.newFromMapRoot = function() {
  var model = cm.TopicModel.newFromMapRoot(
      TOPIC_MAP_ROOT_JSON, ['1', '2', '3', '4', '5']);
  expectEq(TOPIC_MAP_ROOT_JSON.id, model.get('id'));
  expectEq(TOPIC_MAP_ROOT_JSON.title, model.get('title'));
  expectEq(new cm.LatLonBox(3, 2, 8, 7), model.get('viewport'));
  expectEq(['1', '2', '3', '4', '5'], model.get('layer_ids'));
  expectEq(TOPIC_MAP_ROOT_JSON.tags, model.get('tags'));
  expectEq(TOPIC_MAP_ROOT_JSON.crowd_enabled, model.get('crowd_enabled'));
  expectEq(TOPIC_MAP_ROOT_JSON.questions, model.get('questions'));
};

TopicModelTest.prototype.newFromMapRootMissingId = function() {
  var json = goog.object.clone(TOPIC_MAP_ROOT_JSON);
  delete json['id'];
  json['title'] = ' Complex (title 3!) ';
  var model = cm.TopicModel.newFromMapRoot(json, ['1', '2', '3', '4', '5']);
  expectEq('complex_title_3', model.get('id'));

  json['title'] = '   ';
  model = cm.TopicModel.newFromMapRoot(json, ['1', '2', '3', '4', '5']);
  expectEq('', model.get('id'));

  delete json['title'];
  model = cm.TopicModel.newFromMapRoot(json, ['1', '2', '3', '4', '5']);
  expectEq('', model.get('id'));
};

TopicModelTest.prototype.newFromMapRootInvalidLayerIds = function() {
  var model = cm.TopicModel.newFromMapRoot(
      TOPIC_MAP_ROOT_JSON, ['1', '3', '6']);
  expectEq(['1', '3'], model.get('layer_ids'));
};

TopicModelTest.prototype.toMapRoot = function() {
  var model = cm.TopicModel.newFromMapRoot(
      TOPIC_MAP_ROOT_JSON, ['1', '2', '3', '4', '5']);
  expectEq(TOPIC_MAP_ROOT_JSON, model.toMapRoot());
};
