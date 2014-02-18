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

// Author: shakusa@google.com (Steve Hakusa)

function CreateTopicsCommandTest() {
  this.mapModel_ = cm.MapModel.newFromMapRoot({
    'id': 'map1',
    'layers': [
      {'id': '1', title: 'Layer One', type: 'KML'},
      {'id': '2', title: 'Layer Two', type: 'KML'}
    ],
    'topics': [
      {'id': 't1', 'title': 'Topic One', 'layer_ids': ['1']},
      {'id': 't2', 'title': 'Topic Two', 'layer_ids': ['2']}
    ]
  });
  this.appState_ = new cm.AppState();
}
registerTestSuite(CreateTopicsCommandTest);

/**
 * Test that execute() and undo() for a single topic.
 */
CreateTopicsCommandTest.prototype.testExecuteUndoSingle = function() {
  var command = new cm.CreateTopicsCommand({
    'title': 'Topic Three', 'layer_ids_': ['1', '2']
  });

  command.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopic('topic_three'), not(isUndefined));
  expectThat(this.mapModel_.getTopicIds(),
      elementsAre(['t1', 't2', 'topic_three']));

  command.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopic('topic_three'), isUndefined);
  expectThat(this.mapModel_.getTopicIds(), elementsAre(['t1', 't2']));

  // redo
  command.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopic('topic_three'), not(isUndefined));
  expectThat(this.mapModel_.getTopicIds(),
      elementsAre(['t1', 't2', 'topic_three']));
};

/**
 * Test that execute() and undo() for multiple topics.
 */
CreateTopicsCommandTest.prototype.testExecuteMultiple = function() {
  var command = new cm.CreateTopicsCommand([
      {'title': 'Topic Four', 'layer_ids': ['2']},
      {'title': 'Topic Five', 'layer_ids': ['1', '2']}
  ]);

  command.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopic('topic_four'), not(isUndefined));
  expectThat(this.mapModel_.getTopic('topic_five'), not(isUndefined));
  expectThat(this.mapModel_.getTopicIds(),
      elementsAre(['t1', 't2', 'topic_four', 'topic_five']));

  command.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopic('topic_four'), isUndefined);
  expectThat(this.mapModel_.getTopic('topic_five'), isUndefined);
  expectThat(this.mapModel_.getTopicIds(), elementsAre(['t1', 't2']));

  // redo
  command.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopic('topic_four'), not(isUndefined));
  expectThat(this.mapModel_.getTopic('topic_five'), not(isUndefined));
  expectThat(this.mapModel_.getTopicIds(),
      elementsAre(['t1', 't2', 'topic_four', 'topic_five']));
};
