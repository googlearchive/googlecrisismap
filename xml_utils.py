# Copyright 2010 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""XML parsing and serialization framework.

This framework helps you parse XML documents, which may have many levels
of nested elements, into flatter Python structures.  To use it, define
subclasses of Converter.  Each Converter describes how to convert a subtree
of an XML document to or from a Python value.  The type and structure of
the Python value is up to the Converter.
"""

# pylint:disable=g-import-not-at-top
try:
  import xml.etree.cElementTree as ElementTree
except ImportError:
  import xml.etree.ElementTree as ElementTree


def Qualify(ns, name):
  """Makes a namespace-qualified name."""
  return '{%s}%s' % (ns, name)


# ==== Constructing and reading elements ===================================


def Xml(tag, *args, **kwargs):
  """Creates an Element with the given tag and contents.

  The tag may be a string or a (ns, name) tuple.  The arguments may include
  None (which is ignored), dictionaries of attributes, child elements,
  or lists of child elements; anything else is converted to become text
  content.  Attributes may also be specified using keyword arguments;
  None omits the attribute.

  Args:
    tag: The name of the new tag, or a (ns, name) tuple.
    *args: Attributes or children (see docstring).
    **kwargs: Attributes for the tag.
  Returns:
    The newly created Element.
  """
  if isinstance(tag, tuple):
    tag = Qualify(*tag)
  element = ElementTree.Element(tag)
  etype = type(element)  # in cElementTree, this is not the same as Element
  child = None
  for arg in args:
    if isinstance(arg, dict):  # attributes
      for key, value in arg.items():
        if isinstance(key, tuple):
          key = Qualify(*key)
        if value is not None:
          element.set(key, unicode(value))
    else:  # text content or child elements
      for arg_item in arg if isinstance(arg, list) else [arg]:
        if isinstance(arg_item, etype):  # child element
          element.append(arg_item)
          child = arg_item
        elif arg_item:  # text content
          if child:
            child.tail = (child.tail or '') + unicode(arg_item)
          else:
            element.text = (element.text or '') + unicode(arg_item)
  for key, value in kwargs.items():  # attributes
    if isinstance(key, tuple):
      key = Qualify(*key)
    if value is not None:
      element.set(key, unicode(value))
  return element


def Parse(string):
  """Parses XML from a string."""
  return ElementTree.fromstring(string)


def Read(fileobject):
  """Reads an XML tree from a file."""
  return ElementTree.parse(fileobject)


# ==== Serializing and writing elements ====================================


def Indent(element, level=0):
  """Adds indentation to an element subtree."""
  # TODO(kpy): Make this non-mutating so we don't have to copy in serialize().
  indentation = '\n' + level*'  '
  if element:
    if not element.text or not element.text.strip():
      element.text = indentation + '  '
    if not element.tail or not element.tail.strip():
      element.tail = indentation
    child = None
    for child in element:
      Indent(child, level + 1)
    if child:
      if not child.tail or not child.tail.strip():
        child.tail = indentation
  elif level:
    if not element.tail or not element.tail.strip():
      element.tail = '\n' + (level-1)*'  '


def FixName(name, uri_prefixes):
  """Converts a Clark qualified name into a name with a namespace prefix."""
  if name[0] == '{':
    uri, tag = name[1:].split('}')
    if uri in uri_prefixes:
      return uri_prefixes[uri] + ':' + tag
  return name


def SetPrefixes(root, uri_prefixes):
  """Replaces Clark qualified element names with specific given prefixes."""
  # TODO(kpy): Make this non-mutating so we don't have to copy in serialize().
  for uri, prefix in uri_prefixes.items():
    root.set('xmlns:' + prefix, uri)

  for element in root.getiterator():
    element.tag = FixName(element.tag, uri_prefixes)


def Serialize(root, uri_prefixes=None, pretty_print=True):
  """Serializes XML to a string."""
  root_copy = ElementTree.fromstring(ElementTree.tostring(root))
  SetPrefixes(root_copy, uri_prefixes or {})
  if pretty_print:
    Indent(root_copy)
  return ElementTree.tostring(root_copy)


def Write(fileobj, root, uri_prefixes=None, pretty_print=True):
  """Writes an XML tree to a file.

  This uses the given map of namespace URIs to prefixes, and adds nice
  indentation.

  Args:
    fileobj: The open file object.
    root: The root element.
    uri_prefixes: A dictionary of namespace URI to prefixes.
    pretty_print: If True, pretty print the XML (add indentation).
  """
  root_copy = ElementTree.fromstring(ElementTree.tostring(root))
  SetPrefixes(root_copy, uri_prefixes or {})
  if pretty_print:
    Indent(root_copy)
  # Setting encoding to 'UTF-8' makes ElementTree write the XML declaration
  # because 'UTF-8' differs from ElementTree's default, 'utf-8'.  According
  # to the XML 1.0 specification, 'UTF-8' is also the recommended spelling.
  ElementTree.ElementTree(root_copy).write(fileobj, encoding='UTF-8')
