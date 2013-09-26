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
 * @fileoverview Tooltip strings.
 * @author romano@google.com (Raquel Romano)
 */
goog.provide('cm.tooltips');

// Layer editor tooltips

/** @desc Tooltip for editing the layer's title. */
var MSG_LAYER_TITLE_TOOLTIP = goog.getMsg(
    'The layer title to display in the map\'s layer list.');

/** @desc Tooltip for editing the layer's description. */
var MSG_LAYER_DESCRIPTION_TOOLTIP = goog.getMsg(
    'HTML of the layer description to display in the map\'s layer list.');

/** @desc Tooltip for editing the layer's legend. */
var MSG_LEGEND_TOOLTIP = goog.getMsg(
    'The legend to display for this layer.');

/** @desc Tooltip for editing the layer's viewport. */
var MSG_LAYER_VIEWPORT_TOOLTIP = goog.getMsg(
    'The bounding coordinates of the area to zoom to when the user clicks ' +
    '"Zoom to area".');

/** @desc Tooltip for editing the layer's minimum zoom level. */
var MSG_MIN_ZOOM = goog.getMsg(
    'The lowest zoom level at which to show this layer (0=fully zoomed out, ' +
    '21=fully zoomed in).');

/** @desc Tooltip for editing the layer's maximum zoom level. */
var MSG_MAX_ZOOM = goog.getMsg(
    'The highest zoom level at which to show this layer (0=fully zoomed out, ' +
    '21=fully zoomed in).');

/** @desc Tooltip for editing the layer's source data type. */
var MSG_SOURCE_DATA_TYPE = goog.getMsg(
    'The data type or format of the layer\'s data.');

/** @desc Tooltip for editing the layer data's source URL. */
var MSG_SOURCE_URL = goog.getMsg(
    'The complete public URL where the layer\'s data is hosted. (For Tile ' +
    'layers, this is a URL template such as ' +
    'http://foo.com/maptile/example/{X}_{Y}_{Z}.png with placeholders for ' +
    'X, Y, and Z.)');

/** @desc Tooltip for toggling the display layer's data download link. */
var MSG_SHOW_DOWNLOAD_LINK = goog.getMsg(
    'Whether or not to display a link to the data source URL.');

/** @desc For a Fusion Table layer, tooltip for editing the Fusion Table ID. */
var MSG_FUSION_TABLE_ID = goog.getMsg(
    'The numeric ID of the Fusion Table.  In Fusion Tables, <b>File</b> &gt; ' +
    '<b>About</b> shows this ID.');

/**
 * @desc For a Fusion Table layer, tooltip for editing the index of the
 * Fusion Table's location column.
 */
var MSG_FUSION_TABLE_LOCATION_COLUMN = goog.getMsg(
    'The <a target="_blank" href="http://support.google.com/fusiontables/' +
    'answer/2590990?hl=en&ref_topic=2573808">location column</a> to use for ' +
    'plotting the points in the Fusion Table. For two-column locations ' +
    '(latitude/longitude), use the primary location column.');

/**
 * @desc For a Fusion Table layer, tooltip for editing the Fusion Table
 * query's WHERE clause.
 */
var MSG_FUSION_TABLE_WHERE_CLAUSE = goog.getMsg(
    'The condition to use in the Fusion Tables <a target="_blank" href=' +
    '"https://developers.google.com/fusiontables/docs/v1/using#queryData">' +
    'SELECT query\'s WHERE clause.</a>');

/** @desc Tooltip for editing the color of a weather layer's icons. */
var MSG_WEATHER_LABEL_COLOR = goog.getMsg(
    'The text color for the weather icons.');

/**
 * @desc Tooltip for editing the temperature units of a weather layer's
 * icons.
 */
var MSG_WEATHER_TEMP_UNITS = goog.getMsg(
    'The temperature units for the temperatures shown with the weather icons.');

/**
 * @desc Tooltip for editing the wind speed units of a weather layer's
 * pop-up windows.
 */
var MSG_WEATHER_WIND_SPEED_UNITS = goog.getMsg(
    'The speed units to use for wind speeds shown in the weather forecast ' +
    'pop-up windows.');

/** @desc Tooltip for editing a Google Maps Engine layer's map ID. */
var MSG_GME_MAP_ID = goog.getMsg(
    'The Google Maps Engine map ID.  In <a target="_blank" href=' +
    '"https://developers.google.com/maps/documentation/javascript/' +
    'mapsenginelayer">Google Maps Engine</a>, go to <b>Map details</b> page, ' +
    'click <b>Maps API ID: Details</b> and look for <b>Map ID</b>. ' +
    'Add "-4" to the end of this this ID.');

/**
 * @desc For a Google Maps Engine layer, tooltip for editing the layer
 * key of the source map.
 */
var MSG_GME_LAYER_KEY = goog.getMsg(
    'The Google Maps Engine layer key.  In <a target="_blank" href=' +
    '"https://developers.google.com/maps/documentation/javascript/' +
    'mapsenginelayer">Google Maps Engine</a>, go to <b>Map details</b> page, ' +
    'click <b>Maps API ID: Details</b> and look for <b>Layer key</b>.');

/** @desc Tooltip for selecting layers from a WMS service. */
var MSG_WMS_LAYERS = goog.getMsg(
    'The list of layers to display from the WMS service. If no options ' +
    'are displayed, either the WMS server cannot be reached, or the ' +
    'server is not publishing layers with Spherical Mercator projections.');

/**
 * @desc Tooltip for toggling whether a tile layer's source URL is an
 * indexed tile URL.
 */
var MSG_TILE_INDEX = goog.getMsg(
    'Whether the tile layer\'s URL is an indexed tile set.');

/** @desc Tooltip for selecting the type of tile coordinates. */
var MSG_TILE_COORDINATE_TYPE = goog.getMsg(
    'The type of tile coordinates for the source data (<a target="_blank" ' +
    'href="https://developers.google.com/maps/documentation/javascript/' +
    'maptypes#CustomMapTypes">Google</a>, <a target="_blank" href=' +
    '"http://msdn.microsoft.com/en-us/library/bb259689.aspx">Bing</a>, or ' +
    '<a target="_blank" href=' +
    '"http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification">TMS</a>).');

/** @desc Tooltip for selecting the folder type. */
var MSG_FOLDER_TYPE = goog.getMsg(
    'The type of folder: <b>Unlocked (default)</b>: folder contents are ' +
    'viewable in the map\'s layer list; <b>Locked</b>: folder contents are ' +
    'hidden from the map\'s layer list; or <b>Single Select</b>: a single ' +
    'sublayer of the folder may be selected for listing and showing on the ' +
    'map.');
