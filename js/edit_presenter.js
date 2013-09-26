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

/**
 * @fileoverview [MODULE: edit] Presenter for editing functionality.
 *     Non-editing behaviours are implemented in Presenter.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.provide('cm.EditPresenter');

goog.require('cm.ArrangeCommand');
goog.require('cm.ArrangeView');
goog.require('cm.Command');
goog.require('cm.CreateLayersCommand');
goog.require('cm.DeleteLayerCommand');
goog.require('cm.EditCommand');
goog.require('cm.ImporterView');
goog.require('cm.InspectorView');
goog.require('cm.LayerModel');
goog.require('cm.MapModel');
goog.require('cm.SetDefaultViewCommand');
goog.require('cm.ShareEmailView');
goog.require('cm.css');
goog.require('cm.editors');
goog.require('cm.events');
goog.require('goog.net.XhrIo');

/**
 * Presenter for editing functionality.
 * @param {cm.AppState} appState The application state.
 * @param {cm.MapModel} mapModel The map model.
 * @param {cm.ArrangeView} arranger The nested folder arranger view.
 * @param {Object} opt_config Configuration settings.  These fields are used:
 *     api_maps_url: The URL from which to GET maps with layers to import.
 *     legend_url: The URL of the legend item extractor service.
 *     share_url: The URL to which to POST to share the map.
 *     save_url: The URL to which to POST to save the edited map data.
 *     enable_osm_map_type_editing: Allow OSM as a base map option?
 * @constructor
 */
cm.EditPresenter = function(appState, mapModel, arranger, opt_config) {
  var config = opt_config || {};
  var importer = new cm.ImporterView(config['api_maps_url']);
  var inspector = new cm.InspectorView();
  var sharer = new cm.ShareEmailView();

  /**
   * @type Array.<cm.Command>
   * @private
   */
  this.commands_ = [];

  /**
   * @type number
   * @private
   */
  this.nextRedoIndex_ = 0;

  /**
   * @type string
   * @private
   */
  this.saveUrl_ = config['save_url'];

  function usesUrlField(type) {
    return type === cm.LayerModel.Type.KML ||
        type === cm.LayerModel.Type.GEORSS ||
        type === cm.LayerModel.Type.TILE ||
        type === cm.LayerModel.Type.WMS;
  }

  function downloadable(type) {
    return type === cm.LayerModel.Type.KML ||
        type === cm.LayerModel.Type.GEORSS;
  }

  function isType(type) {
    return function(t) { return t === type; };
  }

  function isPlainLayer(type) {
    return type !== cm.LayerModel.Type.FOLDER;
  }

  var layerTypeChoices = [
    {value: cm.LayerModel.Type.KML, label: 'KML'},
    {value: cm.LayerModel.Type.GEORSS, label: 'GeoRSS'},
    {value: cm.LayerModel.Type.TILE,
     label: cm.MSG_LAYER_TYPE_TILE_SERVICE},
    {value: cm.LayerModel.Type.WMS, label: 'WMS'},
    {value: cm.LayerModel.Type.FUSION, label: cm.MSG_LAYER_TYPE_FUSION_TABLES},
    {value: cm.LayerModel.Type.MAP_DATA, label: cm.MSG_LAYER_TYPE_MAPS_ENGINE},
    {value: cm.LayerModel.Type.TRAFFIC, label: cm.MSG_LAYER_TYPE_TRAFFIC},
    {value: cm.LayerModel.Type.TRANSIT, label: cm.MSG_LAYER_TYPE_TRANSIT},
    {value: cm.LayerModel.Type.WEATHER, label: cm.MSG_LAYER_TYPE_WEATHER},
    {value: cm.LayerModel.Type.CLOUD, label: cm.MSG_LAYER_TYPE_CLOUDS}
  ];


  var mapTypeChoices = [
    {value: cm.MapModel.Type.ROADMAP, label: cm.MSG_BASE_MAP_TYPE_ROADMAP},
    {value: cm.MapModel.Type.SATELLITE, label: cm.MSG_BASE_MAP_TYPE_SATELLITE},
    {value: cm.MapModel.Type.HYBRID, label: cm.MSG_BASE_MAP_TYPE_HYBRID},
    {value: cm.MapModel.Type.TERRAIN, label: cm.MSG_BASE_MAP_TYPE_TERRAIN},
    {value: cm.MapModel.Type.CUSTOM, label: cm.MSG_BASE_MAP_TYPE_CUSTOM}
  ];

  if (config['enable_osm_map_type_editing']) {
    mapTypeChoices.push({value: cm.MapModel.Type.OSM, label: 'OpenStreetMap'});
  }

  // Create footer content postfix to mimic actual Crisis Map footer.
  // TODO(user): Ideally, footerPostfix would be contained elsewhere
  //     (intialize or footer_view), but since it's small, we'll hard code
  //     it until we find the best place it.
  var footerPreviewPostfix = cm.ui.create('span', {},
      cm.ui.SEPARATOR_DOT, cm.ui.createLink(cm.MSG_HELP),
      cm.ui.SEPARATOR_DOT, cm.ui.createLink(cm.MSG_REPORT_ABUSE));

  var mapFields = [
   {key: 'title', label: cm.MSG_TITLE, type: cm.editors.Type.TEXT},
   {key: 'description', label: cm.MSG_DESCRIPTION, type: cm.editors.Type.HTML,
    preview_class: cm.css.MAP_DESCRIPTION},
   {key: 'footer', label: cm.MSG_FOOTER, type: cm.editors.Type.HTML,
    preview_class: cm.css.FOOTER, preview_postfix: footerPreviewPostfix},
   {key: 'viewport', label: cm.MSG_DEFAULT_VIEWPORT,
    type: cm.editors.Type.LAT_LON_BOX, app_state: appState},
   {key: 'map_type', label: cm.MSG_DEFAULT_BASE_MAP,
    type: cm.editors.Type.MENU, choices: mapTypeChoices},
   {key: 'base_map_style', label: cm.MSG_CUSTOM_BASE_MAP_STYLE,
    type: cm.editors.Type.TEXT,
    conditions: {'map_type': isType(cm.MapModel.Type.CUSTOM)}},
   {key: 'base_map_style_name', label: cm.MSG_CUSTOM_STYLE_NAME,
    type: cm.editors.Type.TEXT,
    conditions: {'map_type': isType(cm.MapModel.Type.CUSTOM)}}
 ];

  var layerFields = [
    // Settings that don't depend on the layer type
    {key: 'title', label: cm.MSG_TITLE, type: cm.editors.Type.TEXT,
     tooltip: cm.MSG_LAYER_TITLE_TOOLTIP},
    {key: 'description', label: cm.MSG_DESCRIPTION, type: cm.editors.Type.HTML,
     preview_class: cm.css.LAYER_DESCRIPTION,
     tooltip: cm.MSG_LAYER_DESCRIPTION_TOOLTIP},
    {key: 'legend', label: cm.MSG_LEGEND, type: cm.editors.Type.LEGEND,
     preview_class: cm.css.LAYER_LEGEND, legend_url: config['legend_url'],
     tooltip: cm.MSG_LEGEND_TOOLTIP},
    {key: 'viewport', label: cm.MSG_LAYER_VIEWPORT,
     type: cm.editors.Type.LAT_LON_BOX, app_state: appState,
     tooltip: cm.MSG_LAYER_VIEWPORT_TOOLTIP},
    {key: 'min_zoom', label: cm.MSG_MINIMUM_ZOOM,
     type: cm.editors.Type.NUMBER, minimum: 0, maximum: 20,
     require_integer: true, tooltip: cm.MSG_MINIMUM_ZOOM_TOOLTIP},
    {key: 'max_zoom', label: cm.MSG_MAXIMUM_ZOOM,
     type: cm.editors.Type.NUMBER, minimum: 0, maximum: 20,
     require_integer: true, tooltip: cm.MSG_MAXIMUM_ZOOM_TOOLTIP},
    // Settings that depend on the layer type
    {key: 'type', label: cm.MSG_LAYER_TYPE,
     type: cm.editors.Type.MENU, choices: layerTypeChoices,
     conditions: {'type': isPlainLayer},
     tooltip: cm.MSG_LAYER_TYPE_TOOLTIP},
    {key: 'url', label: cm.MSG_SOURCE_URL, type: cm.editors.Type.TEXT,
     conditions: {'type': usesUrlField},
     tooltip: cm.MSG_SOURCE_URL_TOOLTIP},
    {key: 'suppress_download_link', label: cm.MSG_SHOW_DOWNLOAD_LINK,
     type: cm.editors.Type.CHECKBOX, checked_value: null,
      unchecked_value: true, conditions: {'type': downloadable},
     tooltip: cm.MSG_SHOW_DOWNLOAD_LINK_TOOLTIP},
    // TODO(romano): protect this field with a config variable
    {key: 'url_is_tile_index', label: cm.MSG_TILE_INDEX,
     type: cm.editors.Type.CHECKBOX, checked_value: true,
     unchecked_value: false,
     conditions: {'type': isType(cm.LayerModel.Type.TILE)},
     tooltip: cm.MSG_TILE_INDEX_TOOLTIP},
    {key: 'ft_from', label: cm.MSG_GFT_TABLE_ID,
     type: cm.editors.Type.TEXT,
     conditions: {'type': isType(cm.LayerModel.Type.FUSION)},
     tooltip: cm.MSG_GFT_TABLE_ID_TOOLTIP},
    {key: 'ft_select', label: cm.MSG_GFT_LOCATION_COLUMN,
     type: cm.editors.Type.TEXT,
     conditions: {'type': isType(cm.LayerModel.Type.FUSION)},
     tooltip: cm.MSG_GFT_LOCATION_COLUMN_TOOLTIP},
    {key: 'ft_where', label: cm.MSG_GFT_FILTER_CONDITION,
     type: cm.editors.Type.TEXT,
     conditions: {'type': isType(cm.LayerModel.Type.FUSION)},
     tooltip: cm.MSG_GFT_FILTER_CONDITION_TOOLTIP},
    {key: 'label_color', label: cm.MSG_WEATHER_LABEL_COLOR,
     type: cm.editors.Type.MENU,
     conditions: {'type': isType(cm.LayerModel.Type.WEATHER)},
     choices: [
       {value: cm.LayerModel.LabelColor.BLACK, label: cm.MSG_BLACK},
       {value: cm.LayerModel.LabelColor.WHITE, label: cm.MSG_WHITE}
     ],
     tooltip: cm.MSG_WEATHER_LABEL_COLOR_TOOLTIP},
    {key: 'temperature_unit', label: cm.MSG_WEATHER_TEMPERATURE_UNIT,
     type: cm.editors.Type.MENU,
     conditions: {'type': isType(cm.LayerModel.Type.WEATHER)},
     choices: [
       {value: cm.LayerModel.TemperatureUnit.CELSIUS, label: cm.MSG_CELSIUS},
       {value: cm.LayerModel.TemperatureUnit.FAHRENHEIT,
        label: cm.MSG_FAHRENHEIT}
     ],
     tooltip: cm.MSG_WEATHER_TEMPERATURE_UNIT_TOOLTIP},
    {key: 'wind_speed_unit', label: cm.MSG_WEATHER_WIND_SPEED_UNIT,
     type: cm.editors.Type.MENU,
     conditions: {'type': isType(cm.LayerModel.Type.WEATHER)},
     choices: [
       {value: cm.LayerModel.WindSpeedUnit.KILOMETERS_PER_HOUR, label: 'km/h'},
       {value: cm.LayerModel.WindSpeedUnit.METERS_PER_SECOND, label: 'm/s'},
       {value: cm.LayerModel.WindSpeedUnit.MILES_PER_HOUR, label: 'mph'}
     ],
     tooltip: cm.MSG_WEATHER_WIND_SPEED_UNIT_TOOLTIP},
    {key: 'maps_engine_map_id', label: cm.MSG_GME_MAP_ID,
     type: cm.editors.Type.TEXT,
     conditions: {'type': isType(cm.LayerModel.Type.MAP_DATA)},
     tooltip: cm.MSG_GME_MAP_ID_TOOLTIP},
    {key: 'maps_engine_layer_key', label: cm.MSG_GME_LAYER_KEY,
     type: cm.editors.Type.TEXT,
     conditions: {'type': isType(cm.LayerModel.Type.MAP_DATA)},
     tooltip: cm.MSG_GME_LAYER_KEY_TOOLTIP},
    {key: 'wms_layers', label: cm.MSG_WMS_LAYERS,
     type: cm.editors.Type.WMS_MENU,
     conditions: {'type': isType(cm.LayerModel.Type.WMS)},
     multiple: true, choices: [], menu_class: cm.css.WMS_MENU_EDITOR,
     wms_query_url: config['wms_query_url'],
     tooltip: cm.MSG_WMS_LAYERS_TOOLTIP},
    {key: 'tile_coordinate_type',
     label: cm.MSG_TILE_COORDINATE_TYPE,
     type: cm.editors.Type.MENU,
     conditions: {'type': isType(cm.LayerModel.Type.TILE)},
     choices: [
       {value: cm.LayerModel.TileCoordinateType.GOOGLE,
        label: cm.MSG_GOOGLE_MAPS_COORDINATES},
       {value: cm.LayerModel.TileCoordinateType.BING,
        label: cm.MSG_BING_MAPS_QUADKEYS},
       {value: cm.LayerModel.TileCoordinateType.TMS,
        label: cm.MSG_TMS_COORDINATES}],
     tooltip: cm.MSG_TILE_COORDINATE_TYPE_TOOLTIP},
    {key: 'folder_type', label: cm.MSG_FOLDER_TYPE,
      type: cm.editors.Type.MENU,
      choices: [
        {value: cm.LayerModel.FolderType.UNLOCKED,
         label: cm.MSG_FOLDER_TYPE_UNLOCKED},
        {value: cm.LayerModel.FolderType.LOCKED,
         label: cm.MSG_FOLDER_TYPE_LOCKED},
        {value: cm.LayerModel.FolderType.SINGLE_SELECT,
         label: cm.MSG_FOLDER_TYPE_SINGLE_SELECT}
      ],
     conditions: {'type': isType(cm.LayerModel.Type.FOLDER)},
     tooltip: cm.MSG_FOLDER_TYPE_TOOLTIP}
 ];

  // The user has asked us to bring up an inspector.
  // The INSPECT event contains an object for editing existing objects, or
  // no object for a new layer.
  // TODO(joeysilva): Use a type field to specify new layers or new folders.
  cm.events.listen(goog.global, cm.events.INSPECT, function(e) {
    if (!e.object) {
      // New layer
      inspector.inspect('Create new layer', layerFields, appState);
    } else if (e.object instanceof cm.MapModel) {
      inspector.inspect('Edit map details', mapFields, appState, e.object);
    } else if (e.object instanceof cm.LayerModel) {
      inspector.inspect('Edit layer details', layerFields, appState, e.object);
    }
  });

  // The user has requested to arrange the layers in the panel.
  cm.events.listen(goog.global, cm.events.ARRANGE, function(e) {
    arranger.open();
  });

  // The user has requested to add layers.
  cm.events.listen(goog.global, cm.events.IMPORT, function(e) {
    importer.openImporter();
  });

  // The user has selected some layers to import and wants to import them.
  cm.events.listen(goog.global, cm.events.ADD_LAYERS, function(e) {
    this.doCommand(new cm.CreateLayersCommand(e.layers), appState, mapModel);
  }, this);

  // The user has filled in properties for a new layer and wants to create the
  // layer.
  cm.events.listen(goog.global, cm.events.NEW_LAYER, function(e) {
    var model = cm.LayerModel.newFromMapRoot({type: 'KML'});
    for (var key in e.properties) {
      if (e.properties[key] !== undefined) {
        model.set(key, e.properties[key]);
      }
    }
    this.doCommand(new cm.CreateLayersCommand([model.toMapRoot()]),
                   appState, mapModel);
  }, this);

  // The user has requested to delete a layer.
  cm.events.listen(goog.global, cm.events.DELETE_LAYER, function(e) {
    this.doCommand(new cm.DeleteLayerCommand(e.id), appState, mapModel);
  }, this);

  // The user has requested to save the current map model to the server.
  cm.events.listen(goog.global, cm.events.SAVE, this.handleSave, this);

  // The user has finished an edit and wants to commit the changes.
  cm.events.listen(goog.global, cm.events.OBJECT_EDITED, function(e) {
    this.doCommand(new cm.EditCommand(e.oldValues, e.newValues, e.layerId),
                   appState, mapModel);
  }, this);

  // The user has finished arranging layers and wants to commit the changes.
  cm.events.listen(goog.global, cm.events.LAYERS_ARRANGED, function(e) {
    this.doCommand(new cm.ArrangeCommand(e.oldValue, e.newValue),
                   appState, mapModel);
    cm.events.emit(goog.global, cm.events.MODEL_CHANGED, {model: mapModel});
  }, this);

  // The user has requested undo or redo.
  cm.events.listen(goog.global, cm.events.UNDO, function() {
    this.handleUndo(appState, mapModel);
  }, this);
  cm.events.listen(goog.global, cm.events.REDO, function() {
    this.handleRedo(appState, mapModel);
  }, this);

  cm.events.listen(goog.global, cm.events.SHARE_EMAIL, function() {
    sharer.share(config['share_url']);
  }, this);

  cm.events.listen(goog.global, cm.events.SHARE_EMAIL_FAILED, function() {
    sharer.emailError();
  }, this);

  // The user has set the current view as the default view.
  cm.events.listen(goog.global, cm.events.DEFAULT_VIEW_SET, function(e) {
    this.doCommand(new cm.SetDefaultViewCommand(e.oldDefault, e.newDefault),
                   appState, mapModel);
  }, this);
};

/**
 * @param {cm.Command} command An undoable command to perform.
 * @param {cm.AppState} appState The state of the application.
 * @param {cm.MapModel} mapModel The map model.
 */
cm.EditPresenter.prototype.doCommand = function(command, appState, mapModel) {
  if (command.execute(appState, mapModel)) {
    this.commands_.length = this.nextRedoIndex_;
    this.commands_.push(command);
    this.addToNextRedoIndex_(1);
  } else {
    // TODO(kpy): Handle command failure.
  }
};

/**
 * Undoes the last executed command.
 * @param {cm.AppState} appState The state of the application.
 * @param {cm.MapModel} mapModel The map model.
 */
cm.EditPresenter.prototype.handleUndo = function(appState, mapModel) {
  if (this.nextRedoIndex_ > 0) {
    if (this.commands_[this.nextRedoIndex_ - 1].undo(appState, mapModel)) {
      this.addToNextRedoIndex_(-1);
    } else {
      // TODO(kpy): Handle undo failure.
    }
  }
};

/**
 * Redoes the last undone command.
 * @param {cm.AppState} appState The state of the application.
 * @param {cm.MapModel} mapModel The map model.
 */
cm.EditPresenter.prototype.handleRedo = function(appState, mapModel) {
  if (this.nextRedoIndex_ < this.commands_.length) {
    if (this.commands_[this.nextRedoIndex_].execute(appState, mapModel)) {
      this.addToNextRedoIndex_(1);
    } else {
      // TODO(kpy): Handle redo failure.
    }
  }
};

/**
 * Saves the map model to the server.
 * @param {Object} event The SAVE event (which should have a 'model' property).
 */
cm.EditPresenter.prototype.handleSave = function(event) {
  var json = goog.json.serialize(event.model.toMapRoot());
  goog.net.XhrIo.send(this.saveUrl_, function(e) {
    var success = (e.target.getStatus() === 201);
    cm.events.emit(goog.global,
                   success ? cm.events.SAVE_DONE : cm.events.SAVE_FAILED);
  }, 'POST', 'json=' + encodeURIComponent(json));
};

/**
 * Adds a given value to {@code this.nextRedoIndex_}.
 * @param {number} value The value to add.
 * @private
 */
cm.EditPresenter.prototype.addToNextRedoIndex_ = function(value) {
  this.nextRedoIndex_ += value;
  cm.events.emit(goog.global, cm.events.UNDO_REDO_BUFFER_CHANGED,
      {redo_possible: this.nextRedoIndex_ !== this.commands_.length,
       undo_possible: this.nextRedoIndex_ !== 0});
};
