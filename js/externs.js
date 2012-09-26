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
 * @fileoverview Externs (beyond what's already in the public Maps API externs).
 * @author shakusa@google.com (Steve Hakusa)
 */

// TODO(kpy): Remove this when MapDataLayer is in the standard externs file.
google.maps.visualization = {};

/**
 * @constructor
 * @extends {google.maps.MVCObject}
 * @param {Object.<string, *>=} opt_opts
 */
google.maps.visualization.MapDataLayer = function(opt_opts) {};
