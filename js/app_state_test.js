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
  expectEq(0, this.appState_.get('promoted_layer_ids').getCount());
  expectEq(this.viewport_, this.appState_.get('viewport'));
  expectEq(cm.MapModel.Type.ROADMAP, this.appState_.get('map_type'));
};

/** Test the AppState fromAppState copy method. */
AppStateTest.prototype.testFromAppState = function() {
  this.appState_.set('language', 'es');
  this.appState_.get('enabled_layer_ids').add('x');
  this.appState_.get('promoted_layer_ids').add('y');
  this.appState_.set('layer_opacities', {a: 50});
  this.appState_.set('viewport', new cm.LatLonBox(10, -10, 20, -20));
  this.appState_.set('map_type', cm.MapModel.Type.SATELLITE);

  // Check that all the properties are equal.
  var newAppState = cm.AppState.fromAppState(this.appState_);
  expectEq(this.appState_.get('language'), newAppState.get('language'));
  expectEq(this.appState_.get('enabled_layer_ids'),
           newAppState.get('enabled_layer_ids'));
  expectEq(this.appState_.get('promoted_layer_ids'),
           newAppState.get('promoted_layer_ids'));
  expectEq(this.appState_.get('layer_opacities'),
           newAppState.get('layer_opacities'));
  expectEq(this.appState_.get('viewport'),
           newAppState.get('viewport'));
  expectEq(this.appState_.get('map_type'), newAppState.get('map_type'));

  // Check that object references are not the same.
  var keys = ['enabled_layer_ids', 'promoted_layer_ids', 'layer_opacities'];
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

  var notified = 0;
  cm.events.listen(this.appState_, 'enabled_layer_ids_changed', function() {
    ++notified;
  });

  expectFalse(this.appState_.getLayerEnabled('a'));
  expectEq(0, notified);

  this.appState_.setLayerEnabled('a', true);
  expectTrue(this.appState_.getLayerEnabled('a'));
  expectEq(1, notified);

  this.appState_.setLayerEnabled('a', false);
  expectFalse(this.appState_.getLayerEnabled('a'));
  expectEq(2, notified);

  this.appState_.setLayerEnabled('a', false);
  expectFalse(this.appState_.getLayerEnabled('a'));
  expectEq(2, notified);

  this.appState_.setLayerEnabled('b', true);
  expectFalse(this.appState_.getLayerEnabled('a'));
  expectTrue(this.appState_.getLayerEnabled('b'));
  expectEq(3, notified);

  this.appState_.setLayerEnabled('b', true);
  expectEq(3, notified);
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

/**
 * Verifies that promoteLayer() adds and removes the right layers from
 * the sets of enabled and promoted layers.
 */
AppStateTest.prototype.testPromoteLayer = function() {
  var child = this.createLayer_('child');
  var sibling = this.createLayer_('sibling');
  var parent = this.createLayer_('parent', null, [child, sibling]);
  child.set('parent', parent);
  sibling.set('parent', parent);
  parent.set('type', cm.LayerModel.Type.FOLDER);
  parent.set('tags', [cm.LayerModel.IS_TIME_SERIES_FOLDER]);

  // Enable both child and sibling
  this.appState_.setLayerEnabled('child');
  this.appState_.setLayerEnabled('sibling');

  // Promote the 'child' sublayer.
  this.appState_.promoteLayer(child);
  expectThat(this.appState_.get('promoted_layer_ids').getValues(),
             elementsAre(['child']));
  expectThat(this.appState_.get('enabled_layer_ids').getValues(),
             elementsAre(['child']));

  // Promote the 'sibling' sublayer.
  this.appState_.promoteLayer(sibling);
  expectThat(this.appState_.get('promoted_layer_ids').getValues(),
             elementsAre(['sibling']));
  expectThat(this.appState_.get('enabled_layer_ids').getValues(),
             elementsAre(['sibling']));
};

/**
 * Verifies that demoteSublayers() modifies the AppState's sets of promoted
 * and enabled layers properly.
 */
AppStateTest.prototype.testDemoteSublayers = function() {
  var child1 = this.createLayer_('child1');
  var child2 = this.createLayer_('child2');
  var child3 = this.createLayer_('child3');
  var parent = this.createLayer_('parent', null, [child1, child2, child3]);
  child1.set('parent', parent);
  child2.set('parent', parent);
  child3.set('parent', parent);
  parent.set('type', cm.LayerModel.Type.FOLDER);
  parent.set('tags', [cm.LayerModel.IS_TIME_SERIES_FOLDER]);
  this.appState_.set('promoted_layer_ids', new goog.structs.Set(['child1']));
  this.appState_.set('enabled_layer_ids', new goog.structs.Set(['child1']));

  // Demote sublayers and verify that child1 is still enabled.
  this.appState_.demoteSublayers(parent);
  expectThat(this.appState_.get('promoted_layer_ids').getValues(),
             elementsAre([]));
  expectThat(this.appState_.get('enabled_layer_ids').getValues(),
             elementsAre(['child1']));
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
      {'location': 'http://google.org/crisismap/foo' +
          '?lat=1&lng=2&llbox=3,4,5,6&z=7&t=8&layers=9'});

  // Add state to the app state.
  this.appState_.set('map_type', cm.MapModel.Type.SATELLITE);

  var layera = this.createLayer_('a');
  var layerb = this.createLayer_('b');
  var layerc = this.createLayer_('c');
  var layerd = this.createLayer_('d');
  this.appState_.set('enabled_layer_ids',
                     new goog.structs.Set(['a', 'b', 'd']));
  this.appState_.set('promoted_layer_ids', new goog.structs.Set(['c']));
  this.appState_.set('viewport', new cm.LatLonBox(12, 11, -33, -34.123456));
  this.appState_.set('layer_opacities', {'a': 1, 'b': 34});
  // crisis should be removed; id, hl, llbox, t, layers, and promoted should
  // be set; lat, lng, z should be removed.
  expectEq('http://google.org/crisismap/foo' +
           '?hl=fr' +
           '&llbox=12%2C11%2C-33%2C-34.123' +
           '&t=SATELLITE' +
           '&layers=a%3A1%2Cb%3A34%2Cd' +
           '&promoted=c',
           this.appState_.getUri().toString());

  // Include the 'base' parameter in the location.
  this.setForTest_('goog.global',
      {'location': 'http://google.org/crisismap?' +
          'crisis=foo&lat=1&lng=2&llbox=3,4,5,6&z=7&t=8&layers=9&' +
          'base=http://elsewhere.org/whatever'});

  expectEq('http://elsewhere.org/whatever' +
           '?hl=fr' +
           '&llbox=12%2C11%2C-33%2C-34.123' +
           '&t=SATELLITE' +
           '&layers=a%3A1%2Cb%3A34%2Cd' +
           '&promoted=c',
           this.appState_.getUri().toString());
};

/** Verifies that the AppState is set according to the 't' param. */
AppStateTest.prototype.testSetFromUriMapType = function() {
  var uri = new goog.Uri('');
  uri.setParameterValue('t', cm.MapModel.Type.HYBRID);

  this.appState_.setFromUri(uri);
  expectEq(cm.MapModel.Type.HYBRID, this.appState_.get('map_type'));
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

/** Verifies that the AppState is set according to the 'promoted' param. */
AppStateTest.prototype.testSetFromUriPromoted = function() {
  var uri = new goog.Uri('');
  uri.setParameterValue('promoted', 'c,a,d');

  this.appState_.setFromUri(uri);
  expectTrue(this.appState_.getLayerPromoted('a'));
  expectFalse(this.appState_.getLayerPromoted('b'));
  expectTrue(this.appState_.getLayerPromoted('c'));
  expectTrue(this.appState_.getLayerPromoted('d'));
};

/** Test that the setFromMapModel() method works correctly. */
AppStateTest.prototype.testSetFromMapModel = function() {
  var viewport = new cm.LatLonBox(10, -10, 20, -20);
  var mapModel = cm.MapModel.newFromMapRoot({
    id: 'map', base_map_type: 'GOOGLE_SATELLITE',
    viewport: {lat_lon_alt_box: viewport.toMapRoot()}, layers: [
      {id: 'layer', type: cm.LayerModel.Type.KML,
       default_visibility: true, opacity: 0},
      {id: 'folderA', type: cm.LayerModel.Type.FOLDER,
       default_visibility: true, opacity: 1, sublayers: [
         {id: 'sublayerA', type: cm.LayerModel.Type.KML,
          default_visibility: false, opacity: 25}
      ]},
      {id: 'folderB', type: cm.LayerModel.Type.FOLDER,
       default_visibility: false, opacity: 75, sublayers: [
         {id: 'sublayerB', type: cm.LayerModel.Type.KML,
          default_visibility: true, opacity: 100}
      ]},
      {id: 'timeSeries', type: cm.LayerModel.Type.FOLDER,
       tags: [cm.LayerModel.IS_TIME_SERIES_FOLDER], sublayers: [
         {id: 'timeA', type: cm.LayerModel.Type.KML},
         {id: 'promoted', type: cm.LayerModel.Type.KML,
          last_update: 1},
         {id: 'timeC', type: cm.LayerModel.Type.KML}
      ]}
    ]
  });
  this.appState_.setFromMapModel(mapModel);

  expectEq(mapModel.get('map_type'), this.appState_.get('map_type'));
  expectEq(viewport, this.appState_.get('viewport'));

  expectEq(['promoted'], this.appState_.get('promoted_layer_ids').getValues());
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
