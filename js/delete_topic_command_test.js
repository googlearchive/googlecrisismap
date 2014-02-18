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

function DeleteTopicCommandTest() {
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
registerTestSuite(DeleteTopicCommandTest);

/** Tests deleting, undoing, and redoing deleting a topic. */
DeleteTopicCommandTest.prototype.testExecuteUndo = function() {
  var command = new cm.DeleteTopicCommand('t1');
  command.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopicIds(), elementsAre(['t2']));

  command.undo(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopicIds(), elementsAre(['t1', 't2']));

  command.execute(this.appState_, this.mapModel_);
  expectThat(this.mapModel_.getTopicIds(), elementsAre(['t2']));
};
