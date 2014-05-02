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
  cm.events.listen(cm.app, cm.events.UNDO, function() {
    undoEmitted = true;
  });

  cm.events.emit(cm.app, cm.events.UNDO_REDO_BUFFER_CHANGED,
      {redo_possible: true, undo_possible: true});
  cm.events.emit(undoLink, 'click');
  expectTrue(undoEmitted);
  expectThat(undoLink, isElement(not(withClass(cm.css.DISABLED))));
};

/** Verifies that the Redo link works properly. */
ToolbarViewTest.prototype.testRedoLink = function() {
  var redoLink = expectDescendantOf(this.parent_, withText('Redo'));
  var redoEmitted = false;
  cm.events.listen(cm.app, cm.events.REDO, function() {
    redoEmitted = true;
  });

  cm.events.emit(cm.app, cm.events.UNDO_REDO_BUFFER_CHANGED,
      {redo_possible: true, undo_possible: true});
  cm.events.emit(redoLink, 'click');
  expectTrue(redoEmitted);
  expectThat(redoLink, isElement(not(withClass(cm.css.DISABLED))));
};

/** Verifies that the Arrange link works. */
ToolbarViewTest.prototype.testArrangeLink = function() {
  var link = expectDescendantOf(this.parent_, withText('Arrange'));
  var eventEmitted = false;
  cm.events.listen(cm.app, cm.events.ARRANGE, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Check that arrange link is hidden on touch-only devices. */
ToolbarViewTest.prototype.testArrangeLink = function() {
  // The arrange link should be hidden on touch devices...
  this.toolbar_ = new cm.ToolbarView(
      this.parent_, this.mapModel_, true, true, '/root/.maps', true);
  var link = expectDescendantOf(this.parent_, withText('Arrange'),
                                not(isShown));

  // ...and appear only if there is a pointing device present and the
  // user moves it.
  cm.events.emit(goog.global, 'mousemove');
  expectThat(link, isShown());
};

/** Verifies that the 'Add layer' link works properly. */
ToolbarViewTest.prototype.testAddLayerLink = function() {
  var link = expectDescendantOf(this.parent_, withText('Add layer'));
  var eventEmitted = false;
  cm.events.listen(cm.app, cm.events.INSPECT, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Verifies that the 'Add folder' link works properly. */
ToolbarViewTest.prototype.testAddFolderLink = function() {
  var link = expectDescendantOf(this.parent_, withText('Add folder'));
  var eventEmitted = false;
  cm.events.listen(cm.app, cm.events.ADD_LAYERS, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Verifies that the 'Show JSON' link works properly. */
ToolbarViewTest.prototype.testShowJsonLink = function() {
  var mapRoot = {'foo': 'bar'};
  stub(this.mapModel_.toMapRoot)().is(mapRoot);
  var diffPopup = null;
  this.setForTest_('cm.ui.showPopup', function(popup) {
    diffPopup = popup;
  });

  // Test the toolbar view with no map ID; should only offer JSON.
  expectNoDescendantOf(this.parent_, withText('Diff'));
  var showJsonLink = expectDescendantOf(this.parent_, withText('Show JSON'));
  cm.events.emit(showJsonLink, 'click');
  expectEq(mapRoot, goog.json.parse(
      cm.ui.getText(diffPopup.lastChild).replace(/&nbsp;/g, '')));
};

/** Verifies that the 'Diff/Show JSON' link works properly. */
ToolbarViewTest.prototype.testDiffJsonLink = function() {
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

  var mapRoot = {'foo': 'bar'};
  stub(this.mapModel_.toMapRoot)().is(mapRoot);
  var diffPopup = null;
  this.setForTest_('cm.ui.showPopup', function(popup) {
    diffPopup = popup;
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

/** Verifies that the 'Edit topics' link works properly. */
ToolbarViewTest.prototype.testEditTopicsLink = function() {
  var link = expectDescendantOf(this.parent_, withText('Edit topics'));
  var eventEmitted = false;
  cm.events.listen(cm.app, cm.events.EDIT_TOPICS, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Verifies the beforeunload handler when there are no changes to be saved.*/
ToolbarViewTest.prototype.testBeforeUnload = function() {
  var str = window.onbeforeunload();
  expectEq(undefined, str);
};

/** Verifies the beforeunload handler when there are changes to be saved. */
ToolbarViewTest.prototype.testBeforeUnloadSave = function() {
  cm.events.emit(cm.app, cm.events.MODEL_CHANGED);
  var str = window.onbeforeunload();
  expectEq(cm.MSG_UNSAVED_CHANGES, str);
};

/** Tests the 'Save' link is updated when clicked. */
ToolbarViewTest.prototype.testSaveLink = function() {
  // The save link should be unavailable until the model changes.
  expectDescendantOf(this.parent_, withText('Saved'), withClass('cm-disabled'));
  expectNoDescendantOf(this.parent_, withText('Save'));
  cm.events.emit(cm.app, cm.events.MODEL_CHANGED);

  // The 'Save' link should be available. On 'click' it should be disabled.
  expectNoDescendantOf(this.parent_, withText('Saved'));
  var saveLink = findDescendantOf(this.parent_, withText('Save'));
  cm.events.emit(saveLink, 'click');
  expectThat(saveLink, withClass('cm-disabled'));

  // When saving is complete, the text should change.
  cm.events.emit(cm.app, cm.events.SAVE_DONE);
  expectDescendantOf(this.parent_, withText('Saved'));
  expectNoDescendantOf(this.parent_, withText('Save'));
};

/** Tests the extra 'Save' link click listeners in the tabbed UI. */
ToolbarViewTest.prototype.testTabbedUiSaveLink = function() {
  // Instantiate a second ToolbarView and simulate a model change.
  var otherParent = cm.ui.create('div');
  new cm.ToolbarView(
      otherParent, this.mapModel_, true, true, '/root/.maps', false,
      undefined, true);
  cm.events.emit(cm.app, cm.events.MODEL_CHANGED);

  // Clicking on the 'Save' in one toolbar should disable all the
  // 'Save' links.
  var saveLink = findDescendantOf(this.parent_, withText('Save'));
  var otherSaveLink = expectDescendantOf(otherParent, withText('Save'));
  cm.events.emit(saveLink, 'click');
  expectThat(saveLink, withClass('cm-disabled'));
  expectThat(otherSaveLink, withClass('cm-disabled'));

  // When saving is complete, the text of all 'Save' links should change.
  cm.events.emit(cm.app, cm.events.SAVE_DONE);
  expectDescendantOf(this.parent_, withText('Saved'));
  expectDescendantOf(otherParent, withText('Saved'));
  expectNoDescendantOf(this.parent_, withText('Save'));
  expectNoDescendantOf(otherParent, withText('Save'));
};
