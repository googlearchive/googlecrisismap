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

// Author: joeysilva@google.com (Joey Silva)

goog.require('cm.css');

function ImporterViewTest() {
  cm.TestBase.call(this);
  this.view_ = new cm.ImporterView('/root/.api/maps');

  // Layers will be keyed by title in this.rows_; therefore the titles must be
  // unique.
  this.maps_ = [
    {url: '/root/example.com/map_a', maproot: {
      title: 'Map A', layers: [
        {title: 'Layer A', id: 'layer_a', type: cm.LayerModel.Type.KML},
        {title: 'Folder A', id: 'folder_a', type: cm.LayerModel.Type.FOLDER,
         sublayers: [
           {title: 'Sublayer A', id: 'sublayer_a', type: cm.LayerModel.Type.KML}
        ]}
      ]
    }},
    {url: '/root/example.com/map_b', maproot: {
      title: 'Map B', layers: [
        {title: 'Layer B', id: 'layer_b', type: cm.LayerModel.Type.KML},
        {title: 'Folder B', id: 'folder_b', type: cm.LayerModel.Type.FOLDER,
         sublayers: [
           {title: 'Sublayer B', id: 'sublayer_b', type: cm.LayerModel.Type.KML}
         ]}
      ]
    }}
  ];

  // Listen for an ADD_LAYERS event.
  this.layersCreated_ = false;
  this.layers_ = null;
  cm.events.listen(goog.global, cm.events.ADD_LAYERS, function(e) {
    this.layersCreated_ = true;
    this.layers_ = e.layers;
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

  this.setForTest_('goog.net.XhrIo.send', createMockFunction());
  expectCall(goog.net.XhrIo.send)('/root/.api/maps', _)
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
      isElement('div', withClass(cm.css.LAYER_ITEM)));
  var rowCounter = 0;
  this.rows_ = {};
  var addLayer = function(layer, url) {
    me.rows_[layer.title] =
        {layer: layer, elem: rowElems[rowCounter++]};
    if (layer.sublayers) {
      goog.array.forEach(layer.sublayers, function(layer) {
        addLayer(layer);
      });
    }
  };
  goog.array.forEach(this.maps_, function(map) {
    goog.array.forEach(map.maproot.layers, function(layer) {
      addLayer(layer);
    });
  }, this);
  expectEq(rowCounter, rowElems.length);
};

/** Tests that the openImporter() method works properly. */
ImporterViewTest.prototype.testOpenImporter = function() {
  this.openImporter_();

  // Confirm that the popup has a title, a table, and two buttons.
  expectDescendantOf(this.popup_, 'h2');
  expectDescendantOf(this.popup_, 'div', withClass(cm.css.IMPORTER_LIST));
  var buttonArea = expectDescendantOf(this.popup_,
                                      withClass(cm.css.BUTTON_AREA));
  expectDescendantOf(buttonArea, 'button', withText('Import selected layers'));
  expectDescendantOf(buttonArea, 'button', withText('Cancel'));

  // Confirm that the map headings are there, with preview links.
  expectDescendantOf(this.popup_, 'span', withText('Map A'));
  expectDescendantOf(this.popup_, 'a', withClass(cm.css.PREVIEW_LINK,
                     withAttr('href', '/root/example.com/map_a')));
  expectDescendantOf(this.popup_, 'span', withText('Map B'));
  expectDescendantOf(this.popup_, 'a', withClass(cm.css.PREVIEW_LINK,
                     withAttr('href', '/root/example.com/map_b')));

  // Confirm the layer rows are there, with correct titles and preview links.
  for (var title in this.rows_) {
    var row = this.rows_[title];
    expectDescendantOf(row.elem, 'span', withText(title));
    if (!this.rows_[title].layer.sublayers) {
      expectDescendantOf(row.elem, 'div', withClass(cm.css.PREVIEW_LINK));
    }
  }

  // Confirm the arrows are there and not expanded.
  var arrows = allDescendantsOf(this.popup_, isElement('div',
      withClass(cm.css.TRIANGLE), not(withClass(cm.css.EXPANDED))));
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
      withClass(cm.css.TRIANGLE)));
  cm.events.emit(arrow, 'click', {stopPropagation: goog.nullFunction});
  expectThat(arrow, withClass(cm.css.EXPANDED));

  // Assert that the hidden sublayer is now showing.
  var containerElem = this.rows_['Sublayer A'].elem.parentNode;
  expectThat(containerElem, isElement(not(withStyle('display', 'none'))));

  // Collapse the folder and verify the sublayer is hidden.
  cm.events.emit(arrow, 'click', {stopPropagation: goog.nullFunction});
  expectThat(arrow, not(withClass(cm.css.EXPANDED)));
  expectThat(containerElem, isElement(withStyle('display', 'none')));
};


/** Tests that selecting layers and sublayers works correctly. */
ImporterViewTest.prototype.testSelectLayers = function() {
  this.openImporter_();

  // Grab the arrow for the folder, and click it
  var arrow = findDescendantOf(this.popup_, isElement('div',
      withClass(cm.css.TRIANGLE)));
  cm.events.emit(arrow, 'click', {stopPropagation: goog.nullFunction});

  // Select and deselect a row.
  var layerElem = this.rows_['Layer A'].elem;
  cm.events.emit(layerElem, 'click');
  expectThat(layerElem, withClass(cm.css.LAYER_SELECTED));
  cm.events.emit(layerElem, 'click');
  expectThat(layerElem, not(withClass(cm.css.LAYER_SELECTED)));

  // Select a folder, then its child, to clear the folder selection
  var folderElem = this.rows_['Folder A'].elem;
  var sublayerElem = this.rows_['Sublayer A'].elem;
  cm.events.emit(folderElem, 'click');
  cm.events.emit(sublayerElem, 'click');
  expectThat(folderElem, not(withClass(cm.css.LAYER_SELECTED)));
  expectThat(sublayerElem, withClass(cm.css.LAYER_SELECTED));

  // Select a parent folder of a selected child, to clear child selection
  cm.events.emit(folderElem, 'click');
  expectThat(folderElem, withClass(cm.css.LAYER_SELECTED));
  expectThat(sublayerElem, not(withClass(cm.css.LAYER_SELECTED)));
};


/** Tests that importing some selected layers works. */
ImporterViewTest.prototype.testImportLayers = function() {
  this.openImporter_();

  var arrow = findDescendantOf(this.popup_, isElement('div',
      withClass(cm.css.TRIANGLE)));
  cm.events.emit(arrow, 'click', {stopPropagation: goog.nullFunction});

  var button = expectDescendantOf(this.popup_, 'button',
      withText('Import selected layers'));
  expectThat(button, withAttr('disabled', 'disabled'));

  // Select some layers and click OK.
  var selectedTitles = ['Layer A', 'Sublayer A', 'Layer B', 'Folder B'];
  goog.array.forEach(selectedTitles, function(title) {
    cm.events.emit(this.rows_[title].elem, 'click');
  }, this);

  expectThat(button, not(withAttr('disabled', 'disabled')));
  cm.events.emit(button, 'click');

  // Verify layers were created with the correct title, and an ID.
  expectTrue(this.layersCreated_);
  expectEq(selectedTitles.length, this.layers_.length);
  goog.array.forEach(this.layers_, function(maproot, i) {
    expectThat(maproot.id, not(isUndefined));
    expectEq(selectedTitles[i], maproot.title);
  });

  // Verify that the folder was added correctly
  var expectedFolder = this.rows_[selectedTitles[3]].layer;
  var folder = this.layers_[3];
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

/** Tests navigation back to the new layer dialog (inspector). */
ImporterViewTest.prototype.testCreateNew = function() {
  this.openImporter_();

  var fired = false;
  cm.events.listen(goog.global, cm.events.INSPECT, function() {
    fired = true;
  });

  var button = expectDescendantOf(this.popup_, 'a', withText('\xab Back'));
  cm.events.emit(button, 'click');
  expectTrue(fired);

  // Confirm that the popup disappeared.
  expectNoDescendantOf(cm.ui.document.body, this.popup_);
};

/** Tests that preview links are correctly created. */
ImporterViewTest.prototype.testPreviewLinks = function() {
  this.maps_ = [
    {url: '/root/example.com/map_a', maproot: {
     title: 'Map A', layers: [
       // Leaf layer, default-off.
       {title: 'Layer A', id: 'layer_a', type: cm.LayerModel.Type.KML},
       // Folder with no default-on children.
       {title: 'Folder A', id: 'folder_a', type: cm.LayerModel.Type.FOLDER,
        sublayers: [
          {title: 'Sublayer A', id: 'sublayer_a', type: cm.LayerModel.Type.KML}
        ]},
       // Folder with some default-on children.
       {title: 'Folder B', id: 'folder_b', type: cm.LayerModel.Type.FOLDER,
        sublayers: [
          {title: 'Sublayer B', id: 'sublayer_b', type: cm.LayerModel.Type.KML},
          {title: 'Sublayer C', id: 'sublayer_c', type: cm.LayerModel.Type.KML,
            visibility: 'DEFAULT_ON'}
        ]},
        // Nested folder with no visible default-on children.
        {title: 'Folder C', id: 'folder_c', type: cm.LayerModel.Type.FOLDER,
         sublayers: [
           {title: 'Subfolder A', id: 'subfolder_a', visibility: 'DEFAULT_ON',
            type: cm.LayerModel.Type.FOLDER, sublayers: [
              {title: 'Sublayer D', id: 'sublayer_d',
               type: cm.LayerModel.Type.KML}
            ]},
            // Default-on children, subfolder not visible though.
            {title: 'Subfolder B', id: 'subfolder_b',
             type: cm.LayerModel.Type.FOLDER, sublayers: [
               {title: 'Sublayer E', id: 'sublayer_e',
                type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'}
            ]}
         ]},
        // Nested folder with some default-on children.
        {title: 'Folder D', id: 'folder_d', type: cm.LayerModel.Type.FOLDER,
         sublayers: [
           {title: 'Subfolder C', id: 'subfolder_c', visibility: 'DEFAULT_ON',
            type: cm.LayerModel.Type.FOLDER, sublayers: [
              {title: 'Sublayer F', id: 'sublayer_f',
               type: cm.LayerModel.Type.KML},
              {title: 'Sublayer G', id: 'sublayer_g',
               type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'}
            ]}
         ]}
     ]
    }}
  ];
  this.openImporter_();

  var previewSrc = '/root/example.com/map_a?preview=1&layers=';

  // Test that leaf layers have previews, regardless of visibility.
  var link = expectDescendantOf(this.rows_['Layer A'].elem,
                                withClass(cm.css.PREVIEW_LINK));
  cm.events.emit(link, 'click');
  expectDescendantOf(cm.ui.document.body, isElement(
      'iframe', withAttr('src', previewSrc + 'layer_a')));

  // Test closing the preview by clicking the close button.
  cm.events.emit(
      expectDescendantOf(cm.ui.document.body, withClass(cm.css.CLOSE_BUTTON)),
      'click');
  expectNoDescendantOf(cm.ui.document.body, 'iframe');

  // Test that folders with no default-on layers have no preview.
  expectDescendantOf(this.rows_['Folder A'].elem,
                       withClass(cm.css.NO_PREVIEW));

  // Test that folders with some default-on layers have a preview.
  link = expectDescendantOf(this.rows_['Folder B'].elem,
                            withClass(cm.css.PREVIEW_LINK));
  cm.events.emit(link, 'click');
  expectDescendantOf(cm.ui.document.body, isElement(
      'iframe', withAttr('src', previewSrc + 'folder_b,sublayer_c')));

  // Test closing by clicking the body.
  cm.events.emit(cm.ui.document.body, 'click');
  expectNoDescendantOf(cm.ui.document.body, 'iframe');

  // Test that nested folders with no default-on descendants have no preview.
  expectDescendantOf(this.rows_['Folder C'].elem,
                     withClass(cm.css.NO_PREVIEW));

  // Test that nested folders with some default-on descendants have a preview.
  link = expectDescendantOf(this.rows_['Folder D'].elem,
                            withClass(cm.css.PREVIEW_LINK));
  cm.events.emit(link, 'click');
  expectDescendantOf(cm.ui.document.body, isElement(
      'iframe', withAttr('src', previewSrc +
          'folder_d,subfolder_c,sublayer_g')));
};
