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


class LayerType(object):
  """Allowed values for the 'type' property of a MapRoot layer."""
  FOLDER = 'FOLDER'
  KML = 'KML'
  GEORSS = 'GEORSS'
  TILE = 'TILE'
  FUSION = 'FUSION'
  MAP_DATA = 'MAP_DATA'


def GetAllLayers(maproot):
  """Gets a flat list of the layer objects in a MapRoot map object.

  Args:
    maproot: A MapRoot map object.

  Returns:
    A list of all the layers in breadth-first order, not including folders.
  """
  layers = []
  queue = maproot.get('layers', [])
  while queue:
    node = queue.pop()
    if node['type'] != LayerType.FOLDER:
      layers.append(node)
    queue += node.get('sublayers', [])
  return layers


def GetSourceAddress(layer):
  """Gets a string identifier for the data source of a MapRoot layer.

  Args:
    layer: A MapRoot layer object.

  Returns:
    A string suitable as a key for the data source, or None if none
    could be determined.
  """
  # TODO(cimamoglu): Add a prefix such as 'url:' before URL addresses.
  source = layer.get('source', {})
  return (source.get('georss', {}).get('url') or
          source.get('kml', {}).get('url') or None)
