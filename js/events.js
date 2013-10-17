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
 * @fileoverview
 *     Unified event handling for DOM events, Closure events, and Maps events.
 *
 *     <p>The common interface to all is:
 *     <pre>
 *         token = cm.events.listen(source, 'foo', handler);
 *         cm.events.emit(source, 'foo');
 *         cm.events.unlisten(token);
 *     </pre>
 *
 *     <p>The <code>source</code> in the above example can be a DOM element,
 *     Closure EventTarget, Maps API object, or any other object.  In all cases
 *     the above code will emit and listen for the right kind of event, and the
 *     handler will be called with one argument whose 'type' property is 'foo'.
 *
 *     <p>You can pass additional properties with an extra argument to emit():
 *     <pre>
 *         cm.events.emit(source, 'foo', {x: 3, y: 'bar'});
 *     </pre>
 *     The handler will be passed the argument {type: 'foo', x: 3, y: 'bar'}.
 *
 *     <p>To forward events from one source to another:
 *     <pre>
 *         cm.events.forward(source, 'foo', nextSource)
 *     </pre>
 *     In this example, each 'foo' event emitted from <code>source</code> will
 *     be re-emitted from <code>nextSource</code>.
 *
 *     <h4>Object disposal</h4>
 *
 *     <p>Listeners that call an object method or forward events through an
 *     object will hold a reference to the object, and thus their existence
 *     will prevent the object from being garbage-collected.  This can lead to
 *     memory leaks or errors: for example, if you intend to get rid of an
 *     object but forget to remove the listeners, the object will still receive
 *     events and may try to act on data that you meant to discard.
 *
 *     <p>To avoid this problem:
 *     <ol>
 *         <li>When you need to bind 'this' in a handler, always provide 'this'
 *             as an extra argument to events.listen, rather than using
 *             goog.bind or some other binding mechanism.  cm.events.listen will
 *             track the listener's held reference to the 'this' object.
 *         <pre>
 *             token = cm.events.listen(source, 'foo', this.onFoo_, this);
 *         </pre>
 *         <li>When you use 'unlisten' to remove a handler, provide the same
 *             'this' object, as an extra argument to cm.events.unlisten.
 *         <pre>
 *             cm.events.unlisten(token, this);
 *         </pre>
 *         <li>Call cm.events.dispose immediately before disposing of an object.
 *             cm.events.dispose will remove all the listeners that were tracked
 *             by cm.events.listen as holding references to the object, thus
 *             allowing the object to be garbage-collected.
 *         <pre>
 *             cm.events.dispose(x);
 *             x = null;
 *         </pre>
 *     </ol>
 *
 *     <h4>Internal details</h4>
 *
 *     <p>Closure events are used when the source is a Closure EventTarget
 *     (goog.events.EventTarget), and Maps events are used in all other cases.
 *
 *     <p>cm.events.emit() wraps the interfaces of google.maps.event.trigger()
 *     and goog.events.EventTarget.dispatchEvent() so that the handler always
 *     receives a single event argument in the same format, regardless of
 *     whether the event was transmitted via the Closure event system or the
 *     Maps API event system.  The function is named emit() because its
 *     signature differs significantly from both dispatchEvent() and trigger().
 *
 * @author kpy@google.com (Ka-Ping Yee)
 */

goog.provide('cm.events');

goog.require('cm');
goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.events.EventTarget');

/**
 * @type {Object}
 */
cm.events = {};

// -------------------------------------------------------------------------
// TODO(kpy): These event type constants probably don't belong here, since
// they're the only part of this whole module that is specific to Crisis Map.

// ==== Events that don't correspond to a specific user action ====

/** A property has changed on a model object that's part of the document. */
cm.events.MODEL_CHANGED = 'MODEL_CHANGED';

/** The client has started sending the current document to the server. */
cm.events.SAVE_STARTED = 'SAVE_STARTED';

/** The attempt to save the document finished successfully. */
cm.events.SAVE_DONE = 'SAVE_DONE';

/** The attempt to save the document failed. */
cm.events.SAVE_FAILED = 'SAVE_FAILED';

/** A set of layers has been added to the map model. */
cm.events.LAYERS_ADDED = 'LAYERS_ADDED';

/** A set of layers has been removed from the map model. */
cm.events.LAYERS_REMOVED = 'LAYERS_REMOVED';

/** The email and permission have been sent and granted. */
cm.events.SHARE_EMAIL_SENT = 'SHARE_EMAIL_SENT';

/** An error occured in sending the email and granting permission. */
cm.events.SHARE_EMAIL_FAILED = 'SHARE_EMAIL_FAILED';

/** The user either performed an undoable command, or clicked on 'Redo' or
 * 'Undo' */
cm.events.UNDO_REDO_BUFFER_CHANGED = 'UNDO_REDO_BUFFER_CHANGED';

// ==== Events emitted when the user performs an edit action ====

/** The user edited the properties of an MVCObject (undoable). */
cm.events.OBJECT_EDITED = 'OBJECT_EDITED';

/** The user requested undo. */
cm.events.UNDO = 'UNDO';

/** The user requested redo. */
cm.events.REDO = 'REDO';

/** The user rearranged the map layers/sublayers (undoable). */
cm.events.LAYERS_ARRANGED = 'LAYERS_ARRANGED';

/**
 * The user requested to create one or more new layers from an array of layer
 * maproots (undoable).
 */
cm.events.ADD_LAYERS = 'ADD_LAYERS';

/**
 * The user requested to create a new layer from a set of properties (undoable).
 */
cm.events.NEW_LAYER = 'NEW_LAYER';

/** The user set the current view as the default view. */
cm.events.DEFAULT_VIEW_SET = 'DEFAULT_VIEW_SET';

// ==== Events emitted when the user performs a non-editing action ====

/** The user requested to save the document. */
cm.events.SAVE = 'SAVE';

/** The user requested to open an inspector on an object (not undoable). */
cm.events.INSPECT = 'INSPECT';

/** The user has opened or closed the inspector dialog. */
cm.events.INSPECTOR_VISIBLE = 'INSPECTOR_VISIBLE';

/** The user requested to arrange the layers in the panel (not undoable). */
cm.events.ARRANGE = 'ARRANGE';

/** The user requested to open the "Share this view" dialog. */
cm.events.SHARE_BUTTON = 'SHARE_BUTTON';

/** The user requested to open the "Share via e-mail" dialog. */
cm.events.SHARE_EMAIL = 'SHARE_EMAIL';

/** The user requested to change the opacity of a layer. */
cm.events.CHANGE_OPACITY = 'CHANGE_OPACITY';

// TODO(rew): the presenter should listen to this and upstate AppState
// with the currently selected tab
/** The user changed the selection in a tab view. */
cm.events.TAB_SELECTION_CHANGED = 'TAB_SELECTION_CHANGED';

/** The user requested to toggle whether a layer is enabled (not undoable). */
cm.events.TOGGLE_LAYER = 'TOGGLE_LAYER';

/** The user requested to zoom the viewport to a layer (not undoable). */
cm.events.ZOOM_TO_LAYER = 'ZOOM_TO_LAYER';

/** The user changed the zoom level of the map. */
cm.events.ZOOM_CHANGED = 'ZOOM_CHANGED';

/**
 * The user chose an option from the time series sublayer picker (not
 * undoable).
 */
cm.events.SELECT_SUBLAYER = 'SELECT_SUBLAYER';

/** The user requested to delete a layer (undoable). */
cm.events.DELETE_LAYER = 'DELETE_LAYER';

/**
 * Information about a feature that's carried with the SELECT_FEATURE event.
 * @typedef {{layerId: string, title: string, snippet: string, content: Element,
 *            position: google.maps.LatLng, pixelOffset: google.maps.Size}}
 */
cm.events.FeatureData;

/**
 * The user selected a feature on the map.  A FeatureData object is passed
 * with this type of event.
 */
cm.events.SELECT_FEATURE = 'SELECT_FEATURE';

/** The user deselected the currently selected feature on the map. */
cm.events.DESELECT_FEATURE = 'DESELECT_FEATURE';

/** The user requested to add/import layers. */
cm.events.IMPORT = 'IMPORT';

/** The user requested to reset the view to the map's default view. */
cm.events.RESET_VIEW = 'RESET_VIEW';

/** The user pressed the my location button. */
cm.events.GO_TO_MY_LOCATION = 'GO_TO_MY_LOCATION';

/** The user changed the query for filtering layers. */
cm.events.FILTER_QUERY_CHANGED = 'FILTER_QUERY_CHANGED';

/** The set of layers matched by layer filtering changed. */
cm.events.FILTER_MATCHES_CHANGED = 'FILTER_MATCHES_CHANGED';

// NOTE(kpy): Everything below this line is not specific to Crisis Map.
// -------------------------------------------------------------------------


/**
 * The name of the internal object property used to track referring listeners.
 * Each listener that holds a reference to X (i.e. whose handler binds 'this'
 * to X) will be tracked in an array at X[events.REFERRING_LISTENERS_PROPERTY],
 * so that events.dispose can remove them to enable garbage collection.
 */
cm.events.REFERRING_LISTENERS_PROPERTY = '__referring_listeners__';

/**
 * A token representing a listener (this is either a Closure "listener key" or
 * a Maps API MapsEventListener).  Note: the type google.maps.MapsEventListener
 * is not actually exposed (it's obfuscated in the Maps API JavaScript), so
 * it can only be used in Closure type annotations, not in code.
 * @typedef {number|google.maps.MapsEventListener}
 */
cm.events.ListenerToken;

/**
 * Listen for events emitted from an object.
 * @param {Object|Array.<Object>} source The object whose events to listen to
 *     (a DOM element, Closure EventTarget, Maps API object, or any other kind
 *     of object), or an array of objects to listen to.
 * @param {string|Array.<string>} type Event type or array of event types.
 * @param {!Function} handler A function to handle the event.
 * @param {Object=} opt_obj An object to bind 'this' to within the handler.
 * @return {cm.events.ListenerToken|Array.<cm.events.ListenerToken>} A token or
 *     tokens that can be later used to remove the added listener or listeners.
 *     This will be an array if and only if source or type was an array.
 */
cm.events.listen = function(source, type, handler, opt_obj) {
  var sources = goog.isArray(source) ? source : [source];
  var types = goog.isArray(type) ? type : [type];
  if (opt_obj) {
    handler = goog.bind(handler, opt_obj);
  }
  var tokens = /** @type Array.<cm.events.ListenerToken> */([]);
  for (var s = 0; s < sources.length; s++) {
    var listen = (sources[s] instanceof goog.events.EventTarget) ?
        goog.events.listen :  // Closure event system
        (sources[s].addEventListener || sources[s].attachEvent /* for IE */) ?
            google.maps.event.addDomListener :  // DOM event system
            google.maps.event.addListener;  // Maps API event system
    for (var t = 0; t < types.length; t++) {
      tokens.push(listen(sources[s], types[t], handler));
    }
  }
  if (opt_obj) {
    // Keep track of listeners so cm.events.dispose() can remove them.
    if (!(cm.events.REFERRING_LISTENERS_PROPERTY in opt_obj)) {
      opt_obj[cm.events.REFERRING_LISTENERS_PROPERTY] = [];
    }
    goog.array.extend(opt_obj[cm.events.REFERRING_LISTENERS_PROPERTY], tokens);
  }
  return (goog.isArray(source) || goog.isArray(type)) ? tokens : tokens[0];
};

/**
 * @param {cm.events.ListenerToken|Array.<cm.events.ListenerToken>} token
 *     A listener token or array of tokens, as returned by cm.events.listen.
 * @param {Object=} opt_obj The object bound to 'this' in the handlers of the
 *     specified listeners (i.e. the opt_obj that was passed to
 *     cm.events.listen).
 */
cm.events.unlisten = function(token, opt_obj) {
  var tokens = goog.isArray(token) ? token : [token];
  for (var i = 0; token = tokens[i]; i++) {
    if (goog.isNumber(tokens[i]) || tokens[i] instanceof goog.events.Listener) {
      goog.events.unlistenByKey(tokens[i]);  // Closure listener key.
    } else {
      google.maps.event.removeListener(tokens[i]);
    }
    if (opt_obj) {
      // Lingering MapsEventListener references will prevent MapsEventListeners
      // from being garbage-collected, so we need to clean them up.
      goog.array.remove(
          opt_obj[cm.events.REFERRING_LISTENERS_PROPERTY] || [], token);
    }
  }
};

/**
 * Mangles a key into an event name exactly as google.maps.MVCObject does.
 * @param {string} key A property key.
 * @return {string} The name of the MVCObject event for the property change.
 */
cm.events.mvcObjectKeyToEventType = function(key) {
  return key.toLowerCase() + '_changed';
};

/**
 * Listens for property change events on a google.maps.MVCObject.  Holds a lock
 * while each change handler is active, in order to prevent endless recursion.
 * @param {google.maps.MVCObject|Array.<google.maps.MVCObject>} mvcObject
 *     A Maps API MVCObject or array of MVCObjects.
 * @param {string|Array.<string>} key Property key or array of property keys.
 * @param {!function(string)} handler A function to handle the change event.
 *     The function will be called with the key of the changed property,
 *     and will not be called recursively.
 * @param {Object=} opt_obj An object to bind 'this' to within the handler.
 * @return {cm.events.ListenerToken|Array.<cm.events.ListenerToken>} A token or
 *     tokens that can be later used to remove the added listener or listeners.
 */
cm.events.onChange = function(mvcObject, key, handler, opt_obj) {
  var mvcObjects = goog.isArray(mvcObject) ? mvcObject : [mvcObject];
  var keys = goog.isArray(key) ? key : [key];
  var tokens = /** @type Array.<cm.events.ListenerToken> */([]);
  for (var i = 0; i < mvcObjects.length; i++) {
    // We use forEach to create a new closure for each key so that each key
    // gets its own handlerActive variable (see below).
    goog.array.forEach(keys, function(key) {
      // Unfortunately, MVCObject triggers change events even when the property
      // doesn't change.  We don't want this because it causes endless recursion
      // if handlers are used to synchronize properties with non-Maps entities.
      var type = cm.events.mvcObjectKeyToEventType(key);
      var handlerActive = false;
      tokens.push(cm.events.listen(mvcObjects[i], type, function() {
        if (!handlerActive) {  // prevent recursion
          handlerActive = true;
          handler.call(this, key);
          handlerActive = false;
        }
      }, opt_obj));
    });
  }
  return (goog.isArray(mvcObject) || goog.isArray(key)) ? tokens : tokens[0];
};

/**
 * Emits an event.  If the source is a Closure EventTarget, emits a Closure
 * event; otherwise emits a DOM or Maps event using the Maps API.  In all cases
 * listeners will be called with a single argument that contains a 'type'
 * property and any additional properties in opt_properties.
 * (Note: if this code is compiled by the Closure compiler, the property name
 * 'type' will be renamed.  Therefore, it should be accessed as event.type, not
 * event['type'], and property names in opt_properties should also be unquoted,
 * to prevent collision with the renamed 'type' property.)
 * @param {Object} source The object from which to emit the event (a DOM
 *     element, Closure EventTarget, Maps API object, or any other object).
 * @param {string} type Event type.
 * @param {Object=} opt_properties Additional properties to pass to listeners.
 */
cm.events.emit = function(source, type, opt_properties) {
  var event = goog.object.clone(opt_properties || {});
  event.type = type;
  if (source instanceof goog.events.EventTarget) {  // Closure event
    source.dispatchEvent(event);
  } else {  // DOM event or Maps API event
    google.maps.event.trigger(source, type, event);
  }
};

/**
 * Listens for DOM events, Closure events, or Maps API events, and re-emits
 * them from a new source.
 * @param {Object} source The source of the events to be forwarded.
 * @param {string|Array.<string>} type Event type or array of event types.
 * @param {Object} nextSource The object from which to re-emit the event (a DOM
 *     element, Closure EventTarget, Maps API object, or any other object).
 * @param {string=} opt_newType If specified, emit a new event of this type
 *     instead of re-emitting the same event that was received.
 * @param {Object=} opt_newProperties If specified, use these properties for
 *     the new event instead of passing on the original event's properties.
 * @return {cm.events.ListenerToken|Array.<cm.events.ListenerToken>} A token or
 *     tokens that can be later used to remove the added listener or listeners.
 */
cm.events.forward = function(source, type,
                             nextSource, opt_newType, opt_newProperties) {
  var types = goog.isArray(type) ? type : [type];
  var tokens = /** @type Array.<cm.events.ListenerToken> */([]);
  goog.array.forEach(types, function(type) {
    tokens.push(cm.events.listen(source, type, function(event) {
      cm.events.emit(this, opt_newType || type, opt_newProperties || event);
    }, nextSource));
  });
  return goog.isArray(type) ? tokens : tokens[0];
};

/**
 * Removes all the listeners whose handlers have 'this' bound to obj.  Typical
 * usage is to call just before disposal, e.g. cm.events.dispose(x); x = null.
 * @param {Object} obj The object that is about to be disposed.
 */
cm.events.dispose = function(obj) {
  cm.events.unlisten(obj[cm.events.REFERRING_LISTENERS_PROPERTY] || []);
  obj[cm.events.REFERRING_LISTENERS_PROPERTY] = [];
};
