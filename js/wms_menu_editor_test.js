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

// @author romano@google.com (Raquel Romano)

function WmsMenuEditorTest() {
  cm.TestBase.call(this);

  this.parent_ = cm.ui.create('div');
  this.draft_ = new google.maps.MVCObject();
  this.draft_.set('type', cm.LayerModel.Type.WMS);
  this.draft_.set('url', '');
}
WmsMenuEditorTest.prototype = new cm.TestBase();
registerTestSuite(WmsMenuEditorTest);

/**
 * Constructs the WmsMenuEditor.
 * @private
 */
WmsMenuEditorTest.prototype.createEditor_ = function() {
  this.editor_ = new cm.WmsMenuEditor(
      this.parent_, 'wms_editor',
      {wms_query_url: '/root/.wms/query'},
      this.draft_);
};

/** Tests construction of the editor. */
WmsMenuEditorTest.prototype.testConstructor = function() {
  this.createEditor_();
  expectThat(this.editor_.get('value'), elementsAre([]));
};

/** Tests handling a query response from a valid WMS service. */
WmsMenuEditorTest.prototype.testValidReply = function() {
  this.createEditor_();
  var tilestacheQuery = this.expectNew_(
      'goog.net.Jsonp', containsRegExp(/^\/root\/\.wms\/query\?/));
  expectCall(tilestacheQuery.setRequestTimeout)(_);
  var replyCallback = null;
  tilestacheQuery.send = function(_, r, e) {
    replyCallback = r;
  };
  this.draft_.set('url', 'http://some.wms/service');
  expectDescendantOf(this.parent_, withText(
      hasSubstr('Retrieving layer options')));
  replyCallback({'layers': [{name: 'a', title: 'Choice A', crs: 'EPSG:3857'},
                            {name: 'b', title: 'Choice B', crs: 'EPSG:3857'}],
                 'status': cm.WmsMenuEditor.WmsLayersFetchStatus.SUCCESS});
  expectEq(2, this.editor_.selectElem.options.length);
  expectThat(this.editor_.selectElem.options[0],
             isElement(withText('Choice A (a)')));
  expectThat(this.editor_.selectElem.options[1],
             isElement(withText('Choice B (b)')));
  expectDescendantOf(this.parent_, withClass('cm-wms-menu-editor-message'),
                     withText(''));
};

/** Tests handling a valid response with an empty layer list. */
WmsMenuEditorTest.prototype.testValidReplyNoLayers = function() {
  this.createEditor_();
  var tilestacheQuery = this.expectNew_('goog.net.Jsonp', _);
  expectCall(tilestacheQuery.setRequestTimeout)(_);
  var replyCallback = null;
  tilestacheQuery.send = function(_, r, e) {
    replyCallback = r;
  };
  this.draft_.set('url', 'http://some.wms/service');
  replyCallback({'layers': [],
                 'status': cm.WmsMenuEditor.WmsLayersFetchStatus.EMPTY});
  expectDescendantOf(this.parent_, withText(
      hasSubstr('No layers with valid projections')));
};

/** Tests handling a query response from an invalid WMS service. */
WmsMenuEditorTest.prototype.testInvalidService = function() {
  this.createEditor_();
  var tilestacheQuery = this.expectNew_('goog.net.Jsonp', _);
  expectCall(tilestacheQuery.setRequestTimeout)(_);
  var errorCallback = null;
  tilestacheQuery.send = function(_, r, e) {
    errorCallback = e;
  };
  this.draft_.set('url', 'http://invalid/service');
  errorCallback({garbage: 'garbage'});
  expectEq(0, this.editor_.selectElem.options.length);
  expectDescendantOf(this.parent_, withText(
      hasSubstr('A fetch or timeout error was encountered')));
};

/** Tests caching of layers. */
WmsMenuEditorTest.prototype.testLayerCaching = function() {
  this.createEditor_();
  var tilestacheQuery = this.expectNew_('goog.net.Jsonp', _);
  expectCall(tilestacheQuery.setRequestTimeout)(_).times(2);
  var querySent = false;
  var replyCallback;
  tilestacheQuery.send = function(_, r, e) {
    querySent = true;
    replyCallback = r;
  };
  this.draft_.set('url', 'http://wms1.com');
  replyCallback({'layers': []});
  expectTrue(querySent);

  // A new request should be sent when the URL changes to a new value.
  querySent = false;
  this.draft_.set('url', 'http://wms2.com');
  replyCallback({'layers': []});
  expectTrue(querySent);

  // No request should be sent when the URL changes to a cached value.
  querySent = false;
  this.draft_.set('url', 'http://wms1.com');
  replyCallback({'layers': []});
  expectFalse(querySent);
};

/** Tests that server queries are made only for WMS layer types. */
WmsMenuEditorTest.prototype.testLayerType = function() {
  // Expect a query to be issued when the draft layer has a valid URL and
  // type WMS.
  var tilestacheQuery = this.expectNew_('goog.net.Jsonp', _);
  expectCall(tilestacheQuery.setRequestTimeout)(_).times(2);
  var querySent = false;
  var replyCallback = null;
  tilestacheQuery.send = function(_, r, e) {
    querySent = true;
    replyCallback = r;
  };
  this.draft_.set('url', 'http://some.wms/service');
  this.createEditor_();
  replyCallback({'layers': []});
  expectTrue(querySent);

  // Expect no query to be issued when the draft layer's URL changes but the
  // type is no longer WMS.
  querySent = false;
  replyCallback = null;
  expectFalse(querySent);
  this.draft_.set('type', cm.LayerModel.Type.KML);
  this.draft_.set('url', 'http://new.wms/service');
  expectFalse(querySent);

  // Expect a query to be issued if the draft layer's type changes back to
  // WMS.
  replyCallback = null;
  this.draft_.set('type', cm.LayerModel.Type.WMS);
  replyCallback({'layers': []});
  expectTrue(querySent);
};
