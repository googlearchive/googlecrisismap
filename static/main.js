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
 * @fileoverview The main entry point for displaying a map.
 * @author arb@google.com (Anthony Baxter)
 */

/**
 * Callback function for loading a map via JSONP.
 * @param {Object} maproot A map description in Maproot format.
 */
function initMap(maproot) {
  initialize(maproot, 'cm-frame', '/crisismap/js/compiled',
             cm_config.map_catalog, cm_config,
             cm_config.label, cm_config.ui_lang);
}

/** The main entry point for displaying a map. */
function main() {
  // In dev, the 'maproot_url' query param causes map data to be fetched from
  // a URL; otherwise we use cm_config.map_root, pulled from the datastore.
  if (cm_config.maproot_url) {
    var script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', '/crisismap/jsonp?callback=initMap' +
        '&hl=' + encodeURIComponent(cm_config.ui_lang) +
        '&url=' + encodeURIComponent(cm_config.maproot_url));
    document.getElementsByTagName('head')[0].appendChild(script);
  } else {
    initMap(cm_config.map_root);
  }
}
