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
  this.setGjstestEquals_('cm.LatLonBox');
  this.setGjstestEquals_('google.maps.LatLng');
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
  expectEq(google.maps.MapTypeId.ROADMAP, this.appState_.get('map_type_id'));
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

/** Test the setLayerEnabled and getLayerEnabled methods. */
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
  this.appState_.set('map_type_id', google.maps.MapTypeId.SATELLITE);

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
           '&t=satellite' +
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
           '&t=satellite' +
           '&layers=a%3A1%2Cb%3A34%2Cd' +
           '&promoted=c',
           this.appState_.getUri().toString());
};

/** Verifies that the AppState is set according to the 't' param. */
AppStateTest.prototype.testSetFromUriMapType = function() {
  var uri = new goog.Uri('');
  uri.setParameterValue('t', 'hybrid');

  this.appState_.setFromUri(uri);
  expectEq(google.maps.MapTypeId.HYBRID, this.appState_.get('map_type_id'));
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
