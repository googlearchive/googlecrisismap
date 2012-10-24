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
  this.id = '';
  this.className = '';
  this.value = '';  // For pretend input objects
  this.attrs_ = {};
  if (opt_attrs) {
    for (var name in opt_attrs) {
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
  this.style = {};
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
    parts.push(name + '="' + this.attrs_[name] + '"');
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
    return goog.string.unescapeEntities(
        element.innerHTML.replace(/<[^>]*>/g, ''));
  } else if (element.childNodes.length > 0 &&
             element.childNodes[0].nodeName === '#text') {
    return element.childNodes[0].textContent || '';
  }
  return '';
};

/**
 * Fake implementation of ui.setText.
 * @param {FakeElement} element An element.
 * @param {string} text A string of plain text.
 */
FakeUi.setText = function(element, text) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  var child = new FakeElement('#text');
  child.textContent = text;
  element.appendChild(child);
};

/**
 * A base class for tests that use the fake DOM.
 * @constructor
 */
cm.TestBase = function() {
  this.originalValues_ = {};

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
    'body': fakeBody,
    'createElement': FakeUi.create,
    'createTextNode': function(text) {
      var textNode = new FakeElement('#text');
      textNode.textContent = text;
      return textNode;
    },
    'document': {
      'documentElement': fakeHtml
    }
  };

  // Create a fresh goog.global object, ensuring that global variables and
  // event listeners don't linger from test to test.
  var fakeWindow = {
    cm_config: {},
    document: fakeDocument,
    setTimeout: function(callback, delay) { callback(); },
    setInterval: function() { },
    clearInterval: function() { }
  };

  this.setForTest_('cm.ui.document', fakeDocument);
  this.setForTest_('document', fakeDocument);
  this.setForTest_('goog.global', fakeWindow);
  this.setForTest_('window', fakeWindow);
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
      instance.getParentEventTarget = function() { return null; };
      instance.dispatchEvent = function(event) {
        goog.events.dispatchEvent(instance, event);
      };
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
 * Creates a mock instance of a class with some of its methods stubbed out
 * to return constants.
 * @param {Function} constructor A constructor.
 * @param {Object} returnValues A map of method names to values.  The instance
 *     will accept any number of calls to these methods with any arguments,
 *     always returning the given values.  All other methods are mocked.
 * @return {Object} A mock instance of the given class with the specified
 *     methods stubbed out.
 */
function stubInstance(constructor, returnValues) {
  var stub = createMockInstance(constructor);
  for (var methodName in returnValues) {
    stub[methodName] = (function(value) {
      return function() { return value; };
    })(returnValues[methodName]);
  }
  return stub;
}

/**
 * Replaces a single method with a method that accepts any arguments and always
 * returns a constant.  Use this instead of expectCall(...) when you don't care
 * how many times the method is called.  (Only use this on objects that don't
 * linger from test to test, as the method is not restored on teardown.
 * @param {Object} object An object.
 * @param {string} methodName The name of a method on the object.
 * @param {*} returnValue The value that you want the method to return.
 */
function stubReturn(object, methodName, returnValue) {
  object[methodName] = function() { return returnValue; };
}

/**
 * Creates a matcher that checks whether an element has a given node name.
 * @param {string} name The node name to match.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement with the
 *     specified node name (case-insensitive match).
 */
function withNodeName(name) {
  var article = name.match(/^[aehiou]/) ? 'an' : 'a';
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
      function(x) { return x.attrs_[name] === value; });
}

/**
 * Creates a matcher that looks for an inner HTML.
 * @param {string} innerHtml The attribute innerHTML.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     the given innerHTML with exactly the given value.
 */
function withInnerHtml(innerHtml) {
  return new gjstest.Matcher(
      'has an innerHTML equal to "' + innerHtml + '"',
      'doesn\'t have an innerHTML equal to "' + innerHtml + '"',
      function(x) { return x.innerHTML === innerHtml; });
}

/**
 * Creates a matcher that looks for a value.
 * @param {string} value The attribute value.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     the given value with exactly the given value.
 */
function withValue(value) {
  return new gjstest.Matcher(
      'has a value equal to "' + value + '"',
      'doesn\'t have a value equal to "' + value + '"',
      function(x) { return x.value === value; });
}

/**
 * Creates a matcher that looks for a selectedIndex.
 * @param {string} selectedIndex The attribute selectedIndex.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     the given selectedIndex with exactly the given selectedIndex.
 */
function withSelectedIndex(selectedIndex) {
  return new gjstest.Matcher(
      'has a selectedIndex equal to "' + selectedIndex + '"',
      'doesn\'t have a selectedIndex equal to "' + selectedIndex + '"',
      function(x) { return x.selectedIndex === selectedIndex; });
}

/**
 * Creates a matcher that looks for a style attribute.
 * @param {string} name The style attribute name.
 * @param {string} value The style attribute value.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     the given style attribute with exactly the given value.
 */
function withStyle(name, value) {
  return new gjstest.Matcher(
      'has a "' + name + '" style attribute equal to "' + value + '"',
      'doesn\'t have a "' + name + '" style attribute equal to "' + value + '"',
      function(x) { return x.style[name] === value; });
}

/**
 * Shorthand for withAttr('href', value).
 * @param {string} value The expected value of the "href" attribute.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement that has
 *     an "href" attribute with exactly the given value.
 */
function withHref(value) {
  return withAttr('href', value);
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
 * @param {string|gjstest.Matcher} text The expected text or a string matcher.
 * @return {gjstest.Matcher} A matcher that accepts any FakeElement whose
 *     text content exactly matches the given string.  See FakeUi.getText
 *     for what we consider to be the text content of a FakeElement.
 */
function withText(text) {
  if (text instanceof gjstest.Matcher) {
    var matcher = text;
    return new gjstest.Matcher(
        'has text that ' + matcher.description,
        'doesn\'t have text that ' + matcher.description,
        function(x) { return matcher.predicate(FakeUi.getText(x)); });
  }
  return new gjstest.Matcher(
      'has text equal to "' + text + '"',
      'doesn\'t have text equal to "' + text + '"',
      function(x) { return FakeUi.getText(x) == text; });
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
        withNodeName(arguments[i]) : arguments[i]);
  }
  return allOf(matchers);
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
 * @param {FakeElement} element The element under which to search.
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
 * Sets up the expectations for a call to ui.create, returning a newly created
 * FakeElement.  TODO(kpy): Remove this when it is no longer used in tests.
 * @param {string} name A name to give the element for easier debugging.
 * @param {string} type The type of element expected.
 * @param {map} opt_attrs The (optional) attributes to pass to ui.create.
 * @param {*} var_args The (optional) children to pass to ui.create.
 * @return {FakeElement} The newly created element.
 */
function expectCreate(name, type, opt_attrs, var_args) {
  var newElement = new FakeElement(name);
  var args = [type];
  if (arguments.length >= 3) {  // opt_attrs was supplied
    args.push(opt_attrs ? recursivelyEquals(opt_attrs) : equals(opt_attrs));
  }
  // Get the array of arguments starting from var_args onwards.
  var_args = Array.prototype.slice.call(arguments, 3);
  if (var_args.length > 0) {
    if (var_args.length == 1 && var_args[0] instanceof Array) {
      args.push(recursivelyEquals(var_args[0]));
    } else {
      args = args.concat(var_args);
    }
  }
  // Populate the element with its children.
  for (var i = 0; i < var_args.length; i++) {
    if (var_args[i] instanceof cm.Html) {
      var div = new FakeElement('div');
      var_args[i].pasteInto(div);
      newElement.childNodes.push(div);
    } else if (typeof(var_args[i]) === 'string') {
      var text = new FakeElement('#text');
      text.textContent = var_args[i];
      newElement.childNodes.push(text);
    } else {
      newElement.childNodes.push(var_args[i]);
    }
  }
  expectCall(cm.ui.create).apply(null, args)
      .willOnce(returnWith(newElement));
  return newElement;
}
