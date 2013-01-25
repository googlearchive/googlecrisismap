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


function EventsTest() {
  cm.TestBase.call(this);
  this.source_ = {me: 'SOURCE'};
  this.closureTarget_ = new goog.events.EventTarget();
  this.mvcObject_ = new google.maps.MVCObject();
  this.handler_ = createMockFunction('handler');
}
EventsTest.prototype = new cm.TestBase();
registerTestSuite(EventsTest);

/**
 * Tests cm.events.listen using the maps event system.
 */
EventsTest.prototype.listenMapsEvent = function() {
  cm.events.listen(this.source_, 'click', this.handler_);

  expectCall(this.handler_)('arg1', 'arg2');
  google.maps.event.trigger(this.source_, 'click', 'arg1', 'arg2');
};

/**
 * Tests cm.events.listen using the maps event system for a non-IE DOM element.
 */
EventsTest.prototype.listenMapsDomEvent = function() {
  this.source_.addEventListener = createMockFunction('addEventListener');

  expectCall(this.source_.addEventListener)('click', this.handler_, undefined);
  cm.events.listen(this.source_, 'click', this.handler_);

  expectCall(this.handler_)('arg1', 'arg2');
  google.maps.event.trigger(this.source_, 'click', 'arg1', 'arg2');
};

/**
 * Tests cm.events.listen using the maps event system for an IE DOM element.
 */
EventsTest.prototype.listenMapsDomEventIE = function() {
  this.source_.attachEvent = createMockFunction('attachEvent');

  // The argument to attachEvent is a wrapped function. Just checking that
  // this.handler_ is called on trigger.
  expectCall(this.source_.attachEvent)('onclick', _);
  cm.events.listen(this.source_, 'click', this.handler_);

  expectCall(this.handler_)('arg1', 'arg2');
  google.maps.event.trigger(this.source_, 'click', 'arg1', 'arg2');
};

/** Tests cm.events.listen using the Closure event system. */
EventsTest.prototype.listenClosureEvent = function() {
  cm.events.listen(this.closureTarget_, 'click', this.handler_);

  // Closure events contain a lot of properties. Instead of writing a
  // "recursivelyContains" matcher, just check the expected contents.
  expectCall(this.handler_)(_)
      .willOnce(function(event) {
        expectEq('click', event.type);
        expectEq('dog', event.prop1);
      });
  this.closureTarget_.dispatchEvent({type: 'click', prop1: 'dog'});
};

/**
 * Tests multiple listeners are set up when an array of event types is passed
 * to cm.events.listen.
 */
EventsTest.prototype.listenMultipleTypes = function() {
  cm.events.listen(this.source_, ['event1', 'event2'], this.handler_);

  expectCall(this.handler_)('cat');
  google.maps.event.trigger(this.source_, 'event2', 'cat');

  expectCall(this.handler_)('dog');
  google.maps.event.trigger(this.source_, 'event1', 'dog');
};

/**
 * Tests multiple listeners are set up when an array of sources is passed
 * to cm.events.listen.
 */
EventsTest.prototype.listenMultipleSources = function() {
  var source1 = {}, source2 = {};
  cm.events.listen([source1, source2], 'click', this.handler_);

  expectCall(this.handler_)('cat');
  google.maps.event.trigger(source1, 'click', 'cat');

  expectCall(this.handler_)('dog');
  google.maps.event.trigger(source2, 'click', 'dog');
};

/**
 * Tests the handler is bound to the object passed to cm.events.listen.
 */
EventsTest.prototype.listenObject = function() {
  var obj = {me: 'OBJECT'};

  cm.events.listen(this.source_, 'click', this.handler_, obj);

  expectCall(this.handler_)()
      .willOnce(function() { expectRef(obj, this); });
  google.maps.event.trigger(this.source_, 'click');
};

/**
 * Tests that the event handler is not called after unlisten is called (using
 * the maps event system).
 */
EventsTest.prototype.unlistenMapsEvent = function() {
  var token = cm.events.listen(this.source_, 'click', this.handler_);
  cm.events.unlisten(token);

  // Expect no calls to this.handler_.
  google.maps.event.trigger(this.source_, 'click');
};

/**
 * Tests that the event handler is not called after unlisten is called (using
 * the closure event system).
 */
EventsTest.prototype.unlistenClosureEvent = function() {
  var token = cm.events.listen(this.closureTarget_, 'click', this.handler_);
  cm.events.unlisten(token);

  // Expect no calls to this.handler_.
  this.closureTarget_.dispatchEvent({type: 'click', prop1: 'dog'});
};

/**
 * Tests that a listener is removed and the referring listeners array cleared
 * when cm.events.unlisten is called with an object.
 */
EventsTest.prototype.unlistenObject = function() {
  var obj = {me: 'OBJECT'};

  var token = cm.events.listen(this.source_, 'click', this.handler_, obj);
  expectThat(obj[cm.events.REFERRING_LISTENERS_PROPERTY], elementsAre([token]));

  cm.events.unlisten(token, obj);

  google.maps.event.trigger(this.source_, 'click');

  expectThat(obj[cm.events.REFERRING_LISTENERS_PROPERTY], elementsAre([]));
};

/**
 * Tests that multiple listeners are set up when an array of sources and
 * an array of types are passed to cm.events.listen, and that the listeners
 * can all be removed.
 */
EventsTest.prototype.unlistenMultipleSourcesAndTypes = function() {
  var source1 = {}, source2 = {};
  var tokens = cm.events.listen(
      [source1, source2], ['event1', 'event2'], this.handler_);

  expectEq(4, tokens.length);

  expectCall(this.handler_)('cat');
  google.maps.event.trigger(source1, 'event1', 'cat');

  expectCall(this.handler_)('dog');
  google.maps.event.trigger(source1, 'event2', 'dog');

  expectCall(this.handler_)('bird');
  google.maps.event.trigger(source2, 'event1', 'bird');

  expectCall(this.handler_)('fish');
  google.maps.event.trigger(source2, 'event2', 'fish');

  // After unlistening, none of the events should trigger the handler.
  cm.events.unlisten(tokens);

  this.handler_ = function() {
    throw new Error('Unexpected event');
  };
  google.maps.event.trigger(source1, 'event1', 'cat');
  google.maps.event.trigger(source1, 'event2', 'dog');
  google.maps.event.trigger(source2, 'event1', 'bird');
  google.maps.event.trigger(source2, 'event2', 'fish');
};

/** Tests that onChange properly attaches a listener to a single property. */
EventsTest.prototype.onChange = function() {
  this.mvcObject_.set('key', 'old');
  cm.events.onChange(this.mvcObject_, 'key', this.handler_);

  expectCall(this.handler_)('key');
  this.mvcObject_.set('key', 'new');
};

/** Tests that onChange prevents the handler from triggering itself. */
EventsTest.prototype.onChangeDoesNotRecurse = function() {
  var obj = this.mvcObject_;
  obj.set('key1', 'a');
  obj.set('key2', 'b');

  // Set up a cyclic dependency between two handlers.
  var handler1Calls = 0;
  cm.events.onChange(obj, 'key1', function(key, value) {
    handler1Calls++;
    obj.set('key2', obj.get('key1'));
  });
  var handler2Calls = 0;
  cm.events.onChange(obj, 'key2', function(key, value) {
    handler2Calls++;
    obj.set('key1', obj.get('key2'));
  });

  // Each handler should get called just once.
  this.mvcObject_.set('key1', 'new');
  expectEq(1, handler1Calls);
  expectEq(1, handler2Calls);

  // Each handler should get called just once more.
  this.mvcObject_.set('key2', 'foo');
  expectEq(2, handler1Calls);
  expectEq(2, handler2Calls);
};

/** Tests that onChange properly attaches a listener to multiple properties. */
EventsTest.prototype.onChangeArray = function() {
  this.mvcObject_.set('magic', 1);
  this.mvcObject_.set('dream', 2);
  cm.events.onChange(this.mvcObject_, ['magic', 'dream'], this.handler_);

  expectCall(this.handler_)('magic');
  this.mvcObject_.set('magic', 3);

  expectCall(this.handler_)('dream');
  this.mvcObject_.set('dream', 4);
};

/** Tests that onChange properly binds 'this' when attaching a listener. */
EventsTest.prototype.onChangeObject = function() {
  var obj = {};
  cm.events.onChange(this.mvcObject_, 'x', this.handler_, obj);

  expectCall(this.handler_)('x')
      .willOnce(function() { expectRef(obj, this); });
  this.mvcObject_.set('x', 'foo');
};

/**
 * Tests that emit causes a Google Maps style event to be triggered on the
 * specified source object.
 */
EventsTest.prototype.emitMapsEvent = function() {
  google.maps.event.addListener(this.source_, 'click', this.handler_);

  expectCall(this.handler_)({type: 'click'});
  cm.events.emit(this.source_, 'click');
};

/**
 * Tests that emit causes a Closure style event to be triggered on the specified
 * source object if it inherits from Closure's EventTarget.
 */
EventsTest.prototype.emitClosureEvent = function() {
  goog.events.listen(this.closureTarget_, 'click', this.handler_);

  expectCall(this.handler_)(_)
      .willOnce(function(event) {
        expectEq('click', event.type);
      });
  cm.events.emit(this.closureTarget_, 'click');
};

/**
 * Tests that the properties passed to emit are passed through to the event
 * handler.
 */
EventsTest.prototype.emitMapsEventWithProperties = function() {
  google.maps.event.addListener(this.source_, 'mousemove', this.handler_);

  expectCall(this.handler_)({type: 'mousemove', prop1: 'dog', prop2: 'cat'});
  cm.events.emit(this.source_, 'mousemove', {prop1: 'dog', prop2: 'cat'});
};

/**
 * Tests that the properties passed to emit are passed through to a Closure
 * style event's handler.
 */
EventsTest.prototype.emitClosureEventWithProperties = function() {
  goog.events.listen(this.closureTarget_, 'click', this.handler_);

  expectCall(this.handler_)(_)
      .willOnce(function(event) {
        expectEq('click', event.type);
        expectEq('cat', event.prop1);
        expectEq('dog', event.prop2);
      });
  cm.events.emit(this.closureTarget_, 'click', {prop1: 'cat', prop2: 'dog'});
};

/**
 * Tests that Maps events are forwarded using cm.events.forward if neither the
 * source nor the target is a Closure EventTarget.
 */
EventsTest.prototype.forwardMapsEvent = function() {
  cm.events.listen(this.source_, 'mousemove', this.handler_);

  var originalSource = {me: 'ORIGINAL'};
  cm.events.forward(originalSource, 'mousemove', this.source_);

  expectCall(this.handler_)({type: 'mousemove'});
  cm.events.emit(originalSource, 'mousemove');
};

/**
 * Tests that events are converted from Maps events to Closure events if the
 * source of forward is not a Closure EventTarget and the target is.
 */
EventsTest.prototype.forwardMapsToClosureEvent = function() {
  cm.events.listen(this.closureTarget_, 'mousemove', this.handler_);

  cm.events.forward(this.source_, 'mousemove', this.closureTarget_);

  expectCall(this.handler_)(_)
      .willOnce(function(event) {
        expectEq('mousemove', event.type);
      });
  cm.events.emit(this.source_, 'mousemove');
};

/**
 * Tests that events are converted from Closure events to Maps events if the
 * source of forward is a Closure EventTarget and the target is not.
 */
EventsTest.prototype.forwardClosureToMapsEvent = function() {
  cm.events.listen(this.source_, 'mousemove', this.handler_);

  cm.events.forward(this.closureTarget_, 'mousemove', this.source_);

  expectCall(this.handler_)(_)
      .willOnce(function(event) {
        expectEq('mousemove', event.type);
      });
  cm.events.emit(this.closureTarget_, 'mousemove');
};

/**
 * Tests that multiple events are forwarded if an array of event types is
 * specified.
 */
EventsTest.prototype.forwardArray = function() {
  var handler1 = createMockFunction('handler1');
  var handler2 = createMockFunction('handler2');
  cm.events.listen(this.source_, 'mouseover', handler1);
  cm.events.listen(this.source_, 'mouseout', handler2);

  var originalSource = {me: 'ORIGINAL'};
  cm.events.forward(originalSource, ['mouseover', 'mouseout'], this.source_);

  expectCall(handler1)({type: 'mouseover'});
  cm.events.emit(originalSource, 'mouseover');

  expectCall(handler2)({type: 'mouseout'});
  cm.events.emit(originalSource, 'mouseout');
};

/**
 * Tests that the event type changes if a second type is specified in forward.
 */
EventsTest.prototype.forwardNewType = function() {
  cm.events.listen(this.source_, 'newType', this.handler_);

  var originalSource = {me: 'ORIGINAL'};
  cm.events.forward(originalSource, 'type', this.source_, 'newType');

  expectCall(this.handler_)({type: 'newType'});
  cm.events.emit(originalSource, 'type');
};

/**
 * Tests that new properties are added to a forwarded event.
 */
EventsTest.prototype.forwardNewProperties = function() {
  cm.events.listen(this.source_, 'type', this.handler_);

  var originalSource = {me: 'ORIGINAL'};
  cm.events.forward(originalSource, 'type', this.source_, null, {prop1: 'dog'});

  expectCall(this.handler_)({prop1: 'dog', type: 'type'});
  cm.events.emit(originalSource, 'type');
};

/**
 * Tests that dispose causes all event listeners to be removed and the
 * REFERRING_LISTENERS_PROPERTY object to be cleared.
 */
EventsTest.prototype.dispose = function() {
  var obj = {me: 'OBJECT'};
  cm.events.listen(this.source_, ['type1', 'type2'], this.handler_, obj);

  cm.events.dispose(obj);

  // No calls to handler after event has been disposed of.
  cm.events.emit(this.source_, 'type1');
  cm.events.emit(this.source_, 'type2');
  expectThat(obj[cm.events.REFERRING_LISTENERS_PROPERTY], elementsAre([]));
};
