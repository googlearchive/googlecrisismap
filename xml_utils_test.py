# Copyright 2010 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Tests for xml_utils.py."""

import unittest

import xml_utils


class XmlUtilsTest(unittest.TestCase):
  def testXml(self):
    e1 = xml_utils.Xml('a', xml_utils.Xml('x'), p='hey', q='you')
    e2 = xml_utils.Xml('b', ['good', 'bye'])
    e3 = xml_utils.Xml('c', [e1, e2])
    e4 = xml_utils.Xml(('d', 'e'), [e1, e2])
    assert sorted(e1.items()) == [('p', 'hey'), ('q', 'you')]
    assert e1.tag == 'a'
    assert e1.attrib == {'p': 'hey', 'q': 'you'}
    assert e2.tag == 'b'
    assert e2.text == 'goodbye'
    assert e3.tag == 'c'
    assert e3.getchildren() == [e1, e2]
    assert e4.tag == '{d}e'
    self.assertEquals("""\
<ns0:e xmlns:ns0="d">
  <a p="hey" q="you">
    <x />
  </a>
  <b>goodbye</b>
</ns0:e>
""", xml_utils.Serialize(e4))


if __name__ == '__main__':
  unittest.main()
