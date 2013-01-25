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

var MAPROOT_JSON = {'layers': [
  {'id': 'lyr1', 'type': 'KML', 'source': {'kml': {'url': 'a.com/b.kml'}}},
  {'id': 'lyr5', 'type': 'KML', 'source': {'kml': {'url': 'j.com/z.kml'}}},
  {'id': 'l3', 'type': 'TRAFFIC'}]};

function MetadataUpdaterTest() {
  cm.TestBase.call(this);

  this.xhr_ = this.expectNew_('goog.net.XhrIo');
  expectCall(this.xhr_.setTimeoutInterval)(_);

  var TICK = goog.Timer.TICK;
  this.timer_ = this.expectNew_('goog.Timer', _);
  // NOTE: Due to this.expectNew_ above, goog.Timer is a mock at this point,
  // so we can set properties on it without worrying about restoring them.
  // The code under test uses the goog.Timer.TICK constant, so we provide it.
  goog.Timer.TICK = TICK;

  expectCall(this.timer_.start)();
  expectCall(this.timer_.dispatchTick)();

  this.metadataUrl_ = '/crisismap/metadata?token=foobar';
  this.metadataModel_ = new cm.MetadataModel();

  this.mapModel_ = cm.MapModel.newFromMapRoot(MAPROOT_JSON);
}
MetadataUpdaterTest.prototype = new cm.TestBase();
registerTestSuite(MetadataUpdaterTest);


/** Tests whether TICK event of goog.Timer is handled correctly. */
MetadataUpdaterTest.prototype.testTimeTick = function() {
  var updater = new cm.MetadataUpdater(
      this.mapModel_, this.metadataModel_, this.metadataUrl_);
  var expectedAddress = '/crisismap/metadata?token=foobar&layers=';
  expectCall(this.xhr_.send)(expectedAddress, 'GET').
      willOnce(goog.bind(function(_, _) {
        cm.events.emit(this.xhr_, goog.net.EventType.SUCCESS, {'target': {
          'getResponseJson': function() {
            return {'a.com/b.kml': {'content_hash': 'xyz'},
                    'j.com/z.kml': {'content_length': 123}};
          }}});
  }, this));

  cm.events.emit(this.timer_, goog.Timer.TICK);
  expectEq({'content_hash': 'xyz'}, this.metadataModel_.get('lyr1'));
  expectEq({'content_length': 123}, this.metadataModel_.get('lyr5'));
};


/**
 * Tests whether map model changes are handled correctly by the metadata
 * updater.
 */
MetadataUpdaterTest.prototype.testModelChange = function() {
  var updater = new cm.MetadataUpdater(
      this.mapModel_, this.metadataModel_, this.metadataUrl_);

  // Remove a layer.
  this.mapModel_.get('layers').removeAt(0);
  // Modify the address of an existing one.
  var modifiedLayer = cm.LayerModel.newFromMapRoot(
      {'id': 'lyr5', 'type': 'KML',
       'source': {'kml': {'url': 'j.com/k.kmz'}}});
  this.mapModel_.get('layers').setAt(0, modifiedLayer);
  // Add a new one.
  var newLayer = cm.LayerModel.newFromMapRoot(
      {'id': 'l2', 'type': 'GEORSS',
       'source': {'georss': {'url': 'c.net/d.xml'}}});
  this.mapModel_.get('layers').push(newLayer);
  cm.events.emit(goog.global, cm.events.MODEL_CHANGED);

  var expectedAddress = '/crisismap/metadata?token=foobar&layers=j.com' +
                        '%2Fk.kmz%24c.net%2Fd.xml%24';
  expectEq(expectedAddress, updater.getRequestUrl_());
};

