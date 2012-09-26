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

// Author: romano@google.com (Raquel Romano)

function UtilTest() {
}
registerTestSuite(UtilTest);

/**
 * Tests that forLayerAndDescendants walks entire tree of descendants.
 */
UtilTest.prototype.testForLayerAndDescendants = function() {
  var json = {id: 'layer0', type: 'FOLDER', sublayers: [
    {id: 'layer1', type: 'KML'},
    {id: 'layer2', type: 'KML'},
    {id: 'layer3', type: 'KML'},
    {id: 'layer4', type: 'FOLDER', sublayers: [
      {id: 'layer5', type: 'KML'},
      {id: 'layer6', type: 'KML'}
    ]}
  ]};
  var layer = cm.LayerModel.newFromMapRoot(json);
  ids = [];
  cm.util.forLayerAndDescendants(layer, function(model) {
    ids.push(model.get('id'));
  });
  expectThat(ids, whenSorted(elementsAre(
      ['layer0', 'layer1', 'layer2', 'layer3', 'layer4', 'layer5', 'layer6'])));
};

/**
 * Tests that forLayerAndDescendants respects the expansion function.
 */
UtilTest.prototype.testForLayersAndDescendantsTree = function() {
  var json = {id: 'layer0', type: 'FOLDER', sublayers: [
    {id: 'layer1', type: 'KML'},
    {id: 'layer2', type: 'KML'},
    {id: 'layer3', type: 'KML'},
    {id: 'layer4', type: 'FOLDER', sublayers: [
      {id: 'layer5', type: 'KML'},
      {id: 'layer6', type: 'KML'}
    ]}
  ]};
  var layer = cm.LayerModel.newFromMapRoot(json);
  ids = [];
  cm.util.forLayerAndDescendants(layer,
      function(model) { ids.push(model.get('id')); },
      function(model) { return model.get('id') != 'layer4'; });
  expectThat(ids, whenSorted(elementsAre(
      ['layer0', 'layer1', 'layer2', 'layer3', 'layer4'])));
};

/**
 * Tests the forLayersInMap function.
 */
UtilTest.prototype.testForLayersInMap = function() {
  var json = {
    title: 'Map With Nested Folders',
  viewport: {},
  layers: [{
    id: 'folder0',
    type: 'FOLDER',
    sublayers: [{
      id: 'folder1',
      type: 'FOLDER',
      sublayers: [{
        id: 'folder2',
        type: 'FOLDER',
        sublayers: [{
          id: 'kml0',
          type: 'KML',
          source: { kml: {} }
        }]
     }]
   }]
  } , {
    id: 'folder3',
    type: 'FOLDER',
    sublayers: [{
      id: 'folder4',
      type: 'FOLDER'
   }]
  }]};
  var mapModel = cm.MapModel.newFromMapRoot(json);
  ids = [];
  cm.util.forLayersInMap(mapModel, function(model) {
    ids.push(model.get('id'));
  });
  expectThat(ids, whenSorted(elementsAre(
      ['folder0', 'folder1', 'folder2', 'folder3', 'folder4', 'kml0'])));
};

/** Tests yToLat. */
UtilTest.prototype.testYToLat = function() {
  // These results should be exact.
  expectEq(90, cm.util.yToLat(Infinity));
  expectEq(0, cm.util.yToLat(0));
  expectEq(-90, cm.util.yToLat(-Infinity));
  expectEq(-cm.util.yToLat(64), cm.util.yToLat(-64));

  // These results should be approximately correct.
  expectThat(cm.util.yToLat(300), isNearNumber(89.927323, 1e-6));
  expectThat(cm.util.yToLat(128), isNearNumber(85.051128, 1e-6));
  expectThat(cm.util.yToLat(64), isNearNumber(66.513260, 1e-6));
  expectThat(cm.util.yToLat(-128), isNearNumber(-85.051128, 1e-6));
};

/** Tests latToY. */
UtilTest.prototype.testLatToY = function() {
  // These results should be exact.
  expectEq(Infinity, cm.util.latToY(90));
  expectEq(0, cm.util.latToY(0));
  expectEq(-Infinity, cm.util.latToY(-90));
  expectEq(-cm.util.latToY(45), cm.util.latToY(-45));

  // These results should be approximately correct.
  expectThat(cm.util.latToY(85.0511287), isNearNumber(128, 1e-6));
  expectThat(cm.util.latToY(45), isNearNumber(35.910390, 1e-6));
  expectThat(cm.util.latToY(-85.0511287), isNearNumber(-128, 1e-6));
};

/** Tests cm.util.round. */
UtilTest.prototype.testRound = function() {
  expectEq(0, cm.util.round(123.456, -3));
  expectEq(100, cm.util.round(123.456, -2));
  expectEq(120, cm.util.round(123.456, -1));
  expectEq(123, cm.util.round(123.456, 0));
  expectEq(123.5, cm.util.round(123.456, 1));
  expectEq(123.46, cm.util.round(123.456, 2));
  expectEq(123.456, cm.util.round(123.456, 3));
  expectEq(123.456, cm.util.round(123.456, 50));
  expectEq(0.00123, cm.util.round(0.00123456, 5));

  expectEq(0, cm.util.round(-123.456, -3));
  expectEq(-100, cm.util.round(-123.456, -2));
  expectEq(-120, cm.util.round(-123.456, -1));
  expectEq(-123, cm.util.round(-123.456, 0));
  expectEq(-123.5, cm.util.round(-123.456, 1));
  expectEq(-123.46, cm.util.round(-123.456, 2));
  expectEq(-123.456, cm.util.round(-123.456, 3));
  expectEq(-123.456, cm.util.round(-123.456, 50));

  expectEq(Infinity, cm.util.round(Infinity, 1));
  expectEq(-Infinity, cm.util.round(-Infinity, 1));
  expectTrue(isNaN(cm.util.round(NaN, 1)));
};

/** Tests cm.util.removeNulls. */
UtilTest.prototype.testRemoveNulls = function() {
  // Nulls should be removed from plain Objects and Arrays.
  expectThat(cm.util.removeNulls([3, 4, null, 5]),
             recursivelyEquals([3, 4, 5]));
  expectThat(cm.util.removeNulls([3, 4, [6, 7, null, 8], {a: null, b: 1}, 5]),
             recursivelyEquals([3, 4, [6, 7, 8], {b: 1}, 5]));
  expectThat(cm.util.removeNulls({a: 3, b: null, c: 5}),
             recursivelyEquals({a: 3, c: 5}));
  expectThat(cm.util.removeNulls({a: 3, b: {x: null, y: 4}, c: [null, 5]}),
             recursivelyEquals({a: 3, b: {y: 4}, c: [5]}));

  // Anything that isn't a plain Object or Array should be unaffected.
  expectThat(cm.util.removeNulls(3), equals(3));
  expectThat(cm.util.removeNulls('abc'), equals('abc'));
  expectThat(cm.util.removeNulls('abc'), equals('abc'));

  // Properties of other objects shouldn't be affected, even if they are null.
  function Foo() { }
  var f = new Foo();
  f.a = null;
  expectThat(cm.util.removeNulls(f), equals(f));
  expectTrue('a' in f);
  expectEq(null, f.a);
};
