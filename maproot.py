#!/usr/bin/python
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

import urlparse


class LayerType(object):
  """Allowed values for the 'type' property of a MapRoot layer."""
  FOLDER = 'FOLDER'
  KML = 'KML'
  GEORSS = 'GEORSS'
  GOOGLE_MAP_TILES = 'GOOGLE_MAP_TILES'
  GOOGLE_FUSION_TABLES = 'GOOGLE_FUSION_TABLES'
  GOOGLE_MAP_DATA = 'GOOGLE_MAP_DATA'
  GOOGLE_TRAFFIC = 'GOOGLE_TRAFFIC'
  GOOGLE_TRANSIT = 'GOOGLE_TRANSIT'
  GOOGLE_WEATHER = 'GOOGLE_WEATHER'
  GOOGLE_CLOUD_IMAGERY = 'GOOGLE_CLOUD_IMAGERY'
  WMS = 'WMS'


def GetAllLayers(maproot):
  """Gets a flat list of the layer objects in a MapRoot map object.

  Args:
    maproot: A MapRoot map object.

  Returns:
    A list of all the layers in breadth-first order, not including folders.
  """
  layers = []
  queue = maproot.get('layers', [])[:]
  while queue:
    node = queue.pop()
    if node['type'] != LayerType.FOLDER:
      layers.append(node)
    queue.extend(node.get('sublayers', []))
  return layers


def GetSourceAddress(layer):
  """Gets a string identifier for the data source of a MapRoot layer.

  Args:
    layer: A MapRoot layer object.

  Returns:
    A string suitable as a unique key for the data source, or None if none
    layer type is not supported by the metadata subsystem.
  """
  layer_type = layer.get('type', '')
  source = layer.get('source', {}).get(layer_type.lower())
  if layer_type in [LayerType.KML, LayerType.GEORSS, LayerType.WMS]:
    return layer_type + ':' + source.get('url', '')


def GetHostnameForSource(source):
  """Gets the hostname of the server for a given source address.

  Args:
    source: A source address produced by GetSourceAddress.

  Returns:
    A hostname, or None if no hostname can be determined.
  """
  layer_type, url = source.split(':', 1)
  if layer_type in [LayerType.KML, LayerType.GEORSS, LayerType.WMS]:
    netloc = urlparse.urlsplit(url).netloc
    return netloc.split(':')[0]
