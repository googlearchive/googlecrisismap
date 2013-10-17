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


// All localizable messages are declared below.  Please provide a @desc for
// each message to give the translators some context.
//
//   - Constant messages are declared as constants of the form "MSG_FOO".
//
//   - Parameterizable messages are defined in functions named "cm.getMsgFoo".
//     (Closure forces us to assign each message *after substitution* to a
//     variable like MSG_FOO, so the only way to make messages parameterizable
//     is to assign to a local variable in a function and return the variable.)


// Generic messages.

/** @desc Proper name for the product. */
cm.MSG_PRODUCT_NAME = goog.getMsg('Google Crisis Map');

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

// Labels for the tabs in the panel.

/**
 * @desc Label for the tab that holds the map's title, description,
 *   and publisher.
 */
cm.MSG_ABOUT_TAB_lABEL = goog.getMsg('About');

/** @desc Label for the tab that shows details for a selected feature. */
cm.MSG_DETAILS_TAB_LABEL = goog.getMsg('Details');

/**
 * @desc Label for the tab that holds the descriptions of all the layers
 *   on the map.
 */
cm.MSG_LAYERS_TAB_LABEL = goog.getMsg('Layers');

// About

/** @desc Header for the about box. */
cm.MSG_ABOUT_HEADER = goog.getMsg('Google Crisis Map');

/** @desc HTML content in a Help pop-up for people viewing the map. */
cm.MSG_ABOUT_HTML = goog.getMsg(
    'Tips for using this site:' +
    '<ul>' +
    '  <li>Zoom the map using either the on-screen controls or your mouse.' +
    '  </li>' +
    '  <li>Find additional layers in the Layers list, where you can turn' +
    '  them on or off.  Scroll to see all layers.</li>' +
    '  <li>Zoom to an appropriate view for each layer by clicking the "Zoom' +
    '  to area" links in the Layers list.</li>' +
    '  <li>View selected layers in <a href="http://www.google.com/earth/"' +
    '  target="_blank">Google Earth</a> by clicking the "Download KML" links' +
    '  in the Layers list.</li>' +
    '  <li>Share the map in e-mail by clicking the Share button and copying' +
    '  the URL provided there. The URL will restore your current view,' +
    '  including the set of layers that you have turned on.</li>' +
    '  <li>Embed the map on your website or blog by getting a snippet of ' +
    '  HTML code from the Share button.</li>' +
    '  <li>Share the link on Google+, Twitter or Facebook by clicking the ' +
    '  appropriate button in the Share window.</li>' +
    '</ul>');


// Footer view

/** @desc The link text for opening the map in a new browser window. */
cm.MSG_FULL_MAP_LINK = goog.getMsg('Full map');

/**
 * @param {string} publisherName Name of the person or organization that
 *     published the map.
 * @return {string} The localized message.
 */
cm.getMsgPublisherAttribution = function(publisherName) {
  /** @desc Attribution for the person or organization publishing the map. */
  var MSG_PUBLISHER_ATTRIBUTION = goog.getMsg(
      'Published by {$publisherName}', {'publisherName': publisherName});
  return MSG_PUBLISHER_ATTRIBUTION;  // Closure forces this silly circumlocution
};

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

/** @desc A temporary message shown while contents are loading. */
cm.MSG_LOADING = goog.getMsg('Loading...');

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

/** @desc Label for the map legend or an area for editing the map legend. */
cm.MSG_LEGEND = goog.getMsg('Legend');

/**
 * @param {string} formattedTime A formatted date and time.
 * @return {string} The localized message.
 */
cm.getMsgLastUpdatedTime = function(formattedTime) {
  /** @desc Indicator for the time that the layer was last updated. */
  var MSG_LAST_UPDATED = goog.getMsg(
      'Last updated: {$formattedTime}', {'formattedTime': formattedTime});
  return MSG_LAST_UPDATED;  // Closure forces this silly circumlocution
};

/**
 * @desc Information text that shows how many descendants of a layer match
 * a layer filter query.
 */
cm.MSG_NUMBER_MATCHING_SUBLAYERS = goog.getMsg('{NUM_LAYERS, plural, ' +
  '=0 {No matching layers in this folder}' +
  '=1 {1 matching layer in this folder}' +
  'other {# matching layers in this folder}}');


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

/** @desc HTML for a copyright notice for map data from OpenStreetMap. */
cm.MSG_OSM_COPYRIGHT_HTML = goog.getMsg(
    'Map data \u00a9 ' +
    '<a href="http://www.openstreetmap.org/copyright" target="_blank">' +
    'OpenStreetMap</a> contributors');


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

/**
 * @desc Placeholder text for an input for entering a layer filter query.
 * The message describes what the input element does.
 */
cm.MSG_LAYER_FILTER_PLACEHOLDER = goog.getMsg('Filter layers');

/**
 * @desc Information text that shows how many layers are matched by the
 * layer filter query.
 */
cm.MSG_NUMBER_MATCHING_LAYERS = goog.getMsg('{NUM_LAYERS, plural, ' +
  '=0 {No layers or folders match the filter query}' +
  '=1 {1 layer or folder matches the filter query}' +
  'other {# layers and folders match the filter query}}');


// Share popup

/** @desc Label for a button to share the current map view. */
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


// Collaborate popup

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



// Inspector

/** @desc Text of link to proceed to the "Import layers" dialog. */
cm.MSG_IMPORT_LAYERS = goog.getMsg('Import published layers \xbb');

/** @desc Label for a text field for a map title or layer title. */
cm.MSG_TITLE = goog.getMsg('Title');

/** @desc Label for a text field for a map description or layer description. */
cm.MSG_DESCRIPTION = goog.getMsg('Description');

/** @desc Label for a text field for the content at the bottom of the map. */
cm.MSG_FOOTER = goog.getMsg('Footer');

/**
 * @desc Label for an area for editing the map's default viewport, which is
 *     used to determine the zoom level and visible area of the map when it
 *     is initially loaded.
 */
cm.MSG_DEFAULT_VIEWPORT = goog.getMsg('Default viewport');

/**
 * @desc Label for the menu for choosing the type of base map (road map,
 *     satellite map, etc.) displayed by default when the map initially loads.
 */
cm.MSG_DEFAULT_BASE_MAP = goog.getMsg('Default base map');

/** @desc One of the available options for a type of base map. */
cm.MSG_BASE_MAP_TYPE_ROADMAP = goog.getMsg('Road map');

/** @desc One of the available options for a type of base map. */
cm.MSG_BASE_MAP_TYPE_SATELLITE = goog.getMsg('Satellite imagery');

/** @desc One of the available options for a type of base map. */
cm.MSG_BASE_MAP_TYPE_HYBRID = goog.getMsg('Satellite imagery with labels');

/** @desc One of the available options for a type of base map. */
cm.MSG_BASE_MAP_TYPE_TERRAIN = goog.getMsg('Terrain');

/**
 * @desc One of the available options for a type of base map; this option
 *     allows the user to customize the style of the base map.
 */
cm.MSG_BASE_MAP_TYPE_CUSTOM = goog.getMsg('Custom');

/**
 * @desc Label for a text field where the user can enter code to customize the
 *     style of the base map.  It's important to show that the code should be
 *     entered in JSON format, so "(JSON)" should appear in all translations.
 */
cm.MSG_CUSTOM_BASE_MAP_STYLE = goog.getMsg('Custom base map style (JSON)');

/**
 * @desc Label for a text field for entering a name for the custom style that
 *     the user has defined in the "Custom base map style (JSON)" field.
 */
cm.MSG_CUSTOM_STYLE_NAME = goog.getMsg('Custom style name');

/**
 * @desc Label for an area for editing the layer's viewport, which determines
 *     the rectangular area that the map zooms to when the user clicks
 *     "Zoom to area".  The "Zoom to area" part in quotation marks refers to a
 *     command in the UI, so it should be translated identically to the other
 *     "Zoom to area" message.
 */
cm.MSG_LAYER_VIEWPORT = goog.getMsg('"Zoom to area" viewport');

/**
 * @desc Label for a checkbox to copy the current map's viewport to the layer's
 *     viewport fields, as an alternative to typing in numbers for the viewport.
 */
cm.MSG_USE_CURRENT_MAP_VIEWPORT = goog.getMsg('Use current map viewport');

/**
 * @desc A warning message that asks the user to fill in the layer viewport
 *     for "Tile service" layers.  The words "Tile service" in quotation marks
 *     refer to the "Tile service" option in the UI, and they should be
 *     translated identically to the other message for "Tile service".
 */
cm.MSG_TILE_LAYER_VIEWPORT_WARNING = goog.getMsg(
    'For "Tile service" layers, please provide accurate viewport bounds ' +
    'in order to ensure that only tiles within the bounds are requested.');

/** @desc Label for an area for entering the minimum zoom level of the map. */
cm.MSG_MINIMUM_ZOOM = goog.getMsg('Minimum zoom level');

/** @desc Label for an area for entering the maximum zoom level of the map. */
cm.MSG_MAXIMUM_ZOOM = goog.getMsg('Maximum zoom level');

/** @desc Label for a menu for selecting the type of a map layer. */
cm.MSG_LAYER_TYPE = goog.getMsg('Layer type');

/** @desc Menu option for a service that delivers layer tiles. */
cm.MSG_LAYER_TYPE_TILE_SERVICE = goog.getMsg('Tile service');

/** @desc Menu option for a layer from the Google Fusion Tables product. */
cm.MSG_LAYER_TYPE_FUSION_TABLES = goog.getMsg('Google Fusion Tables');

/** @desc Menu option for a layer from the Google Maps Engine product. */
cm.MSG_LAYER_TYPE_MAPS_ENGINE = goog.getMsg('Google Maps Engine');

/** @desc Menu option for the traffic layer from Google Maps. */
cm.MSG_LAYER_TYPE_TRAFFIC = goog.getMsg('Traffic (from Google Maps)');

/** @desc Menu option for the transit layer from Google Maps. */
cm.MSG_LAYER_TYPE_TRANSIT = goog.getMsg('Transit (from Google Maps)');

/** @desc Menu option for the weather layer from Google Maps. */
cm.MSG_LAYER_TYPE_WEATHER = goog.getMsg('Weather (from Google Maps)');

/** @desc Menu option for the clouds layer from Google Maps. */
cm.MSG_LAYER_TYPE_CLOUDS = goog.getMsg('Clouds (from Google Maps)');

/** @desc Label for a text field for the URL of a data source. */
cm.MSG_SOURCE_URL = goog.getMsg('Source URL');

/**
 * @desc Label for a checkbox that controls whether to show a link to
 *     download the data for this layer.
 */
cm.MSG_SHOW_DOWNLOAD_LINK = goog.getMsg('Show download link?');

/**
 * @desc Label for a checkbox that controls whether the URL that the user
 *     entered should be treated as a tile index.
 */
cm.MSG_TILE_INDEX = goog.getMsg('Tile index URL?');

/**
 * @desc Label for a text field for entering the Table ID of a table in
 *     Google Fusion Tables.  This should match the translation of the
 *     message "Table ID" in the Google Fusion Tables product.
 */
cm.MSG_GFT_TABLE_ID = goog.getMsg('Table ID');

/**
 * @desc Label for a text field for entering a column name.  The purpose of
 *     entering the column name is to specify which column contains location
 *     information in a table of data in Google Fusion Tables.
 */
cm.MSG_GFT_LOCATION_COLUMN = goog.getMsg('Location column');

/**
 * @desc Label for a text field for entering a condition that is used to filter
 *     the data (from a table in Google Fusion Tables) to be shown on the map.
 *     An example of a condition would be "type = 'tornado'" or "speed > 60".
 */
cm.MSG_GFT_FILTER_CONDITION = goog.getMsg('Filter condition');

/**
 * @desc Label for a menu for selecting the color of the text labels
 *     on a weather layer.
 */
cm.MSG_WEATHER_LABEL_COLOR = goog.getMsg('Label color');

/** @desc The color black in a color selection menu. */
cm.MSG_BLACK = goog.getMsg('Black');

/** @desc The color white in a color selection menu. */
cm.MSG_WHITE = goog.getMsg('White');

/**
 * @desc Label for a menu for selecting the temperature unit to use
 *     on a weather layer (the options in the menu are Celsius and Fahrenheit).
 */
cm.MSG_WEATHER_TEMPERATURE_UNIT = goog.getMsg('Temperature unit');

/** @desc An option in a menu for selecting temperature units. */
cm.MSG_CELSIUS = goog.getMsg('Celsius');

/** @desc An option in a menu for selecting temperature units. */
cm.MSG_FAHRENHEIT = goog.getMsg('Fahrenheit');

/**
 * @desc Label for a menu for selecting the speed unit (mph or km/h)
 *     to use for displaying wind speeds for a weather layer.
 */
cm.MSG_WEATHER_WIND_SPEED_UNIT = goog.getMsg('Wind speed unit');

/**
 * @desc Label for a text field for the Map ID of a map in Google Maps Engine.
 *     Should match the translation for "Map ID" in the GME product.
 */
cm.MSG_GME_MAP_ID = goog.getMsg('Map ID');

/**
 * @desc Label for a text field for a layer key in Google Maps Engine.
 *     Should match the translation for "Layer key" in the GME product.
 */
cm.MSG_GME_LAYER_KEY = goog.getMsg('Layer key');

/** @desc Label for a list of map layers that the user can select from. */
cm.MSG_WMS_LAYERS = goog.getMsg('Layers');

/**
 * @desc Label for a menu for selecting the type of coordinates to use
 *     for a tile service.
 */
cm.MSG_TILE_COORDINATE_TYPE = goog.getMsg('Tile coordinate type');

/** @desc An option in a menu for selecting a type of coordinates. */
cm.MSG_GOOGLE_MAPS_COORDINATES = goog.getMsg('Google Maps tile coordinates');

/**
 * @desc An option in a menu for selecting a type of coordinates.  "Quadkey"
 *     is a technical term invented by Bing Maps.
 */
cm.MSG_BING_MAPS_QUADKEYS = goog.getMsg('Bing Maps quadkeys');

/** @desc An option in a menu for selecting a type of coordinates. */
cm.MSG_TMS_COORDINATES = goog.getMsg('Tile Map Service (TMS) coordinates');

/**
 * @desc Label for a menu for selecting the type of a folder (in which
 *     layers are organized).
 */
cm.MSG_FOLDER_TYPE = goog.getMsg('Folder type');

/**
 * @desc A menu option that sets a folder to be unlocked, meaning that the
 *     contents within the folder are visible and can be manipulated.
 */
cm.MSG_FOLDER_TYPE_UNLOCKED = goog.getMsg('Unlocked');

/**
 * @desc A menu option that sets a folder to be locked, meaning that the
 *     contents within the folder are hidden and cannot be manipulated.
 */
cm.MSG_FOLDER_TYPE_LOCKED = goog.getMsg('Locked');

/**
 * @desc A menu option that sets a folder to be restricted so that only one
 *     of the items inside it is shown at a time.
 */
cm.MSG_FOLDER_TYPE_SINGLE_SELECT = goog.getMsg('Single-select');


// Inspector tooltips

/** @desc Tooltip for editing the layer's title. */
cm.MSG_LAYER_TITLE_TOOLTIP = goog.getMsg(
    'The layer title to display in the map\'s layer list.');

/** @desc Tooltip for editing the layer's description. */
cm.MSG_LAYER_DESCRIPTION_TOOLTIP = goog.getMsg(
    'HTML of the layer description to display in the map\'s layer list.');

/** @desc Tooltip for editing the layer's legend. */
cm.MSG_LEGEND_TOOLTIP = goog.getMsg('The legend to display for this layer.');

/**
 * @desc Tooltip for editing the layer's viewport.  The "Zoom to area" part
 *     in quotation marks refers to a command in the UI and should be
 *     translated identically to the other "Zoom to area" message.
 */
cm.MSG_LAYER_VIEWPORT_TOOLTIP = goog.getMsg(
    'The bounding coordinates of the area to zoom to when the user clicks ' +
    '"Zoom to area".');

/**
 * @desc Tooltip for a text field for a layer's minimum zoom level.
 *     [BACKUP_MESSAGE_ID: 1222561086658662105] <- remove by 2013-06-30.
 */
cm.MSG_MINIMUM_ZOOM_TOOLTIP = goog.getMsg(
    'The lowest zoom level at which to show this layer (0=fully zoomed out, ' +
    '21=fully zoomed in).');

/**
 * @desc Tooltip for a text field for a layer's maximum zoom level.
 *     [BACKUP_MESSAGE_ID: 7963246557554006791] <- remove by 2013-06-30.
 */
cm.MSG_MAXIMUM_ZOOM_TOOLTIP = goog.getMsg(
    'The highest zoom level at which to show this layer (0=fully zoomed out, ' +
    '21=fully zoomed in).');

/**
 * @desc Tooltip for a menu for selecting the type of a map layer.
 *     [BACKUP_MESSAGE_ID: 1910785398096973936] <- remove by 2013-06-30.
 */
cm.MSG_LAYER_TYPE_TOOLTIP = goog.getMsg(
    'The data type or format of the layer\'s data.');

/**
 * @desc Tooltip for the text field for a layer's data source URL.  "Quadkey"
 *     is a technical term invented by Bing Maps.  Do not translate the example
 *     URL, "http://example.com/{X}_{Y}_{Z}.png".
 */
cm.MSG_SOURCE_URL_TOOLTIP = goog.getMsg(
    'The public URL of the layer data.  (For Google Maps tiles and TMS ' +
    'tiles, this is a URL template like http://example.com/{X}_{Y}_{Z}.png ' +
    'with placeholders for X, Y, and Z values.  For Bing Maps tiles, this is ' +
    'the tile URL without the quadkey at the end.)');

/**
 * @desc Tooltip for a checkbox that sets whether to show a download link.
 *     [BACKUP_MESSAGE_ID: 936745501152598628] <- remove by 2013-06-30.
 */
cm.MSG_SHOW_DOWNLOAD_LINK_TOOLTIP = goog.getMsg(
    'Whether or not to display a link to the data source URL.');

/**
 * @desc Tooltip for a text field for entering the ID of a table in
 *     Google Fusion Tables.  For every table, Google Fusion Tables shows
 *     two different IDs: one made only of digits, and one made of digits and
 *     letters.  We want to ask for the one made of digits and letters.
 *     [BACKUP_MESSAGE_ID: 1377315150680845923] <- remove by 2013-06-30.
 */
cm.MSG_GFT_TABLE_ID_TOOLTIP = goog.getMsg(
    'The alphanumeric ID (NOT "Numeric ID") of the table, which can be found ' +
    'in the <b>File</b> &gt; <b>About</b> box in Fusion Tables.');

/**
 * @desc Tooltip for a text field for entering a column name.  The purpose of
 *     entering the column name is to specify which column contains location
 *     information in a table of data in Google Fusion Tables.
 *     [BACKUP_MESSAGE_ID: 8009846162525503389] <- remove by 2013-06-30.
 */
cm.MSG_GFT_LOCATION_COLUMN_TOOLTIP = goog.getMsg(
    'The name of the <a target="_blank" href="http://support.google.com/' +
    'fusiontables/answer/2590990?ref_topic=2573808">location column</a> ' +
    'in the Fusion Table to draw on the map.  For two-column locations ' +
    '(latitude and longitude), use the name of the latitude column.');

/**
 * @desc Tooltip for a text field for entering a condition that will be used
 *     to filter the data to be shown on the map.  In the <code> example,
 *     the words "type", "tornado", and "speed" can be translated as long as
 *     the translated words are written in plain unaccented A-Z letters;
 *     otherwise do not translate them.  The words AND, WHERE, and SELECT are
 *     fixed in the syntax of Fusion Tables and should not be translated.
 *     "Fusion Tables" refers to the Google Fusion Tables product.
 */
cm.MSG_GFT_FILTER_CONDITION_TOOLTIP = goog.getMsg(
    'A condition used to filter the rows in the Fusion Table to draw on the ' +
    'map, such as <b><code>type = \'tornado\' AND speed &gt; 60</code></b>. ' +
    'Write the condition as it would be written in the <a target="_blank" ' +
    'href="https://developers.google.com/fusiontables/docs/v1/' +
    'sql-reference#Select">WHERE clause of a Fusion Tables SELECT query</a>. ' +
    'If this is left blank, all rows in the table that have valid location ' +
    'values are drawn on the map.');

/**
 * @desc Tooltip for a menu for selecting the color of the text labels
 *     on a weather layer.
 *     [BACKUP_MESSAGE_ID: 1379611439718787345] <- remove by 2013-06-30.
 */
cm.MSG_WEATHER_LABEL_COLOR_TOOLTIP = goog.getMsg(
    'The color of the text labels on weather icons.');

/**
 * @desc Tooltip for a menu for selecting the temperature unit to use
 *     on a weather layer (the options in the menu are Celsius and Fahrenheit).
 */
cm.MSG_WEATHER_TEMPERATURE_UNIT_TOOLTIP = goog.getMsg(
    'The temperature unit for the temperatures shown with the weather icons.');

/**
 * @desc Tooltip for a menu for selecting the speed unit to use for displaying
 *     wind speeds for a weather layer.
 *     [BACKUP_MESSAGE_ID: 5561151520318073865] <- remove by 2013-06-30.
 */
cm.MSG_WEATHER_WIND_SPEED_UNIT_TOOLTIP = goog.getMsg(
    'The speed unit to use for wind speeds shown in the weather forecast ' +
    'pop-up windows.');

/**
  * @desc Tooltip for the text field for a Google Maps Engine map ID.
 *     [BACKUP_MESSAGE_ID: 2434966409823343020] <- remove by 2013-06-30.
  */
cm.MSG_GME_MAP_ID_TOOLTIP = goog.getMsg(
    'The Google Maps Engine map ID.  In <a target="_blank" href=' +
    '"https://developers.google.com/maps/documentation/javascript/' +
    'mapsenginelayer">Google Maps Engine</a>, go to <b>Map details</b> page, ' +
    'click <b>Maps API ID: Details</b> and look for <b>Map ID</b>. ' +
    'Add "-4" to the end of this this ID.');

/**
 * @desc Tooltip for the text field for a Google Maps Engine layer key.
 *     [BACKUP_MESSAGE_ID: 3296719912787488933] <- remove by 2013-06-30.
 */
cm.MSG_GME_LAYER_KEY_TOOLTIP = goog.getMsg(
    'The Google Maps Engine layer key.  In <a target="_blank" href=' +
    '"https://developers.google.com/maps/documentation/javascript/' +
    'mapsenginelayer">Google Maps Engine</a>, go to <b>Map details</b> page, ' +
    'click <b>Maps API ID: Details</b> and look for <b>Layer key</b>.');

/**
 * @desc Tooltip for a list of map layers that the user can select from.
 *     [BACKUP_MESSAGE_ID: 6748479918576975622] <- remove by 2013-06-30.
 */
cm.MSG_WMS_LAYERS_TOOLTIP = goog.getMsg(
    'The list of WMS layers to use.  If nothing is shown in this box, it' +
    'means that either the WMS server cannot be reached, or the server ' +
    'is not publishing layers with Spherical Mercator projections.');

/**
 * @desc Tooltip for toggling whether a tile layer's source URL is an
 *     indexed tile URL.
 */
cm.MSG_TILE_INDEX_TOOLTIP = goog.getMsg(
    'Whether the tile layer\'s URL is an indexed tile set.');

/**
 * @desc Tooltip for a menu for selecting the type of coordinates to use
 *     for a tile service.
 */
cm.MSG_TILE_COORDINATE_TYPE_TOOLTIP = goog.getMsg(
    'The type of tile coordinates to use in tile URLs (<a target="_blank" ' +
    'href="https://developers.google.com/maps/documentation/javascript/' +
    'maptypes#CustomMapTypes">Google</a>, <a target="_blank" href=' +
    '"http://msdn.microsoft.com/en-us/library/bb259689.aspx">Bing</a>, or ' +
    '<a target="_blank" href=' +
    '"http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification">TMS</a>).');

/**
 * @desc Tooltip for a menu for selecting the type of a folder (in which
 *     layers are organized).  The strings "Unlocked", "Locked", and
 *     "Single-select" that are mentioned in this text refer to the options
 *     in the menu, so they should be translated identically to the messages
 *     "Unlocked", "Locked", and "Single-select".
 */
cm.MSG_FOLDER_TYPE_TOOLTIP = goog.getMsg(
    '<b>Unlocked</b> (default): folder contents are visible in the layer ' +
    'list; <b>Locked</b>: folder contents are hidden from the layer list; ' +
    '<b>Single-select</b>: only one sublayer at a time may be selected ' +
    'in this folder.');
