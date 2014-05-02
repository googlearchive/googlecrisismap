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

goog.provide('cm');

goog.require('goog.i18n.MessageFormat');

cm = {};

/** A place to emit, and attach listeners for, app-wide events. */
cm.app = {};


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

// Short time indicators

/** @desc Time label for an item posted less than a minute ago (very short). */
cm.MSG_JUST_NOW = goog.getMsg('just now');

/**
 * @param {number} minutes Number of minutes.
 * @return {string} The localized message.
 */
cm.getMsgShortMinutesAgo = function(minutes) {
  /** @desc Time label for an item posted some minutes ago (very short). */
  var MSG_SHORT_MINUTES_AGO = goog.getMsg('{minutes, plural, ' +
      '=1 {1m ago}' +
      '=2 {2m ago}' +
      'other {#m ago}}');
  return new goog.i18n.MessageFormat(MSG_SHORT_MINUTES_AGO).format(
      {'minutes': minutes});  // Closure forces this silly circumlocution
};

/**
 * @param {number} hours Number of hours.
 * @return {string} The localized message.
 */
cm.getMsgShortHoursAgo = function(hours) {
  /** @desc Time label for an item posted some hours ago (very short). */
  var MSG_SHORT_HOURS_AGO = goog.getMsg('{hours, plural, ' +
      '=1 {1h ago}' +
      '=2 {2h ago}' +
      'other {#h ago}}');
  return new goog.i18n.MessageFormat(MSG_SHORT_HOURS_AGO).format(
      {'hours': hours});  // Closure forces this silly circumlocution
};

/**
 * @param {number} days Number of days.
 * @return {string} The localized message.
 */
cm.getMsgShortDaysAgo = function(days) {
  /** @desc Time label for an item posted some days ago (very short). */
  var MSG_SHORT_DAYS_AGO = goog.getMsg('{days, plural, ' +
      '=1 {1d ago}' +
      '=2 {2d ago}' +
      'other {#d ago}}');
  return new goog.i18n.MessageFormat(MSG_SHORT_DAYS_AGO).format(
      {'days': days});  // Closure forces this silly circumlocution
};


// Labels for the tabs in the panel.

/**
 * @desc Label for the tab that holds the map's title, description,
 *   and publisher.
 */
cm.MSG_ABOUT_TAB_LABEL = goog.getMsg('About');

/** @desc Label for the tab that shows details for a selected feature. */
cm.MSG_DETAILS_TAB_LABEL = goog.getMsg('Details');

/**
 * @desc Label for the tab that holds the descriptions of all the layers
 *   on the map.
 */
cm.MSG_LAYERS_TAB_LABEL = goog.getMsg('Layers');

/**
 * @desc Label for the tab that holds the legend to the map.
 */
cm.MSG_LEGEND_TAB_LABEL = goog.getMsg('Legend');

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

/** @desc Link to go back to the "Create new layer" dialog. */
cm.MSG_BACK_TO_CREATE_NEW_LAYER = goog.getMsg('\xab Back');

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


// TopicSelector view

/**
 * @desc Title for a popup that displays an editable set of topics for this map.
 * Topics are used to group map layers and associate them with survey
 * questions and user comments.
 */
cm.MSG_TOPICS_FOR_THIS_MAP_TITLE = goog.getMsg('Topics for this map');

/** @desc Description explaining the concept of map topics. */
cm.MSG_TOPICS_DESCRIPTION = goog.getMsg('Topics are used to group map layers ' +
    'and associate them with survey questions and user comments.');

/**
 * @desc Link to create a new topic data structure, where the user can pose
 * questions relating to layers on the map.
 */
cm.MSG_CREATE_NEW_TOPIC = goog.getMsg('Create new topic');


// Layers button

/** @desc Standard label for the 'Layers' button in embedded mode. */
cm.MSG_LAYER_BUTTON = goog.getMsg('Layers');


// Edit presenter

/**
 * @desc Link to create a new map layer.
 */
cm.MSG_CREATE_NEW_LAYER = goog.getMsg('Create new layer');

/**
 * @desc Title for a popup to edit map properties like title,
 * description, and viewport.
 */
cm.MSG_EDIT_MAP_DETAILS = goog.getMsg('Edit map details');

/**
 * @desc Title for a popup to edit layer properties like title,
 * description, and type.
 */
cm.MSG_EDIT_LAYER_DETAILS = goog.getMsg('Edit layer details');

/**
 * @desc Title for a popup to edit topic properties like title, tags,
 * and viewport.
 */
cm.MSG_EDIT_TOPIC = goog.getMsg('Edit topic');

// Layer Entry View

/** @desc Label for a link that zooms the map to fit the layer's area. */
cm.MSG_ZOOM_TO_AREA_LINK = goog.getMsg('Zoom to area');

/** @desc Label for a link to download a KML file. */
cm.MSG_DOWNLOAD_KML_LINK = goog.getMsg('Download KML');

/** @desc Label for a link to download a GeoJSON file. */
cm.MSG_DOWNLOAD_GEOJSON_LINK = goog.getMsg('Download GeoJSON');

/** @desc Label for a link to download a GeoRSS file. */
cm.MSG_DOWNLOAD_GEORSS_LINK = goog.getMsg('Download GeoRSS');

/** @desc Label for a link to download a CSV file. */
cm.MSG_DOWNLOAD_CSV_LINK = goog.getMsg('Download CSV');

/** @desc Label for a link to view data in a Google Spreadsheet. */
cm.MSG_VIEW_GOOGLE_SPREADSHEET = goog.getMsg('View Google Spreadsheet');

/** @desc Label for a link to view the layer in Google Maps Engine. */
cm.MSG_VIEW_IN_GOOGLE_MAPS_ENGINE = goog.getMsg('View in Google Maps Engine');

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


// Answer editor

/** @desc Label for a field to enter a color. */
cm.MSG_ANSWER_COLOR = goog.getMsg('Color');

/** @desc Tooltip for the field to enter a color. */
cm.MSG_ANSWER_COLOR_TOOLTIP = goog.getMsg('Background color for the answer ' +
    'label, in hexadecimal RGB notation as used in CSS. ' +
    'Red is #ff0000 or #f00.');

/**
 * @desc Label for a field to enter an multiple-choice answer to a question.
 * This answer appears on a button the user presses to select the asnwer.
 */
cm.MSG_ANSWER_BUTTON_LABEL = goog.getMsg('Button label');

/** @desc Tooltip for the field to enter a multiple-choice answer. */
cm.MSG_ANSWER_BUTTON_LABEL_TOOLTIP = goog.getMsg('Short text of the answer. ' +
    'The answer appears on a button the user presses to select it. Often the ' +
    'button label is simply "Yes" or "No".');

/**
 * @desc Label for a field to enter a very short form of the
 * answer that can be understood without seeing the corresponding
 * question.  A successful answer label to the question,
 * "Does this gas station have gas?" would be, "Has Gas".
 */
cm.MSG_ANSWER_STANDALONE_TEXT = goog.getMsg('Standalone text');

/**
 * @desc Tooltip for the field to enter a label for a multiple-choice answer.
 */
cm.MSG_ANSWER_STANDALONE_TEXT_TOOLTIP = goog.getMsg('A label to describe ' +
   'the selected answer. These labels should be understandable without ' +
    'seeing the corresponding question and should be unique across all ' +
    'questions. A useful label to the question, "Does this gas station have ' +
    'gas?" could be, "Has gas"');

/**
 * @desc An affirmative answer.
 */
cm.MSG_YES = goog.getMsg('Yes');

/**
 * @desc A negative answer.
 */
cm.MSG_NO = goog.getMsg('No');


// Question editor

/** @desc Label for a form to add a multiple choice answer to a question. */
cm.MSG_ANSWER = goog.getMsg('Answer');

/** @desc Label for a button to add an multiple choice answer to a question. */
cm.MSG_ADD_ANSWER = goog.getMsg('Add an answer');

/** @desc Label for a text field for entering the text of a question. */
cm.MSG_QUESTION_TEXT = goog.getMsg('Question');

/** @desc Tooltip for a text field. */
cm.MSG_QUESTION_TEXT_TOOLTIP = goog.getMsg('The text of the question.');


// Question list editor

/** @desc Label for a button to add a question to a list of questions. */
cm.MSG_ADD_QUESTION = goog.getMsg('Add a question');


// Map view

/** @desc HTML for a copyright notice for map data from OpenStreetMap. */
cm.MSG_OSM_COPYRIGHT_HTML = goog.getMsg(
    '\u00a9 ' +
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

/** @desc Label for a link that opens the layers tab. */
cm.MSG_OPEN_LAYERS_TAB_LINK = goog.getMsg('View all layers \u00bb');


// Crowd view

/** @desc An invitation to users to contribute a report about a location. */
cm.MSG_CROWD_REPORT_PROMPT = goog.getMsg('Know something about this location?');

/** @desc Label for an answer to a multiple-choice question. */
cm.MSG_NOT_SURE = goog.getMsg('Not sure');

/** @desc Heading for a section containing reports from citizens. */
cm.MSG_CITIZEN_REPORTS = goog.getMsg('Citizen reports');

/** @desc Label for the comment entry box. */
cm.MSG_ENTER_COMMENT = goog.getMsg('Enter a comment');

/** @desc A button for posting the user's comment. */
cm.MSG_POST = goog.getMsg('Post');

/**
 * @desc A short question asking whether a comment is helpful or not.  "Yes"
 *     and "No" buttons are offered after this question for the user to click.
 */
cm.MSG_HELPFUL_QUESTION = goog.getMsg('Helpful?');

/** @desc Tooltip for a button to vote that a comment is helpful. */
cm.MSG_UPVOTE_TOOLTIP = goog.getMsg('Vote this comment up');

/** @desc Tooltip for a button to vote that a comment is not helpful. */
cm.MSG_DOWNVOTE_TOOLTIP = goog.getMsg('Vote this comment down');

/** @desc A notice to let users know their reports will be public. */
cm.MSG_CROWD_PRIVACY_DISCLAIMER = goog.getMsg(
    'Please note: All data entered will be public.');


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

/** @desc Link text to edit topics for which the map is related. */
cm.MSG_EDIT_TOPICS = goog.getMsg('Edit topics');

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

/** @desc Label for a text field for a map, layer, or topic title. */
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

/** @desc Menu option for a Google Spreadsheet layer. */
cm.MSG_LAYER_TYPE_GOOGLE_SPREADSHEET = goog.getMsg('Google Spreadsheet');

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

/** @desc Menu option for a layer from Google Maps Engine Lite or Pro. */
cm.MSG_LAYER_TYPE_MAPS_ENGINE_LITE_OR_PRO = goog.getMsg(
    'Google Maps Engine Lite/Pro');

/** @desc Label for a text field for the URL of a data source. */
cm.MSG_SOURCE_URL = goog.getMsg('Source URL');

/**
 * @desc Error message shown when a user enters a URL that does not contain
 *     a valid protocol such as http:// or https://.
 */
cm.MSG_INVALID_URL = goog.getMsg(
    'Invalid URL - please include a protocol (e.g. http:// or https://)');

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

/** @desc Label for a text field for entering the title of a placemark. */
cm.MSG_PLACEMARK_TITLE = goog.getMsg('Placemark title');

/** @desc Label for a text field for entering the description of placemark. */
cm.MSG_PLACEMARK_DESCRIPTION = goog.getMsg('Placemark description');

/**
 * @desc Label for a text field for entering the name of the field in a data
 *     record that contains the latitude for that record.
 */
cm.MSG_LATITUDE_FIELD = goog.getMsg('Latitude field');

/**
 * @desc Label for a text field for entering the name of the field in a data
 *     record that contains the longitude for that record.
 */
cm.MSG_LONGITUDE_FIELD = goog.getMsg('Longitude field');

/** @desc Label for a text field for entering the URL of an icon image. */
cm.MSG_ICON_URL = goog.getMsg('Icon URL');

/** @desc Label for a field for entering a color tint to apply to icons. */
cm.MSG_ICON_COLOR_TINT = goog.getMsg('Icon color tint');

/**
 * @desc Label for a field for specifying the hotspot position in an icon.
 *     "Hotspot" is a term of art in KML (not related to a Wi-Fi hotspot).
 *     The "hotspot" is the location in the image to use for alignment, e.g.
 *     if the hotspot is in the bottom-right corner, then the image will be
 *     placed so its bottom-right corner is aligned with the point in question.
 */
cm.MSG_ICON_HOTSPOT = goog.getMsg('Icon hotspot');

/**
 * @desc Label for a text field for entering a condition that is used to filter
 *     a set of records to be shown on the map.  An example of a condition
 *     would be "speed > 60".
 */
cm.MSG_FILTER_CONDITION = goog.getMsg('Filter condition');

/**
 * @desc Label for a field to select layers with content relevant to the
 * given topic.
 */
cm.MSG_LAYERS_FOR_THIS_TOPIC = goog.getMsg('Layers for this topic');

/** @desc Label for a field to associate tags (like hashtags) to a map topic. */
cm.MSG_TAGS = goog.getMsg('Tags');

/**
 * @desc Label for a checkbox field specifying whether viewers of the map
 * (the crowd) can contribute comments on questions relating to this topic.
 */
cm.MSG_ENABLE_CROWD_REPORTS = goog.getMsg('Enable crowd reports');

/**
 * @desc Label for a text field for entering the radius of a circle inside
 * which geo-located comments from users are clustered to a single point.
 */
cm.MSG_CLUSTER_RADIUS = goog.getMsg('Cluster radius (in meters)');

/** @desc Label for a field to enter questions about a topic. */
cm.MSG_SURVEY_QUESTIONS = goog.getMsg('Survey questions');

/** @desc Refers to the point at the center of an image. */
cm.MSG_HOTSPOT_CENTER = goog.getMsg('Center');

/** @desc Refers to the point at the center of the bottom edge of an image. */
cm.MSG_HOTSPOT_BOTTOM_CENTER = goog.getMsg('Center of bottom edge');

/** @desc Refers to the point at the center of the top edge of an image. */
cm.MSG_HOTSPOT_TOP_CENTER = goog.getMsg('Center of top edge');

/** @desc Refers to the point at the center of the left edge of an image. */
cm.MSG_HOTSPOT_LEFT_CENTER = goog.getMsg('Center of left edge');

/** @desc Refers to the point at the center of the right edge of an image. */
cm.MSG_HOTSPOT_RIGHT_CENTER = goog.getMsg('Center of right edge');

/** @desc Refers to the point at the top-left corner of an image. */
cm.MSG_HOTSPOT_TOP_LEFT = goog.getMsg('Top-left corner');

/** @desc Refers to the point at the top-right corner of an image. */
cm.MSG_HOTSPOT_TOP_RIGHT = goog.getMsg('Top-right corner');

/** @desc Refers to the point at the bottom-left corner of an image. */
cm.MSG_HOTSPOT_BOTTOM_LEFT = goog.getMsg('Bottom-left corner');

/** @desc Refers to the point at the bottom-right corner of an image. */
cm.MSG_HOTSPOT_BOTTOM_RIGHT = goog.getMsg('Bottom-right corner');

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
 * @desc Label for a checkbox for controlling whether a Google Fusion Table
 *     layer should be displayed as a heatmap. An example Google Fusion Table
 *     heatmap can be found here: http://goo.gl/QUJ5gX
 */
cm.MSG_GFT_HEATMAP = goog.getMsg('Display as heatmap?');

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
    'The URL of the file, feed, spreadsheet, or map with the layer data. ' +
    'For a Google Spreadsheet, be sure to use the URL provided by ' +
    'File > Publish to the Web.  For Google Maps tiles and TMS tiles, ' +
    'this is a URL template like http://example.com/{X}_{Y}_{Z}.png with ' +
    'placeholders for X, Y, and Z values.  For Bing Maps tiles, this is ' +
    'the tile URL without the quadkey at the end.');

/**
 * @desc Tooltip for the text field for a Maps EngineLite layer's source URL.
 */
cm.MSG_MAPS_ENGINE_LITE_OR_PRO_URL_TOOLTIP = goog.getMsg(
    'The public URL of the Maps Engine Lite/Pro layer data.');

/**
 * @desc Tooltip for a checkbox that sets whether to show a download link.
 *     [BACKUP_MESSAGE_ID: 936745501152598628] <- remove by 2013-06-30.
 */
cm.MSG_SHOW_DOWNLOAD_LINK_TOOLTIP = goog.getMsg(
    'Whether or not to display a link to the data source URL.');

/**
 * @desc Tooltip for a text field for entering the title of a placemark.
 *     "Template" means the user can include placeholders which will be filled
 *     in with data values containing information about each placemark.
 */
cm.MSG_PLACEMARK_TITLE_TOOLTIP = goog.getMsg(
    'Optional (default is "$name").  ' +
    'Template for the title of each placemark.  ' +
    'Use "$xyz" to insert the contents of field "xyz".'
);

/**
 * @desc Tooltip for a text field for entering the description of a placemark.
 *     "Template" means the user can include placeholders which will be filled
 *     in with data values containing information about each placemark.
 */
cm.MSG_PLACEMARK_DESCRIPTION_TOOLTIP = goog.getMsg(
    'Optional (default is "$_description").  ' +
    'HTML template for the description of each placemark.  ' +
    'Use "$xyz" to insert the contents of field "xyz" as plain text; ' +
    'use "$_xyz" to insert the contents of field "xyz" as HTML.'
);

/**
 * @desc Tooltip for a text field for entering the name of the column in a data
 *     table that contains the latitude for each record.
 */
cm.MSG_LATITUDE_FIELD_TOOLTIP = goog.getMsg(
    'Name of the latitude column.  This column should contain values in ' +
    'decimal degrees from -90 to 90, where north is positive.');

/**
 * @desc Tooltip for a text field for entering the name of the column in a data
 *     table that contains the longitude for each record.
 */
cm.MSG_LONGITUDE_FIELD_TOOLTIP = goog.getMsg(
    'Name of the longitude column.  This column should contain values in ' +
    'decimal degrees from -180 to 180, where east is positive.');

/** @desc Tooltip for a text field for entering the URL of an icon image. */
cm.MSG_ICON_URL_TOOLTIP = goog.getMsg(
    'Optional.  URL of the icon to use for each placemark. ' +
    'The default icon is a small red dot.');

/** @desc Tooltip for a field for entering a color tint to apply to icons. */
cm.MSG_ICON_COLOR_TINT_TOOLTIP = goog.getMsg(
    'Optional.  Color tint to apply to icons, in rrggbb (hex) format.');

/**
 * @desc Tooltip for a field for specifying the hotspot position in an icon.
 *     "Hotspot" is a term of art in KML (not related to a Wi-Fi hotspot).
 *     The "hotspot" is the location in the image to use for alignment, e.g.
 *     if the hotspot is in the bottom-right corner, then the image will be
 *     placed so its bottom-right corner is aligned with the point in question.
 */
cm.MSG_ICON_HOTSPOT_TOOLTIP = goog.getMsg(
    'Location of the spot in the placemark icon ' +
    'to align with the specified latitude and longitude.');

/**
 * @desc Tooltip for a text field for entering a condition that is used to
 *     filter a set of records to be shown on the map.  An example of a
 *     condition would be "speed > 60".
 */
cm.MSG_FILTER_CONDITION_TOOLTIP = goog.getMsg(
    'Optional.  Enter a condition like "xyz < 5" or "title = foo" ' +
    'to select a subset of the data records to show on the map.'
);

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
 * @desc Tooltip for the checkbox that's used to control whether a Fusion
 *     Table has a heatmap enabled. "Fusion Tables" refers to the Google
 *     Fusion Tables product. A heatmap is a visualization technique
 *     that applies color intensity to denote the presence or absence
 *     of data, e.g. http://goo.gl/QUJ5gX
 */
cm.MSG_GFT_HEATMAP_TOOLTIP = goog.getMsg(
    'A checkbox for controlling whether a Google Fusion Table is to ' +
    'be displayed as a heatmap rather than the default display of ' +
    'individual points, lines, and polygons. An example Google Fusion ' +
    'Table heatmap can be found at http://goo.gl/QUJ5gX');
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
    'click <b>Maps API ID: Details</b> and look for <b>Map ID</b>.');

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

/** @desc Tooltip for the title of a topic. */
cm.MSG_TOPIC_TITLE_TOOLTIP = goog.getMsg('The user-visible name of the topic.');

/** @desc Tooltip for the tags of a topic. */
cm.MSG_TOPIC_TAGS_TOOLTIP = goog.getMsg('A list of tags or labels associated ' +
    'with this topic.');

/** @desc Tooltip for a menu to select one or more layers of map data. */
cm.MSG_LAYER_MENU_TOOLTIP = goog.getMsg('The layers of the current map whose ' +
    'data can be associated with this topic. Use Ctrl+click or Cmd+click ' +
    'to select multiple layers.');

/** @desc Tooltip for the viewport inside which a topic is relevant. */
cm.MSG_TOPIC_VIEWPORT_TOOLTIP = goog.getMsg(
    'The bounding coordinates of the area in which this topic is relevant.');

/** @desc Tooltip for whether or not topic is enabled for crowd reporting. */
cm.MSG_CROWD_ENABLED_TOOLTIP = goog.getMsg('Turns on commenting and, ' +
    'optionally, survey questions for this topic\'s layers.');

/**
 * @desc Tooltip for the radius within which to treat geolocated reports
 * as reports about the same resource (e.g. same gas station, hospital, etc.).
 */
cm.MSG_CLUSTER_RADIUS_TOOLTIP = goog.getMsg('The radius, in meters, within ' +
    'which to treat geolocated reports as reports about the same resource ' +
    '(e.g. same gas station, hospital, etc.).');

/**
 * @desc Tooltip for the definitions of the survey questions associated
 * with this topic.
 */
cm.MSG_QUESTION_LIST_TOOLTIP = goog.getMsg(
    'Definitions of the survey questions associated with this topic.');
