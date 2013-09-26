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
 * @fileoverview Definition of the 'cm' namespace that contains everything else.
 *     Also holds all translated messages.
 * @author arb@google.com (Anthony Baxter)
 */

goog.provide('cm');

cm = {};


// Generic messages.

/** @desc Label for an OK button on a dialog with OK and Cancel buttons. */
cm.MSG_OK = goog.getMsg('OK');

/** @desc Label for a Cancel button on a dialog with OK and Cancel buttons. */
cm.MSG_CANCEL = goog.getMsg('Cancel');

/** @desc Link or button text in an editor to edit content directly. */
cm.MSG_EDIT = goog.getMsg('Edit');

/** @desc Link or button text to delete user content. */
cm.MSG_DELETE = goog.getMsg('Delete');

/** @desc Link or button text to save a user's settings or changes. */
cm.MSG_SAVE = goog.getMsg('Save');

/** @desc Notifies the user that some changes have been saved. */
cm.MSG_SAVED = goog.getMsg('Saved');

/** @desc Notifies the user that saving some changes are in progress. */
cm.MSG_SAVING = goog.getMsg('Saving...');

/** @desc Notifies the user that some user changes failed to save. */
cm.MSG_SAVE_FAILED = goog.getMsg('Save failed');

/** @desc Link or button text to undo a user action. */
cm.MSG_UNDO = goog.getMsg('Undo');

/** @desc Link or button text to redo an action previously undone by user. */
cm.MSG_REDO = goog.getMsg('Redo');

/** @desc Link or button text to sign in to your account. */
cm.MSG_SIGN_IN = goog.getMsg('Sign in');

/** @desc Link or button text to sign out of your account. */
cm.MSG_SIGN_OUT = goog.getMsg('Sign out');

/** @desc Link or button text that shows documentation or help instructions. */
cm.MSG_HELP = goog.getMsg('Help');


// About

/** @desc Header for the about box. */
cm.MSG_ABOUT_HEADER = goog.getMsg('Google Crisis Map');


// Footer view

/** @desc The link text for opening the map in a new browser window. */
cm.MSG_FULL_MAP_LINK = goog.getMsg('Full map');

/**
 * @desc The link text in the footer for reporting abuse of the terms of
 * service.
 */
cm.MSG_REPORT_ABUSE = goog.getMsg('Report abuse');

/**
 * @desc Label for a select element that lets users choose which language to
 * show the page in.
 */
cm.MSG_SELECT_LANGUAGE = goog.getMsg('Select language');

/**
 * @desc Option in a drop down menu to choose the page's language. This option
 * indicates the user would like to use the default language preferred by their
 * browser.
 */
cm.MSG_LANGUAGE_DEFAULT = goog.getMsg('Default language');


// Importer view

/**
 * @desc Label for the submit button of the importer dialog, which will import
 * the layers selected by the user.
 */
cm.MSG_IMPORTER_SUBMIT = goog.getMsg('Import selected layers');

/** @desc Label for the Cancel button on the importer dialog. */
cm.MSG_IMPORTER_CANCEL = goog.getMsg('Cancel');

/** @desc Link to go back to the "Create new layer" dialog. */
cm.MSG_CREATE_NEW_LAYER = goog.getMsg('\xab Back');

/** @desc Title text for import dialog. */
cm.MSG_IMPORT_TITLE = goog.getMsg('Select layers to import');

/**
 * @desc Message shown in the importer when there are no layers in any published
 * maps to import.
 */
cm.MSG_NO_LAYERS = goog.getMsg(
    'There are no layers in any published maps to import.');

/** @desc Initial text in the importer before the user has selected anything. */
cm.MSG_NONE_SELECTED_INITIAL = goog.getMsg(
    'No layers are selected.  Click layer names to select them.');

/** @desc [ICU Syntax] Text displaying how many layers the user has selected. */
cm.MSG_LAYERS_SELECTED = goog.getMsg('{SELECTED, plural, ' +
    '=0 {No layers selected}' +
    '=1 {1 layer selected}' +
    'other {# layers selected}}');

/** @desc Tooltip text for folder previews that have no visible layers. */
cm.MSG_NO_PREVIEW =
    goog.getMsg('This folder has no layers visible by default.');


// Inspector View

/** @desc Text of link to proceed to the "Import layers" dialog. */
cm.MSG_IMPORT_LAYERS = goog.getMsg('Import published layers \xbb');


// Layers button

/** @desc Standard label for the 'Layers' button in embedded mode. */
cm.MSG_LAYER_BUTTON = goog.getMsg('Layers');


// Layer Entry View

/** @desc Label for a link that zooms the map to fit the layer's area. */
cm.MSG_ZOOM_TO_AREA_LINK = goog.getMsg('Zoom to area');

/** @desc Label for a link to download a KML file. */
cm.MSG_DOWNLOAD_KML_LINK = goog.getMsg('Download KML');

/** @desc Label for a link to download a GeoRSS file. */
cm.MSG_DOWNLOAD_GEORSS_LINK = goog.getMsg('Download GeoRSS');

/** @desc Label for a link to view data from a Fusion table. */
cm.MSG_VIEW_FUSION_TABLE_LABEL = goog.getMsg('View data');

/** @desc Label for a link to adjust a layer's transparency. */
cm.MSG_OPACITY_TOOLTIP = goog.getMsg('Adjust layer transparency');

/** @desc Warning message for data sources that have unsupported features. */
cm.MSG_UNSUPPORTED_KML_WARNING = goog.getMsg(
    'This layer may include some unsupported features.');

/**
 * @desc Warning message when the data file is empty or contains no
 * features.
 */

cm.MSG_NO_DATA_WARNING = goog.getMsg(
    'This layer currently contains nothing to show on the map.');
/**
 * @desc Label for faded out layer entry when layer is not visible at the
 * current zoom level.
 */
cm.MSG_OUT_OF_ZOOM_RANGE_TOOLTIP =
    goog.getMsg('Data not available at current zoom level.');

/** @desc Section heading for the map legend. */
cm.MSG_LEGEND = goog.getMsg('Legend');


// Legend editor

/** @desc Link text displayed in legend editor to add a legend item / row. */
cm.MSG_ADD_ITEM = goog.getMsg('Add item');

/** @desc Link text displayed in legend editor to edit legend HTML directly. */
cm.MSG_EDIT_HTML = goog.getMsg('Edit HTML');

/** @desc Link text displayed in HTML editor to go back to legend editor. */
cm.MSG_EDIT_GRAPHICALLY = goog.getMsg('Edit graphically');

/** @desc Text displayed for empty legend items. */
cm.MSG_EMPTY_LEGEND_TEXT = goog.getMsg('Click to add a description');

/**
 * @desc Text displayed when the legend HTML becomes no longer able to be parsed
 *     and therefore cannot be edited in the graphical interface.
 */
cm.MSG_INVALID_LEGEND =
    goog.getMsg('The HTML is no longer editable graphically');

/** @desc Link displayed to revert to valid legend editor HTML. */
cm.MSG_REVERT = goog.getMsg('Revert');


// Map view

/** @desc Copyright notice for OpenStreetMap base map data. */
cm.MSG_OSM_COPYRIGHT_HTML = goog.getMsg(
    'Map data \u00a9 ' +
    '<a href="http://www.openstreetmap.org/copyright" target="_blank">' +
    '<b>OpenStreetMap</b></a> contributors');


// Panel view

/** @desc Label for a link that resets the map to its default view. */
cm.MSG_SET_DEFAULT_VIEW_LINK = goog.getMsg('Set current view as default');

/** @desc Label to show for a draft (unpublished) map. */
cm.MSG_DRAFT_LABEL = goog.getMsg('DRAFT');

/** @desc Detail text for the label on a draft (unpublished) map. */
cm.MSG_DRAFT_TOOLTIP = goog.getMsg(
    'This is an unpublished version of this map.');

/** @desc Label for a link that resets the map to its default view. */
cm.MSG_RESET_VIEW_LINK = goog.getMsg('Reset to default view');


// Share.js

/** @desc Standard label for the 'Share' button on the map. */
cm.MSG_SHARE_BUTTON = goog.getMsg('Share');

/** @desc Title for the share box. */
cm.MSG_SHARE_TITLE = goog.getMsg('Share this view');

/** @desc Label for the field containing the link URL to share the map view. */
cm.MSG_SHARE_URL_LABEL = goog.getMsg('Paste link in email or IM');

/** @desc Label for the field containing HTML code to share the map view. */
cm.MSG_SHARE_HTML_LABEL = goog.getMsg(
    'Paste HTML to embed in website');

/** @desc Label for the "Shorten URLs" checkbox in the share popup. */
cm.MSG_SHORTEN_URL_LABEL = goog.getMsg('Shorten URLs');

/** @desc Accessible text for the "Share on G+" button in the share popup. */
cm.MSG_GPLUS_SHARE_LABEL = goog.getMsg('Share on Google+');

/** @desc Accessible text for the "Tweet" button in the share popup. */
cm.MSG_TWITTER_SHARE_LABEL = goog.getMsg('Tweet this map');


// Share email view

/** @desc Heading of the dialog for inviting another user to collaborate. */
cm.MSG_INVITE_TITLE = goog.getMsg('Invite someone to collaborate');

/**
 * @desc Error message to show for a server error when trying to invite
 * another user to collaborate (this is pretty rare).
 */
cm.MSG_EMAIL_ERROR = goog.getMsg(
    'Sorry, there was a problem inviting someone to collaborate on this map.');

/**
 * @desc Label for text box for a personal message to include when
 * inviting another user to collaborate.
 */
cm.MSG_INVITE_MESSAGE = goog.getMsg('Message text');

/**
 * @desc Placeholder inside the text box for a personal message to include
 * when inviting another user to collaborate.
 */
cm.MSG_INVITE_MESSAGE_PLACEHOLDER =
    goog.getMsg('Include a personal message...');

/** @desc Label for input field for the e-mail address of a user to invite. */
cm.MSG_EMAIL = goog.getMsg('E-mail address');

/** @desc Radio button label for granting view-only access. */
cm.MSG_VIEWER = goog.getMsg('Viewer');

/** @desc Radio button label for granting edit access. */
cm.MSG_EDITOR = goog.getMsg('Editor');

/** @desc Radio button label for granting full ownership access. */
cm.MSG_OWNER = goog.getMsg('Owner');

/** @desc Label for radio buttons for choosing the level of access to grant. */
cm.MSG_PERMISSION = goog.getMsg('Permission type');

/** @desc Label for the Invite button on the "Invite a collaborator" dialog. */
cm.MSG_INVITE_BUTTON = goog.getMsg('Invite');


// Toolbar view

/** @desc Link text to arrange the layers in the panel. */
cm.MSG_ARRANGE_LAYERS_LINK = goog.getMsg('Arrange');

/** @desc Link text to invite a user to collaborate on editing a map. */
cm.MSG_COLLABORATE_LINK = goog.getMsg('Collaborate');

/** @desc Link text to add a new layer to the map. */
cm.MSG_ADD_NEW_LAYERS = goog.getMsg('Add layer');

/** @desc Default title for an empty layer. */
cm.MSG_UNTITLED_LAYER = goog.getMsg('Untitled Layer');

/** @desc Link text to add a new folder to the map. */
cm.MSG_ADD_NEW_FOLDER = goog.getMsg('Add folder');

/** @desc Link text to return to map list. */
cm.MSG_BACK_TO_MAP_LIST = goog.getMsg('Back to map list');

/** @desc Default title for an empty folder. */
cm.MSG_UNTITLED_FOLDER = goog.getMsg('Untitled Folder');

/** @desc Warning message when discarding unsaved changes. */
cm.MSG_UNSAVED_CHANGES = goog.getMsg(
    'You have unsaved changes that will be lost if you leave' +
    ' the page without clicking the "Save" link.');


// Layer editor tooltips

/** @desc Tooltip for editing the layer's title. */
cm.MSG_LAYER_TITLE_TOOLTIP = goog.getMsg(
    'The layer title to display in the map\'s layer list.');

/** @desc Tooltip for editing the layer's description. */
cm.MSG_LAYER_DESCRIPTION_TOOLTIP = goog.getMsg(
    'HTML of the layer description to display in the map\'s layer list.');

/** @desc Tooltip for editing the layer's legend. */
cm.MSG_LEGEND_TOOLTIP = goog.getMsg(
    'The legend to display for this layer.');

/**
 * @desc Tooltip for editing the layer's viewport.  The "Zoom to area" part
 * in quotation marks refers to the message MSG_ZOOM_TO_AREA_LINK and should
 * exactly match the translation for that message.
 */
cm.MSG_LAYER_VIEWPORT_TOOLTIP = goog.getMsg(
    'The bounding coordinates of the area to zoom to when the user clicks ' +
    '"Zoom to area".');

/** @desc Tooltip for editing the layer's minimum zoom level. */
cm.MSG_MIN_ZOOM = goog.getMsg(
    'The lowest zoom level at which to show this layer (0=fully zoomed out, ' +
    '21=fully zoomed in).');

/** @desc Tooltip for editing the layer's maximum zoom level. */
cm.MSG_MAX_ZOOM = goog.getMsg(
    'The highest zoom level at which to show this layer (0=fully zoomed out, ' +
    '21=fully zoomed in).');

/** @desc Tooltip for editing the layer's source data type. */
cm.MSG_SOURCE_DATA_TYPE = goog.getMsg(
    'The data type or format of the layer\'s data.');

/** @desc Tooltip for editing the layer data's source URL. */
cm.MSG_SOURCE_URL = goog.getMsg(
    'The complete public URL where the layer\'s data is hosted. (For Tile ' +
    'layers, this is a URL template such as ' +
    'http://foo.com/maptile/example/{X}_{Y}_{Z}.png with placeholders for ' +
    'X, Y, and Z.)');

/** @desc Tooltip for toggling the display layer's data download link. */
cm.MSG_SHOW_DOWNLOAD_LINK = goog.getMsg(
    'Whether or not to display a link to the data source URL.');

/** @desc For a Fusion Table layer, tooltip for editing the Fusion Table ID. */
cm.MSG_FUSION_TABLE_ID = goog.getMsg(
    'The numeric ID of the Fusion Table.  In Fusion Tables, <b>File</b> &gt; ' +
    '<b>About</b> shows this ID.');

/**
 * @desc For a Fusion Table layer, tooltip for editing the index of the
 * Fusion Table's location column.
 */
cm.MSG_FUSION_TABLE_LOCATION_COLUMN = goog.getMsg(
    'The <a target="_blank" href="http://support.google.com/fusiontables/' +
    'answer/2590990?hl=en&ref_topic=2573808">location column</a> to use for ' +
    'plotting the points in the Fusion Table. For two-column locations ' +
    '(latitude/longitude), use the primary location column.');

/**
 * @desc For a Fusion Table layer, tooltip for editing the Fusion Table
 * query's WHERE clause.
 */
cm.MSG_FUSION_TABLE_WHERE_CLAUSE = goog.getMsg(
    'The condition to use in the Fusion Tables <a target="_blank" href=' +
    '"https://developers.google.com/fusiontables/docs/v1/using#queryData">' +
    'SELECT query\'s WHERE clause.</a>');

/** @desc Tooltip for editing the color of a weather layer's icons. */
cm.MSG_WEATHER_LABEL_COLOR = goog.getMsg(
    'The text color for the weather icons.');

/**
 * @desc Tooltip for editing the temperature units of a weather layer's
 * icons.
 */
cm.MSG_WEATHER_TEMP_UNITS = goog.getMsg(
    'The temperature units for the temperatures shown with the weather icons.');

/**
 * @desc Tooltip for editing the wind speed units of a weather layer's
 * pop-up windows.
 */
cm.MSG_WEATHER_WIND_SPEED_UNITS = goog.getMsg(
    'The speed units to use for wind speeds shown in the weather forecast ' +
    'pop-up windows.');

/** @desc Tooltip for editing a Google Maps Engine layer's map ID. */
cm.MSG_GME_MAP_ID = goog.getMsg(
    'The Google Maps Engine map ID.  In <a target="_blank" href=' +
    '"https://developers.google.com/maps/documentation/javascript/' +
    'mapsenginelayer">Google Maps Engine</a>, go to <b>Map details</b> page, ' +
    'click <b>Maps API ID: Details</b> and look for <b>Map ID</b>. ' +
    'Add "-4" to the end of this this ID.');

/**
 * @desc For a Google Maps Engine layer, tooltip for editing the layer
 * key of the source map.
 */
cm.MSG_GME_LAYER_KEY = goog.getMsg(
    'The Google Maps Engine layer key.  In <a target="_blank" href=' +
    '"https://developers.google.com/maps/documentation/javascript/' +
    'mapsenginelayer">Google Maps Engine</a>, go to <b>Map details</b> page, ' +
    'click <b>Maps API ID: Details</b> and look for <b>Layer key</b>.');

/** @desc Tooltip for selecting layers from a WMS service. */
cm.MSG_WMS_LAYERS = goog.getMsg(
    'The list of layers to display from the WMS service. If no options ' +
    'are displayed, either the WMS server cannot be reached, or the ' +
    'server is not publishing layers with Spherical Mercator projections.');

/**
 * @desc Tooltip for toggling whether a tile layer's source URL is an
 * indexed tile URL.
 */
cm.MSG_TILE_INDEX = goog.getMsg(
    'Whether the tile layer\'s URL is an indexed tile set.');

/** @desc Tooltip for selecting the type of tile coordinates. */
cm.MSG_TILE_COORDINATE_TYPE = goog.getMsg(
    'The type of tile coordinates for the source data (<a target="_blank" ' +
    'href="https://developers.google.com/maps/documentation/javascript/' +
    'maptypes#CustomMapTypes">Google</a>, <a target="_blank" href=' +
    '"http://msdn.microsoft.com/en-us/library/bb259689.aspx">Bing</a>, or ' +
    '<a target="_blank" href=' +
    '"http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification">TMS</a>).');

/** @desc Tooltip for selecting the folder type. */
cm.MSG_FOLDER_TYPE = goog.getMsg(
    'The type of folder: <b>Unlocked (default)</b>: folder contents are ' +
    'viewable in the map\'s layer list; <b>Locked</b>: folder contents are ' +
    'hidden from the map\'s layer list; or <b>Single Select</b>: a single ' +
    'sublayer of the folder may be selected for listing and showing on the ' +
    'map.');

