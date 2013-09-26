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
 * @fileoverview [MODULE: edit] A quartet of entry fields for a LatLonBox.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.LatLonBoxEditor');

goog.require('cm.Editor');
goog.require('cm.css');
goog.require('cm.ui');

/**
 * A single numeric input field.
 * @param {Element} parentElem The parent element in which to create the editor.
 * @param {string} id The element ID for the editor.
 * @param {{input_class: string,
 *          app_state: cm.AppState}} options Editor options:
 *     options.input_class: A CSS class for the input element.
 *     options.app_state: The cm.AppState from which to copy the viewport.
 * @extends cm.Editor
 * @constructor
 */
cm.LatLonBoxEditor = function(parentElem, id, options) {
  cm.Editor.call(this);
  options = options || {};

  /**
   * @type cm.AppState
   * @private
   */
  this.appState_ = options.app_state;

  /**
   * @type Element
   * @private
   */
  this.north_ = cm.ui.create('input', {'class': options.input_class});

  /**
   * @type Element
   * @private
   */
  this.west_ = cm.ui.create('input', {'class': options.input_class});

  /**
   * @type Element
   * @private
   */
  this.east_ = cm.ui.create('input', {'class': options.input_class});

  /**
   * @type Element
   * @private
   */
  this.south_ = cm.ui.create('input', {'class': options.input_class});

  /**
   * @type Element
   * @private
   */
  this.copyViewportCheckbox_ = cm.ui.create('input',
      {'type': 'checkbox', 'id': 'cm-copy-viewport-checkbox'});

  /**
   * @type Element
   * @private
   */
  this.nsLabel_ = cm.ui.create('div', {'class': cm.css.BOX_SIZE_LABEL});

  /**
   * @type Element
   * @private
   */
  this.ewLabel_ = cm.ui.create('div', {'class': cm.css.BOX_SIZE_LABEL});

  /**
   * @type Element
   * @private
   */
  this.viewportInfo_ = cm.ui.create('div', {'class': cm.css.VIEWPORT_INFO},
      cm.MSG_TILE_LAYER_VIEWPORT_WARNING);

  cm.ui.append(parentElem,
      cm.ui.create('table',
          {'class': cm.css.EXTENTS, 'cellpadding': 0, 'cellspacing': 0},
          cm.ui.create('tr', {},
              cm.ui.create('td', {'colspan': 2}, 'N ', this.north_)),
          cm.ui.create('tr', {},
              cm.ui.create('td', {'class': cm.css.WEST}, 'W ', this.west_),
              cm.ui.create('td', {'class': cm.css.EAST}, 'E ', this.east_)),
          cm.ui.create('tr', {},
              cm.ui.create('td', {'colspan': 2}, 'S ', this.south_))
      ),
      cm.ui.create('div', {'class': cm.css.COPY_VIEWPORT},
          this.copyViewportCheckbox_,
          cm.ui.create('label', {'for': 'cm-copy-viewport-checkbox'},
              cm.MSG_USE_CURRENT_MAP_VIEWPORT)),
      this.nsLabel_,
      this.ewLabel_,
      this.viewportInfo_
  );

  cm.events.listen(
      [this.north_, this.west_, this.east_, this.south_],
      ['change', 'input', 'keyup', 'cut', 'paste'], function() {
    var error = null;
    // TODO(kpy): This way of constructing error messages doesn't work for
    // internationalization.  Internationalize these when we get around to
    // redesigning the LatLonBoxEditor UI.
    function parseValue(input, name, minimum, maximum) {
      var number = input.value - 0;
      if (!input.value.match(/\S/) || isNaN(number) || !isFinite(number)) {
        error = error || name + ' should be a number in decimal degrees';
      } else if (number < minimum) {
        error = error || name + ' should not be less than ' + minimum;
      } else if (number > maximum) {
        error = error || name + ' should not be greater than ' + maximum;
      } else {
        return number;
      }
    }

    if (!(this.north_.value + this.south_.value +
          this.west_.value + this.east_.value).match(/\S/)) {
      this.setValid(null);  // empty input is valid and yields a value of null
    } else {
      var north = parseValue(this.north_, 'N', -90, 90);
      var west = parseValue(this.west_, 'W', -180, 180);
      var east = parseValue(this.east_, 'E', -180, 180);
      var south = parseValue(this.south_, 'S', -90, 90);
      if (error) {
        this.setInvalid(error);
      } else if (north <= south) {
        this.setInvalid('N should be greater than S');
      } else {
        this.setValid(new cm.LatLonBox(north, south, east, west));
      }
    }
    this.updateSizeLabels_();
  }, this);

  cm.events.listen(
      this.copyViewportCheckbox_, 'click', this.viewportChanged_, this);
  cm.events.onChange(this.appState_, 'viewport', this.viewportChanged_, this);
};
goog.inherits(cm.LatLonBoxEditor, cm.Editor);

/**
 * Copy the viewport from the AppState into this editor.
 * @private
 */
cm.LatLonBoxEditor.prototype.viewportChanged_ = function() {
  if (this.copyViewportCheckbox_.checked) {
    var viewport = /** @type cm.LatLonBox */(this.appState_.get('viewport'));
    this.setValid(viewport);
    this.updateUi(viewport);
  }
};

/** @override */
cm.LatLonBoxEditor.prototype.updateUi = function(value) {
  var box = value ? value.round(4) : null;  // avoid showing too much precision
  this.north_.value = box ? box.getNorth() : '';
  this.south_.value = box ? box.getSouth() : '';
  this.east_.value = box ? box.getEast() : '';
  this.west_.value = box ? box.getWest() : '';
  this.updateSizeLabels_();
};

/**
 * Displays feedback on the size of the viewport in meters.
 * @private
 */
cm.LatLonBoxEditor.prototype.updateSizeLabels_ = function() {
  if (this.get('validation_error')) {
    cm.ui.setText(this.nsLabel_, '');
    cm.ui.setText(this.ewLabel_, '');
    return;
  }
  var value = this.get('value');
  if (value) {
    /**
     * Converts a distance to a friendly string with two digits of precision.
     * @param {number} meters A distance in meters.
     * @return {string} A friendly string like "2.1 km" or "34 m".
     */
    var displayMeters = function(meters) {
      var magnitude = Math.floor(Math.log(meters) / Math.log(10));
      return meters >= 1000 ?
          cm.util.round(meters / 1000, 4 - magnitude) + ' km' :
          cm.util.round(meters, 1 - magnitude) + ' m';
    };
    var ns = value.getNorthSouthMeters(), ew = value.getEastWestMeters();
    cm.ui.setText(this.nsLabel_, 'N\u2013S: ' + displayMeters(ns));
    cm.ui.setText(this.ewLabel_, 'E\u2013W: ' + displayMeters(ew));
  }
};
