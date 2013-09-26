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

// @author arb@google.com (Anthony Baxter)

/**
 * @constructor
 */
TimeoutCatcher = function() {
  this.timeouts = [];
};

/**
 * Fake setTimeout
 * @param {Function} callback runnable.
 * @param {number} delay time to delay running.
 * @return {*} a token.
 */
TimeoutCatcher.prototype.setTimeout = function(callback, delay) {
  this.timeouts.push([callback, delay]);
  return 'a timeout';
};

function ProxyTileMapTypeTest() {
  cm.TestBase.call(this);
  this.catcher = new TimeoutCatcher();
  this.setForTest_('goog.global.setTimeout',
                   goog.bind(this.catcher.setTimeout, this.catcher));
  this.setForTest_('cm.Analytics.logAction',
                   function(event, layerId, opt_value) {});
  this.setForTest_('cm.Analytics.logTime',
                   function(category, variable, time, label, value) {});
}
ProxyTileMapTypeTest.prototype = new cm.TestBase();
registerTestSuite(ProxyTileMapTypeTest);

/** Tests construction of the ProxyTileMapType. */
ProxyTileMapTypeTest.prototype.testConstructor = function() {
  var map = new cm.ProxyTileMapType({'getTileUrl': function(coord, zoom) {}});
};

/** Tests tile creation and lifecycle. */
ProxyTileMapTypeTest.prototype.tileLifeCycle = function() {
  var getTileUrl = function(coord, zoom) {
    return 'http://foo/' + zoom + '/' + coord.x + '/' + coord.y + '.png';
  };
  var map = new cm.ProxyTileMapType({'getTileUrl': getTileUrl});
  var tile = map.getTile({'x': 10, 'y': 20}, 12);
  expectThat(tile, isElement('div'));
  expectThat(tile, hasDescendant('img',
                                 withAttr('src', 'http://foo/12/10/20.png')));

  // Now trigger the 'error' event and check it behaves correctly.
  cm.events.emit(tile.firstChild, 'error');
  expectThat(tile, hasDescendant(
      'img',
      withAttr('src', '//maps.gstatic.com/mapfiles/transparent.png')));

  expectEq(1, this.catcher.timeouts.length);
  expectThat(tile.tileData.retryTimeout, not(isNull));

  // Trigger the retry loop
  this.catcher.timeouts[0][0].apply();
  expectThat(tile, hasDescendant('img',
                                 withAttr('src', 'http://foo/12/10/20.png')));

  // Trigger the 'load' event.
  cm.events.emit(tile.firstChild, 'load');
  expectThat(tile.tileData.retryTimeout, isNull);

  // Now release the tile
  map.releaseTile(tile);
  expectThat(tile.tileData, isNull);
  expectEq(0, tile.childNodes.length);
};
