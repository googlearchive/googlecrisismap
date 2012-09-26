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
 * @fileoverview [MODULE: edit] Export declarations.
 * @author kpy@google.com (Ka-Ping Yee)
 */
goog.require('cm.ArrangeView');
goog.require('cm.EditPresenter');
goog.require('cm.InspectorView');
goog.require('cm.LayerDragHandler');
goog.require('cm.ToolbarView');
goog.require('goog.module');

// One provide() line for each object to export.
goog.module.provide('edit', 'cm.ArrangeView', cm.ArrangeView);
goog.module.provide('edit', 'cm.EditPresenter', cm.EditPresenter);
goog.module.provide('edit', 'cm.InspectorView', cm.InspectorView);
goog.module.provide('edit', 'cm.LayerDragHandler', cm.LayerDragHandler);
goog.module.provide('edit', 'cm.ToolbarView', cm.ToolbarView);

// Last, announce that the module has finished loading.
goog.module.provide('edit');
