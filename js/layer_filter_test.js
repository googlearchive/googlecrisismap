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


function layerFilterTest() {
  cm.TestBase.call(this);
}
layerFilterTest.prototype = new cm.TestBase();
registerTestSuite(layerFilterTest);

/**
 * Wrapper to execute search and sort results.
 * @private
 */
layerFilterTest.prototype.doMatching_ = function(query) {
  res = cm.layerFilter.matchAllLayers(this.mapModel_, query);
  goog.array.sort(res);
  return res;
};

layerFilterTest.prototype.testSearch = function() {
  this.mapModel_ = cm.MapModel.newFromMapRoot({
    'layers': [{
      'id': 'layer1',
      'title': 'No disasters',
      'description': 'anywhere',
      'type': 'KML' // Must have a type, or won't create.
    },
    {
      'id': 'layer2',
      'title': 'Wow',
      'description': '<em>so</em> cool',
      'type': 'KML'
    }]
  });
  expectEq(['layer1', 'layer2'], cm.layerFilter.matchAllLayers(
    this.mapModel_, 's'));
  expectEq(['layer1'], cm.layerFilter.matchAllLayers(this.mapModel_,
    'Anywhere'));
  expectEq(['layer2'], cm.layerFilter.matchAllLayers(this.mapModel_, 'WoW'));
  expectEq(['layer2'], cm.layerFilter.matchAllLayers(this.mapModel_, 'so'));
  // Make sure both query words match.
  expectEq(['layer1'], cm.layerFilter.matchAllLayers(this.mapModel_, 's a'));
  // Not searching HTML.
  expectEq([], cm.layerFilter.matchAllLayers(this.mapModel_, 'em'));
};

layerFilterTest.prototype.testSearchWithFolders = function() {
  this.mapModel_ = cm.MapModel.newFromMapRoot({
    'layers': [{
      'id': 'a1',
      'title': 'Broad',
      'description': 'topics',
      'type': cm.LayerModel.Type.FOLDER,
      'sublayers': [{
        'id': 'b1',
        'title': 'smaller',
        'description': 'topics',
        'type': cm.LayerModel.Type.FOLDER,
        'sublayers': [{
          'id': 'c1',
          'title': 'no',
          'description': 'topics',
          'type': 'KML'
        },
        {
          'id': 'c2',
          'title': 'simply',
          'description': 'empty',
          'type': 'KML'
        }]
      },
      {
        'id': 'b2',
        'title': 'no tiny',
        'description': 'topics',
        'type': 'KML'
      }]
    }]
  });

  expectEq(['a1', 'b1', 'b2', 'c1'], this.doMatching_('topic'));
  expectEq(['a1'], this.doMatching_('broad'));
  expectEq(['b1'], this.doMatching_('small'));
  expectEq(['b2', 'c1'], this.doMatching_('no'));
  expectEq(['c2'], this.doMatching_('empty'));
};

layerFilterTest.prototype.testMatchLayer = function() {
  var layer = new google.maps.MVCObject();
  layer.set('title', 'Abc');
  layer.set('description', 'dEf ghi');

  expectEq(cm.layerFilter.matchLayer(layer, 'a'), true);
  // Test across keys.
  expectEq(cm.layerFilter.matchLayer(layer, 'ag'), false);
  // And across words.
  expectEq(cm.layerFilter.matchLayer(layer, 'defg'), false);
  // Multiple words in the query.
  expectEq(cm.layerFilter.matchLayer(layer, 'd Gh'), true);
  // Only one matches.
  expectEq(cm.layerFilter.matchLayer(layer, 'ab x'), false);
  expectEq(cm.layerFilter.matchLayer(layer, 'a d g'), true);
  expectEq(cm.layerFilter.matchLayer(layer, ''), true);
};
