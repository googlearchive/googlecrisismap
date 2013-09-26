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
 * @fileoverview The footer below the map in the UI.
 */

goog.provide('cm.FooterView');

goog.require('cm');
goog.require('cm.AboutPopup');
goog.require('cm.Html');
goog.require('cm.MapModel');
goog.require('cm.ui');
goog.require('goog.Uri');

// URL for the support form for reporting abuse.
var REPORT_ABUSE_BASE_URL =
    'https://support.google.com/crisismaps/contact/abuse';

/**
 * The footer below the map in the UI, which includes some custom text from the
 * map model as well as a "Help" link that shows a popup.
 * @param {Element} parentElem The DOM element in which to place the footer.
 * @param {Element} popupContainer The DOM element on which to center the
 *     "Help" popup window.
 * @param {cm.MapModel} mapModel The map model.
 * @param {Object} footerParams Parameters necessary for footer rendering.
 *     publisher_name: The publisher's name.
 *     langs: A list of the BCP 47 codes of all supported languages.
 * @constructor
 */
cm.FooterView = function(parentElem, popupContainer, mapModel, footerParams) {
  /**
   * @type cm.MapModel
   * @private
   */
  this.mapModel_ = mapModel;

  /**
   * @type Element
   * @private
   */
  this.footerSpan_ = cm.ui.create('span');

  /**
   * @type Element
   * @private
   */
  this.langSelect_;

  var publisherName = footerParams['publisher_name'];
  if (publisherName) {
    cm.ui.append(parentElem, cm.ui.create('span', {},
        cm.getMsgPublisherAttribution(publisherName), cm.ui.SEPARATOR_DOT));
  }
  cm.ui.append(parentElem, this.footerSpan_);

  var uri = new goog.Uri(goog.global.location);
  if (window != window.top) {
    uri.removeParameter('embedded');
    var fullMapLink = cm.ui.createLink(cm.MSG_FULL_MAP_LINK, '' +
        uri, '_blank');
    cm.ui.append(parentElem, fullMapLink, cm.ui.SEPARATOR_DOT);
  }

  var helpLink = cm.ui.createLink(cm.MSG_HELP);
  var helpPopup = new cm.AboutPopup(popupContainer);
  helpLink.onclick = goog.bind(helpPopup.show, helpPopup);
  cm.ui.append(parentElem, helpLink);

  var reportAbuseUri = new goog.Uri(REPORT_ABUSE_BASE_URL);
  reportAbuseUri.setParameterValue('url', uri.toString());
  cm.ui.append(parentElem, cm.ui.SEPARATOR_DOT, cm.ui.createLink(
      cm.MSG_REPORT_ABUSE, reportAbuseUri.toString(), '_blank'));

  // Show the language selector only on published maps.
  var langs = footerParams['langs'];
  this.langSelect_ = cm.ui.create('select');
  // Add default as the first item.
  var langChoices = [{'value': '',
      'label': cm.MSG_LANGUAGE_DEFAULT}];
  langChoices = goog.array.concat(langChoices,
      cm.util.createLanguageChoices(langs));
  goog.array.forEach(langChoices, function(langChoice) {
      cm.ui.append(this.langSelect_, cm.ui.create('option',
          {'value': langChoice.value}, langChoice.label));
  }, this);
  var hlParam = uri.getParameterValue('hl');
  this.langSelect_.value = hlParam || '';
  cm.ui.append(parentElem, cm.ui.SEPARATOR_DOT, cm.ui.create('div',
     {'class': cm.css.LANGUAGE_PICKER_ICON}),
    this.langSelect_);

  // Change URL parameter and reload when another language is selected.
  cm.events.listen(this.langSelect_, 'change', function(e) {
      var newUri = (this.value === '') ? uri.removeParameter('hl') :
          uri.setParameterValue('hl', this.value);
      goog.global.location.replace(newUri.toString());
  }, this.langSelect_);

  cm.events.onChange(mapModel, 'footer', this.updateFooter_, this);
  this.updateFooter_();
};

/** @private Updates the footer to match the MapModel. */
cm.FooterView.prototype.updateFooter_ = function() {
  var footer = /** @type cm.Html */(this.mapModel_.get('footer'));
  (footer || cm.Html.EMPTY).pasteInto(this.footerSpan_);
  // Append a separator dot to footer content if it exists.
  if (!footer.isEmpty()) {
    cm.ui.append(this.footerSpan_, cm.ui.SEPARATOR_DOT);
  }
};
