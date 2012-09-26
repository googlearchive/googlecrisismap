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

function ToolbarViewTest() {
  cm.TestBase.call(this);
  this.parent_ = cm.ui.create('div');
  this.mapModel_ = createMockInstance(cm.MapModel);
  this.toolbar_ = new cm.ToolbarView(this.parent_, this.mapModel_,
      true, true, false);
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
  expectThat(undoLink, isElement(not(withClass('cm-disabled'))));
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
  expectThat(redoLink, isElement(not(withClass('cm-disabled'))));
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
  cm.events.listen(goog.global, cm.events.CREATE_LAYERS, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Verifies that the 'Add folder' link works properly. */
ToolbarViewTest.prototype.testAddFolderLink = function() {
  var link = expectDescendantOf(this.parent_, withText('Add folder'));
  var eventEmitted = false;
  cm.events.listen(goog.global, cm.events.CREATE_LAYERS, function() {
    eventEmitted = true;
  });
  cm.events.emit(link, 'click');
  expectTrue(eventEmitted);
};

/** Verifies that the 'Show JSON' link works properly. */
ToolbarViewTest.prototype.testShowJsonLink = function() {
  expectCall(this.mapModel_.toMapRoot)()
      .willOnce(returnWith({'foo': 'bar'}));
  var jsonPopup = null;
  this.setForTest_('cm.ui.showPopup', function(popup) {
    jsonPopup = popup;
  });

  var showJsonLink = expectDescendantOf(this.parent_, withText('Show JSON'));
  cm.events.emit(showJsonLink, 'click');
  expectThat(goog.json.parse(cm.ui.getText(jsonPopup)),
             recursivelyEquals({'foo': 'bar'}));
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
  expectEq(MSG_UNSAVED_CHANGES, str);
};
