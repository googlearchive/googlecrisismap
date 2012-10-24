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


function ImporterViewTest() {
  cm.TestBase.call(this);
  this.view_ = new cm.ImporterView();

  // Layers will be keyed by title in this.rows_; therefore the titles must be
  // unique.
  this.maps_ = [
    {title: 'Map A', layers: [
      {title: 'Layer A', type: cm.LayerModel.Type.KML},
      {title: 'Folder A', type: cm.LayerModel.Type.FOLDER, sublayers: [
        {title: 'Sublayer A', type: cm.LayerModel.Type.KML}
      ]}
    ]},
    {title: 'Map B', layers: [
      {title: 'Layer B', type: cm.LayerModel.Type.KML},
      {title: 'Folder B', type: cm.LayerModel.Type.FOLDER, sublayers: [
        {title: 'Sublayer B', type: cm.LayerModel.Type.KML}
      ]}
    ]}
  ];

  // Listen for an ADD_LAYERS event.
  this.layersCreated_ = false;
  this.maproots_ = null;
  cm.events.listen(goog.global, cm.events.ADD_LAYERS, function(e) {
    this.layersCreated_ = true;
    this.maproots_ = e.maproots;
  }, this);
}
ImporterViewTest.prototype = new cm.TestBase();
registerTestSuite(ImporterViewTest);

/**
 * Opens the importer.
 * @private
 */
ImporterViewTest.prototype.openImporter_ = function() {
  // Grab the popup that the InspectorView will open.
  var me = this;
  this.setForTest_('cm.ui.showPopup', function(popup) {
    me.popup_ = popup;
    cm.ui.document.body.appendChild(me.popup_);
  });

  goog.net.XhrIo.send = createMockFunction('goog.net.XhrIo.send');
  expectCall(goog.net.XhrIo.send)('/crisismap/api/maps', _)
      .willOnce(function(url, callback, method, data) {
        callback({target: {
          isSuccess: function() {
            return true;
          },
          getResponseJson: function() {
            return me.maps_;
          }
        }});
      });
  this.view_.openImporter();

  // Construct this.rows_ object, which keys rows by their title, and has
  // their layer model and row element.
  var rowElems = allDescendantsOf(this.popup_,
      isElement('div', withClass('cm-layer-item')));
  var rowCounter = 0;
  this.rows_ = {};
  var addLayer = function(layer) {
    this.rows_[layer.title] = {layer: layer, elem: rowElems[rowCounter++]};
    if (layer.sublayers) {
      goog.array.forEach(layer.sublayers, addLayer, this);
    }
  };
  goog.array.forEach(this.maps_, function(map) {
    goog.array.forEach(map.layers, addLayer, this);
  }, this);
  expectEq(rowCounter, rowElems.length);
};

/** Tests that the openImporter() method works properly. */
ImporterViewTest.prototype.testOpenImporter = function() {
  this.openImporter_();

  // Confirm that the popup has a title, a table, and two buttons.
  expectDescendantOf(this.popup_, 'h2');
  expectDescendantOf(this.popup_, 'div', withClass('cm-importer-list'));
  var buttonArea = expectDescendantOf(this.popup_, withClass('cm-button-area'));
  expectDescendantOf(buttonArea, 'button', withText('OK'));
  expectDescendantOf(buttonArea, 'button', withText('Cancel'));

  // Confirm that the map headings are there
  expectDescendantOf(this.popup_, 'div', withText('Map A'));
  expectDescendantOf(this.popup_, 'div', withText('Map B'));

  // Confirm the layer rows are there
  for (title in this.rows_) {
    var row = this.rows_[title];
    expectDescendantOf(row.elem, 'span', withText(title));
  }

  // Confirm the arrows are there and not expanded.
  var arrows = allDescendantsOf(this.popup_, isElement('div',
      withClass('cm-triangle'), not(withClass('cm-expanded'))));
  expectEq(2, arrows.length);

  // Confirm the sublayers are hidden.
  expectThat(this.rows_['Sublayer A'].elem.parentNode,
      isElement(withStyle('display', 'none')));
  expectThat(this.rows_['Sublayer B'].elem.parentNode,
      isElement(withStyle('display', 'none')));
};

/** Tests that expanding and collapsing folders works properly. */
ImporterViewTest.prototype.testExpandFolders = function() {
  this.openImporter_();

  // Grab the arrow for the folder, and click it to expand the folder.
  var arrow = findDescendantOf(this.popup_, isElement('div',
      withClass('cm-triangle')));
  cm.events.emit(arrow, 'click', {stopPropagation: goog.nullFunction});
  expectThat(arrow, withClass('cm-expanded'));

  // Assert that the hidden sublayer is now showing.
  var containerElem = this.rows_['Sublayer A'].elem.parentNode;
  expectThat(containerElem, isElement(not(withStyle('display', 'none'))));

  // Collapse the folder and verify the sublayer is hidden.
  cm.events.emit(arrow, 'click', {stopPropagation: goog.nullFunction});
  expectThat(arrow, not(withClass('cm-expanded')));
  expectThat(containerElem, isElement(withStyle('display', 'none')));
};


/** Tests that selecting layers and sublayers works correctly. */
ImporterViewTest.prototype.testSelectLayers = function() {
  this.openImporter_();

  // Grab the arrow for the folder, and click it
  var arrow = findDescendantOf(this.popup_, isElement('div',
      withClass('cm-triangle')));
  cm.events.emit(arrow, 'click', {stopPropagation: goog.nullFunction});

  // Select and deselect a row.
  var layerElem = this.rows_['Layer A'].elem;
  cm.events.emit(layerElem, 'click');
  expectThat(layerElem, withClass('cm-layer-selected'));
  cm.events.emit(layerElem, 'click');
  expectThat(layerElem, not(withClass('cm-layer-selected')));

  // Select a folder, then its child, to clear the folder selection
  var folderElem = this.rows_['Folder A'].elem;
  var sublayerElem = this.rows_['Sublayer A'].elem;
  cm.events.emit(folderElem, 'click');
  cm.events.emit(sublayerElem, 'click');
  expectThat(folderElem, not(withClass('cm-layer-selected')));
  expectThat(sublayerElem, withClass('cm-layer-selected'));

  // Select a parent folder of a selected child, to clear child selection
  cm.events.emit(folderElem, 'click');
  expectThat(folderElem, withClass('cm-layer-selected'));
  expectThat(sublayerElem, not(withClass('cm-layer-selected')));
};


/** Tests that importing some selected layers works. */
ImporterViewTest.prototype.testImportLayers = function() {
  this.openImporter_();

  var arrow = findDescendantOf(this.popup_, isElement('div',
      withClass('cm-triangle')));
  cm.events.emit(arrow, 'click', {stopPropagation: goog.nullFunction});

  // Select some layers and click OK.
  var selectedTitles = ['Layer A', 'Sublayer A', 'Layer B', 'Folder B'];
  goog.array.forEach(selectedTitles, function(title) {
    cm.events.emit(this.rows_[title].elem, 'click');
  }, this);
  var button = expectDescendantOf(this.popup_, 'button', withText('OK'));
  cm.events.emit(button, 'click');

  // Verify layers were created with the correct title, and an ID.
  expectTrue(this.layersCreated_);
  expectEq(selectedTitles.length, this.maproots_.length);
  goog.array.forEach(this.maproots_, function(maproot, i) {
    expectThat(maproot.id, not(isUndefined));
    expectEq(selectedTitles[i], maproot.title);
  });

  // Verify that the folder was added correctly
  var expectedFolder = this.rows_[selectedTitles[3]].layer;
  var folder = this.maproots_[3];
  expectEq(1, folder.sublayers.length);
  var sublayer = folder.sublayers[0];
  expectThat(sublayer.id, not(isUndefined));
  expectEq(expectedFolder.sublayers[0].title, sublayer.title);

  // Confirm that the popup disappeared.
  expectNoDescendantOf(cm.ui.document.body, this.popup_);
};

/** Tests that clicking the Cancel button does nothing. */
ImporterViewTest.prototype.testCancel = function() {
  this.openImporter_();

  // Click the Cancel button.
  var button = expectDescendantOf(this.popup_, 'button', withText('Cancel'));
  cm.events.emit(button, 'click');

  // Confirm that the OBJECT_EDITED event was not emitted.
  expectFalse(this.layersCreated_);

  // Confirm that the popup disappeared.
  expectNoDescendantOf(cm.ui.document.body, this.popup_);
};

/** Tests navigation to the new layer dialog (inspector). */
ImporterViewTest.prototype.testCreateNew = function() {
  this.openImporter_();

  var fired = false;
  cm.events.listen(goog.global, cm.events.INSPECT, function() {
    fired = true;
  });

  var button = expectDescendantOf(this.popup_, 'a',
      withText('Create new layer'));
  cm.events.emit(button, 'click');
  expectTrue(fired);

  // Confirm that the popup disappeared.
  expectNoDescendantOf(cm.ui.document.body, this.popup_);
};
