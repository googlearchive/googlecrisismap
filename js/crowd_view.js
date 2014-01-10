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
goog.require('cm.MapModel');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('cm.util');

goog.require('goog.array');
goog.require('goog.dom.classes');
goog.require('goog.net.Jsonp');
goog.require('goog.net.XhrIo');
goog.require('goog.object');


/**
 * A view showing crowd reports and accepting new crowd reports for a feature.
 * @param {Element} parentElem The element in which to render this view.
 * @param {cm.MapModel} mapModel The model for the map being displayed.
 * @param {Object} config A dictionary of configuration options.
 * @constructor
 */
cm.CrowdView = function(parentElem, mapModel, config) {
  this.reportQueryUrl_ = config['report_query_url'];
  this.reportPostUrl_ = config['report_post_url'];

  /** @private {cm.MapModel} */
  this.mapModel_ = mapModel;

  /** @private {string} Currently selected feature's layer. */
  this.layerId_;

  /** @private {google.maps.LatLng} Currently selected feature's position. */
  this.position_;

  /** @private {Element} The area for collecting a report from the user. */
  this.reportCollectionDiv_ = cm.ui.create('div', cm.css.REPORT_COLLECTION);

  /** @private {Element} The area for displaying the list of reports. */
  this.reportDisplayDiv_ = cm.ui.create('div', cm.css.REPORTS);

  /** @private {Element} The text field for entering a comment with a report. */
  this.textInput_;

  /** @private {Element} The button for submitting the report form. */
  this.submitBtn_;

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
  this.layerId_ = featureData.layerId;
  this.position_ = featureData.position;

  // Set up a map of answer objects by answer ID, for convenient access.
  var topics = this.mapModel_.getCrowdTopicsForLayer(this.layerId_);
  goog.array.forEach(topics, function(topic) {
    var questions = /** @type Array.<Object> */(topic.get('questions'));
    goog.array.forEach(questions, function(question) {
      goog.array.forEach(question.answers, function(answer) {
        answersById[mapId + '.' + topic.get('id') + '.' +
                    question.id + '.' + answer.id] = answer;
      });
    });
  });

  if (topics.length) {
    // TODO(kpy): Replace "Loading..." text with a spinner icon.
    cm.ui.append(this.reportDisplayDiv_, cm.ui.create('p', {}, cm.MSG_LOADING));

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
  var anyAnswer = false;
  for (var qid in this.selectedAnswerIds_) {
    anyAnswer = anyAnswer || this.selectedAnswerIds_[qid];
  }
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

  function makeButton(answerTitleAndId) {
    var button = cm.ui.create('div', cm.css.BUTTON, answerTitleAndId.title);
    cm.events.listen(button, 'click', function() {
      goog.array.forEach(buttons, function(b) {  // select it, deselect others
        goog.dom.classes.enable(b, cm.css.SELECTED, b === button);
      });
      self.selectedAnswerIds_[qid] = answerTitleAndId.id;
      self.updateSubmitButton_();
    });
    return button;
  }

  var answerTitlesAndIds = goog.array.map(question.answers, function(answer) {
    return {title: answer.title, id: qid + '.' + answer.id};
  }).concat({title: cm.MSG_NOT_SURE, id: null});

  buttons = goog.array.map(answerTitlesAndIds, makeButton);
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
  var bubble;
  cm.ui.append(parentElem,
      bubble = cm.ui.create('div', [cm.css.CROWD_BUBBLE, cm.css.COLLAPSED],
          cm.ui.create('div', cm.css.CROWD_BUBBLE_TAIL),
          cm.ui.create('div', cm.css.CROWD_REPORT_PROMPT,
              cm.ui.create('div', cm.css.CROWD_MORE),
              cm.ui.create('div', {}, cm.MSG_CROWD_REPORT_PROMPT))));

  // Questions and their answer buttons
  var closeBtn = cm.ui.create('div', cm.css.CLOSE_BUTTON);
  var form = cm.ui.create('div', cm.css.CROWD_REPORT_FORM, closeBtn);
  goog.array.forEach(topics, function(topic) {
    var topicId = mapId + '.' + topic.get('id');
    topic.get('questions').forEach(function(question) {
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
              'input', {'type': 'text', 'placeholder': cm.MSG_ENTER_COMMENT})),
      cm.ui.create('div', cm.css.BUTTON_AREA,
          self.submitBtn_ = cm.ui.create(
              'input', {'type': 'submit', 'value': cm.MSG_POST,
                        'class': [cm.css.BUTTON, cm.css.SUBMIT]})),
      cm.ui.create('div', cm.css.NOTICE, cm.MSG_CROWD_PRIVACY_DISCLAIMER)
  );
  self.submitBtn_.disabled = true;

  // Form opening and closing behaviour
  function openForm(event) {
    if (self.formPopupEnabled_) {
      goog.dom.classes.swap(bubble, cm.css.EXPANDED, cm.css.COLLAPSED);
      goog.dom.classes.add(form, cm.css.POPUP);
      cm.ui.remove(form);
      cm.ui.showPopup(form);
    } else {
      goog.dom.classes.remove(form, cm.css.POPUP);
      cm.ui.append(bubble, form);
      goog.dom.classes.swap(bubble, cm.css.COLLAPSED, cm.css.EXPANDED);
    }
  };

  function closeForm(event) {
    goog.dom.classes.swap(bubble, cm.css.EXPANDED, cm.css.COLLAPSED);
    cm.ui.remove(form);

    goog.array.forEach(cm.ui.getAllByClass(cm.css.BUTTON, form),
        function(b) { goog.dom.classes.remove(b, cm.css.SELECTED); });
    self.selectedAnswerIds_ = {};
    self.textInput_.value = '';
    self.submitBtn_.disabled = true;

    event && event.stopPropagation();  // so click-to-expand doesn't kick in
  }

  cm.events.listen(bubble, 'click', openForm);
  cm.events.listen(closeBtn, 'click', closeForm);

  // Text input behaviour
  cm.events.listen(self.textInput_, ['keyup', 'cut', 'paste', 'change'],
      function() { window.setTimeout(function() {
        self.updateSubmitButton_();
      }, 1); }
  );

  // Submission behaviour
  var latLng = self.position_.lat() + ',' + self.position_.lng();
  var topicIds = goog.array.map(
      topics, function(topic) { return mapId + '.' + topic.get('id'); });
  function submitForm(event) {
    var answerIds = cm.util.removeNulls(
        goog.object.getValues(self.selectedAnswerIds_)) || [];
    goog.net.XhrIo.send(self.reportPostUrl_, function(e) {
      self.loadReports_(self.reportDisplayDiv_);
    }, 'POST', 'll=' + encodeURIComponent(latLng) +
               '&topic_ids=' + encodeURIComponent(topicIds.join(',')) +
               '&answer_ids=' + encodeURIComponent(answerIds.join(',')) +
               '&text=' + encodeURIComponent(self.textInput_.value));
    closeForm(event);
  }
  cm.events.listen(self.submitBtn_, 'click', submitForm);
  cm.events.listen(self.textInput_, 'keypress', function(event) {
    if (event.keyCode == 13) submitForm(event);
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

  new goog.net.Jsonp(self.reportQueryUrl_).send({
    'll': self.position_.lat() + ',' + self.position_.lng(),
    'topic_ids': goog.array.map(
        topics, function(t) { return mapId + '.' + t.get('id'); }).join(','),
    'radii': goog.array.map(
        topics, function(t) { return t.get('cluster_radius'); }).join(',')
  }, function(reports) {
    cm.ui.clear(parentElem);
    cm.ui.append(parentElem, cm.ui.create('div', {},
        goog.array.map(reports, goog.bind(self.renderReport_, self))));
    parentElem.style.display = reports.length ? '' : 'none';
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
  return cm.ui.create('div', {},
      cm.ui.create('div', cm.css.REPORT,
          cm.ui.create('div', cm.css.TIME,
              cm.util.shortAge(report['effective'])),
          goog.array.map(report['answer_ids'], function(aid) {
            var answer = self.answersById_[aid];
            var div = cm.ui.create('div', cm.css.ANSWER,
                answer.label || answer.title);
            div.style.background = answer.color;
            div.style.color = cm.ui.legibleTextColor(answer.color);
            return div;
          }), report['text']),
      null
  );
};
