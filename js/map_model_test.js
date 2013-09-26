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


// Test input: a map in MapRoot JSON format.
var DRACULA_MAPROOT = {
  id: 'foo',
  languages: ['en', 'fr'],
  title: 'Dracula invades Pittsburgh!',
  description: '<i>Deadly vampire</i> on the loose',
  footer: 'Brought to you by B. Stoker',
  region: 'xz',
  thumbnail_url: 'http://vampireinvasion.com/vampires.png',
  base_map_style: {
    name: 'chic',
    definition: '[{"featureType": "all", "stylers": [{"saturation": 10}]}]'
  },
  viewport: {
    lat_lon_alt_box: {
      north: 20,
      south: 10,
      east: -40,
      west: -50
    }
  },
  full_extent: {
    lat_lon_alt_box: {
      north: 21,
      south: 10,
      east: -40,
      west: -51
    }
  },
  layers: [{id: 'layer1'}, {id: 'layer2'}]
};


function MapModelTest() {
  cm.TestBase.call(this);
  this.setForTest_('cm.LayerModel.newFromMapRoot', createMockFunction());
  this.expectedLayers_ = [];
}
MapModelTest.prototype = new cm.TestBase();
registerTestSuite(MapModelTest);

/**
 * Create a fake LayerModel with the given layer ID.
 * @param {string} id The layer ID.
 * @return {google.maps.MVCobject} The fake layer.
 * @private
 */
MapModelTest.prototype.createFakeLayer_ = function(id) {
  var model = new google.maps.MVCObject();
  model.set('id', id);
  model.set('sublayers', new google.maps.MVCArray());
  return model;
};

/**
 * For this and all sublayers of the given layer json, creates either
 * a mock LayerModel instance or a simple MVCObject, sets up stubs
 * and expectations, and adds the model to this.expectedLayers_. The fake
 * instance gets its 'id' property from the provided json.
 * @param {Object} json The JSON object for this LayerModel.
 * @param {boolean} useMockLayers True to create mock instances for the
 *     LayerModels, and false to create simple MVCObjects for the LayerModels.
 * @private
 */
MapModelTest.prototype.recursivelyExpectLayer_ = function(json, useMockLayers) {
  var model;
  if (useMockLayers) {
    model = createMockInstance(cm.LayerModel);
    model.get = function() { return ''; };
  } else {
    model = this.createFakeLayer_(json.id);
  }
  json.sublayers && goog.array.forEach(json.sublayers, function(layerMapRoot) {
    this.recursivelyExpectLayer_(layerMapRoot, useMockLayers);
  }, this);
  expectCall(cm.LayerModel.newFromMapRoot)(equalsRef(json))
      .willOnce(returnWith(model));
  this.expectedLayers_.push(model);
};

/**
 * Calls MapModel.newFromMapRoot with appropriate expectations.
 * @param {Object} json A JSON object to pass to newFromMapRoot.
 * @param {boolean} useMockLayers True to create mock instances for the
 *     LayerModels; false to create simple MVCObjects for the LayerModels.
 * @return {cm.MapModel} The new MapModel instance.
 * @private
 */
MapModelTest.prototype.mapModelFromMapRoot_ = function(json, useMockLayers) {
  if (useMockLayers) {
    this.setForTest_('cm.events.listen', function() {});
    this.setForTest_('cm.events.unlisten', function() {});
  }
  // Iterate over the layers in the json object and create LayerModel
  // instances which are stored in this.expectedLayers_.
  for (var i = 0, layerMapRoot; layerMapRoot = (json.layers || [])[i]; ++i) {
    this.recursivelyExpectLayer_(layerMapRoot, useMockLayers);
  }
  return cm.MapModel.newFromMapRoot(json);
};

/**
 * Tests that the properties of the MapModel are set when a new one is created
 * from a MapRoot JS object.
 */
MapModelTest.prototype.newFromMapRoot = function() {
  var mapModel = this.mapModelFromMapRoot_(DRACULA_MAPROOT, true);
  expectEq(DRACULA_MAPROOT.title, mapModel.get('title'));
  expectEq(DRACULA_MAPROOT.description,
           mapModel.get('description').getUnsanitizedHtml());
  expectEq(DRACULA_MAPROOT.footer, mapModel.get('footer').getUnsanitizedHtml());
  expectEq(DRACULA_MAPROOT.region, mapModel.get('region'));
  expectEq(DRACULA_MAPROOT.thumbnail_url, mapModel.get('thumbnail_url'));
  // The model's 'map_type' property is overriden if the
  // 'base_map_style' property is set.
  expectEq(DRACULA_MAPROOT.base_map_style['definition'],
           mapModel.get('base_map_style'));
  expectEq(DRACULA_MAPROOT.base_map_style['name'],
           mapModel.get('base_map_style_name'));
  expectEq(cm.MapModel.Type.CUSTOM, mapModel.get('map_type'));
  expectEq(new cm.LatLonBox(20, 10, -40, -50), mapModel.get('viewport'));
  expectEq(2, mapModel.get('layers').getLength());
  expectEq(this.expectedLayers_[0], mapModel.get('layers').getAt(0));
  expectEq(this.expectedLayers_[1], mapModel.get('layers').getAt(1));
};

/** Tests that the MapModel enforces uniqueness of layer IDs on construction. */
MapModelTest.prototype.newFromMapRootWithInvalidIds = function() {
  var mapModel = this.mapModelFromMapRoot_({
    layers: [{id: 'a'}, {id: 'b'}, {id: '1'}, {id: '2'}]
  });
  var layers = mapModel.get('layers');
  expectEq('a', layers.getAt(0).get('id'));
  expectEq('b', layers.getAt(1).get('id'));
  expectEq('1', layers.getAt(2).get('id'));  // changed to first available int
  expectEq('2', layers.getAt(3).get('id'));  // filled in missing layer ID
  expectEq(layers.getAt(0), mapModel.getLayer('a'));
  expectEq(layers.getAt(1), mapModel.getLayer('b'));
  expectEq(layers.getAt(2), mapModel.getLayer('1'));
  expectEq(layers.getAt(3), mapModel.getLayer('2'));

  var mapModel = this.mapModelFromMapRoot_({
    layers: [{id: '1'}, {id: '1'}, {id: '1'}]
  });
  var layers = mapModel.get('layers');
  expectEq('1', layers.getAt(0).get('id'));
  expectEq('2', layers.getAt(1).get('id'));  // changed to avoid '1'
  expectEq('3', layers.getAt(2).get('id'));  // changed to avoid '1' and '2'
  expectEq(layers.getAt(0), mapModel.getLayer('1'));
  expectEq(layers.getAt(1), mapModel.getLayer('2'));
  expectEq(layers.getAt(2), mapModel.getLayer('3'));
};

/**
 * Tests that the default values are set for the MapModel's properties when
 * it is initialized from an empty object.
 */
MapModelTest.prototype.newFromEmpty = function() {
  var mapModel = this.mapModelFromMapRoot_({}, true);

  expectEq('', mapModel.get('title'));
  expectEq('', mapModel.get('description').getUnsanitizedHtml());
  expectEq('', mapModel.get('footer').getUnsanitizedHtml());
  expectEq(null, mapModel.get('viewport'));
  expectEq(0, mapModel.get('layers').getLength());
};

/**
 * Tests that the result returned from toMapRoot matches the JSON object
 * passed into newFromMapRoot.
 */
MapModelTest.prototype.toMapRoot = function() {
  var mapModel = this.mapModelFromMapRoot_(DRACULA_MAPROOT, true);

  expectCall(this.expectedLayers_[0].toMapRoot)()
      .willOnce(returnWith(DRACULA_MAPROOT.layers[0]));
  expectCall(this.expectedLayers_[1].toMapRoot)()
      .willOnce(returnWith(DRACULA_MAPROOT.layers[1]));

  expectEq(DRACULA_MAPROOT, mapModel.toMapRoot());
};

/**
 * Tests that getLayer returns the expected layers as specified in the JSON
 * object from which the MapModel is initialized.
 */
MapModelTest.prototype.getLayer = function() {
  var mapModel = this.mapModelFromMapRoot_(DRACULA_MAPROOT, false);
  expectEq(this.expectedLayers_[0], mapModel.getLayer('layer1'));
  expectEq(this.expectedLayers_[1], mapModel.getLayer('layer2'));
  expectThat(mapModel.getLayer('layer3'), isUndefined);
};

/** Tests that getAllLayerIds returns all layers IDs in the map. */
MapModelTest.prototype.getAllLayerIds = function() {
  var mapModel = this.mapModelFromMapRoot_(DRACULA_MAPROOT, false);
  // Add nested folders.
  var layer1 = mapModel.getLayer('layer1');
  var layer2 = mapModel.getLayer('layer2');
  var sub1 = this.createFakeLayer_('sub1');
  var sub2 = this.createFakeLayer_('sub2');
  var sub3 = this.createFakeLayer_('sub3');
  layer1.get('sublayers').push(sub1);
  sub1.get('sublayers').push(sub2);
  layer2.get('sublayers').push(sub3);

  var allIds = mapModel.getAllLayerIds();
  goog.array.sort(allIds);
  expectThat(allIds, whenSorted(elementsAre(
      ['layer1', 'layer2', 'sub1', 'sub2', 'sub3'])));
};

/** Tests that getLayerIds returns the top-level layers IDs. */
MapModelTest.prototype.getLayerIds = function() {
  var mapModel = this.mapModelFromMapRoot_(DRACULA_MAPROOT, false);
  expectThat(mapModel.getLayerIds(), elementsAre(['layer1', 'layer2']));
};

/** Tests layer insertion. */
MapModelTest.prototype.insertLayer = function() {
  var mapModel = this.mapModelFromMapRoot_({layers: [{id: 'layer0'}]}, false);
  var numAdded = 0;
  cm.events.listen(mapModel, cm.events.LAYERS_ADDED, function(e) {
    numAdded += e.layers.length;
  });

  // Push a single layer.
  var layer1 = this.createFakeLayer_('layer1');
  mapModel.get('layers').push(layer1);
  expectEq(layer1, mapModel.getLayer('layer1'));
  expectEq(1, numAdded);

  // Insert a single layer.
  var layer2 = this.createFakeLayer_('layer2');
  mapModel.get('layers').insertAt(0, layer2);
  expectEq(layer2, mapModel.getLayer('layer2'));
  expectEq(2, numAdded);

  // Create a fake folder with 2 sublayers.
  var layer3 = this.createFakeLayer_('layer3');
  var sub1 = this.createFakeLayer_('sub1');
  var sub2 = this.createFakeLayer_('sub2');
  layer3.get('sublayers').push(sub1);
  layer3.get('sublayers').push(sub2);

  // Push the folder to a sublayer.
  layer1.get('sublayers').push(layer3);

  // All 3 layers should be registered.
  expectEq(layer3, mapModel.getLayer('layer3'));
  expectEq(sub1, mapModel.getLayer('sub1'));
  expectEq(sub2, mapModel.getLayer('sub2'));
  expectEq(5, numAdded);

  // Push a layer with a duplicate ID.
  var subsub1 = this.createFakeLayer_('layer2');
  sub2.get('sublayers').push(subsub1);
  expectEq('1', subsub1.get('id'));  // changed to first available int
  expectEq(subsub1, mapModel.getLayer('1'));

  // Insert a layer with a duplicate ID.
  var layer4 = this.createFakeLayer_('sub1');
  mapModel.get('layers').insertAt(1, layer4);
  expectEq('2', layer4.get('id'));  // changed to first available int
  expectEq(layer4, mapModel.getLayer('2'));

  // Push a layer with no ID.
  var layer5 = this.createFakeLayer_();
  mapModel.get('layers').push(layer5);
  expectEq('3', layer5.get('id'));  // changed to first available int
  expectEq(layer5, mapModel.getLayer('3'));
};

/**
 * Tests layer removal.
 */
MapModelTest.prototype.removeLayer = function() {
  var mapModel = this.mapModelFromMapRoot_(
      {layers: [{id: 'sub1'}, {id: 'sub2'}, {id: 'sub3'}]} , false);
  var numRemoved = 0;
  cm.events.listen(mapModel, cm.events.LAYERS_REMOVED, function(e) {
    numRemoved += e.ids.length;
  }, this);

  // Add some nested sublayers
  var sub2 = mapModel.getLayer('sub2');
  var sub4 = this.createFakeLayer_('sub4');
  var sub5 = this.createFakeLayer_('sub5');
  sub2.get('sublayers').push(sub4);
  sub2.get('sublayers').push(sub5);

  var sub1 = mapModel.getLayer('sub1');
  var sub6 = this.createFakeLayer_('sub6');
  var sub7 = this.createFakeLayer_('sub7');
  var sub8 = this.createFakeLayer_('sub8');
  sub1.get('sublayers').push(sub6);
  sub6.get('sublayers').push(sub7);
  sub7.get('sublayers').push(sub8);

  // Remove a plain layer.
  mapModel.get('layers').removeAt(2);
  expectThat(mapModel.getLayer('sub3'), isUndefined);
  expectEq(1, numRemoved);

  // Remove a top-level folder.
  mapModel.get('layers').removeAt(1);

  // The folder and its descendants are removed.
  expectThat(mapModel.getLayer('sub2'), isUndefined);
  expectThat(mapModel.getLayer('sub4'), isUndefined);
  expectThat(mapModel.getLayer('sub5'), isUndefined);
  expectEq(4, numRemoved);

  // Remove a folder from a nested folder.
  sub6.get('sublayers').removeAt(0);

  // The folder and its descendants are removed.
  expectThat(mapModel.getLayer('sub7'), isUndefined);
  expectThat(mapModel.getLayer('sub8'), isUndefined);
  expectEq(6, numRemoved);

  // Clear the layers folder.
  mapModel.get('layers').clear();

  // All descendants should be removed.
  expectThat(mapModel.getLayer('sub1'), isUndefined);
  expectThat(mapModel.getLayer('sub6'), isUndefined);
  expectEq(8, numRemoved);

  // Modifying a removed layer's sublayers should neither trigger handlers
  // nor fire events.
  sub2.get('sublayers').clear();
  expectEq(8, numRemoved);

  var numAdded = 0;
  cm.events.listen(mapModel, cm.events.LAYERS_ADDED, function(e) {
    numAdded += e.layers.length;
  });
  sub2.get('sublayers').push(sub6);
  expectEq(0, numAdded);
  var numLayers = 0;
  cm.util.forLayersInMap(mapModel, function() { numLayers++; });
  expectEq(0, numLayers);
};

function MapModelSystemTest() {
}
registerTestSuite(MapModelSystemTest);

/**
 * Creates a MapModel from a test MapRoot file that has one of each
 * type of layer, and verifies that all layers are added.
 * TODO(romano): add other MapRoot files to static:testfiles to verify
 * viewports, folders, and localization.
 */
MapModelSystemTest.prototype.verifyTestMapRoot = function() {
  var json = cm.json_files.test_maproot;
  var mapModel = cm.MapModel.newFromMapRoot(json);
  var expectedTypes =
      ['MAP_DATA', 'TILE', 'FUSION', 'GEORSS', 'KML', 'KML', 'FOLDER', 'FOLDER',
       'TRAFFIC', 'TRANSIT', 'WEATHER', 'CLOUD', 'WMS'];
  var expectedLayers = [];
  goog.array.forEach(json.layers, function(layerMapRoot) {
    expectedLayers.push(cm.LayerModel.newFromMapRoot(layerMapRoot));
  });
  expectEq(expectedTypes.length, expectedLayers.length);

  goog.array.forEach(expectedLayers, function(layer, i) {
    expectEq(expectedTypes[i], layer.get('type'));
  });

  expectEq(json, mapModel.toMapRoot());
};

/**
 * Tests that MODEL_CHANGED events fire from layers, and that they are
 * forwarded through the parent MapModel.
 */
MapModelSystemTest.prototype.verifyModelChangedEvent = function() {
  var json = cm.json_files.test_maproot;
  var mapModel = cm.MapModel.newFromMapRoot(json);
  var modelChangedCount = 0;
  var expectedModelChangedCount = 0;
  cm.events.listen(mapModel, cm.events.MODEL_CHANGED, function() {
    modelChangedCount++;
  });
  mapModel.set('title', 'new title');
  expectedModelChangedCount++;

  cm.util.forLayersInMap(mapModel, function(layerModel) {
    var layerChanged = false;
    cm.events.listen(layerModel, cm.events.MODEL_CHANGED, function() {
      layerChanged = true;
    });

    layerModel.set('title', 'new title');
    expectEq(true, layerChanged);
    expectedModelChangedCount++;
  });

  expectEq(expectedModelChangedCount, modelChangedCount);
};
