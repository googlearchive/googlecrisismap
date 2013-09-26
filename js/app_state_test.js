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


function AppStateTest() {
  cm.TestBase.call(this);
  this.viewport_ = cm.LatLonBox.ENTIRE_MAP;
  this.appState_ = new cm.AppState('fr');
}
AppStateTest.prototype = new cm.TestBase();
registerTestSuite(AppStateTest);

/** Test the AppState constructor. */
AppStateTest.prototype.testConstruction = function() {
  expectEq(0, this.appState_.get('enabled_layer_ids').getCount());
  expectEq('', this.appState_.get('filter_query'));
  expectEq([], this.appState_.get('matched_layer_ids'));
  expectEq(this.viewport_, this.appState_.get('viewport'));
  expectEq(cm.MapModel.Type.ROADMAP, this.appState_.get('map_type'));
};

/** Test the AppState fromAppState copy method. */
AppStateTest.prototype.testFromAppState = function() {
  this.appState_.set('language', 'es');
  this.appState_.get('enabled_layer_ids').add('x');
  this.appState_.get('matched_layer_ids').push('y');
  this.appState_.set('layer_opacities', {a: 50});
  this.appState_.set('viewport', new cm.LatLonBox(10, -10, 20, -20));
  this.appState_.set('map_type', cm.MapModel.Type.SATELLITE);

  // Check that all the properties are equal.
  var newAppState = cm.AppState.fromAppState(this.appState_);
  expectEq(this.appState_.get('language'), newAppState.get('language'));
  expectEq(this.appState_.get('enabled_layer_ids'),
           newAppState.get('enabled_layer_ids'));
  expectEq(this.appState_.get('filter_query'),
           newAppState.get('filter_query'));
  expectEq(this.appState_.get('matched_layer_ids'),
           newAppState.get('matched_layer_ids'));
  expectEq(this.appState_.get('layer_opacities'),
           newAppState.get('layer_opacities'));
  expectEq(this.appState_.get('viewport'),
           newAppState.get('viewport'));
  expectEq(this.appState_.get('map_type'), newAppState.get('map_type'));

  // Check that object references are not the same.
  var keys = ['enabled_layer_ids', 'matched_layer_ids', 'layer_opacities'];
  goog.array.forEach(keys, function(key) {
    expectTrue(newAppState.get(key) !== this.appState_.get(key));
  }, this);
};

/**
 * Create fake LayerModel as an MVCObject.
 * @param {string} id The layer ID.
 * @param {?cm.LayerModel} opt_parent The layer's parent.
 * @param {?Array<LayerModel>} opt_sublayers The layer's sublayers.
 * @return {google.maps.MVCObject} The layer object.
 * @private
 */
AppStateTest.prototype.createLayer_ = function(id, opt_parent, opt_sublayers) {
  var layer = new google.maps.MVCObject();
  layer.setValues({'id': id,
                   'parent': opt_parent || null,
                   'sublayers': opt_sublayers || null});
  layer.getSublayerIds = function() {
    return goog.array.map(layer.get('sublayers'), function(sublayer) {
      return sublayer.get('id');
    });
  };
  return layer;
};

/** Tests the setLayerEnabled and getLayerEnabled methods. */
AppStateTest.prototype.testLayerEnabledPlainLayer = function() {
  var layera = this.createLayer_('a');
  var layerb = this.createLayer_('b');
  expectFalse(this.appState_.getLayerEnabled('a'));
  expectFalse(this.appState_.getLayerEnabled('b'));

  var notified;
  cm.events.onChange(this.appState_, 'enabled_layer_ids', function() {
    notified = true;
  });

  notified = false;
  this.appState_.setLayerEnabled('a', true);
  expectTrue(this.appState_.getLayerEnabled('a'));
  expectTrue(notified);

  notified = false;
  this.appState_.setLayerEnabled('a', false);
  expectFalse(this.appState_.getLayerEnabled('a'));
  expectTrue(notified);

  notified = false;
  this.appState_.setLayerEnabled('a', false);
  expectFalse(this.appState_.getLayerEnabled('a'));
  expectFalse(notified);

  notified = false;
  this.appState_.setLayerEnabled('b', true);
  expectFalse(this.appState_.getLayerEnabled('a'));
  expectTrue(this.appState_.getLayerEnabled('b'));
  expectTrue(notified);

  notified = false;
  this.appState_.setLayerEnabled('b', true);
  expectFalse(notified);
};

/** Tests setLayerEnabled and getLayerEnabled with nested folders. */
AppStateTest.prototype.testLayerEnabledFolders = function() {
  // a contains b contains c
  var layera = this.createLayer_('a');
  var layerb = this.createLayer_('b', layera);
  var layerc = this.createLayer_('c', layerb);

  goog.array.forEach(['a', 'b', 'c'], function(id) {
    expectFalse(this.appState_.getLayerEnabled(id));
  }, this);

  // Turn on root and leaf layers.
  this.appState_.setLayerEnabled('a', true);
  this.appState_.setLayerEnabled('c', true);
  expectTrue(this.appState_.getLayerEnabled('a'));
  expectFalse(this.appState_.getLayerEnabled('b'));
  expectTrue(this.appState_.getLayerEnabled('c'));

  // Turn off root folder and verify that leaf is still enabled.
  this.appState_.setLayerEnabled('a', false);
  expectFalse(this.appState_.getLayerEnabled('a'));
  expectFalse(this.appState_.getLayerEnabled('b'));
  expectTrue(this.appState_.getLayerEnabled('c'));

};

/** Tests that selectSublayer() enables and disables sublayers corectly. */
AppStateTest.prototype.testSelectSublayer = function() {
  var mapModel = cm.MapModel.newFromMapRoot({
    id: 'map', layers: [
      {id: 'singleSelect', type: 'FOLDER', list_item_type: 'RADIO_FOLDER',
       sublayers: [
         {id: 'subA', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'},
         {id: 'subB', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'},
         {id: 'subC', type: cm.LayerModel.Type.KML}
      ]}
    ]
  });
  this.appState_.setFromMapModel(mapModel);
  var folder = mapModel.getLayer('singleSelect');

  var notified;
  cm.events.onChange(this.appState_, 'enabled_layer_ids', function() {
    notified = true;
  });

  // Verify that only first sublayer of the single-select folder is enabled.
  expectTrue(this.appState_.get('enabled_layer_ids').contains('subA'));
  expectFalse(this.appState_.get('enabled_layer_ids').contains('subB'));
  expectFalse(this.appState_.get('enabled_layer_ids').contains('subC'));

  // Select the third sublayer.
  notified = false;
  this.appState_.selectSublayer(folder, 'subC');
  expectFalse(this.appState_.get('enabled_layer_ids').contains('subA'));
  expectFalse(this.appState_.get('enabled_layer_ids').contains('subB'));
  expectTrue(this.appState_.get('enabled_layer_ids').contains('subC'));
  expectTrue(notified);

  // Turn off all sublayers and verify that selectSublayer() turns one on.
  notified = false;
  this.appState_.get('enabled_layer_ids').clear();
  this.appState_.selectSublayer(folder, 'subA', true);
  expectTrue(this.appState_.get('enabled_layer_ids').contains('subA'));
  expectFalse(this.appState_.get('enabled_layer_ids').contains('subB'));
  expectFalse(this.appState_.get('enabled_layer_ids').contains('subC'));
  expectTrue(notified);
};

/** Tests enforcing that single-select folders have one enabled sublayer. */
AppStateTest.prototype.testUpdateSingleSelectFolders = function() {
  var mapModel = cm.MapModel.newFromMapRoot({
    id: 'map', layers: [
      {id: 'folder1', type: 'FOLDER', list_item_type: 'RADIO_FOLDER',
       sublayers: [
         {id: 'folder2', type: cm.LayerModel.Type.FOLDER,
          list_item_type: 'RADIO_FOLDER',
          sublayers: [
            {id: 'subC', type: cm.LayerModel.Type.KML},
            {id: 'subD', type: cm.LayerModel.Type.KML}
          ]},
         {id: 'subA', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'},
         {id: 'subB', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'}
      ]},
      {id: 'folder3', type: 'FOLDER', list_item_type: 'RADIO_FOLDER',
       sublayers: []
      }
    ]
  });
  this.appState_.setFromMapModel(mapModel);
  expectThat(this.appState_.get('enabled_layer_ids').getValues(),
             whenSorted(elementsAre(['subA', 'subC'])));
};

/**
 * Tests that enabling/disabled a folder determines the map visibility
 * of its sublayers.
 */
AppStateTest.prototype.testGetVisibleLayerIds = function() {
  this.originalGlobal_ = goog.global;
  var child11 = this.createLayer_('child11');
  var child12 = this.createLayer_('child12');
  var root1 = this.createLayer_('root1', null, [child11, child12]);
  var child21 = this.createLayer_('child21');
  var child22 = this.createLayer_('child22');
  var root2 = this.createLayer_('root2', null, [child21, child22]);

  root1.set('type', cm.LayerModel.Type.FOLDER);
  root2.set('type', cm.LayerModel.Type.FOLDER);

  // Add root layers to MapModel
  var mapModel = new google.maps.MVCObject();
  mapModel.set('layers', new google.maps.MVCArray([root1, root2]));

  this.appState_.setLayerEnabled('root2', true);
  this.appState_.setLayerEnabled('child11', true);

  // Since root1 is disabled, child11 is not visible, even though it is enabled.
  expectTrue(this.appState_.getLayerEnabled('child11'));
  expectThat(this.appState_.getVisibleLayerIds(mapModel).getValues(),
             elementsAre(['root2']));

  // Enable root1 and expect both root1 and child11 to be visible.
  this.appState_.setLayerEnabled('root1', true);
  expectThat(this.appState_.getVisibleLayerIds(mapModel).getValues(),
             whenSorted(elementsAre(['child11', 'root1', 'root2'])));
};

/** Tests conversion of the AppState to URI parameters. */
AppStateTest.prototype.testGetUri = function() {
  // Provide a fake location URL that includes some pre-existing parameters.
  this.setForTest_('goog.global',
      {'location': 'http://app.com/root/foo' +
          '?lat=1&lng=2&llbox=3,4,5,6&z=7&t=8&layers=9'});

  // Add state to the app state.
  this.appState_.set('map_type', cm.MapModel.Type.SATELLITE);

  var layera = this.createLayer_('a');
  var layerb = this.createLayer_('b');
  var layerc = this.createLayer_('c');
  var layerd = this.createLayer_('d');
  this.appState_.set('enabled_layer_ids',
                     new goog.structs.Set(['a', 'b', 'd']));
  this.appState_.set('viewport', new cm.LatLonBox(12, 11, -33, -34.123456));
  this.appState_.set('layer_opacities', {'a': 1, 'b': 34});
  // crisis should be removed; id, hl, llbox, t, and layers should
  // be set; lat, lng, z should be removed.
  expectEq('http://app.com/root/foo' +
           '?hl=fr' +
           '&llbox=12%2C11%2C-33%2C-34.123' +
           '&t=SATELLITE' +
           '&layers=a%3A1%2Cb%3A34%2Cd',
           this.appState_.getUri().toString());

  // Include the 'base' parameter in the location.
  this.setForTest_('goog.global',
      {'location': 'http://app.com/root?' +
          'crisis=foo&lat=1&lng=2&llbox=3,4,5,6&z=7&t=8&layers=9&' +
          'base=http://elsewhere.org/whatever'});

  expectEq('http://elsewhere.org/whatever' +
           '?hl=fr' +
           '&llbox=12%2C11%2C-33%2C-34.123' +
           '&t=SATELLITE' +
           '&layers=a%3A1%2Cb%3A34%2Cd',
           this.appState_.getUri().toString());
};

/** Verifies that the AppState is set according to the 't' param. */
AppStateTest.prototype.testSetFromUriMapType = function() {
  var uri = new goog.Uri('');
  uri.setParameterValue('t', cm.MapModel.Type.HYBRID);

  this.appState_.setFromUri(uri);
  expectEq(cm.MapModel.Type.HYBRID, this.appState_.get('map_type'));

  // For backward compatibility, also accept lowercase map types.
  uri.setParameterValue('t', 'terrain');
  this.appState_.setFromUri(uri);
  expectEq(cm.MapModel.Type.TERRAIN, this.appState_.get('map_type'));

  // When the type argument is invalid, we should default to ROADMAP.
  uri.setParameterValue('t', 'wxyz');
  this.appState_.setFromUri(uri);
  expectEq(cm.MapModel.Type.ROADMAP, this.appState_.get('map_type'));
};

/** Verifies that the AppState is set according to the 'layers' param. */
AppStateTest.prototype.testSetFromUriLayers = function() {
  var uri = new goog.Uri('');
  uri.setParameterValue('layers', 'c:1,a,d:66');

  this.appState_.setFromUri(uri);
  expectTrue(this.appState_.getLayerEnabled('a'));
  expectFalse(this.appState_.getLayerEnabled('b'));
  expectTrue(this.appState_.getLayerEnabled('c'));
  expectTrue(this.appState_.getLayerEnabled('d'));
  var opacities = this.appState_.get('layer_opacities');
  expectEq(1, opacities['c']);
  expectEq(66, opacities['d']);
};

/**
 * Verifies that the AppState layer filter query is set according
 * to the 'q' param.
 */
AppStateTest.prototype.testSetFromUriFilterQuery = function() {
  var uri = new goog.Uri('');
  uri.setParameterValue('q', 'awesome');

  this.appState_.setFromUri(uri);
  expectEq(this.appState_.get('filter_query'), 'awesome');
};

/** Test that the setFromMapModel() method works correctly. */
AppStateTest.prototype.testSetFromMapModel = function() {
  var viewport = {north: 10, south: -10, east: 20, west: -20};
  var mapModel = cm.MapModel.newFromMapRoot({
    id: 'map', base_map_type: 'GOOGLE_SATELLITE',
    viewport: {lat_lon_alt_box: viewport}, layers: [
      {id: 'layer', type: 'KML', visibility: 'DEFAULT_ON', opacity: 0},
      {id: 'folderA', type: 'FOLDER', visibility: 'DEFAULT_ON', opacity: 1,
       sublayers: [{id: 'sublayerA', type: 'KML', opacity: 25}]},
      {id: 'folderB', type: 'FOLDER', opacity: 75, sublayers: [
        {id: 'sublayerB', type: 'KML', visibility: 'DEFAULT_ON', opacity: 100}
      ]},
      {id: 'singleSelect', type: 'FOLDER', list_item_type: 'RADIO_FOLDER',
       sublayers: [
         {id: 'subA', type: cm.LayerModel.Type.KML},
         {id: 'subB', type: cm.LayerModel.Type.KML, visibility: 'DEFAULT_ON'},
         {id: 'subC', type: cm.LayerModel.Type.KML}
      ]}
    ]
  });
  this.appState_.setFromMapModel(mapModel);

  expectEq(mapModel.get('map_type'), this.appState_.get('map_type'));
  expectEq(mapModel.get('viewport'), this.appState_.get('viewport'));

  var opacities = this.appState_.get('layer_opacities');
  var enabledLayerIds = this.appState_.get('enabled_layer_ids');
  cm.util.forLayersInMap(mapModel, function(layer) {
    var id = /** @type {string} */ (layer.get('id'));
    var opacity = layer.get('opacity');
    var matchers = [equals(opacity * 100)];
    if (opacity === 1) {
      matchers.push(isUndefined);
    }
    expectThat(opacities[id], anyOf(matchers),
              'Unexpected opacity for layer id ' + id);
    expectEq(layer.get('default_visibility'), enabledLayerIds.contains(id),
             'Unexpected visibility for layer id ' + id);
  });
};

/** Test that single-select folders get at most one enabled sublayer. */
AppStateTest.prototype.testSetFromMapModelSingleSelect = function() {
  var mapModel = cm.MapModel.newFromMapRoot({
    id: 'map', layers: [
      {id: 'singleSelect', type: 'FOLDER', list_item_type: 'RADIO_FOLDER',
        sublayers: [
          {id: 'subA', type: cm.LayerModel.Type.KML},
          {id: 'subB', type: cm.LayerModel.Type.KML},
          {id: 'subC', type: cm.LayerModel.Type.KML}
      ]},
      {id: 'emptySingleSelect1', type: 'FOLDER', list_item_type: 'RADIO_FOLDER',
        sublayers: []}
    ]
  });
  this.appState_.setFromMapModel(mapModel);

  // The first sublayer of the single-select folder should be enabled, even
  // though its MapRoot 'visibility' was off.
  expectTrue(this.appState_.get('enabled_layer_ids').contains('subA'));
};

/** Test that the writeToMapModel() method works correctly. */
AppStateTest.prototype.testWriteToMapModel = function() {
  this.appState_.set('enabled_layer_ids', new goog.structs.Set(['a', 'c']));
  this.appState_.set('layer_opacities', {a: 0, b: 50, c: 100});
  this.appState_.set('viewport', new cm.LatLonBox(10, -10, 20, 20));
  this.appState_.set('map_type', cm.MapModel.Type.SATELLITE);

  var mapModel = cm.MapModel.newFromMapRoot({
    id: 'map', layers: [
      {id: 'a', type: cm.LayerModel.Type.KML},
      {id: 'b', type: cm.LayerModel.Type.KML},
      {id: 'c', type: cm.LayerModel.Type.KML}
    ]
  });
  this.appState_.writeToMapModel(mapModel);

  expectEq(this.appState_.get('viewport'), mapModel.get('viewport'));
  expectEq(this.appState_.get('map_type'), mapModel.get('map_type'));
  var opacities = this.appState_.get('layer_opacities');
  var enabledLayerIds = this.appState_.get('enabled_layer_ids');
  cm.util.forLayersInMap(mapModel, function(layer) {
    var id = /** @type {string} */ (layer.get('id'));
    var opacity = layer.get('opacity');
    expectEq(opacities[id], opacity && /** @type {number} */(opacity) * 100,
        'Unexpected opacity for layer id ' + id);
    expectEq(enabledLayerIds.contains(id), layer.get('default_visibility'),
        'Unexpected visibility for layer id ' + id);
  });
};
