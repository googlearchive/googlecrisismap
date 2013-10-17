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

// Author: arb@google.com (Anthony Baxter)

/**
 * A fake for a DOM Element object.  These fakes are used in gjstest tests.
 * @param {string} nodeName The name of the newly created node.
 * @param {Object} opt_attrs The attributes of the newly created node.
 * @constructor
 */
FakeElement = function(nodeName, opt_attrs) {
  this.nodeName = nodeName.match(/^#/) ? nodeName : nodeName.toUpperCase();
  this.nodeType = nodeName.match(/^#/) ? 0 : 1;
  this.id = '';
  this.className = '';
  this.value = '';  // For pretend input objects
  this.attrs_ = {};
  this.style = {};
  if (opt_attrs) {
    for (var name in opt_attrs) {
      if (name === 'style' && !goog.isString(opt_attrs['style'])) {
        goog.object.extend(this.style, opt_attrs['style']);
      }
      this.setAttribute(name, opt_attrs[name]);
    }
  }
  this.firstChild = null;
  this.lastChild = null;
  this.previousSibling = null;
  this.nextSibling = null;
  this.childNodes = [];
  this.selectedIndex = -1;
  this.options = this.childNodes; // For pretend select objects
  this.ownerDocument = cm.ui.document;
  this.innerHTML = '';
  FakeElement.elementsById_[this.id] = this;
};

/**
 * A map of all FakeElements by their DOM element ID.
 * @private
 */
FakeElement.elementsById_ = {};

/**
 * Creates and returns copy of this FakeElement.
 * @param {boolean} deepCopy Whether or not to recursively copy this element's
 *     descendants.
 * @return {FakeElement} The copy.
 */
FakeElement.prototype.cloneNode = function(deepCopy) {
  var el = new FakeElement(this.nodeName, this.attrs_);
  if (deepCopy) {
    goog.array.forEach(this.childNodes, function(child) {
      el.appendChild(child.cloneNode(true));
    });
  }
  return el;
};

/**
 * Displays the hierarchy under this element, for debugging.
 * @return {string} An indented tree diagram of the fake DOM hierarchy,
 *     starting from this element and showing all its descendants.  Text nodes
 *     are shown on their own line with their content in quotation marks;
 *     innerHTML content is shown on the same line immediately following a tag.
 */
FakeElement.prototype.toString = function() {
  if (this.nodeName === '#text') {
    return '\n"' + this.textContent + '"';
  }

  // Sync {@code this.attrs_} to the corresponding attributes.
  if (this.className) {
    this.attrs_['class'] = this.className;
  }
  if (this.href) {
    this.attrs_['href'] = this.href;
  }
  if (this.id) {
    this.attrs_['id'] = this.id;
  }
  if (this.src) {
    this.attrs_['src'] = this.src;
  }

  var parts = [this.nodeName];
  for (var name in this.attrs_) {
    var value;
    if (name === 'style' && !goog.isString(this.attrs_['style'])) {
      value = '';
      for (key in this.style) {
        value += goog.string.format(
            '%s: %s;', goog.string.toSelectorCase(key), this.style[key]);
      }
    } else {
      value = this.attrs_[name];
    }
    parts.push(name + '="' + value + '"');
  }
  if (this.selectedIndex >= 0) {
    parts.push('selectedIndex="' + this.selectedIndex + '"');
  }
  var children = '';
  for (var i = 0; i < this.childNodes.length; i++) {
    children += this.childNodes[i].toString();
  }
  // The .replace() calls below are designed to draw an ASCII tree like this:
  // <UL>
  // |-<LI>
  // | '-"one"
  // '-<LI>
  //   '-"two"
  //
  // To create this tree, each line is indented in one of three ways:
  // 1. All immediate children but the last are indented with "|-".
  // 2. The last immediate child is indented with "'-".
  // 3. Other descendants before the last child are indented with "| ".
  // 4. Other descendants after the last child are indented with "  ".
  var indentedChildren = children
      .replace(/\n([ |'])/g, '\n| $1')  // indent grandkids with a bar on left
      .replace(/\n([<"])/g, '\n|-$1')  // draw lines to immediate children
      .replace(/^([\s\S]*\n)\|-([\s\S]*)$/,  // remove bars below last child
               function(all, before, after) {
                 return before + "'-" + after.replace(/\n\|/g, '\n ');
               });

  return '\n<' + parts.join(' ') + '>' + (this.innerHTML || indentedChildren);
};

/**
 * Fake implementation of getAttribute.
 * @param {string} name The attribute's name.
 * @return {string} The attribute's value.
 */
FakeElement.prototype.getAttribute = function(name) {
  return this.attrs_[name];
};

/**
 * Fake implementation of getAttributeNode, used by
 * goog.dom.isFocusableTabIndex().
 * @param {string} name The attribute's name.
 * @return {string} The attribute name and value as an object.
 */
FakeElement.prototype.getAttributeNode = function(name) {
  return {'name': name, 'value': this.attrs_[name]};
};

/**
 * Fake implementaiton of getElementsByTagName, used by goog.ui.TabBar.
 * @param {string} name The name of the tag being sought.
 * @return {Array.<FakeElement>}
 */
FakeElement.prototype.getElementsByTagName = function(name) {
  var result = [];
  for (var i = 0; i < this.childNodes.length; i++) {
    var child = this.childNodes[i];
    if (child.nodeName === name) {
      result.push(child);
    }
    result.concat(child.getElementsByTagName(name));
  }
  return result;
};

/**
 * Fake implementation of setAttribute.
 * @param {string} name The attribute's name.
 * @param {string} value The attribute's value.
 */
FakeElement.prototype.setAttribute = function(name, value) {
  this.attrs_[name] = value;
  if (name === 'class') {
    this.className = value;
  }
  if (name === 'id' || name === 'href' || name === 'src' || name === 'value') {
    this[name] = value;
  }
};

/**
 * Fake implementation of removeAttribute.
 * @param {string} name The attribute's name.
 */
FakeElement.prototype.removeAttribute = function(name) {
  delete this.attrs_[name];
  if (name === 'class') {
    this.className = '';
  }
  if (name === 'id' || name === 'href' || name === 'src' || name === 'value') {
    this[name] = '';
  }
};

/**
 * Fake implementation of removeChild.
 * @param {string} element The child element.
 */
FakeElement.prototype.removeChild = function(element) {
  expectTrue(goog.array.remove(this.childNodes, element));
  var n = this.childNodes.length;
  if (this.nodeName === 'SELECT' && !n) {
    this.selectedIndex = -1;
  }
  this.firstChild = n ? this.childNodes[0] : null;
  this.lastChild = n ? this.childNodes[n - 1] : null;
  if (element.previousSibling) {
    element.previousSibling.nextSibling = null;
    element.previousSibling = null;
  }
  if (element.nextSibling) {
    element.nextSibling.previousSibling = null;
    element.nextSibling = null;
  }
  element.parentNode = null;
};

/**
 * Fake implementation of appendChild.
 * @param {string} element The child element.
 */
FakeElement.prototype.appendChild = function(element) {
  this.childNodes.push(element);
  this.firstChild = this.childNodes[0];
  this.lastChild = element;
  element.parentNode = this;
  var length = this.childNodes.length;
  if (length > 1) {
    var previous = this.childNodes[length - 2];
    element.previousSibling = previous;
    previous.nextSibling = element;
  }
  if (this.nodeName === 'SELECT' && this.selectedIndex === -1) {
    this.selectedIndex = 0;
  }
};

 /**
  * Fake implementation of insertBefore.
  * @param {string} element The child element.
  * @param {string} referenceElement The sibling element.
  */
FakeElement.prototype.insertBefore = function(element, referenceElement) {
  var i = 0;
  while (i < this.childNodes.length &&
         this.childNodes[i] !== referenceElement)
  {
    i++;
  }
  this.childNodes.splice(i, 0, element);
  this.firstChild = this.childNodes[0];
  this.lastChild = this.childNodes[this.childNodes.length - 1];
  element.parentNode = this;
  if (i > 0) {
    var previous = this.childNodes[i - 1];
    element.previousSibling = previous;
    previous.nextSibling = element;
  }
  if (this.lastChild !== element) {
    element.nextSibling = referenceElement;
    referenceElement.previousSibling = element;
  }
  if (this.nodeName === 'SELECT' && this.selectedIndex === -1) {
    this.selectedIndex = 0;
  }
};

/**
 * Fake attachEvent - needed by various Closure internals.
 * TODO(arb): figure out if we can get rid of this, somehow.
 * @param {string|Array.<string>} eventObj Event type or array of event types.
 * @param {!Function} handler A function to handle the event.
 */
FakeElement.prototype.attachEvent = function(eventObj, handler) {
  // TODO(arb): do we want to do anything with this?
};

/**
 * Fake detachEvent - needed by various Closure internals.
 * @param {string|Array.<string>} eventObj Event type or array of event types.
 * @param {!Function} handler A function to handle the event.
 */
FakeElement.prototype.detachEvent = function(eventObj, handler) {
  // TODO(arb): do we want to do anything with this?
};

/**
 * Fake focus method.
 */
FakeElement.prototype.focus = goog.nullFunction;

/** A namespace for fake implementations of cm.ui functions. */
FakeUi = {};

/**
 * Fake implementation of cm.ui.get.
 * @param {string} id A DOM element ID.
 * @return {FakeElement} The element with the given ID.
 */
FakeUi.get = function(id) {
  return FakeElement.elementsById_[id];
};

/**
 * Fake implementation of cm.ui.getByClass.
 * @param {string} className A class name.
 * @param {?FakeElement} opt_parent A DOM element to look in.
 * @return {FakeElement} The first element with the given class name, if found.
 */
FakeUi.getByClass = function(className, opt_parent) {
  var elems = FakeUi.getAllByClass(className, opt_parent);
  return elems[0] ? elems[0] : null;
};

/**
 * Fake implementation of cm.ui.getAllByClass.
 * @param {string} className A class name.
 * @param {?FakeElement} opt_parent A DOM element to look in.
 * @return {Array.<FakeElement>} The elements with the given class name.
 */
FakeUi.getAllByClass = function(className, opt_parent) {
  return allDescendantsOf(opt_parent || cm.ui.document, withClass(className));
};

/**
 * Creates a new child for a newly created FakeElement
 * @param {FakeElement} newElement The newly created element.
 * @param {string|Element|cm.Html} newChild The new child to append.
 * @private
 */
FakeUi.createChildHelper_ = function(newElement, newChild) {
  if (typeof(newChild) === 'string') {
    var child = new FakeElement('#text');
    child.textContent = newChild;
    newElement.appendChild(child);
  } else if (newChild instanceof cm.Html) {
    newChild.pasteInto(newElement);
  } else if (newChild) {
    newElement.appendChild(newChild);
  }
};

/**
 * Fake implementation of cm.ui.create.
 * @param {string} tag The tag name of the element to create.
 * @param {Object=} opt_attrs Attributes to set on the new element.
 * @param {string|Element|Array.<Element>} var_args Text strings, elements,
 *     or arrays of elements to add as children of the new element.
 * @return {FakeElement} The newly created element.
 */
FakeUi.create = function(tag, opt_attrs, var_args) {
  var args = Array.prototype.slice.call(arguments, 2);
  if (opt_attrs && opt_attrs['class'] && goog.isArray(opt_attrs['class'])) {
    opt_attrs['class'] = opt_attrs['class'].join(' ');
  }
  var element = new FakeElement(tag, opt_attrs);
  for (var i = 0; i < args.length; i++) {
    if (goog.isArray(args[i])) {
      for (var j = 0; j < args[i].length; j++) {
        FakeUi.createChildHelper_(element, args[i][j]);
      }
    } else {
      FakeUi.createChildHelper_(element, args[i]);
    }
  }
  return element;
};

/**
 * Fake implementation of cm.ui.getText.
 * @param {FakeElement} element A DOM element.
 * @return {string} The text content of the element.
 */
FakeUi.getText = function(element) {
  if (element.innerHTML) {
    var document = goog.global['document'];
    delete goog.global['document'];
    var text = goog.string.unescapeEntities(
        element.innerHTML.replace(/<[^>]*>/g, ''));
    goog.global['document'] = document;
    return text;
  } else if (element.childNodes.length > 0 &&
             element.childNodes[0].nodeName === '#text') {
    return element.childNodes[0].textContent || '';
  }
  return '';
};

/**
 * Fake implementation of ui.setText.
 * @param {Element} element A DOM element.
 * @param {string} text A string of plain text.
 * @param {number?} opt_wordBreakMaxLen If this is specified, word breaks are
 *     inserted; this is the maximum length after which to add a word break.
 */
FakeUi.setText = function(element, text, opt_wordBreakMaxLen) {
  if (opt_wordBreakMaxLen) {
    element.innerHTML = goog.format.insertWordBreaksBasic(
        goog.string.htmlEscape(text), opt_wordBreakMaxLen);
  } else {
    delete element['innerHTML'];
    cm.ui.clear(element);
    var child = new FakeElement('#text');
    child.textContent = text;
    element.appendChild(child);
  }
};

/**
 * A base class for tests that use the fake DOM.
 * @constructor
 */
cm.TestBase = function() {
  this.originalValues_ = {};
  this.analyticsTracker_ = null;
  this.trackedEvents_ = [];

  // Install cm.TestBase.equals as the default matcher, so that expectEq,
  // expectCall, etc. use it instead of gjstest.equals for comparison.
  this.setForTest_('gjstest.equals', cm.TestBase.equals);
  this.setForTest_('equals', cm.TestBase.equals);

  // Install cm.TestBase.expectTrue and cm.TestBase.expectFalse, so that
  // expectTrue and expectFalse check whether things are true or false.
  // To check whether something is equal to true, use expectEq(true, ...).
  this.setForTest_('expectTrue', cm.TestBase.expectTrue);
  this.setForTest_('expectFalse', cm.TestBase.expectFalse);

  FakeElement.elementsById_ = {};
  this.setForTest_('cm.ui.create', FakeUi.create);
  this.setForTest_('cm.ui.get', FakeUi.get);
  this.setForTest_('cm.ui.getByClass', FakeUi.getByClass);
  this.setForTest_('cm.ui.getAllByClass', FakeUi.getAllByClass);
  this.setForTest_('cm.ui.getText', FakeUi.getText);
  this.setForTest_('cm.ui.setText', FakeUi.setText);

  // Set up a document body that emulates templates/index.html.
  var fakeBody = cm.ui.create('body', {'id': 'body'},
                              cm.ui.create('div', {'id': 'aboutText'}));
  var fakeHtml = cm.ui.create('html', {}, fakeBody);
  var fakeDocument = {
    'addEventListener': function() {},
    'body': fakeBody,
    'createElement': FakeUi.create,
    'createTextNode': function(text) {
      var textNode = new FakeElement('#text');
      textNode.textContent = text;
      return textNode;
    },
    'documentElement': fakeHtml,
    'nodeType': goog.dom.NodeType.DOCUMENT
  };

  // Create a fresh goog.global object, ensuring that global variables and
  // event listeners don't linger from test to test.  We need to include
  // 'cm' and' goog' so they remain visible to tests in the global namespace.
  var fakeWindow = {
    cm: cm,
    cm_config: {},
    document: fakeDocument,
    goog: goog,
    setTimeout: function(callback, delay) { callback(); },
    setInterval: function() { },
    clearInterval: function() { }
  };

  fakeDocument.defaultView = fakeWindow;

  this.setForTest_('cm.ui.document', fakeDocument);
  this.setForTest_('document', fakeDocument);
  this.setForTest_('goog.global', fakeWindow);
  this.setForTest_('window', fakeWindow);
};

/**
 * Constant to use for call counts that should be at least one, but where
 * the exact number doesn't matter.
 */
cm.TestBase.AT_LEAST_ONCE = -1;

/**
 * An "equals" matcher that uses our saner "match" function.  Installed as
 * the default matcher for expectEq, expectCall, etc. by cm.TestBase.
 * @param {*} expected The expected value.
 * @return {Matcher} A matcher for the expected value.
 */
cm.TestBase.equals = function(expected) {
  return new gjstest.Matcher(
      'equals ' + gjstest.stringify(expected),
      'does not equal ' + gjstest.stringify(expected),
      function(actual) { return cm.TestBase.match(expected, actual); });
};

/**
 * A saner "match" function for test arguments and return values.  Unlike the
 * standard gjstest.equals matcher, this matcher compares by value whenever
 * possible, falling back to reference comparison only as a last resort.
 * Matchers are matched against, objects with an equals() method are compared
 * with equals(), all other objects and arrays are compared recursively, and
 * primitive values are compared with ===.
 * @param {*} expected The expected value, or a Matcher for it.
 * @param {*} actual The actual value.
 * @param {string=} opt_path The path of keys dereferenced so far, used to
 *     produce a message describing a mismatch.
 * @return {boolean|string} True if the actual value matches the expected
 *     value, or a string describing the reason it doesn't match.
 */
cm.TestBase.match = function(expected, actual, opt_path) {
  var keyDescription = opt_path ?
      'whose item ' + opt_path + ' is ' + gjstest.stringify(actual) + ', ' : '';
  /* Try applying the expected value as a Matcher. */
  if (expected instanceof gjstest.Matcher) {
    var result = expected.predicate(actual);
    return result === true ||
        keyDescription + (result || 'which ' + expected.negativeDescription);
  }
  /* Try the equals() method. */
  if (typeof expected === 'object' && expected !== null && expected.equals) {
    return expected.equals(actual) ? true : keyDescription +
        'which fails the equals() method of ' + gjstest.stringify(expected);
  }
  /* Try recursively comparing elements. */
  if (typeof expected === 'object' && expected !== null &&
      typeof actual === 'object' && actual !== null) {
    var isArray = expected.constructor === [].constructor;
    if (expected.constructor !== actual.constructor) {
      return keyDescription + 'which has class ' + actual.constructor.name +
          ' (should be ' + expected.constructor.name + ')';
    } else if (isArray && actual.length !== expected.length) {
      return keyDescription + ('which has length ' + actual.length +
          ' (should be ' + expected.length + ')');
    } else if (isArray || expected.constructor === {}.constructor) {
      /**
       * @param {string} path A key path, such as '[2]' or '.foo'.
       * @param {string} key A key to append, such as 5 or 'bar'.
       * @return {string} Path with key added, such as '.foo[5]' or '.foo.bar'.
       */
      function appendKey(path, key) {
        // Only for arrays, we show integer keys like array indices, e.g. '[5]'.
        // Otherwise, we use . for identifiers, e.g. '.foo', and brackets for
        // keys that aren't valid identifier strings, e.g. "['^.*']".
        return (path || '') + (isArray && key.match(/^\d+$/) ? '[' + key + ']' :
            key.match(/^[a-zA-Z_]\w*$/) ? '.' + key : '[\'' + key + '\']');
      };
      for (var key in expected) {
        var childPath = appendKey(opt_path, key);
        if (!(key in actual)) {
          return 'which lacks an expected item at ' + childPath +
              ' (should be ' + gjstest.stringify(expected[key]) + ')';
        }
        var result = cm.TestBase.match(expected[key], actual[key], childPath);
        if (result !== true) {
          return result;
        }
      }
      for (var key in actual) {
        if (!(key in expected)) {
          return 'which has an unexpected item at ' + appendKey(opt_path, key) +
              ' (with value ' + gjstest.stringify(actual[key]) + ')';
        }
      }
      return true;
    }
  }
  /* Compare primitive values. */
  return expected === actual ? true : keyDescription + 'which !== ' +
      gjstest.stringify(expected);
};

/**
 * Asserts that something has a true value.
 * @param {*} actual The value.
 */
cm.TestBase.expectTrue = function(actual) {
  expectThat(actual, evalsToTrue);
};

/**
 * Asserts that something has a false value.
 * @param {*} actual The value.
 */
cm.TestBase.expectFalse = function(actual) {
  expectThat(actual, evalsToFalse);
};

/**
 * Asserts that a particular event be emitted some number of times before
 *  the end of the test.
 * @param {Object} source The expected source of the event.
 * @param {string} type The expected type of the event.
 * @param {number=} opt_count The expected count of matching events; defaults
 *   to 1 if not set.  You may pass cm.TestBase.AT_LEAST_ONCE to permit any
 *   non-zero number of calls.
 * @param {function=} opt_verifier A function that will verify that the event
 *   matches expectations; it should take a single argument (the additional
 *   properties associated with the event) and return a true on a match and
 *   false otherwise.
 */
cm.TestBase.prototype.expectEvent = function(source, type, opt_count,
                                             opt_verifier) {
  var eventRecord = {
    source: source,
    type: type,
    expected: opt_count === undefined ? 1 : opt_count,
    called: 0,
    verifier: opt_verifier || null
  };
  this.trackedEvents_.push(eventRecord);
  cm.events.listen(source, type, function(properties) {
    if (!this.verifier || this.verifier(properties)) this.called++;
  }, eventRecord);
};

/**
 * Causes the test to start capturing Analytics logs.
 * @private
 */
cm.TestBase.prototype.captureAnalyticsLogs_ = function() {
  if (!this.analyticsTracker_) {
    this.analyticsTracker_ = new cm.TestBase.AnalyticsTracker();
    this.setForTest_(
        'cm.Analytics.logAction',
        goog.bind(this.analyticsTracker_.logAction, this.analyticsTracker_));
  }
};

/**
 * Returns any accumulated Analytics logs.
 * @return {?Array.<Object>}
 * @private
 */
cm.TestBase.prototype.analyticsLogs_ = function() {
  return this.analyticsTracker_ ? this.analyticsTracker_.logs() : null;
};

/**
 * Adds an expectation for a particular call to cm.Analytics.logAction()
 * @param {string} action The expected action from cm.Analytics.
 * @param {?string} layerId The expected layer ID per cm.Analytics.logAction
 *   or null if there is no associated layer.
 * @param {number=} opt_count The expected number of matching logs; defaults
 *   to 1.  Can be cm.TestBase.AT_LEAST_ONCE to allow any non-zero number of
 *   matches.
 * @param {number=} opt_value The expected value if any.
 */
cm.TestBase.prototype.expectLogAction = function(
    action, layerId, opt_count, opt_value) {
  this.captureAnalyticsLogs_();
  if (opt_count === undefined) opt_count = 1;
  this.analyticsTracker_.expectAction(action, layerId, opt_count, opt_value);
};

// The cm.TestBase method definitions below are all enclosed in a private scope
// because they use setByDottedName and getByDottedName, which use global.
(function() {
  var global = this;

  function setByDottedName(dottedName, value) {
    var parts = dottedName.split('.');
    var parent = global;
    for (var i = 0; i < parts.length - 1; i++) {
      parent = parent[parts[i]];
    }
    parent[parts[parts.length - 1]] = value;
  }

  function getByDottedName(dottedName) {
    var parts = dottedName.split('.');
    var value = global;
    for (var i = 0; i < parts.length; i++) {
      value = value[parts[i]];
    }
    return value;
  }

  /** Restores all symbols replaced by setForTest_, including DOM fakes. */
  cm.TestBase.prototype.tearDown = function() {
    for (var dottedName in this.originalValues_) {
      setByDottedName(dottedName, this.originalValues_[dottedName]);
    }
    if (this.analyticsTracker_) {
      this.analyticsTracker_.verify();
    }
    for (var i = 0; i < this.trackedEvents_.length; i++) {
      var eventRecord = this.trackedEvents_[i];
      cm.TestBase.verifyCallCount_(eventRecord, 'Event ' + eventRecord.type);
    }
  };

  /**
   * Sets a value by its fully qualified name, to be automatically restored
   * in cm.TestBase.tearDown().
   * @param {string} dottedName A fully qualified name, e.g. "goog.foo.bar".
   * @param {*} value The value to temporarily bind to the name.
   * @private
   */
  cm.TestBase.prototype.setForTest_ = function(dottedName, value) {
    this.originalValues_[dottedName] = getByDottedName(dottedName);
    setByDottedName(dottedName, value);
  };

  /** Temporarily sets gjstestEquals to the .equals() method on a class. */
  cm.TestBase.prototype.setGjstestEquals_ = function(className) {
    this.setForTest_(className + '.prototype.gjstestEquals',
                     getByDottedName(className + '.prototype.equals'));
  };

  /**
   * Replaces a constructor with a mock constructor that expects to be called
   * with the given arguments, any number of times, returning the same mock
   * instance every time.  It's safe to call expectNew_ more than once for the
   * same constructor; doing so will change the argument expectations for
   * subsequent calls and produce a new mock instance.  The original constructor
   * will be automatically restored in tearDown().
   * @param {string} dottedName The fully qualified name of the constructor.
   * @param {...*} var_args Matchers for expected arguments to the constructor.
   * @return {Object} The mock instance that the mock constructor will return.
   * @private
   */
  cm.TestBase.prototype.expectNew_ = function(dottedName, var_args) {
    var instance;
    if (dottedName in this.originalValues_) {
      instance = createMockInstance(this.originalValues_[dottedName]);
    } else {
      instance = createMockInstance(getByDottedName(dottedName));
      this.setForTest_(dottedName, createMockFunction(dottedName));
    }
    var args = Array.prototype.slice.call(arguments, 1);
    expectCall(getByDottedName(dottedName)).apply(null, args)
        .willRepeatedly(returnWith(instance));
    // The following lines are monkey patches for two methods that belong to
    // goog.events.EventTarget. By this, we can emit events from mock Closure
    // objects.
    if ('getParentEventTarget' in instance &&
        'dispatchEvent' in instance) {
      goog.testing.events.mixinListenable(instance);
    }
    return instance;
  };

  /**
   * Sets up an expectation that a given function or constructor will not be
   * called.  The original function or constructor will be automatically
   * restored in tearDown().
   * @param {string} dottedName Function or constructor's fully qualified name.
   * @private
   */
  cm.TestBase.prototype.expectNoCalls_ = function(dottedName) {
    var thrower = function() {
      throw new Error('Unexpected call to ' + dottedName + '()');
    };
    if (dottedName in this.originalValues_) {
      setByDottedName(dottedName, thrower);
    } else {
      this.setForTest_(dottedName, thrower);
    }
  };
})();

/**
 * Returns a matcher that compares objects by reference.
 * @param {Object|Array} expected A reference to the expected object.
 * @return {gjstest.Matcher} A matcher requiring a reference to the same object.
 */
function equalsRef(expected) {
  return new gjstest.Matcher(
      'refers to the same object as ' + gjstest.stringify(expected),
      'does not refer to the same object as ' + gjstest.stringify(expected),
      function(actual) { return expected === actual; }
  );
}

/**
 * Asserts that 'actual' refers to the same object as 'expected'.
 * @param {Object|Array} expected A reference to the expected object.
 * @param {Object|Array} actual A reference to the actual object.
 */
function expectRef(expected, actual) {
  gjstest.expectThat(actual, equalsRef(expected));
}

/**
 * Stubs out a function or method call to make it return a constant value.
 * Use stub(func)(arg1, arg2, ...).is(returnValue) instead of expectCall(...)
 * to express that you're setting up test inputs, not declaring an expectation
 * (i.e. you don't care whether or how many times the function is called).
 * @param {Function} func A function or method.
 * @return {Function} A thing that should be immediately invoked as
 *     stub(func)(arg1, arg2, ...).is(returnValue) in order to make the given
 *     function return returnValue whenever it gets called with arguments that
 *     match arg1, arg2, ... (arg1, arg2, ... can be actual values or matchers).
 */
function stub(func) {
  return function() {
    var args = arguments;
    return {'is': function(value) {
      expectCall(func).apply(null, args).willRepeatedly(returnWith(value));
    }};
  };
}

/**
 * Creates a matcher that checks whether an element has a given node name.
 * @param {string} name The node name to match.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement with the
 *     specified node name (case-insensitive match).
 */
function withNodeName(name) {
  var article = name.match(/^[aeio]|^h[0-9]|^u[a-z]/) ? 'an' : 'a';
  return new gjstest.Matcher(
      'is ' + article + ' <' + name + '> element',
      'is not ' + article + ' <' + name + '> element',
      function(x) { return x.nodeName.toUpperCase() === name.toUpperCase(); });
}

/**
 * Creates a matcher that looks for a given element ID.
 * @param {string} id The element ID to look for.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     the given ID.
 */
function withId(id) {
  return new gjstest.Matcher('has id "' + id + '"',
                             'doesn\'t have id "' + id + '"',
                             function(x) { return x.id === id; });
}

/**
 * Creates a matcher that checks whether an element has a given class.
 * @param {string} name The class name to look for.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     the given class among the classes in its className.
 */
function withClass(name) {
  return new gjstest.Matcher(
      'has the "' + name + '" class',
      'doesn\'t have the "' + name + '" class',
      function(x) {
        return (x.className || '').split(/\s+/).indexOf(name) >= 0;
      });
}

/**
 * Creates a matcher that looks for an attribute.
 * @param {string} name The attribute name.
 * @param {string} value The attribute value.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     the given attribute with exactly the given value.
 */
function withAttr(name, value) {
  return new gjstest.Matcher(
      'has a "' + name + '" attribute equal to "' + value + '"',
      'doesn\'t have a "' + name + '" attribute equal to "' + value + '"',
      function(x) {
        if (name === 'href' || name === 'src' || name === 'value') {
          x.attrs_[name] = x[name];
        }
        return x.attrs_[name] === value;
      }
  );
}

/**
 * Shorthand for withAttr('href', value).
 * @param {string} value The expected value of the "href" attribute.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     an "href" attribute or property with exactly the given value.
 */
function withHref(value) {
  return withAttr('href', value);
}

/**
 * Shorthand for withAttr('src', value).
 * @param {string} value The expected value of the "src" attribute.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     a "src" attribute or property with exactly the given value.
 */
function withSrc(value) {
  return withAttr('src', value);
}

/**
 * Shorthand for withAttr('value', value).
 * @param {string} value The expected value of the "value" attribute.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     a "value" attribute or property with exactly the given value.
 */
function withValue(value) {
  return withAttr('value', value);
}

/**
 * Creates a matcher that looks for a selectedIndex.
 * @param {string} selectedIndex The attribute selectedIndex.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     exactly the given selectedIndex.
 */
function withSelectedIndex(selectedIndex) {
  return new gjstest.Matcher(
      'has a selectedIndex equal to "' + selectedIndex + '"',
      'doesn\'t have a selectedIndex equal to "' + selectedIndex + '"',
      function(x) { return x.selectedIndex === selectedIndex; });
}

/**
 * Creates a matcher that looks for a property on the style object.
 * @param {string} name The style property name.
 * @param {string} value The style property value.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement whose
 *     style object has a property with the given name and value.
 */
function withStyle(name, value) {
  return new gjstest.Matcher(
      'has a "' + name + '" style attribute equal to "' + value + '"',
      'doesn\'t have a "' + name + '" style attribute equal to "' + value + '"',
      function(x) { return x.style[name] === value; });
}

/**
 * Creates a matcher that looks for an <input> element of a given type.
 * @param {string} type The desired type.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement with the
 *     nodeName "input" and a "type" attribute matching the given type,
 *     treating <input> elements with no "type" attribute as type "text".
 */
function inputType(type) {
  return new gjstest.Matcher(
      'is an <input> with type "' + type + '"',
      'is not an <input> with type "' + type + '"',
      function(x) {
        return x.nodeName.toUpperCase() === 'INPUT' &&
            (x.attrs_['type'] || 'text') === type;
      });
}

/**
 * Creates a matcher for the text content of an element.
 * @param {string|gjstest.Matcher} expected The expected text, or a matcher.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement whose text
 *     content exactly equals the given string or matches the matcher.  See
 *     FakeUi.getText for what we consider the text content of a FakeElement.
 */
function withText(expected) {
  if (expected instanceof gjstest.Matcher) {
    return new gjstest.Matcher(
        'has text that ' + expected.description,
        'doesn\'t have text that ' + expected.description,
        function(x) { return expected.predicate(FakeUi.getText(x)); });
  }
  return new gjstest.Matcher(
      'has text equal to "' + expected + '"',
      'doesn\'t have text equal to "' + expected + '"',
      function(x) { return FakeUi.getText(x) === expected; });
}

/**
 * Creates a matcher for the innerHTML content of an element.
 * @param {string|gjstest.Matcher} expected The expected HTML, or a matcher.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement whose
 *     innerHTML content exactly equals the given string or matches the matcher.
 */
function withInnerHtml(expected) {
  if (expected instanceof gjstest.Matcher) {
    return new gjstest.Matcher(
        'has innerHTML that ' + expected.description,
        'doesn\'t have innerHTML that ' + expected.description,
        function(x) { return expected.predicate(x.innerHTML); });
  }
  return new gjstest.Matcher(
      'has innerHTML equal to "' + expected + '"',
      'doesn\'t have innerHTML equal to "' + expected + '"',
      function(x) { return x.innerHTML === expected; });
}

/**
 * Returns the sanitized HTML generated by cm.Html.pasteInto.
 * @param {string} html A string of HTML.
 * @return {string} The sanitized HTML generated by cm.Html.pasteInto.
 */
function sanitize(html) {
  var element = {};
  new cm.Html(html).pasteInto(element);
  return element.innerHTML;
}

/**
 * Creates a matcher for elements that optionally satisfy a set of predicates.
 * For example, to match any div element that has the "exciting" class, say:
 * isElement('div', withClass('exciting')).
 * @param {FakeElement|string|gjstest.Matcher} var_args Any number of
 *     conditions to satisfy.  Supply a FakeElement to require a particular
 *     element; or supply a string to require a particular nodeName; or use
 *     any of the matchers withId, withClass, withAttr, withText.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that
 *     satisfies all of the given conditions.
 */
function isElement(var_args) {
  var matchers = [new gjstest.Matcher(
      'is an Element', 'is not an Element',
      function(x) { return x !== null && x instanceof FakeElement; }
  )];
  for (var i = 0; i < arguments.length; i++) {
    // allOf() will convert any FakeElement x to a matcher, equals(x).
    matchers.push(typeof(arguments[i]) === 'string' ?
        withNodeName(arguments[i]) :
        arguments[i] instanceof FakeElement ?
            stringEquals(arguments[i]) : arguments[i]);
  }
  return allOf(matchers);
}

/**
 * Equality matcher for elements which simply compares the string descriptions
 * of elements, defined by toString().
 * @param {FakeElement} element The element that other elements must equal.
 * @return {gjstest.Matcher} A matcher that accepts a FakeElement that matches
 *     the given FakeElement, by string value.
 */
function stringEquals(element) {
  return new gjstest.Matcher(
      'equals element ' + element, 'does not equal element ' + element,
      function(obj) {
        return obj === element || obj.toString() === element.toString();
      });
}

/**
 * Finds and returns the first descendant of the given element that satisfies
 * the given matcher.  Descendants are searched in depth-first order.
 * @param {FakeElement} element The element under which to search for a match.
 * @param {gjstest.Matcher} matcher The matcher to satisfy.
 * @return {FakeElement} The first descendant that satisfies the matcher.
 */
function findDescendantOf(element, matcher) {
  var results = allDescendantsOf(element, matcher);
  return results.length ? results[0] : null;
}

/**
 * Finds and returns all the descendants of the given element that satisfy
 * the given matcher.  Descendants are searched in depth-first order.
 * @param {FakeElement} element The element under which to search for a match.
 * @param {gjstest.Matcher} matcher The matcher to satisfy.
 * @return {Array.<FakeElement>} The descendants that satisfy the matcher.
 */
function allDescendantsOf(element, matcher) {
  expectThat(element, isElement());
  var results = [];
  for (var i = 0; i < element.childNodes.length; i++) {
    var child = element.childNodes[i];
    if (matcher.predicate(child) === true) {  // a string means failure
      results.push(child);
    }
    results = results.concat(allDescendantsOf(child, matcher));
  }
  return results;
}

// A place to put the element found by findDescendantOf.
var foundElement = null;

/**
 * Creates a matcher that accepts an element if it has any descendant that
 * satisfies all the given conditions.  Examples: hasDescendant(fooElement),
 * hasDescendant('div', withId('whatever')), hasDescendant(withText('abc')).
 * @param {FakeElement|string|gjstest.Matcher} var_args Any number of
 *     conditions to satisfy.  Supply a FakeElement to require a particular
 *     element; or supply a string to require a particular nodeName; or use
 *     any of the matchers withId, withClass, withAttr, withText.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     any descendant that satisfies all of the given conditions.
 */
function hasDescendant(var_args) {
  var matcher = isElement.apply(null, arguments);
  return new gjstest.Matcher(
      'has a descendant that ' + matcher.description,
      'doesn\'t have a descendant that ' + matcher.description,
      function(x) { return !!(foundElement = findDescendantOf(x, matcher)); });
}

/**
 * Asserts that the given element has a descendant satisfying all the given
 * conditions, and returns the first such descendant (in depth-first order).
 * @param {FakeElement} element The element under which to search for a match.
 * @param {FakeElement|string|gjstest.Matcher} var_args Any number of
 *     conditions to satisfy.  Supply a FakeElement to require a particular
 *     element; or supply a string to require a particular nodeName; or use
 *     any of the matchers withId, withClass, withAttr, withText.
 * @return {FakeElement} The matching element, if found.
 */
function expectDescendantOf(element, var_args) {
  var args = Array.prototype.slice.call(arguments, 1);
  foundElement = null;
  expectThat(element, hasDescendant.apply(null, args));
  return foundElement;
}

/**
 * Asserts that none of an element's descendants meet all the given conditions.
 * @param {FakeElement} element The  element under which to search.
 * @param {FakeElement|string|gjstest.Matcher} var_args Any number of
 *     conditions to satisfy.  Supply a FakeElement to require a particular
 *     element; or supply a string to require a particular nodeName; or use
 *     any of the matchers withId, withClass, withAttr, withText.
 */
function expectNoDescendantOf(element, var_args) {
  var args = Array.prototype.slice.call(arguments, 1);
  expectThat(element, not(hasDescendant.apply(null, args)));
}

/**
 * Matcher for whether or not an element is shown, based on its 'display' style.
 * @return {gjstest.Matcher} The visibility matcher.
 */
function isShown() {
  return new gjstest.Matcher('is shown', 'is not shown',
                             not(withStyle('display', 'none')).predicate);
}

/**
 * Filters an array for elements that match matcher.
 * @param {array} array The array to filter.
 * @param {gjstest.Matcher} matcher The matcher to match.
 * @return {array} The filtered array elements.
 */
function filterMatches(array, matcher) {
  return array.filter(function(x) { return matcher.predicate(x) === true; });
}

/**
 * Tracks the expectations of Analytics events.
 * @constructor
 */
cm.TestBase.AnalyticsTracker = function() {
  /**
   * The logs which the tracker has captured; each entry is an object
   * with attributes 'action', 'layerId', and possibly 'value'.
   * @type {Array.<Object>}
   * @private
   */
  this.logs_ = [];
  /**
   * The expectations that have been registered with the tracker; keys
   * are the action name (so there can only be one expectation per
   * action) and values are objects with the attributes 'expected' (the
   * expected call count), 'layerId' (the expected layerId), 'called' (the
   * actual call count; incremented as logs accrue) and optionally 'value'
   * (the expected value, if any).
   * @type {Object.<string, object>}
   * @private
   */
  this.expectedActions_ = {};
};

/**
 * Constructs a string suitable for error reporting when checking the
 * expectations around an action.
 * @param {string} action The action whose expectations are being checked.
 * @return {string}
 * @private
 */
cm.TestBase.AnalyticsTracker.prototype.errorDesc_ = function(action) {
  return 'logAction(' + action + ')';
};

/**
 * Mock for cm.Analytics.logAction; adds the logged action to the tracker's
 * records.  If there is an expectation set for the given action, the logged
 * action is compared against the expectation and throws on a mismatch.
 * @param {string} action As per cm.Analytics.logAction.
 * @param {?string} layerId As per cm.Analytics.logAction.
 * @param {number=} opt_value As per cm.Analytics.logAction.
 */
cm.TestBase.AnalyticsTracker.prototype.logAction = function(
    action, layerId, opt_value) {
  var log = {'action': action, 'layerId': layerId};
  if (opt_value) {
    log['value'] = opt_value;
  }
  this.logs_.push(log);
  var expected = this.expectedActions_[action];
  if (expected) {
    expectEq(expected.layerId, layerId,
             'as layerId in ' + this.errorDesc_(action));
    if (expected.value !== undefined) {
      expectEq(expected.value, opt_value,
               'as value for ' + this.errorDesc_(action));
    }
    expected.called++;
    if (expected.expected !== cm.TestBase.AT_LEAST_ONCE) {
      expectLe(expected.called, expected.expected,
               'for expected call count for ' + this.errorDesc_(action));
    }
  }
};

/**
 * Fetch the logs accumulated by the tracker.
 * @return {Array.<Object>}
 */
cm.TestBase.AnalyticsTracker.prototype.logs = function() {
  return this.logs_.slice(0);
};

/**
 * Add an expectation that a particular action be logged.
 * @param {string} action The expected action.
 * @param {?string} layerId The expected layerId.
 * @param {number} count The expected number of calls, or
 *   cm.TestBase.AT_LEAST_ONCE if any number of calls greater than 0 is
 *   acceptable.
 * @param {number=} opt_value The expected value if any.
 */
cm.TestBase.AnalyticsTracker.prototype.expectAction = function(
    action, layerId, count, opt_value) {
  this.expectedActions_[action] = {
    expected: count, layerId: layerId, called: 0};
  if (opt_value) {
    this.expectedActions_[action]['value'] = opt_value;
  }
};

/** Verifies that all expectations have been satisfied. */
cm.TestBase.AnalyticsTracker.prototype.verify = function() {
  for (var action in this.expectedAction_) {
    var expected = this.expectedAction_[action];
    cm.TestBase.verifyCallCount_(expected, this.errorDesc_(action));
  }
};

/**
 * Verifies that the call count for a record matches the expectations.
 * @param {Object.<string, Object>} record The record of calls; assumes the
 *   expected call count will be in record.expected and the actual call count
 *   will be in in record.called.
 * @param {string} errString An error string to emit on failed expectations.
 * @private
 */
cm.TestBase.verifyCallCount_ = function(record, errString) {
  var expected = record.expected;
  var called = record.called;
  if (expected === cm.TestBase.AT_LEAST_ONCE) {
    expectGt(called, 0, errString);
  } else {
    expectEq(expected, called, errString);
  }
};

// TODO(rew): This doesn't really belong here; the fake DOM and mocks for
// cm.ui should be kept isolated so they can be re-used elsewhere. b/10566080

/**
 * Creates a fake folder with an empty sublayer list.
 * @param {string} id The ID.
 * @param {boolean=} opt_folder Pass true if this layer should be a folder.
 * @param {string=} opt_source The return value for getSourceAddress.
 * @param {string=} opt_singleSelect The return value for isSingleSelect.
 * @return {google.maps.MVCObject} The new layer.
 */
cm.TestBase.prototype.createFakeLayer = function(id, opt_folder,
  opt_source, opt_singleSelect) {
  var layer = new google.maps.MVCObject();
  layer.set('id', id);
  if (opt_folder) {
    layer.set('type', cm.LayerModel.Type.FOLDER);
  }
  layer.set('sublayers', new google.maps.MVCArray());
  layer.isSingleSelect = function() { return (opt_singleSelect || false); };
  layer.getSourceAddress = function() { return (opt_source || 'XYZ:xyz'); };
  layer.getSublayerIds = function() { return []; };
  return layer;
};
