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
 * @fileoverview [MODULE: edit] The registry for all types of editors.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.editors');

goog.require('cm.CheckboxEditor');
goog.require('cm.HtmlEditor');
goog.require('cm.LatLonBoxEditor');
goog.require('cm.LegendEditor');
goog.require('cm.MenuEditor');
goog.require('cm.NumberEditor');
goog.require('cm.RadioEditor');
goog.require('cm.TextEditor');
goog.require('cm.WmsMenuEditor');
goog.require('cm.ui');
goog.require('goog.object');

/**
 * A record representing an available choice that the user can select.
 * The MenuEditor and RadioEditor are configured with an array of these.
 * @typedef {{value: (string|number|null), label: string}}
 */
cm.InputChoice;

/**
 * Identifiers for each type of editor.
 * @enum {string}
 */
cm.editors.Type = {
  CHECKBOX: 'CHECKBOX',
  HTML: 'HTML',
  LAT_LON_BOX: 'LAT_LON_BOX',
  LEGEND: 'LEGEND',
  MENU: 'MENU',
  NUMBER: 'NUMBER',
  RADIO: 'RADIO',
  TEXT: 'TEXT',
  WMS_MENU: 'WMS_MENU'
};

/**
 * A table of editor constructors by editor type.
 * @type {Object.<cm.editors.Type, function(
 *     new:cm.Editor, Element, string, Object, google.maps.MVCObject)>}
 * @const
 */
cm.editors.CONSTRUCTORS = goog.object.create(
  cm.editors.Type.CHECKBOX, cm.CheckboxEditor,
  cm.editors.Type.HTML, cm.HtmlEditor,
  cm.editors.Type.LAT_LON_BOX, cm.LatLonBoxEditor,
  cm.editors.Type.LEGEND, cm.LegendEditor,
  cm.editors.Type.MENU, cm.MenuEditor,
  cm.editors.Type.NUMBER, cm.NumberEditor,
  cm.editors.Type.RADIO, cm.RadioEditor,
  cm.editors.Type.TEXT, cm.TextEditor,
  cm.editors.Type.WMS_MENU, cm.WmsMenuEditor
);

/**
 * @param {Element} parentElem The element in which to place the editor.
 * @param {cm.editors.Type} type The type of editor to create.
 * @param {string} id A DOM element ID for the editor's main input element
 *     (suitable for use elsewhere as the "for" attribute of a <label>).
 * @param {Object} options Additional options for the editor (see the
 *     constructors of the individual cm.*Editor classes for details).
 * @param {google.maps.MVCObject} draft Inspector's draft object.
 * @return {cm.Editor} A newly created editor of the requested type.
 */
cm.editors.create = function(parentElem, type, id, options, draft) {
  return new (cm.editors.CONSTRUCTORS[type])(parentElem, id, options, draft);
};
