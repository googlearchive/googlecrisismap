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


// Test input: some layers in MapRoot format.

var KML_MAP_ROOT_JSON = {
  id: 'prawn',
  title: 'Sharks',
  description: '<b>Whales</b>',
  legend: 'Blue - Blue whales<br/>Grey - Grey whales',
  visibility: 'DEFAULT_ON',
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
  min_zoom: 5,
  max_zoom: 10,
  opacity: 50,
  type: 'KML',
  source: {
    kml: {
      url: 'http://monkfish.com'
    }
  }
};

var MAPTILE_MAP_ROOT_JSON = {
  id: 'foo',
  title: 'bar',
  type: 'GOOGLE_MAP_TILES',
  source: {
    google_map_tiles: {
      url: 'http://mw1.google.com/mw-weather/radar/maptiles/index.js',
      url_is_tile_index: true
    }
  }
};

function LayerModelTest() {
  cm.TestBase.call(this);
  this.setForTest_('cm.LayerModel.nextId_', 0);
}
LayerModelTest.prototype = new cm.TestBase();
registerTestSuite(LayerModelTest);

/** Tests LayerModel.newFromMapRoot with a KML layer in MapRoot JSON. */
LayerModelTest.prototype.newFromMapRootKmlLayer = function() {
  var layerModel = cm.LayerModel.newFromMapRoot(KML_MAP_ROOT_JSON);
  expectEq('prawn', layerModel.get('id'));
  expectEq('Sharks', layerModel.get('title'));
  expectEq('<b>Whales</b>', layerModel.get('description').getUnsanitizedHtml());
  expectEq('Blue - Blue whales<br/>Grey - Grey whales',
      layerModel.get('legend').getUnsanitizedHtml());
  expectEq(cm.LayerModel.Type.KML, layerModel.get('type'));
  expectTrue(layerModel.get('default_visibility'));
  expectEq(null, layerModel.get('suppress_download_link'));
  expectEq(new cm.LatLonBox(20, 10, -40, -50), layerModel.get('viewport'));
  expectEq('http://monkfish.com', layerModel.get('url'));
  expectEq(5, layerModel.get('min_zoom'));
  expectEq(10, layerModel.get('max_zoom'));
  expectEq(0.5, layerModel.get('opacity'));
};

/** Tests LayerModel.newFromMapRoot with a Maptile layer in MapRoot JSON. */
LayerModelTest.prototype.newFromMapRootMaptileLayer = function() {
  var layerModel = cm.LayerModel.newFromMapRoot(MAPTILE_MAP_ROOT_JSON);
  expectEq('foo', layerModel.get('id'));
  expectEq('bar', layerModel.get('title'));
  expectEq(true, layerModel.get('url_is_tile_index'));
};

/** Tests the default values set in LayerModel.newFromMapRoot. */
LayerModelTest.prototype.newFromMapRootDefaultValues = function() {
  var EMPTY_MAPROOT = {type: 'KML', title: 'Empty map'};
  var layerModel = cm.LayerModel.newFromMapRoot(EMPTY_MAPROOT);
  expectEq('Empty map', layerModel.get('title'));
  expectEq('', layerModel.get('description').getUnsanitizedHtml());
  expectEq('layer0', layerModel.get('id'));
  expectEq(cm.LayerModel.Type.KML, layerModel.get('type'));
  expectFalse(layerModel.get('default_visibility'));
  expectEq(null, layerModel.get('viewport'));
  expectEq(null, layerModel.get('suppress_download_link'));
  expectEq(undefined, layerModel.get('url'));
  expectEq(undefined, layerModel.get('url_is_tile_index'));
  expectEq(undefined, layerModel.get('ft_select'));
  expectEq(undefined, layerModel.get('ft_from'));
  expectEq(undefined, layerModel.get('ft_where'));
  expectEq(undefined, layerModel.get('layer_id'));
  expectEq(undefined, layerModel.get('is_hybrid'));
  expectEq(1, layerModel.get('opacity'));
  expectEq(undefined, layerModel.get('bounds'));
};

/**
 * Tests the appropriate LayerModel.Type is set for each of the
 * MapRoot JSON type values.
 */
LayerModelTest.prototype.newFromMapRootLayerTypes = function() {
  var layerModel;
  layerModel = cm.LayerModel.newFromMapRoot({type: 'KML'});
  expectEq(cm.LayerModel.Type.KML, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot({type: 'GEORSS'});
  expectEq(cm.LayerModel.Type.GEORSS, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot(
      {type: 'GOOGLE_MAP_TILES'});
  expectEq(cm.LayerModel.Type.TILE, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot(
      {type: 'GOOGLE_FUSION_TABLES'});
  expectEq(cm.LayerModel.Type.FUSION, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot({type: 'GOOGLE_MAP_DATA'});
  expectEq(cm.LayerModel.Type.MAP_DATA, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot({type: 'GOOGLE_TRAFFIC'});
  expectEq(cm.LayerModel.Type.TRAFFIC, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot({type: 'GOOGLE_TRANSIT'});
  expectEq(cm.LayerModel.Type.TRANSIT, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot({type: 'GOOGLE_WEATHER'});
  expectEq(cm.LayerModel.Type.WEATHER, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot({type: 'GOOGLE_CLOUD_IMAGERY'});
  expectEq(cm.LayerModel.Type.CLOUD, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot({type: 'FOLDER'});
  expectEq(cm.LayerModel.Type.FOLDER, layerModel.get('type'));

  layerModel = cm.LayerModel.newFromMapRoot({type: 'WMS'});
  expectEq(cm.LayerModel.Type.WMS, layerModel.get('type'));

  expectThat(cm.LayerModel.newFromMapRoot({type: 'other'}), isNull);
};

/**
 * Tests that a suitable description of a Maps Engine layer is built
 * and stored on the model for external Map Engine layers.
 */
LayerModelTest.prototype.newExternalMapsEngineLayerFromMapRoot = function() {
  var maproot = {
    'title': 'A map',
    'layers': [{
      'id': 'maproot_id',
      'title': 'layer_title',
      'description': 'layer_description',
      'visibility': 'DEFAULT_ON',
      'viewport': {
        'lat_lon_alt_box': {
          'north': 1.0,
          'south': 2.0,
          'east': -3.0,
          'west': -4.0
        }
      },
      'type': 'GOOGLE_MAP_DATA',
      'source': {
        'google_map_data': {
          'map_id': 'map_id',

          // NOTE(user): In practice, only key should be set. layer_id
          // is supported for older maproots.
          'layer_id': 'layer_id',
          'layer_key': 'layer_key'
        }
      }
    }]
  };

  var layerModel = cm.LayerModel.newFromMapRoot(maproot.layers[0]);

  expectEq(cm.LayerModel.Type.MAP_DATA, layerModel.get('type'));
  expectEq('layer_title', layerModel.get('title'));
  expectEq('map_id', layerModel.get('maps_engine_map_id'));
  expectEq('layer_id', layerModel.get('maps_engine_layer_id'));
  expectEq('layer_key', layerModel.get('maps_engine_layer_key'));
};

/**
 * Tests that the application gracefully handles a poorly formed Maps Engine
 * layer description.
 */
LayerModelTest.prototype.handlesMissingMapsEngineLayerDescription = function() {
  var maproot = {
    'title': 'A map',
    'layers': [{
      'type': 'GOOGLE_MAP_DATA'
    }]
  };

  var layerModel = cm.LayerModel.newFromMapRoot(maproot.layers[0]);

  expectEq(cm.LayerModel.Type.MAP_DATA, layerModel.get('type'));
};

/**
 * Tests that folder hierarchies are constructed from JSON layers with
 * nested sublayers.
 */
LayerModelTest.prototype.newFromMapRootFolders = function() {
  var json = {id: 'root', type: 'FOLDER', sublayers: [
    {id: 'sub0', type: 'KML'},
    {id: 'sub1', type: 'GEORSS'},
    {id: 'sub2', type: 'GOOGLE_MAP_TILES'},
    {id: 'sub3', type: 'FOLDER', sublayers: [
      {type: 'GOOGLE_FUSION_TABLES'},
      {type: 'GOOGLE_TRAFFIC'},
      {type: 'GOOGLE_MAP_DATA'}
     ]}
  ]};
  var layerModel = cm.LayerModel.newFromMapRoot(json);
  expectEq(cm.LayerModel.Type.FOLDER, layerModel.get('type'));
  var sublayers = layerModel.get('sublayers');
  expectThat(sublayers, not(isNull));
  expectEq(4, sublayers.getLength());
  expectEq('root', sublayers.getAt(0).get('parent').get('id'));
  // Sublayer order is preserved
  expectEq('sub0', sublayers.getAt(0).get('id'));
  expectEq('sub1', sublayers.getAt(1).get('id'));
  expectEq('sub2', sublayers.getAt(2).get('id'));

  var nested_folder = sublayers.getAt(3);
  expectEq('sub3', nested_folder.get('id'));
  expectEq(3, nested_folder.get('sublayers').getLength());
};

/** Tests construction of a single-select folder. */
LayerModelTest.prototype.newFromMapRootSingleSelect = function() {
  var json = {
    type: 'FOLDER',
    list_item_type: 'RADIO_FOLDER',
    sublayers: [
      {type: 'KML', id: '1'},
      {type: 'KML', id: '2', visibility: 'DEFAULT_ON'},
      {type: 'KML', id: '3'}
    ]};
  var layerModel = cm.LayerModel.newFromMapRoot(json);
  expectTrue(layerModel.isSingleSelect());
};

/** Tests construction of a locked folder. */
LayerModelTest.prototype.newFromMapRootLockedFolder = function() {
  var json = {
    type: 'FOLDER',
    list_item_type: 'CHECK_HIDE_CHILDREN',
    sublayers: [
      {type: 'KML', id: '1'},
      {type: 'KML', id: '2'},
      {type: 'KML', id: '3'}
    ]};
  var layerModel = cm.LayerModel.newFromMapRoot(json);
  expectEq(cm.LayerModel.FolderType.LOCKED, layerModel.get('folder_type'));
};

/**
 * Tests that layer ids are used from the MapRoot JSON or generated if
 * unspecified.
 */
LayerModelTest.prototype.newFromMapRootLayerIds = function() {
  var layerModel = cm.LayerModel.newFromMapRoot({type: 'GOOGLE_TRANSIT'});
  expectEq('layer0', layerModel.get('id'));

  var layerModel = cm.LayerModel.newFromMapRoot({type: 'GOOGLE_WEATHER'});
  expectEq('layer1', layerModel.get('id'));

  var layerModel = cm.LayerModel.newFromMapRoot(
      {type: 'GOOGLE_TRAFFIC', id: 'traffic'});
  expectEq('traffic', layerModel.get('id'));

  var layerModel = cm.LayerModel.newFromMapRoot({type: 'GOOGLE_CLOUD_IMAGERY'});
  expectEq('layer2', layerModel.get('id'));
};

/**
 * Tests that the result of toMapRoot matches the values specified in
 * the original JSON object.
 */
LayerModelTest.prototype.toMapRoot = function() {
  var layerModel = cm.LayerModel.newFromMapRoot(KML_MAP_ROOT_JSON);
  expectEq(KML_MAP_ROOT_JSON, layerModel.toMapRoot());
};

/** Tests that toMapRoot constructs a hierarchy of nested folders. */
LayerModelTest.prototype.toMapRootFolders = function() {
  var json = {
    id: 'folder0',
    title: '',
    visibility: 'DEFAULT_ON',
    min_zoom: 5,
    max_zoom: 10,
    type: 'FOLDER',
    sublayers: [{
      id: 'folder1',
      title: '',
      visibility: 'DEFAULT_ON',
      min_zoom: 5,
      max_zoom: 10,
      type: 'FOLDER',
      sublayers: [{
        id: 'folder2',
        title: '',
        visibility: 'DEFAULT_ON',
        min_zoom: 5,
        max_zoom: 10,
        type: 'FOLDER',
        sublayers: [{
          id: 'kml0',
          title: '',
          visibility: 'DEFAULT_ON',
          min_zoom: 5,
          max_zoom: 10,
          type: 'KML',
          source: {
            kml: {
              url: 'http://sub.sub.sub.layer.com'
            }
          }
        }
     ]}
   ]}
  ]};

  var layerModel = cm.LayerModel.newFromMapRoot(json);
  expectEq(json, layerModel.toMapRoot());
};

/** Tests the getSublayerIds() method. */
LayerModelTest.prototype.getSublayerIds = function() {
  var json = {
    type: 'FOLDER',
    sublayers: [
      {id: 'sub0', type: 'KML'},
      {id: 'sub1', type: 'GEORSS'},
      {id: 'sub2', type: 'FOLDER'}
    ]};
  var folderLayer = cm.LayerModel.newFromMapRoot(json);
  expectThat(folderLayer.getSublayerIds(),
             whenSorted(elementsAre(['sub0', 'sub1', 'sub2'])));

  // Remove the sublayers.
  json.sublayers = [];
  var plainLayer = cm.LayerModel.newFromMapRoot(json);
  expectThat(plainLayer.getSublayerIds(), elementsAre([]));
};

/** Tests the getSublayer() method. */
LayerModelTest.prototype.getSublayer = function() {
  var json = {
    type: 'FOLDER',
    sublayers: [
      {id: 'sub0', type: 'KML'},
      {id: 'sub1', type: 'GEORSS'},
      {id: 'sub2', type: 'FOLDER'}
    ]};
  var layerModel = cm.LayerModel.newFromMapRoot(json);
  expectEq('sub1', layerModel.getSublayer('sub1').get('id'));
  expectThat(layerModel.getSublayer('not-there'), isNull);
};

/** Tests sublayer insertion. */
LayerModelTest.prototype.insertLayer = function() {
  var parent = cm.LayerModel.newFromMapRoot({type: 'FOLDER'});

  // Push a sublayers.
  var child0 = cm.LayerModel.newFromMapRoot({type: 'KML', id: 'child0'});
  parent.get('sublayers').push(child0);
  expectEq(parent, child0.get('parent'));

  // Insert a sublayer.
  var child1 = cm.LayerModel.newFromMapRoot({type: 'KML', id: 'child1'});
  parent.get('sublayers').insertAt(0, child1);
  expectEq(parent, child1.get('parent'));
};

/** Tests whether source adress is returned correctly. */
LayerModelTest.prototype.testGetSourceAddress = function() {
  var layerModel = cm.LayerModel.newFromMapRoot(KML_MAP_ROOT_JSON);
  expectEq('KML:http://monkfish.com', layerModel.getSourceAddress());

  layerModel = cm.LayerModel.newFromMapRoot(MAPTILE_MAP_ROOT_JSON);
  expectEq('GOOGLE_MAP_TILES:' +
           'http://mw1.google.com/mw-weather/radar/maptiles/index.js',
           layerModel.getSourceAddress());

  layerModel = cm.LayerModel.newFromMapRoot(
      {type: 'WMS', source: {wms:
        {url: 'http://irs.gis-lab.info/?layers=osm'}}});
  expectEq('WMS:http://irs.gis-lab.info/?layers=osm',
           layerModel.getSourceAddress());

  layerModel = cm.LayerModel.newFromMapRoot(
      {type: 'WMS', source: {wms:
        {url: 'http://njwebmap.state.nj.us/njimagery?' +
              'VERSION=1.1.1&SERVICE=WMS&REQUEST=GetCapabilities'}}});
  expectEq('WMS:http://njwebmap.state.nj.us/njimagery',
           layerModel.getSourceAddress());

  layerModel = cm.LayerModel.newFromMapRoot(
      {type: 'WMS', source: {wms: {
        url: 'http://wms.hogwarts.edu?' +
             'service=magic&spell=alohomora&charm=unlocking'}}});
  expectEq('WMS:http://wms.hogwarts.edu?spell=alohomora&charm=unlocking',
           layerModel.getSourceAddress());
};

/** Tests creation of a WMS layer. */
LayerModelTest.prototype.newWmsLayerFromMapRoot = function() {
  var layerJson = {
    'id': 'wms',
    'title': 'Wms',
    'type': 'WMS',
    'source': {
      'wms': {
        'url': 'http://wms.service.url',
        'layer_names': ['wms_1', 'wms_2']
      }
    }
  };

  var layerModel = cm.LayerModel.newFromMapRoot(layerJson);
  expectEq(cm.LayerModel.Type.WMS, layerModel.get('type'));
  expectEq(layerModel.get('url'), layerJson['source']['wms']['url']);
  expectThat(layerJson['source']['wms']['layer_names'],
             elementsAre(layerModel.get('wms_layers')));
};


