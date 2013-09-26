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

// @author kpy@google.com (Ka-Ping Yee)

goog.require('cm.Analytics');
goog.require('cm.css');

function MapPickerTest() {
  cm.TestBase.call(this);
}
MapPickerTest.prototype = new cm.TestBase();
registerTestSuite(MapPickerTest);

/** Tests construction of the menu. */
MapPickerTest.prototype.createMenu = function() {
  this.setForTest_('goog.global.location', 'http://example.com/root/map2');
  var menu = cm.MapPicker.createMenu_([
    {title: 'Item One', url: '/root/map1'},
    {title: 'Item Two', url: '/root/map2'}
  ]);
  expectThat(menu, isElement('ul'), withClass(cm.css.MAP_PICKER));
  // /map1 should be a live link, and should not be selected
  var item1 = expectDescendantOf(menu, withText('Item One'));
  expectThat(item1, isElement('a', withHref('/root/map1')));
  expectThat(item1.parentNode,
             isElement('li', not(withClass(cm.css.SELECTED))));
  // /map2 should not be a link, and should be selected
  var item2 = expectDescendantOf(menu, withText('Item Two'));
  expectThat(item2, isElement('a', not(withHref('/root/map2'))));
  expectThat(item2.parentNode, isElement('li', withClass(cm.css.SELECTED)));
};

/** Tests positioning of the menu. */
MapPickerTest.prototype.positionMenu = function() {
  var menu, button;
  cm.ui.append(cm.ui.document.body,
               button = cm.ui.create('div'),
               menu = cm.ui.create('div'));
  this.setForTest_('cm.ui.document.body.offsetWidth', 400);
  button.offsetLeft = 150;
  button.offsetTop = 20;
  button.offsetWidth = 15;
  button.offsetHeight = 15;

  // Menu fits with its right edge aligned to the button.
  menu.offsetWidth = 150;
  menu.offsetHeight = 300;
  cm.MapPicker.positionMenu_(menu, button);
  expectEq('15px', menu.style.left);
  expectEq('35px', menu.style.top);

  // Menu is too wide to fit with its right edge aligned to the button.
  menu.offsetWidth = 200;
  cm.MapPicker.positionMenu_(menu, button);
  expectEq('4px', menu.style.left);
  expectEq('35px', menu.style.top);
};

/** Tests behaviour of the menu button. */
MapPickerTest.prototype.menuButton = function() {
  var body = cm.ui.document.body;
  var parent = cm.ui.create('div');
  new cm.MapPicker(parent, [
    {title: 'Item One', url: '/root/map1'},
    {title: 'Item Two', url: '/root/map2'}
  ]);
  var button = expectDescendantOf(parent, withClass(cm.css.MAP_PICKER_BUTTON));

  // Menu should be initially not shown.
  expectNoDescendantOf(body, withClass(cm.css.MAP_PICKER));

  // Clicking on the button should make it appear.
  cm.events.emit(body, 'click', {target: button});
  expectDescendantOf(body, withClass(cm.css.MAP_PICKER));

  // Clicking on the button again should make it disappear.
  cm.events.emit(body, 'click', {target: button});
  expectNoDescendantOf(body, withClass(cm.css.MAP_PICKER));

  // Clicking on the button should make it appear.
  cm.events.emit(body, 'click', {target: button});
  expectDescendantOf(body, withClass(cm.css.MAP_PICKER));

  // Clicking anywhere outside the button should make it disappear.
  cm.events.emit(body, 'click');
  expectNoDescendantOf(body, withClass(cm.css.MAP_PICKER));

  // Clicking on the button should make it appear.
  cm.events.emit(body, 'click', {target: button});
  expectDescendantOf(body, withClass(cm.css.MAP_PICKER));

  // Resizing the window should make it disappear.
  cm.events.emit(goog.global, 'resize');
  expectNoDescendantOf(body, withClass(cm.css.MAP_PICKER));
};

/** Tests selecting a menu item from the picker */
MapPickerTest.prototype.testMenuSelection = function() {
  var body = cm.ui.document.body;
  var parent = cm.ui.create('div');
  var picker = new cm.MapPicker(parent, [
    {title: 'Item One', url: '/root/map1'},
    {title: 'Item Two', url: '/root/map2'}
  ]);
  var button = expectDescendantOf(
      parent, withClass(cm.css.MAP_PICKER_BUTTON));
  cm.events.emit(body, 'click', {target: button});
  var pickerElem = expectDescendantOf(body, withClass(cm.css.MAP_PICKER));
  var links = allDescendantsOf(pickerElem, withNodeName('a'));
  expectEq(2, links.length);
  this.expectLogAction(
      cm.Analytics.LayersPanelAction.MAP_PICKER_ITEM_SELECTED, null);
  cm.events.emit(links[1], 'click');
};
