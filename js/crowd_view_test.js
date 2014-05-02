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

goog.require('cm.CrowdView');

function CrowdViewTest() {
  cm.TestBase.call(this);
  this.feature_ = {
    'layerId': '1',
    'position': new google.maps.LatLng(3, 4)
  };
  this.mapRoot_ = {
    'id': 'map1',
    'layers': [
      {'id': '1', title: 'Emergency shelters', type: 'KML'}
    ],
    'topics': [{
      'id': 'shelter',
      'title': 'Shelter',
      'layer_ids': ['1'],
      'crowd_enabled': true,
      'cluster_radius': 456,
      'questions': [{
        'id': 'q1',
        'text': 'Is there space available?',
        'answers': [
          {'id': 'y', 'title': 'Yes', 'label': 'space', 'color': '#00c000'},
          {'id': 'n', 'title': 'No', 'label': 'no space', 'color': '#c00000'}
        ]
      }, {
        'id': 'q2',
        'text': 'Are overnight stays allowed?',
        'answers': [
          {'id': 'y', 'title': 'Yes', 'label': 'overnight', 'color': '#00c080'},
          {'id': 'n', 'title': 'No', 'label': 'day only', 'color': '#c00080'}
        ]
      }]
    }]
  };
  this.config_ = {'report_query_url': 'http://app.com/api/.reports',
                  'report_post_url': 'http://app.com/api/.reports?xsrf=foo'};
}
CrowdViewTest.prototype = new cm.TestBase();
registerTestSuite(CrowdViewTest);

/** @private Constructs a CrowdView for testing. */
CrowdViewTest.prototype.createCrowdView_ = function() {
  var parent = cm.ui.create('div');
  this.mapModel_ = cm.MapModel.newFromMapRoot(this.mapRoot_);
  this.view_ = new cm.CrowdView(parent, this.mapModel_, this.config_);
  return parent;
};

/** @private Opens a CrowdView with a given list of reports. */
CrowdViewTest.prototype.openCrowdView_ = function(reports) {
  // Set up a mock to return the reports.
  var jsonp = this.expectNew_('goog.net.Jsonp', this.config_.report_query_url);
  expectCall(jsonp.send)({
    'll': '3,4',
    'topic_ids': 'map1.shelter',
    'radii': '456',
    'votes': '1'
  }, _).willOnce(function(_, callback) { callback(reports); });

  // Open the CrowdView.
  var parent = this.createCrowdView_();
  this.view_.open(this.feature_);
  return parent;
};

/** Verifies that reports are retrieved and displayed. */
CrowdViewTest.prototype.displayReports = function() {
  // Open the CrowdView with two reports.
  var now = new Date().getTime() / 1000;
  var parent = this.openCrowdView_([{
    'effective': now - 301,
    'answers': {'map1.shelter.q1': 'y'},
    'text': 'Foo'
  }, {
    'effective': now - 7200,
    'answers': {'map1.shelter.q1': 'n', 'map1.shelter.q2': 'y'},
    'text': 'Bar'
  }]);

  // Verify that both reports are correctly displayed.
  var reports = allDescendantsOf(
      expectDescendantOf(parent, withClass(cm.css.REPORTS)),
      withClass(cm.css.REPORT));
  expectEq(2, reports.length);

  var r = reports[0];
  expectDescendantOf(r, withClass(cm.css.TIME), withText('5m ago'));
  expectDescendantOf(r, withClass(cm.css.ANSWER), withText('space'));
  expectDescendantOf(r, '#text', withText('Foo'));

  r = reports[1];
  expectDescendantOf(r, withClass(cm.css.TIME), withText('2h ago'));
  expectDescendantOf(r, withClass(cm.css.ANSWER), withText('no space'));
  expectDescendantOf(r, withClass(cm.css.ANSWER), withText('overnight'));
  expectDescendantOf(r, '#text', withText('Bar'));
};

/** Verifies the voting UI for reports. */
CrowdViewTest.prototype.voteOnReports = function() {
  // We're going to show 2 reports with a total of 6 upvotes and 9 downvotes.
  this.expectLogAction(
      cm.Analytics.PassiveAction.CROWD_REPORTS_DISPLAYED, '1', 1, 2);
  this.expectLogAction(
      cm.Analytics.PassiveAction.CROWD_VOTES_DISPLAYED, '1', 1, -3);

  // Open the CrowdView with two reports.
  var now = new Date().getTime() / 1000;
  var parent = this.openCrowdView_([{
    'id': 'r0',
    'effective': now - 301,
    'answers': {'map1.shelter.q1': 'y'},
    'upvote_count': 1,
    'downvote_count': 6
  }, {
    'id': 'r1',
    'effective': now - 7200,
    'text': 'Bar',
    'upvote_count': 5,
    'downvote_count': 3,
    'vote': 'd'
  }]);

  // Verify that the voting UI is correctly displayed.
  var reports = allDescendantsOf(
      expectDescendantOf(parent, withClass(cm.css.REPORTS)),
      withClass(cm.css.REPORT));
  expectEq(2, reports.length);

  var r = reports[0];  // first report has no text, so no voting UI
  expectNoDescendantOf(r, withClass(cm.css.REPORT_VOTE));

  r = reports[1];  // second report should have a voting UI
  expectDescendantOf(r, withClass(cm.css.REPORT_VOTE));
  var upBtn = expectDescendantOf(r, withClass(cm.css.UPVOTE));
  var upCount = expectDescendantOf(
      r, withClass(cm.css.VOTE_COUNT), withText('5'));
  var downBtn = expectDescendantOf(r, withClass(cm.css.DOWNVOTE));
  var downCount = expectDescendantOf(
      r, withClass(cm.css.VOTE_COUNT), withText('3'));

  // Switch from a downvote to an upvote.
  this.setForTest_('cm.xhr.post', createMockFunction());
  expectCall(cm.xhr.post)(this.config_.vote_post_url);
  cm.events.emit(upBtn, 'click');
  expectThat(upCount, withText('6'));
  expectThat(downCount, withText('2'));
};

/** Verifies the report submission flow. */
CrowdViewTest.prototype.submitReport = function() {
  // Open the CrowdView with no reports.
  var parent = this.openCrowdView_([]);

  // Clicking the bubble should reveal the form.
  var bubble = expectDescendantOf(parent, withClass(cm.css.CROWD_BUBBLE));
  cm.events.emit(bubble, 'click');

  // Verify that both questions appear in the form.
  var form = expectDescendantOf(parent, withClass(cm.css.CROWD_REPORT_FORM));
  var questions = allDescendantsOf(form, withClass(cm.css.QUESTION));
  expectEq(2, questions.length);

  var q = questions[0];
  expectDescendantOf(q, 'h3', withText('Is there space available?'));
  var q1yes = expectDescendantOf(q, withClass(cm.css.BUTTON), withText('Yes'));
  expectDescendantOf(q, withClass(cm.css.BUTTON), withText('No'));
  expectDescendantOf(q, withClass(cm.css.BUTTON), withText('Not sure'));

  q = questions[1];
  expectDescendantOf(q, 'h3', withText('Are overnight stays allowed?'));
  expectDescendantOf(q, withClass(cm.css.BUTTON), withText('Yes'));
  var q2no = expectDescendantOf(q, withClass(cm.css.BUTTON), withText('No'));
  expectDescendantOf(q, withClass(cm.css.BUTTON), withText('Not sure'));

  // Set up a mock to expect a report submission.
  this.setForTest_('cm.xhr.post', createMockFunction());
  expectCall(cm.xhr.post)(this.config_.report_post_url, {}, _);

  // Submit a new report.
  cm.events.emit(q1yes, 'click');
  cm.events.emit(q2no, 'click');
  var textInput = expectDescendantOf(form, 'input', withAttr('type', 'text'));
  textInput.value = 'A new comment';
  cm.events.emit(expectDescendantOf(form, 'input', withValue('Post')),
                 'click', {'stopPropagation': function() { }});

  // Verify the contents of the report.
  expectEq('3,4', cm.ui.get('cm-ll').value);
  expectEq('map1.shelter', cm.ui.get('cm-topic-ids').value);
  expectEq('{"map1.shelter.q1":"y","map1.shelter.q2":"n"}',
           cm.ui.get('cm-answers-json').value);
};
