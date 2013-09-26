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

// Author: cimamoglu@google.com (Cihat Imamoglu)

var MAPROOT = {'layers': [
  {'id': '1', 'type': 'KML', 'source': {'kml': {'url': 'http://a.com/b.kml'}}},
  {'id': '5', 'type': 'KML', 'source': {'kml': {'url': 'http://j.com/z.kml'}}},
  {'id': '3', 'type': 'TRAFFIC'},
  {'id': '7', 'type': 'WMS', 'source': {'wms': {'url': 'http://d.com'}}}
]};

var METADATA_URL = '/root/.metadata?key=foobar';


function MetadataModelTest() {
  cm.TestBase.call(this);

  // First set up the mock for the timer...
  this.timer_ = this.expectNew_('goog.Timer', 90000);
  // NOTE: this.expectNew_ replaces goog.Timer with a mock, but the code under
  // test needs the goog.Timer.TICK constant, so we provide it.
  goog.Timer.TICK = 'TICK';
  goog.Timer.callOnce = createMockFunction();
  expectCall(this.timer_.start)();

  this.mapModel_ = cm.MapModel.newFromMapRoot(MAPROOT);
  this.metadataModel_ = new cm.MetadataModel(this.mapModel_, {
    'KML:http://a.com/b.kml': {
      'length': 10,
      'has_no_features': true,
      'update_time': 123000000
    },
    'KML:http://j.com/z.kml': {
      'length': 0,
      'fetch_error_occurred': true,
      'has_unsupported_kml': true
    },
    'WMS:http://d.com': {
      'wms_layers': {'wms0' : {'minx': 1.1, 'miny': 2.2,
                               'maxx': 3.3, 'maxy': 4.4}}
    }
  }, METADATA_URL);
}
MetadataModelTest.prototype = new cm.TestBase();
registerTestSuite(MetadataModelTest);


/** Tests the various getters on the initially loaded metadata. */
MetadataModelTest.prototype.testGetters = function() {
  var layer1 = this.mapModel_.getLayer('1');
  expectTrue(this.metadataModel_.isEmpty(layer1));
  expectFalse(this.metadataModel_.hasUnsupportedFeatures(layer1));
  expectFalse(this.metadataModel_.fetchErrorOccurred(layer1));
  expectEq(10, this.metadataModel_.getLength(layer1));
  expectEq(123000000, this.metadataModel_.getUpdateTime(layer1));

  var layer5 = this.mapModel_.getLayer('5');
  expectTrue(this.metadataModel_.isEmpty(layer5));
  expectTrue(this.metadataModel_.hasUnsupportedFeatures(layer5));
  expectTrue(this.metadataModel_.fetchErrorOccurred(layer5));
  expectEq(0, this.metadataModel_.getLength(layer5));
  expectEq(null, this.metadataModel_.getUpdateTime(layer5));

  var layer7 = this.mapModel_.getLayer('7');
  var extent = this.metadataModel_.getWmsLayerExtents(layer7)['wms0'];
  expectEq(1.1, extent['minx']);
  expectEq(2.2, extent['miny']);
  expectEq(3.3, extent['maxx']);
  expectEq(4.4, extent['maxy']);
};


/** Tests the retrieval of periodic updates from the server. */
MetadataModelTest.prototype.testUpdates = function() {
  // Set up the mock for the JSONP request...
  var jsonp = this.expectNew_('goog.net.Jsonp', METADATA_URL);
  expectCall(jsonp.send)({
    'source': []
  }, _).willOnce(function(_, callback) {
    callback({
      'KML:http://a.com/b.kml': {
        'has_no_features': true,
        'length': 123,
        'update_time': 123456789
      },
      'KML:http://j.com/z.kml': {
        'has_unsupported_kml': true,
        'update_time': 123456000
      }
    });
  });
  expectCall(this.timer_.setInterval)(90000);

  // ...and fire the timer.
  cm.events.emit(this.timer_, goog.Timer.TICK);

  // The JSON response should now be loaded into the model.
  var layer1 = this.mapModel_.getLayer('1');
  var layer5 = this.mapModel_.getLayer('5');
  expectTrue(this.metadataModel_.isEmpty(layer1));
  expectEq(123, this.metadataModel_.getLength(layer1));
  expectEq(123456789, this.metadataModel_.getUpdateTime(layer1));

  expectTrue(this.metadataModel_.hasUnsupportedFeatures(layer5));
  expectEq(123456000, this.metadataModel_.getUpdateTime(layer5));

  // Now add a layer to the map...
  var layer4 = cm.LayerModel.newFromMapRoot(
    {'id': '4', 'type': 'GEORSS', 'source': {'georss': {'url': 'http://foo'}}}
  );
  this.mapModel_.get('layers').insertAt(0, layer4);

  // ...set up the mock for a second JSONP request...
  var jsonp = this.expectNew_('goog.net.Jsonp', METADATA_URL);
  expectCall(jsonp.send)({
    'source': ['GEORSS:http://foo']
  }, _).willOnce(function(_, callback) {
    callback({
      'KML:http://a.com/b.kml': {
        'length': 456,
        'update_time': 123457000
      },
      'KML:http://j.com/z.kml': {
        'fetch_error_occurred': true
      },
      'GEORSS:http://foo': {
        'length': 789,
        'update_time': 123459000
      }
    });
  });
  expectCall(this.timer_.setInterval)(90000);

  // ...and fire the timer again.
  cm.events.emit(this.timer_, goog.Timer.TICK);

  // The metadata should be updated with the new layer.
  expectFalse(this.metadataModel_.isEmpty(layer1));
  expectEq(456, this.metadataModel_.getLength(layer1));
  expectEq(123457000, this.metadataModel_.getUpdateTime(layer1));

  expectFalse(this.metadataModel_.hasUnsupportedFeatures(layer5));
  expectTrue(this.metadataModel_.fetchErrorOccurred(layer5));

  expectEq(123459000, this.metadataModel_.getUpdateTime(layer4));
  expectEq(789, this.metadataModel_.getLength(layer4));
};
