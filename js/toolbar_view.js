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
 * @fileoverview [MODULE: edit] The toolbar for editing commands.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.ToolbarView');

goog.require('cm.MapModel');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.dom');
goog.require('goog.json');

/** @desc Label for a link that lets the user rearrange the layer
 *  order and hierarchy.
 */

/** @desc Link text to arrange the layers in the panel. */
var MSG_ARRANGE_LAYERS_LINK = goog.getMsg('Arrange');

/** @desc Link text to arrange the layers in the panel. */
var MSG_SHARE_EMAIL_LINK = goog.getMsg('Share with user');

/** @desc Link text to add a new layer to the map. */
var MSG_ADD_NEW_LAYER = goog.getMsg('Add layer');

/** @desc Default title for an empty layer. */
var MSG_UNTITLED_LAYER = goog.getMsg('Untitled Layer');

/** @desc Link text to add a new folder to the map. */
var MSG_ADD_NEW_FOLDER = goog.getMsg('Add folder');

/** @desc Default title for an empty folder. */
var MSG_UNTITLED_FOLDER = goog.getMsg('Untitled Folder');

/** @desc Warning message when discarding unsaved changes. */
var MSG_UNSAVED_CHANGES = goog.getMsg(
    'You have unsaved changes that will be lost if you leave' +
    ' the page without clicking the "Save" link.');

/**
 * A command toolbar.  For now, this is just a few links, but in future will
 * contain other editing/drawing functions.
 * @param {Element} parentElem The DOM element in which to render the toolbar.
 * @param {cm.MapModel} mapModel The map model.
 * @param {boolean} enableSave True to enable the "Save" function.
 * @param {boolean} devMode True to enable the "Show JSON" function.
 * @param {boolean} touch True if the map is being edited on a touch device.
 * @constructor
 */
cm.ToolbarView = function(parentElem, mapModel, enableSave, devMode, touch) {
  // Initially, neither the undo nor the redo operation can be done.
  var undoLink = cm.ui.createLink('Undo');
  var redoLink = cm.ui.createLink('Redo');
  goog.dom.classes.add(undoLink, 'cm-disabled');
  goog.dom.classes.add(redoLink, 'cm-disabled');

  var undoLinkEventToken = cm.events.forward(undoLink, 'click',
      goog.global, cm.events.UNDO);
  var redoLinkEventToken = cm.events.forward(redoLink, 'click',
      goog.global, cm.events.REDO);

  cm.events.listen(goog.global, cm.events.UNDO_REDO_BUFFER_CHANGED,
    function(e) {
      goog.dom.classes.enable(undoLink, 'cm-disabled', !e.undo_possible);
      goog.dom.classes.enable(redoLink, 'cm-disabled', !e.redo_possible);
  }, this);

  var toolbarElem = cm.ui.create('div', {'class': 'cm-toolbar'},
                                 undoLink, cm.ui.SEPARATOR_DOT,
                                 redoLink, cm.ui.SEPARATOR_DOT);
  if (!touch) {
    var arrangeLink = cm.ui.createLink(MSG_ARRANGE_LAYERS_LINK);
    cm.ui.append(toolbarElem, arrangeLink, cm.ui.SEPARATOR_DOT);
    cm.events.forward(arrangeLink, 'click', goog.global, cm.events.ARRANGE);
  }

  var addNewLayerLink = cm.ui.createLink(MSG_ADD_NEW_LAYER);
  cm.events.forward(
      addNewLayerLink, 'click', goog.global, cm.events.CREATE_LAYERS, {
    model: mapModel,
    maproots: [{title: MSG_UNTITLED_LAYER, type: cm.LayerModel.Type.KML}]
  });
  cm.ui.append(toolbarElem, addNewLayerLink, cm.ui.SEPARATOR_DOT);

  var addNewFolderLink = cm.ui.createLink(MSG_ADD_NEW_FOLDER);
  cm.events.forward(
      addNewFolderLink, 'click', goog.global, cm.events.CREATE_LAYERS, {
    model: mapModel,
    maproots: [{title: MSG_UNTITLED_FOLDER, type: cm.LayerModel.Type.FOLDER}]
  });
  cm.ui.append(toolbarElem, addNewFolderLink);

  if (enableSave) {
    var saveLink = cm.ui.createLink('Saved');
    cm.ui.append(toolbarElem, cm.ui.SEPARATOR_DOT, saveLink);

    // The "Save" link is initially disabled. Changing the model enables it.
    goog.dom.classes.add(saveLink, 'cm-disabled');
    cm.events.listen(goog.global, cm.events.MODEL_CHANGED, function() {
      cm.ui.setText(saveLink, 'Save');
      goog.dom.classes.remove(saveLink, 'cm-disabled', 'cm-error');
    }, this);

    // Handle clicks on the "Save" link.
    cm.events.listen(saveLink, 'click', function() {
      if (!goog.dom.classes.has(saveLink, 'cm-disabled')) {
        cm.ui.setText(saveLink, 'Saving...');
        goog.dom.classes.remove(saveLink, 'cm-error');
        goog.dom.classes.add(saveLink, 'cm-disabled');
        cm.events.emit(goog.global, cm.events.SAVE, {model: mapModel});
      }
    });

    // Handle completion of the Save operation.
    cm.events.listen(goog.global, cm.events.SAVE_DONE, function() {
      cm.ui.setText(saveLink, 'Saved');
    }, this);
    cm.events.listen(goog.global, cm.events.SAVE_FAILED, function() {
      // If the save fails, leave the link enabled so the user can click it
      // to try again.  Not the most elegant solution, but good enough for now.
      goog.dom.classes.remove(saveLink, 'cm-disabled');
      goog.dom.classes.add(saveLink, 'cm-error');
      cm.ui.setText(saveLink, 'Save failed');
    }, this);

    // This way works for Chrome, Firefox.
    // cm.events.listen only works in Chrome.
    // In Chrome, this event will not get fired if you navigate to another page
    // within this app via the navigation bar.
    window.onbeforeunload = function() {
      if (!goog.dom.classes.has(saveLink, 'cm-disabled')) {
        return MSG_UNSAVED_CHANGES;
      }
    };

    var shareEmailLink = cm.ui.createLink(MSG_SHARE_EMAIL_LINK);
    cm.events.forward(shareEmailLink, 'click',
                      goog.global, cm.events.SHARE_EMAIL);
    cm.ui.append(toolbarElem, cm.ui.SEPARATOR_DOT, shareEmailLink);
  }

  if (devMode) {
    var jsonLink = cm.ui.createLink('Show JSON');
    cm.ui.append(toolbarElem, cm.ui.SEPARATOR_DOT, jsonLink);
    cm.events.listen(jsonLink, 'click', function() {
      var popup = cm.ui.create('div',
          {'class': 'cm-popup', 'style': 'max-width: 1000px'},
          goog.json.serialize(mapModel.toMapRoot()));
      cm.ui.createCloseButton(
          popup, function() { goog.dom.removeNode(popup); });
      cm.ui.showPopup(popup);
    });
  }

  parentElem.appendChild(toolbarElem);
};
