#!/usr/bin/python2.5
# Copyright 2012 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Utility functions and definitions for handling MapRoot objects."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'


class Struct(object):
  """A simple bag of attributes."""

  def __init__(self, **kwargs):
    self.__dict__.update(kwargs)

  def __get__(self, name, default=None):
    return self.__dict__.get(name, default)

  def __iter__(self):
    return iter(self.__dict__)


LAYER_TYPE = Struct()
# pylint: disable-msg=C6409
LAYER_TYPE.FOLDER = 'FOLDER'
LAYER_TYPE.KML = 'KML'
LAYER_TYPE.GEORSS = 'GEORSS'
LAYER_TYPE.TILE = 'TILE'
LAYER_TYPE.FUSION = 'FUSION'
LAYER_TYPE.MAP_DATA = 'MAP_DATA'


def GetAllLayers(maproot_dict):
  """Returns the list of all layers (i.e. data sources) in a MapRoot object.

  This method flattens the tree structure by taking care of nested folders.

  Args:
    maproot_dict: A dictionary wih MapRoot structure.

  Returns:
    The list of all non-folder layers.
  """
  layers = []
  queue = maproot_dict.get('layers', [])
  while queue:
    node = queue.pop()
    if node['type'] != LAYER_TYPE.FOLDER:
      layers.append(node)
    queue += node.get('sublayers', [])
  return layers


def GetSourceAddress(layer):
  """Returns a string identifier for the data source of a MapRoot layer.

  Args:
    layer: A dictionary with the structure of a MapRoot layer object.

  Returns:
    A string that describes the source address, or None if no source
    address could be determined.
  """
  # TODO(cimamoglu): Add a prefix such as 'url:' before URL addresses.
  source = layer.get('source', {})
  if source.get('georss', {}).get('url'):
    return source.get('georss').get('url')
  if source.get('kml', {}).get('url'):
    return source.get('kml').get('url')
