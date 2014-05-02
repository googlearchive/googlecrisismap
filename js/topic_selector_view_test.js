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

goog.require('cm.css');

function TopicSelectorViewTest() {
  cm.TestBase.call(this);
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
  this.view_ = new cm.TopicSelectorView(this.mapModel_);
}
TopicSelectorViewTest.prototype = new cm.TestBase();
registerTestSuite(TopicSelectorViewTest);

/**
 * Opens the topic selector.
 * @private
 */
TopicSelectorViewTest.prototype.open_ = function() {
  // Grab the popup that the TopicSelectorView will open.
  var me = this;
  this.setForTest_('cm.ui.showPopup', function(popup) {
    me.popup_ = popup;
    cm.ui.document.body.appendChild(me.popup_);
  });

  this.view_.open();

  // Construct this.rows_ object, which keys rows by their title, and has
  // their layer model and row element.
  var rowElems = allDescendantsOf(this.popup_,
      isElement('div', withClass(cm.css.TOPIC_ITEM)));
  var rowCounter = 0;
  this.rows_ = {};
  goog.array.forEach(this.mapModel_.getTopicIds(), function(topicId) {
    var topic = me.mapModel_.getTopic(topicId);
    me.rows_[topic.get('title')] = {topic: topic, elem: rowElems[rowCounter++]};
  }, this);
  expectEq(rowCounter, rowElems.length);
};

/** Tests that the open() method works properly. */
TopicSelectorViewTest.prototype.testOpen = function() {
  this.open_();

  // Confirm that the popup has a title, a table, and two buttons.
  expectDescendantOf(this.popup_, 'h2');
  var buttonArea = expectDescendantOf(this.popup_,
                                      withClass(cm.css.BUTTON_AREA));
  expectDescendantOf(buttonArea, 'button', withText('Cancel'));

  // Confirm the topic rows are there, with correct titles.
  for (var title in this.rows_) {
    var row = this.rows_[title];
    expectDescendantOf(row.elem, 'span', withText(title));
  }
};

/** Tests that selecting a topic works correctly. */
TopicSelectorViewTest.prototype.testSelectTopic = function() {
  this.open_();

  var topic = null;
  cm.events.listen(cm.app, cm.events.INSPECT, function(e) {
    topic = e.object;
  });

  // Click the row for 'Topic One'
  var row = this.rows_['Topic One'];
  cm.events.emit(row.elem, 'click', {stopPropagation: goog.nullFunction});

  // Confirm that the INSPECT event was emitted for the correct topic.
  expectEq(topic, row.topic);
};

/** Tests that deleting a topic works correctly. */
TopicSelectorViewTest.prototype.testDeleteTopic = function() {
  this.open_();

  var id = null;
  cm.events.listen(cm.app, cm.events.DELETE_TOPIC, function(e) {
    id = e.id;
  });

  expectDescendantOf(this.popup_, 'span', withText('Topic One'));

  // Click the delete button for 'Topic One'
  var row = this.rows_['Topic One'];
  var btn = expectDescendantOf(row.elem, 'div', withClass(cm.css.CLOSE_BUTTON));
  cm.events.emit(btn, 'click', {stopPropagation: goog.nullFunction});

  // Confirm that the DELETE_TOPIC event was emitted
  expectEq(id, 't1');
  expectNoDescendantOf(this.popup_, 'span', withText('Topic One'));
};

/** Tests that clicking the Cancel button does nothing. */
TopicSelectorViewTest.prototype.testCancel = function() {
  this.open_();

  var fired = false;
  cm.events.listen(cm.app, cm.events.INSPECT, function(e) {
    fired = true;
  });

  // Click the 'Cancel' button.
  var button = expectDescendantOf(this.popup_, 'button', withText('Cancel'));
  cm.events.emit(button, 'click');

  // Confirm that the INSPECT event was not emitted.
  expectFalse(fired);

  // Confirm that the popup disappeared.
  expectNoDescendantOf(cm.ui.document.body, this.popup_);
};

/** Tests the create new link. */
TopicSelectorViewTest.prototype.testCreateNew = function() {
  this.open_();

  var isNewTopic = false;
  cm.events.listen(cm.app, cm.events.INSPECT, function(e) {
    isNewTopic = e.isNewTopic;
  });

  // Click the 'Create new topic' link
  var link = expectDescendantOf(this.popup_, 'a',
      withText('Create new topic'));
  cm.events.emit(link, 'click');

  // Confirm that the INSPECT event was emitted.
  expectTrue(isNewTopic);

  // Confirm that the popup disappeared.
  expectNoDescendantOf(cm.ui.document.body, this.popup_);
};
