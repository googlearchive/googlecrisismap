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

// Author: kpy@google.com (Ka-Ping Yee)

goog.require('cm.css');

function ToolbarViewTest() {
  cm.TestBase.call(this);
  this.parent_ = cm.ui.create('div');
  this.mapModel_ = createMockInstance(cm.MapModel);
  this.toolbar_ = new cm.ToolbarView(
      this.parent_, this.mapModel_, true, true, '/root/.maps', false);
}
ToolbarViewTest.prototype = new cm.TestBase();
registerTestSuite(ToolbarViewTest);

/** Verifies that the Undo link works properly. */
ToolbarViewTest.prototype.testUndoLink = function() {
  var undoLink = expectDescendantOf(this.parent_, withText('Undo'));
  var undoEmitted = false;
  cm.events.listen(goog.global, cm.events.UNDO, function() {
    undoEmitted = true;
  });

  cm.events.emit(goog.global, cm.events.UNDO_REDO_BUFFER_CHANGED,
      {redo_possible: true, undo_possible: true});
  cm.events.emit(undoLink, 'click');
  expectTrue(undoEmitted);
  expectThat(undoLink, isElement(not(withClass(cm.css.DISABLED))));
};

/** Verifies that the Redo link works properly. */
ToolbarViewTest.prototype.testRedoLink = function() {
  var redoLink = expectDescendantOf(this.parent_, withText('Redo'));
  var redoEmitted = false;
  cm.events.listen(goog.global, cm.events.REDO, function() {
    redoEmitted = true;
  });

  cm.events.emit(goog.global, cm.events.UNDO_REDO_BUFFER_CHANGED,
      {redo_possible: true, undo_possible: true});
  cm.events.emit(redoLink, 'click');
  expectTrue(redoEmitted);
  expectThat(redoLink, isElement(not(withClass(cm.css.DISABLED))));
};

/** Verifies that the Arrange link works properly. */
ToolbarViewTest.prototype.testArrangeLink = function() {
  var link = expectDescendantOf(this.parent_, withText('Arrange'));
  var eventEmitted = false;
  cm.events.listen(goog.global, cm.events.ARRANGE, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Verifies that the 'Add layer' link works properly. */
ToolbarViewTest.prototype.testAddLayerLink = function() {
  var link = expectDescendantOf(this.parent_, withText('Add layer'));
  var eventEmitted = false;
  cm.events.listen(goog.global, cm.events.INSPECT, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Verifies that the 'Add folder' link works properly. */
ToolbarViewTest.prototype.testAddFolderLink = function() {
  var link = expectDescendantOf(this.parent_, withText('Add folder'));
  var eventEmitted = false;
  cm.events.listen(goog.global, cm.events.ADD_LAYERS, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Verifies that the 'Diff/Show JSON' link works properly. */
ToolbarViewTest.prototype.testDiffJsonLink = function() {
  var mapRoot = {'foo': 'bar'};
  stub(this.mapModel_.toMapRoot)().is(mapRoot);
  var diffPopup = null;
  this.setForTest_('cm.ui.showPopup', function(popup) {
    diffPopup = popup;
  });

  // Test the toolbar view with no map ID; should only offer JSON.
  var showJsonLink = expectDescendantOf(this.parent_, withText('Show JSON'));
  cm.events.emit(showJsonLink, 'click');
  expectEq(mapRoot, goog.json.parse(
      cm.ui.getText(diffPopup.lastChild).replace(/&nbsp;/g, '')));

  // Test the toolbar view with a map ID; should offer diffs and JSON.
  this.setForTest_('goog.net.XhrIo.send', createMockFunction());
  expectCall(goog.net.XhrIo.send)('/root/.diff/xyz',
      _, 'POST', 'new_json=%7B%22foo%22%3A%22bar%22%7D')
      .willOnce(function(url, callback) {
        callback({'target': {
          'isSuccess': function() { return true; },
          'getResponseJson': function() {
            return {
              'saved_diff': 'Saved diff',
              'catalog_diffs': [{'name': 'Name 1', 'diff': 'Catalog diff'}]
            };
          }
        }});
      });
  new cm.ToolbarView(
      this.parent_, this.mapModel_, true, true, '/root/.maps', false,
      '/root/.diff/xyz');

  // Test that the saved diff is displayed first.
  var diffLink = expectDescendantOf(this.parent_, withText('Diff'));
  cm.events.emit(diffLink, 'click');
  expectDescendantOf(diffPopup, withInnerHtml(sanitize('Saved diff')));

  // Test that the selected diffs are displayed.
  var diffSelectElem = expectDescendantOf(diffPopup, isElement('select',
      hasDescendant(withText('Saved')),
      hasDescendant(withText('Name 1'))));
  diffSelectElem.selectedIndex = 1;
  cm.events.emit(diffSelectElem, 'change');
  expectDescendantOf(diffPopup, withInnerHtml(sanitize('Catalog diff')));

  // Test showing the pretty-printed JSON.
  showJsonLink = expectDescendantOf(diffPopup, withText('Show JSON'));
  cm.events.emit(showJsonLink, 'click');
  expectEq(mapRoot, goog.json.parse(cm.ui.getText(diffPopup.lastChild)));

  // Test going back to the diff.
  var showDiffLink = expectDescendantOf(diffPopup, withText('Show diff'));
  cm.events.emit(showDiffLink, 'click');
  expectDescendantOf(diffPopup, withInnerHtml(sanitize('Catalog diff')));
};

/** Verifies the beforeunload handler when there are no changes to be saved.*/
ToolbarViewTest.prototype.testBeforeUnload = function() {
  var str = window.onbeforeunload();
  expectEq(undefined, str);
};

/** Verifies the beforeunload handler when there are changes to be saved. */
ToolbarViewTest.prototype.testBeforeUnloadSave = function() {
  cm.events.emit(goog.global, cm.events.MODEL_CHANGED);
  var str = window.onbeforeunload();
  expectEq(cm.MSG_UNSAVED_CHANGES, str);
};
