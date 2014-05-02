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

goog.provide('cm.CrowdView');

goog.require('cm');
goog.require('cm.Analytics');
goog.require('cm.MapModel');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('cm.util');
goog.require('cm.xhr');

goog.require('goog.array');
goog.require('goog.dom.classes');
goog.require('goog.net.Jsonp');
goog.require('goog.object');
goog.require('goog.string');


/**
 * A view showing crowd reports and accepting new crowd reports for a feature.
 * @param {Element} parentElem The element in which to render this view.
 * @param {cm.MapModel} mapModel The model for the map being displayed.
 * @param {Object} config A dictionary of configuration options.
 * @constructor
 */
cm.CrowdView = function(parentElem, mapModel, config) {
  this.protectUrl_ = config['protect_url'];
  this.reportQueryUrl_ = config['report_query_url'];
  this.reportPostUrl_ = config['report_post_url'];
  this.votePostUrl_ = config['vote_post_url'];

  /** @private {cm.MapModel} */
  this.mapModel_ = mapModel;

  /** @private {string} Currently selected feature's layer. */
  this.layerId_;

  /** @private {google.maps.LatLng} Currently selected feature's position. */
  this.position_;

  /** @private {Element} The area for collecting a report from the user. */
  this.reportCollectionDiv_ = cm.ui.create('div', cm.css.REPORT_COLLECTION);

  /** @private {Element} Loading message. TODO(kpy): Use a spinner icon? */
  this.loadingDiv_ = cm.ui.create('p', {}, cm.MSG_LOADING);
  this.loadingDiv_.style.display = 'none';

  /** @private {Element} The area for displaying the list of reports. */
  this.reportDisplayDiv_ = cm.ui.create(
      'div', cm.css.REPORTS, this.loadingDiv_);

  /** @private {Element} The text field for entering a comment with a report. */
  this.textInput_;

  /** @private {boolean} True after comment form protection is initialized. */
  this.isProtectionReady_ = false;

  /** @private {Element} Hidden field for the 'cm-ll' parameter. */
  this.llInput_;

  /** @private {Element} Hidden field for the 'cm-topic-ids' parameter. */
  this.topicIdsInput_;

  /** @private {Element} Hidden field for the 'cm-answers-json' parameter. */
  this.answersJsonInput_;

  /** @private {Element} Hidden field for the 'cm-report-id' parameter. */
  this.reportIdInput_;

  /** @private {Element} Hidden field for the 'cm-vote-code' parameter. */
  this.voteCodeInput_;

  /** @private {Element} The button for submitting the report form. */
  this.submitBtn_;

  /** @private {Array.<string>} Question IDs relevant to the layer, in order. */
  this.questionIds_ = [];

  /** @private {Object.<Object>} A map of answer objects by answer ID. */
  this.answersById_ = {};

  /** @private {Object} Map of question IDs to currently selected answer IDs. */
  this.selectedAnswerIds_ = {};

  /** @private {boolean} If true, form opens in a popup; else opens in place. */
  this.formPopupEnabled_ = false;

  goog.dom.classes.add(parentElem, cm.css.CROWD);
  cm.ui.append(parentElem, this.reportCollectionDiv_, this.reportDisplayDiv_);
};

/**
 * @param {boolean} enabled If true, the form will open in a separate popup.
 *     Otherwise, the form will open embedded within the crowd view.
 */
cm.CrowdView.prototype.enableFormPopup = function(enabled) {
  this.formPopupEnabled_ = enabled;
};

/**
 * Populates and shows the view with information for a given map feature.
 * @param {cm.events.FeatureData} featureData
 */
cm.CrowdView.prototype.open = function(featureData) {
  var mapId = this.mapModel_.get('id');
  var answersById = this.answersById_ = {};
  var questionIds = this.questionIds_ = [];
  this.layerId_ = featureData.layerId;
  this.position_ = featureData.position;

  // Set up a map of answer objects by answer ID, for convenient access.
  var topics = this.mapModel_.getCrowdTopicsForLayer(this.layerId_);
  goog.array.forEach(topics, function(topic) {
    var questions = /** @type Array.<Object> */(topic.get('questions'));
    goog.array.forEach(questions, function(question) {
      var qid = mapId + '.' + topic.get('id') + '.' + question.id;
      questionIds.push(qid);
      goog.array.forEach(question.answers, function(answer) {
        answersById[qid + '.' + answer.id] = answer;
      });
    });
  });

  if (topics.length) {
    this.renderCollectionArea_(this.reportCollectionDiv_);
    this.loadReports_(this.reportDisplayDiv_);  // kicks off an async request
  }
};

/** Closes the view. */
cm.CrowdView.prototype.close = function() {
  cm.ui.clear(this.reportCollectionDiv_);
  cm.ui.clear(this.reportDisplayDiv_);
};

/**
 * Enables the submit button iff any answers are selected or text is entered.
 * @private
 */
cm.CrowdView.prototype.updateSubmitButton_ = function() {
  if (!this.isProtectionReady_) {
    this.submitBtn_.disabled = true;
    return;
  }
  var anyAnswer = goog.object.some(
      this.selectedAnswerIds_, function(aid) { return aid; });
  this.submitBtn_.disabled = !(anyAnswer || this.textInput_.value.match(/\S/));
};

/**
 * Creates the row of answer buttons for a particular question.
 * @param {string} topicId The topic ID (including the mapID).
 * @param {Object} question The question object (inside the topic).
 * @return {Array.<Element>} The answer buttons.
 * @private
 */
cm.CrowdView.prototype.makeAnswerButtons_ = function(topicId, question) {
  var self = this;  // this scope uses 'self' throughout instead of 'this'
  var qid = topicId + '.' + question.id;
  var buttons = [];  // held locally so we can deselect other buttons on click

  function makeButton(answer) {
    var button = cm.ui.create('div', cm.css.BUTTON, answer.title);
    cm.events.listen(button, 'click', function() {
      goog.array.forEach(buttons, function(b) {  // select it, deselect others
        goog.dom.classes.enable(b, cm.css.SELECTED, b === button);
      });
      self.selectedAnswerIds_[qid] = answer.id;
      self.answersJsonInput_.value =
          goog.json.serialize(self.selectedAnswerIds_);
      cm.Analytics.logAction(
          cm.Analytics.CrowdReportFormAction.ANSWER_BUTTON_CLICKED,
          self.layerId_);
      self.updateSubmitButton_();
    });
    return button;
  }

  var notSure = {title: cm.MSG_NOT_SURE, id: null};
  buttons = goog.array.map(question.answers.concat(notSure), makeButton);
  return buttons;
};

/**
 * Renders a new report collection prompt and form into the given element,
 * replacing any previously existing content.
 * @param {Element} parentElem The element in which to render the form.
 * @private
 */
cm.CrowdView.prototype.renderCollectionArea_ = function(parentElem) {
  var self = this;  // this scope uses 'self' throughout instead of 'this'
  var topics = self.mapModel_.getCrowdTopicsForLayer(self.layerId_);
  var mapId = self.mapModel_.get('id');

  cm.ui.clear(parentElem);
  cm.ui.append(parentElem, cm.ui.create('h2', {}, cm.MSG_CITIZEN_REPORTS));

  // Prompt bubble
  var bubble, form, closeBtn;
  cm.ui.append(parentElem,
      bubble = cm.ui.create('div', [cm.css.CROWD_BUBBLE, cm.css.COLLAPSED],
          cm.ui.create('div', cm.css.CROWD_BUBBLE_TAIL),
          cm.ui.create('div', cm.css.CROWD_REPORT_PROMPT,
              cm.ui.create('div', cm.css.CROWD_MORE),
              cm.ui.create('div', {}, cm.MSG_CROWD_REPORT_PROMPT)),
          form = cm.ui.create('div', cm.css.CROWD_REPORT_FORM,
              closeBtn = cm.ui.create('div', cm.css.CLOSE_BUTTON))));

  // Questions and their answer buttons
  goog.array.forEach(topics, function(topic) {
    var topicId = mapId + '.' + topic.get('id');
    var questions = /** @type Array.<Object> */(topic.get('questions'));
    goog.array.forEach(questions, function(question) {
      cm.ui.append(form,
          cm.ui.create('div', cm.css.QUESTION,
              cm.ui.create('h3', {}, question.text),
              cm.ui.create('div', cm.css.ANSWERS,
                  cm.ui.create('div', cm.css.BUTTON_GROUP,
                      self.makeAnswerButtons_(topicId, question)))
      ));
    });
  });

  // Comment input field and submission button
  cm.ui.append(form,
      cm.ui.create('div', cm.css.REPORT_TEXT,
          self.textInput_ = cm.ui.create(
              'input', {'type': 'text', 'id': 'cm-text',
                        'placeholder': cm.MSG_ENTER_COMMENT})),
      cm.ui.create('div', cm.css.BUTTON_AREA,
          self.submitBtn_ = cm.ui.create(
              'input', {'type': 'submit', 'value': cm.MSG_POST,
                        'class': [cm.css.BUTTON, cm.css.SUBMIT]})),
      cm.ui.create('div', cm.css.NOTICE, cm.MSG_CROWD_PRIVACY_DISCLAIMER)
  );
  self.submitBtn_.disabled = true;

  // Form opening and closing behaviour
  function openForm(event) {
    goog.dom.classes.remove(form, cm.css.HIDDEN);
    goog.dom.classes.enable(form, cm.css.POPUP, self.formPopupEnabled_);
    if (self.formPopupEnabled_) {
      goog.dom.classes.swap(bubble, cm.css.EXPANDED, cm.css.COLLAPSED);
      cm.ui.remove(form);
      cm.ui.showPopup(form);
    } else {
      cm.ui.append(bubble, form);
      goog.dom.classes.swap(bubble, cm.css.COLLAPSED, cm.css.EXPANDED);
    }
  };

  function closeForm(event) {
    goog.dom.classes.swap(bubble, cm.css.EXPANDED, cm.css.COLLAPSED);
    cm.ui.append(bubble, form);

    goog.array.forEach(cm.ui.getAllByClass(cm.css.BUTTON, form),
        function(b) { goog.dom.classes.remove(b, cm.css.SELECTED); });
    self.selectedAnswerIds_ = {};
    self.textInput_.value = '';
    self.submitBtn_.disabled = true;
    if (event) {  // prevent the click from immediately re-expanding the bubble
      event.stopPropagation && event.stopPropagation();
      event.cancelBubble = true;  // for IE 8
    }
  }

  cm.events.listen(bubble, 'click', function(event) {
    cm.Analytics.logAction(
        cm.Analytics.CrowdReportFormAction.PROMPT_BUBBLE_CLICKED,
        self.layerId_);
    openForm(event);
  });
  cm.events.listen(closeBtn, 'click', function(event) {
    cm.Analytics.logAction(
        cm.Analytics.CrowdReportFormAction.CLOSE_BUTTON_CLICKED, self.layerId_);
    closeForm(event);
  });

  // Text input behaviour
  cm.events.listen(self.textInput_, ['keyup', 'cut', 'paste', 'change'],
      function() { window.setTimeout(function() {
        self.updateSubmitButton_();
      }, 1); }
  );

  // Hidden fields for other submitted information
  cm.ui.append(parentElem,
      this.llInput_ = cm.ui.create('input', {'type': 'hidden', 'id': 'cm-ll'}),
      this.topicIdsInput_ = cm.ui.create(
          'input', {'type': 'hidden', 'id': 'cm-topic-ids'}),
      this.answersJsonInput_ = cm.ui.create(
          'input', {'type': 'hidden', 'id': 'cm-answers-json'}),
      this.reportIdInput_ = cm.ui.create(
          'input', {'type': 'hidden', 'id': 'cm-report-id'}),
      this.voteCodeInput_ = cm.ui.create(
          'input', {'type': 'hidden', 'id': 'cm-vote-code'})
  );

  // Submission behaviour
  cm.xhr.protectInputs(
      self.protectUrl_, self.reportPostUrl_,
      ['cm-ll', 'cm-text', 'cm-topic-ids', 'cm-answers-json'],
      function() {
        self.isProtectionReady_ = true;
        self.updateSubmitButton_();
      }
  );
  cm.xhr.protectInputs(
      self.protectUrl_, self.votePostUrl_, ['cm-report-id', 'cm-vote-code']);

  self.llInput_.value = self.position_.lat() + ',' + self.position_.lng();
  var topicIds = goog.array.map(
      topics, function(topic) { return mapId + '.' + topic.get('id'); });
  self.topicIdsInput_.value = topicIds.join(',');

  function submitForm(event) {
    cm.xhr.post(self.reportPostUrl_, {}, function() {
      self.loadReports_(self.reportDisplayDiv_);
    });
    cm.Analytics.logAction(
        cm.Analytics.CrowdReportFormAction.POST_CLICKED, self.layerId_);
    closeForm(event);
    self.loadingDiv_.style.display = '';
  }
  cm.events.listen(self.submitBtn_, 'click', submitForm);
  cm.events.listen(self.textInput_, 'keypress', function(event) {
    if (event.keyCode === 13) submitForm(event);
  });
};

/**
 * Loads the reports for the current feature, then renders them into the given
 * element (replacing any previously existing content in the element).
 * @param {Element} parentElem The element in which to render the reports.
 * @private
 */
cm.CrowdView.prototype.loadReports_ = function(parentElem) {
  var self = this;  // this scope uses 'self' throughout instead of 'this'
  var topics = self.mapModel_.getCrowdTopicsForLayer(self.layerId_);
  var mapId = self.mapModel_.get('id');

  self.loadingDiv_.style.display = '';
  new goog.net.Jsonp(self.reportQueryUrl_).send({
    'll': self.position_.lat() + ',' + self.position_.lng(),
    'topic_ids': goog.array.map(
        topics, function(t) { return mapId + '.' + t.get('id'); }).join(','),
    'radii': goog.array.map(
        topics, function(t) { return t.get('cluster_radius'); }).join(','),
    'votes': '1'
  }, function(reports) {
    self.loadingDiv_.style.display = 'none';
    cm.ui.clear(parentElem);
    // We keep the loadingDiv_ present at the top of the list and turn it on
    // and off by setting its style.display property.
    cm.ui.append(parentElem, self.loadingDiv_);
    cm.ui.append(parentElem, cm.ui.create('div', {},
        goog.array.map(reports, goog.bind(self.renderReport_, self))));
    parentElem.style.display = reports.length ? '' : 'none';
    if (reports.length) {
      var totalUpvotes = 0, totalDownvotes = 0;
      for (var i = 0; i < reports.length; i++) {
        totalUpvotes += reports[i]['upvote_count'] || 0;
        totalDownvotes += reports[i]['downvote_count'] || 0;
      }
      cm.Analytics.logAction(cm.Analytics.PassiveAction.CROWD_REPORTS_DISPLAYED,
                             self.layerId_, reports.length);
      cm.Analytics.logAction(cm.Analytics.PassiveAction.CROWD_VOTES_DISPLAYED,
                             self.layerId_, totalUpvotes - totalDownvotes);
    }
  });
};

/**
 * Renders a single report.
 * @param {Object} report A JSON data object returned from /.api/reports.
 * @return {Element} The report rendered for display.
 * @private
 */
cm.CrowdView.prototype.renderReport_ = function(report) {
  var self = this;  // this scope uses 'self' throughout instead of 'this'

  var timeDiv = cm.ui.create('div', cm.css.TIME,
      cm.util.shortAge(report['effective']));

  var answerChips = [], chip;
  var answers = report['answers'] || {};
  goog.array.forEach(this.questionIds_, function(qid) {
    var answer = self.answersById_[qid + '.' + answers[qid]];
    if (answer) {
      chip = cm.ui.create('div', cm.css.ANSWER, answer.label || answer.title);
      chip.style.background = answer.color;
      chip.style.color = cm.ui.legibleTextColor(answer.color);
      answerChips.push(chip);
    }
  });
  answerChips = answerChips.length ? answerChips : null;
  var text = goog.string.trim(report['text'] || '') || null;

  return cm.ui.create('div', cm.css.REPORT,
      answerChips && cm.ui.create('div', cm.css.REPORT_ANSWERS,
          timeDiv, answerChips),
      text && cm.ui.create('div', cm.css.REPORT_TEXT,
          answerChips ? null : timeDiv, text),
      text && self.renderVotingUi_(report)
  );
};

/**
 * Renders the voting section of a single report.
 * @param {Object} report A JSON data object returned from /.api/reports.
 * @return {Element} The voting UI rendered for display.
 * @private
 */
cm.CrowdView.prototype.renderVotingUi_ = function(report) {
  var self = this;  // this scope uses 'self' throughout instead of 'this'
  var vote = report['vote'];  // this user's current vote: '' or 'u' or 'd'
  // Vote counts not including this user's vote, used for recomputing totals.
  var otherUps = report['upvote_count'] - (vote == 'u' ? 1 : 0);
  var otherDowns = report['downvote_count'] - (vote == 'd' ? 1 : 0);
  var upBtn, upLabel, downBtn, downLabel;

  var result = cm.ui.create('div', cm.css.REPORT_VOTE,
      cm.MSG_HELPFUL_QUESTION,
      upBtn = cm.ui.create('span', {
          'class': [cm.css.VOTE, cm.css.UPVOTE],
          'title': cm.MSG_UPVOTE_TOOLTIP
      }),
      upLabel = cm.ui.create('span', [cm.css.VOTE_COUNT]),
      downBtn = cm.ui.create('span', {
          'class': [cm.css.VOTE, cm.css.DOWNVOTE],
          'title': cm.MSG_DOWNVOTE_TOOLTIP
      }),
      downLabel = cm.ui.create('span', [cm.css.VOTE_COUNT])
  );

  function updateUi() {
    goog.dom.classes.enable(upBtn, cm.css.SELECTED, vote === 'u');
    goog.dom.classes.enable(downBtn, cm.css.SELECTED, vote === 'd');
    cm.ui.setText(upLabel, (otherUps + (vote === 'u' ? 1 : 0)) || '');
    cm.ui.setText(downLabel, (otherDowns + (vote === 'd' ? 1 : 0)) || '');
  }

  function setVote(newVote) {
    vote = newVote;
    updateUi();
    self.reportIdInput_.value = report['id'];
    self.voteCodeInput_.value = vote;
    cm.xhr.post(self.votePostUrl_);
    cm.Analytics.logAction(
        cm.Analytics.CrowdReportAction.VOTE_BUTTON_CLICKED,
        self.layerId_, (vote == 'u') ? 1 : (vote == 'd') ? -1 : 0);
  }

  updateUi();
  cm.events.listen(upBtn, 'click', function() {
    setVote((vote === 'u') ? '' : 'u');
  });
  cm.events.listen(downBtn, 'click', function() {
    setVote((vote === 'd') ? '' : 'd');
  });
  return result;
};
