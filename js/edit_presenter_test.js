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

// Author: kpy@google.com (Ka-Ping Yee)

goog.require('cm.css');

function EditPresenterTest() {
  cm.TestBase.call(this);
  this.config_ = {
    legend_url: '/root/.legend',
    api_maps_url: '/root/.api/maps',
    save_url: '/root/.api/maps/m1?xsrf=abc'
  };
}
EditPresenterTest.prototype = new cm.TestBase();
registerTestSuite(EditPresenterTest);

/** Tests that the EditPresenter responds correctly to IMPORT events. */
EditPresenterTest.prototype.testImportEvent = function() {
  var model = new cm.MapModel();
  var importer = this.expectNew_('cm.ImporterView', '/root/.api/maps');
  var presenter = new cm.EditPresenter(null, model, null, this.config_);
  expectCall(importer.openImporter)();
  cm.events.emit(cm.app, cm.events.IMPORT, {});
};

/** Tests that the EditPresenter responds correctly to INSPECT events. */
EditPresenterTest.prototype.testInspectEvent = function() {
  var model = new cm.MapModel();
  var inspector = this.expectNew_('cm.InspectorPopup');
  var presenter = new cm.EditPresenter(null, model, null, this.config_);

  // Emitting an INSPECT event on a map should open an inspector on the map.
  expectCall(inspector.inspect)('Edit map details', allOf([
    contains({key: 'title', label: 'Title', type: cm.editors.Type.TEXT}),
    contains({key: 'description', label: 'Description',
              type: cm.editors.Type.HTML,
              preview_class: cm.css.MAP_DESCRIPTION}),
    contains({key: 'viewport', label: 'Default viewport',
              type: cm.editors.Type.LAT_LON_BOX, app_state: null})
  ]), null, model, false);
  cm.events.emit(cm.app, cm.events.INSPECT, {object: model});

  // Emitting an INSPECT event on a layer should open an inspector on the layer.
  var layer = new cm.LayerModel();
  var layerSpecExpect = allOf([
    contains({key: 'title', label: 'Title', type: cm.editors.Type.TEXT,
              tooltip: cm.MSG_LAYER_TITLE_TOOLTIP}),
    contains({key: 'description', label: 'Description',
              type: cm.editors.Type.HTML,
              preview_class: cm.css.LAYER_DESCRIPTION,
              tooltip: cm.MSG_LAYER_DESCRIPTION_TOOLTIP}),
    contains({key: 'legend', label: 'Legend', type: cm.editors.Type.LEGEND,
              preview_class: cm.css.LAYER_LEGEND, legend_url: '/root/.legend',
              tooltip: cm.MSG_LEGEND_TOOLTIP}),
    contains({key: 'viewport', label: '"Zoom to area" viewport',
              type: cm.editors.Type.LAT_LON_BOX, app_state: null,
              tooltip: cm.MSG_LAYER_VIEWPORT_TOOLTIP}),
    contains({key: 'min_zoom', label: 'Minimum zoom level',
              type: cm.editors.Type.NUMBER, minimum: 0, maximum: 20,
              require_integer: true, tooltip: cm.MSG_MINIMUM_ZOOM_TOOLTIP}),
    contains({key: 'max_zoom', label: 'Maximum zoom level',
              type: cm.editors.Type.NUMBER, minimum: 0, maximum: 20,
              require_integer: true, tooltip: cm.MSG_MAXIMUM_ZOOM_TOOLTIP})
  ]);
  expectCall(inspector.inspect)(cm.MSG_EDIT_LAYER_DETAILS, layerSpecExpect,
                                null, layer, false);
  cm.events.emit(cm.app, cm.events.INSPECT, {object: layer});

  // Emitting an INSPECT event with no object should open an inspector on a new
  // layer.
  expectCall(inspector.inspect)(cm.MSG_CREATE_NEW_LAYER, layerSpecExpect, null,
                                null, true);
  cm.events.emit(cm.app, cm.events.INSPECT, {});

  // Emitting an INSPECT event on a topic should open an inspector on the map.
  var topic = new cm.TopicModel();
  var topicSpecExpect = allOf([
    contains({key: 'title', label: cm.MSG_TITLE, type: cm.editors.Type.TEXT,
              tooltip: cm.MSG_TOPIC_TITLE_TOOLTIP}),
    contains({key: 'viewport', label: cm.MSG_DEFAULT_VIEWPORT,
              type: cm.editors.Type.LAT_LON_BOX, app_state: null,
              hide_tile_layer_warning: true,
              tooltip: cm.MSG_TOPIC_VIEWPORT_TOOLTIP}),
    contains({key: 'tags', label: cm.MSG_TAGS, type: cm.editors.Type.TEXT_LIST,
              tooltip: cm.MSG_TOPIC_TAGS_TOOLTIP})
  ]);
  expectCall(inspector.inspect)(cm.MSG_EDIT_TOPIC, topicSpecExpect, null,
                                topic, false);
  cm.events.emit(cm.app, cm.events.INSPECT, {object: topic});

  // Emitting an INSPECT event with no object and isNewTopic true should open
  // an inspector on a new topic.
  expectCall(inspector.inspect)(cm.MSG_CREATE_NEW_TOPIC, topicSpecExpect, null,
                                null, false);
  cm.events.emit(cm.app, cm.events.INSPECT, {isNewTopic: true});
};

function findEditorSpec(key, editorSpecs) {
  for (var i = 0; i < editorSpecs.length; i++) {
    if (editorSpecs[i].key === key) {
      return editorSpecs[i];
    }
  }
}

/** Tests that 'enable_osm_map_type_editing' enables the OSM base map option. */
EditPresenterTest.prototype.testEnableOsmMapTypeEditing = function() {
  var OSM_CHOICE = {value: 'OSM', label: 'OpenStreetMap'};
  var model = new cm.MapModel();
  var inspector = this.expectNew_('cm.InspectorPopup'), specs;
  inspector.inspect = function(title, editorSpecs, object) {
    specs = editorSpecs;
  };

  // This should call inspector.inspect, which captures the 'editorSpecs' arg.
  var presenter = new cm.EditPresenter(null, null, null, {});
  cm.events.emit(cm.app, cm.events.INSPECT, {object: model});
  // The OSM option should not be present.
  var spec = findEditorSpec('map_type', specs);
  expectThat(spec.choices, not(contains(OSM_CHOICE)));

  // Try again, this time with the enable_osm_map_type_editing flag set.
  presenter = new cm.EditPresenter(null, null, null,
                                   {enable_osm_map_type_editing: true});
  cm.events.emit(cm.app, cm.events.INSPECT, {object: model});
  // The OSM option should be present this time.
  var spec = findEditorSpec('map_type', specs);
  expectThat(spec.choices, contains(OSM_CHOICE));
};

