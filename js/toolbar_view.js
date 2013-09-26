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
goog.require('cm.css');
goog.require('cm.events');
goog.require('cm.ui');
goog.require('goog.dom');
goog.require('goog.format.JsonPrettyPrinter');
goog.require('goog.json');
goog.require('goog.net.XhrIo');
goog.require('goog.string');

/* TODO(rew): This link needs to be updated when the draft document is
   finalized and published in its permanent location. */
/* URL to the help document for editing maps. */
var HELP_LINK_URL = 'https://docs.google.com/document/d/' +
    '1cp9hLYJzGZZtM6IyO2WqIUvolU1WyCadlI_pGGtBGDY/pub';

/**
 * A command toolbar.  For now, this is just a few links, but in future will
 * contain other editing/drawing functions.
 * @param {Element} parentElem The DOM element in which to render the toolbar.
 * @param {cm.MapModel} mapModel The map model.
 * @param {boolean} enableSave True to enable the "Save" function.
 * @param {boolean} devMode True to enable the "Show JSON" function.
 * @param {string} mapListUrl The URL endpoint for the user's map list.
 * @param {boolean} touch True if the map is being edited on a touch device.
 * @param {string=} opt_diffUrl URL used in devMode to diff the current
 *     maproot against the original maproot.
 * @constructor
 */
cm.ToolbarView = function(parentElem, mapModel, enableSave, devMode, mapListUrl,
    touch, opt_diffUrl) {
  var collaborateLink = cm.ui.createLink(cm.MSG_COLLABORATE_LINK);
  cm.events.forward(collaborateLink, 'click',
                    goog.global, cm.events.SHARE_EMAIL);

  // TODO(romano): move the toolbars into the inner panel element, which
  // contains the collapse button, map title, description, and layers.
  var toolbarElem = cm.ui.create('div', {'class': cm.css.TOOLBAR},
      cm.ui.createLink(cm.MSG_BACK_TO_MAP_LIST, mapListUrl),
      cm.ui.SEPARATOR_DOT, collaborateLink);

  var helpLink = cm.ui.createLink(cm.MSG_HELP, HELP_LINK_URL, '_blank');
  cm.ui.append(toolbarElem, cm.ui.SEPARATOR_DOT, helpLink);

  // Initially, neither the undo nor the redo operation can be done.
  var undoLink = cm.ui.createLink(cm.MSG_UNDO);
  var redoLink = cm.ui.createLink(cm.MSG_REDO);
  goog.dom.classes.add(undoLink, cm.css.DISABLED);
  goog.dom.classes.add(redoLink, cm.css.DISABLED);

  var undoLinkEventToken = cm.events.forward(undoLink, 'click',
      goog.global, cm.events.UNDO);
  var redoLinkEventToken = cm.events.forward(redoLink, 'click',
      goog.global, cm.events.REDO);

  cm.events.listen(goog.global, cm.events.UNDO_REDO_BUFFER_CHANGED,
    function(e) {
      goog.dom.classes.enable(undoLink, cm.css.DISABLED, !e.undo_possible);
      goog.dom.classes.enable(redoLink, cm.css.DISABLED, !e.redo_possible);
  }, this);

  var editToolbarElem = cm.ui.create('div', {'class': cm.css.EDIT_TOOLBAR},
      undoLink, cm.ui.SEPARATOR_DOT, redoLink);

  if (enableSave) {
    var saveLink = cm.ui.createLink(cm.MSG_SAVED);
    cm.ui.append(editToolbarElem, cm.ui.SEPARATOR_DOT, saveLink);

    // The "Save" link is initially disabled. Changing the model enables it.
    goog.dom.classes.add(saveLink, cm.css.DISABLED);
    cm.events.listen(goog.global, cm.events.MODEL_CHANGED, function() {
      cm.ui.setText(saveLink, cm.MSG_SAVE);
      goog.dom.classes.remove(saveLink, cm.css.DISABLED, cm.css.ERROR);
    }, this);

    // Handle clicks on the "Save" link.
    cm.events.listen(saveLink, 'click', function() {
      if (!goog.dom.classes.has(saveLink, cm.css.DISABLED)) {
        cm.ui.setText(saveLink, cm.MSG_SAVING);
        goog.dom.classes.remove(saveLink, cm.css.ERROR);
        goog.dom.classes.add(saveLink, cm.css.DISABLED);
        cm.events.emit(goog.global, cm.events.SAVE, {model: mapModel});
      }
    });

    // Handle completion of the Save operation.
    cm.events.listen(goog.global, cm.events.SAVE_DONE, function() {
      cm.ui.setText(saveLink, cm.MSG_SAVED);
    }, this);
    cm.events.listen(goog.global, cm.events.SAVE_FAILED, function() {
      // If the save fails, leave the link enabled so the user can click it
      // to try again.  Not the most elegant solution, but good enough for now.
      goog.dom.classes.remove(saveLink, cm.css.DISABLED);
      goog.dom.classes.add(saveLink, cm.css.ERROR);
      cm.ui.setText(saveLink, cm.MSG_SAVE_FAILED);
    }, this);

    // This way works for Chrome, Firefox.
    // cm.events.listen only works in Chrome.
    // In Chrome, this event will not get fired if you navigate to another page
    // within this app via the navigation bar.
    window.onbeforeunload = function() {
      if (!goog.dom.classes.has(saveLink, cm.css.DISABLED)) {
        return cm.MSG_UNSAVED_CHANGES;
      }
    };
  }

  var addNewLayerLink = cm.ui.createLink(cm.MSG_ADD_NEW_LAYERS);
  cm.events.forward(addNewLayerLink, 'click', goog.global, cm.events.INSPECT);
  cm.ui.append(editToolbarElem, cm.ui.SEPARATOR_DOT,
               addNewLayerLink, cm.ui.SEPARATOR_DOT);

  // TODO(joeysilva): Use INSPECT event to create new folders by using a type
  // FOLDER argument.
  var addNewFolderLink = cm.ui.createLink(cm.MSG_ADD_NEW_FOLDER);
  cm.events.forward(
      addNewFolderLink, 'click', goog.global, cm.events.ADD_LAYERS, {
        layers: [{title: cm.MSG_UNTITLED_FOLDER,
                  type: cm.LayerModel.Type.FOLDER}]
      });
  cm.ui.append(editToolbarElem, addNewFolderLink, cm.ui.SEPARATOR_DOT);

  if (!touch) {
    var arrangeLink = cm.ui.createLink(cm.MSG_ARRANGE_LAYERS_LINK);
    cm.events.forward(arrangeLink, 'click', goog.global, cm.events.ARRANGE);
    cm.ui.append(editToolbarElem, arrangeLink);
  }

  if (devMode) {
    var diffJsonLink = cm.ui.createLink(opt_diffUrl ? 'Diff' : 'Show JSON');
    cm.events.listen(diffJsonLink, 'click', goog.bind(
        this.handleDiffJsonClick_, this, mapModel, opt_diffUrl));
    cm.ui.append(editToolbarElem, cm.ui.SEPARATOR_DOT, diffJsonLink);
  }

  toolbarElem.appendChild(editToolbarElem);
  parentElem.appendChild(toolbarElem);
};

/**
 * Displays a popup showing diffs between the MapRoot JSON of the most recently
 * saved draft as well as any/all published versions of this map, against the
 * current, unsaved draft. Will simply show the current, unsaved draft if no
 * map ID is provided.
 * @param {cm.MapModel} mapModel The map model.
 * @param {string=} opt_diffUrl URL used to retrieve diffs between the current,
 *     currently saved, and published versions of this map.
 * @private
 */
cm.ToolbarView.prototype.handleDiffJsonClick_ =
    function(mapModel, opt_diffUrl) {
  var popup = cm.ui.create('div', {'class': [cm.css.POPUP, cm.css.DIFF]});
  cm.ui.createCloseButton(
      popup, function() { goog.dom.removeNode(popup); });
  cm.ui.showPopup(popup);

  // Define links and content element used by showJson and showDiff methods.
  var showJsonLink, showDiffLink;
  var contentElem = cm.ui.create('div');

  // Method to show JSON. Used by JSON link, and when diffs cannot be loaded.
  var showJson = function() {
    contentElem.style.whiteSpace = 'pre';
    cm.ui.setText(contentElem, new goog.format.JsonPrettyPrinter(
        new goog.format.JsonPrettyPrinter.TextDelimiters()).
        format(mapModel.toMapRoot()));

    showJsonLink && goog.style.setElementShown(showJsonLink, false);
    showDiffLink && goog.style.setElementShown(showDiffLink, true);
    cm.ui.showPopup(popup);
  };

  if (opt_diffUrl) {
    // Request diffs and show them.
    var loading = cm.ui.create('span', {}, 'Loading diff...');
    cm.ui.append(popup, loading);
    goog.net.XhrIo.send(opt_diffUrl, function(e) {
      cm.ui.remove(loading);
      if (e.target.isSuccess()) {
        // Stored diffs, along with method to show one based on the select
        // element's current selection. Used by select element, as well as
        // diff link.
        var htmlDiffs, diffSelectElem;
        var showDiff = function() {
          // TODO(joeysilva): Fix bug where line numbers are compacted.
          new cm.Html(htmlDiffs[diffSelectElem.selectedIndex]).pasteInto(
              contentElem);
          goog.style.setElementShown(showJsonLink, true);
          goog.style.setElementShown(showDiffLink, false);
          cm.ui.showPopup(popup);
        };

        cm.ui.append(popup,
            'Diff against: ', diffSelectElem = cm.ui.create('select', {},
                cm.ui.create('option', {}, 'Saved')),
            cm.ui.SEPARATOR_DOT,
            showJsonLink = cm.ui.createLink('Show JSON'),
            showDiffLink = cm.ui.createLink('Show diff'),
            cm.ui.create('br'), cm.ui.create('br'),
            contentElem);

        var response = e.target.getResponseJson();
        htmlDiffs = [response['saved_diff']];
        goog.array.forEach(response['catalog_diffs'], function(entry) {
          cm.ui.append(diffSelectElem,
              cm.ui.create('option', {}, entry['name']));
          htmlDiffs.push(entry['diff']);
        });

        cm.events.listen(diffSelectElem, 'change', showDiff);
        cm.events.listen(showDiffLink, 'click', showDiff);
        showDiff();
      } else {
        cm.ui.append(popup, 'Failed to load diff',
            cm.ui.SEPARATOR_DOT,
            showJsonLink = cm.ui.createLink('Show JSON'),
            cm.ui.create('br'), cm.ui.create('br'),
            contentElem);
      }
      cm.events.listen(showJsonLink, 'click', showJson);

    }, 'POST', 'new_json=' + encodeURIComponent(
        goog.json.serialize(mapModel.toMapRoot())));
  } else {
    // No map ID; just show the JSON.
    cm.ui.append(popup, contentElem);
    showJson();
  }
};
