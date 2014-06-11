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

goog.require('cm.ui');
goog.require('goog.object');

/**
 * Identifiers for each type of editor.
 * @enum {string}
 */
cm.editors.Type = {
  CHECKBOX: 'CHECKBOX',
  CHOICE: 'CHOICE',
  HTML: 'HTML',
  LAT_LON_BOX: 'LAT_LON_BOX',
  LAYER_MENU: 'LAYER_MENU',
  LEGEND: 'LEGEND',
  MENU: 'MENU',
  NUMBER: 'NUMBER',
  QUESTION: 'QUESTION',
  QUESTION_LIST: 'QUESTION_LIST',
  RADIO: 'RADIO',
  TEXT: 'TEXT',
  TEXT_LIST: 'TEXT_LIST',
  URL: 'URL',
  WMS_MENU: 'WMS_MENU'
};

/**
 * A table of editor constructors by editor type.
 * @type {Object.<cm.editors.Type, function(
 *     new:cm.Editor, Element, string, Object, google.maps.MVCObject)>}
 */
cm.editors.constructors = {};

/**
 * Registers an editor constructor by its type.
 * @param {cm.editors.Type} type The type of the editor.
 * @param {function(
 *     new:cm.Editor, Element, string, Object, google.maps.MVCObject)} editor An
 *     editor constructor.
 */
cm.editors.register = function(type, editor) {
  cm.editors.constructors[type] = editor;
};

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
  return new (cm.editors.constructors[type])(parentElem, id, options, draft);
};
