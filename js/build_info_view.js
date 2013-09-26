// Copyright 2012 Google Inc.  All Rights Reserved.
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
 * @fileoverview Displays build information.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.BuildInfoView');

goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');

/**
 * Displays a build info indicator using data from window['cm_build_info'].
 * @param {Element} parentElem The element in which to place the indicator.
 * @constructor
 */
cm.BuildInfoView = function(parentElem) {
  var element = cm.ui.create('span', {'class': cm.css.BUILD_INFO}, '\u2665');
  cm.ui.append(parentElem, element);

  cm.events.listen(element, 'click', function() {
    var info = window['cm_build_info'];
    cm.ui.setText(element, cm.BuildInfoView.formatBuildInfo(info));
  });
  cm.events.listen(element, 'mouseout', function() {
    cm.ui.setText(element, '\u2665');
  });
};

/**
 * Formats a timestamp as a relative age and an absolute date and time.
 * @param {number} timestamp A timestamp in seconds since 1970-01-01 00:00 UTC.
 * @return {string} A string such as "36 min ago (Jun 05 2012, 11:34 PDT)".
 */
cm.BuildInfoView.formatTime = function(timestamp) {
  var minutes = (new Date().getTime() / 1000 - timestamp) / 60;
  var age = (minutes >= 100) ? (minutes / 60).toFixed(1) + ' h ago' :
                               minutes.toFixed(0) + ' min ago';
  var date = '' + new Date(timestamp * 1000);
  // Tidy up the date string by removing the seconds and the GMT offset.
  date = date.replace(/:\d\d *GMT *[-+]\d+ *\((.*)\)/, ' $1');
  return age + ' (' + date + ')';
};

/**
 * Formats a short message describing the build.
 * @param {Object} info The build info from build_info.js.
 * @return {string} A string describing the build.
 */
cm.BuildInfoView.formatBuildInfo = function(info) {
  var release = info['release'];
  var version = info['version'];
  var submitTime = info['submit_time'];
  var path = info['path'];
  return (release ? 'release' : 'dev') + ' build at ' + version + (submitTime ?
      ', submitted ' + cm.BuildInfoView.formatTime(submitTime) : '');

};
