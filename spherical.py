#!/usr/bin/python
# Copyright 2014 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Spherical geometry routines.

Instances of Point, db.GeoPt, and ndb.GeoPt all work with routines in this
module -- all that's needed are 'lat' and 'lon' attributes in degrees.
"""

import itertools
import math

atan, atan2, asin, cos, sin, sqrt, pi = (
    math.atan, math.atan2, math.asin, math.cos, math.sin, math.sqrt, math.pi)

# Earth mean radius, in meters.
# Source: http://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
# Note this is != equatorial radius, which is 6378.1 km.
# This is better for our spherical approximation of the Earth.
EARTH_MEAN_RADIUS = 6371000


def Clamp(value, min_val, max_val):
  return max(min_val, min(value, max_val))


def Log(x, base=math.e):
  """Returns -inf for log(0) instead of raising an exception."""
  if x == 0:
    return float('-inf')
  return math.log(x, base)


def YToLat(pixel_y):
  # See http://en.wikipedia.org/wiki/Mercator_projection for details.
  # We use the formulation lat = arctan(sinh(y)) so that yToLat(0) yields
  # exactly 0 and yToLat(-y) is guaranteed to yield exactly -yToLat(y).
  y = pi * pixel_y / 128
  return atan((math.exp(y) - math.exp(-y)) / 2) * 180 / pi


def LatToY(lat):
  sin_y = sin(lat * pi / 180)
  return (Log(1 + sin_y) - Log(1 - sin_y)) * 64 / pi


def ToRadians(deg):
  return deg*pi/180


def ToDegrees(rad):
  return rad*180/pi


class Point(object):
  """A point on a sphere, represented by latitude and longitude.

  Latitude ranges between -90 and 90 degrees, inclusive. Values above or below
  this range will be clamped to the range [-90, 90].

  Longitude ranges between -180 and 180 degrees, inclusive. Values above or
  below this range will be wrapped so that they fall within the range.
  """

  def __init__(self, lat, lon):
    self.lat = Clamp(lat, -90, 90)

    if lon != 180:  # do not wrap +180 to -180
      lon = (lon + 180) % 360 - 180
    self.lon = lon

  def __eq__(self, other):
    return self.lat == other.lat and self.lon == other.lon

  def __iter__(self):
    return iter((self.lat, self.lon))

  def __repr__(self):
    return 'Point(%s, %s)' % tuple(self)


class Arc(object):
  """An arc on a sphere, defined by two Point objects."""

  def __init__(self, start, end):
    self.start = start
    self.end = end


class BoundingBox(object):
  """A box defined by a north/south latitude and an east/west longitude.

  The representation is normalized so that two BoundingBoxes are equal if and
  only if their extents are equal and their longitude span (lon_span) fields are
  equal. The east and west extents are normalized so that -180 <= west < 180 and
  -180 <= east <= 180.
  lon_span can range from 0 to 360 degrees:
  - If east = west, lonSpan can be 0 or 360.
  - If east != west, lonSpan is always equal to east - west.
  - If lonSpan = 360, either east = west or (east, west) = (180, -180).
  """

  # The latitude at the north edge of a square that's 360 degrees wide and
  # centered on the equator in a Mercator projection.  This is the maximum
  # latitude visible on Google Maps tiles, which is 128 pixels north of the
  # equator on Google Maps at zoom level 0.  (We subtract 1e-14 to compensate
  # for numerical error that causes LatToY(MAX_LATITUDE) to exceed 128; we'd
  # rather have it be just slightly less than 128 so that the level-0 tile fits
  # in 256 x 256, rather than being bigger than 256 x 256.)
  MAX_LATITUDE = YToLat(128) - 1e-14  # about 85.051128

  def __init__(self, north, south, east, west, allow_zero_lon_span=False):
    """Initializes a BoundingBox.

    Args:
      north: The latitude of the north extent, in degrees.
      south: The latitude of the south extent, in degrees.
      east: The longitude of the east extent, in degrees.
      west: The longitude of the west extent, in degrees.
      allow_zero_lon_span: Whether to interpret east = west as a 0-degree-wide
          box. Otherwise, east = west gives a 360-degree-wide box. Default to
          False
    """
    # Clamp north and south and ensure that north >= south.
    north = Clamp(north, -90, 90)
    south = Clamp(south, -90, 90)
    if north < south:
      north = south = 0

    self.north = north
    self.south = south
    self.east = east
    self.west = west
    self.lon_span = None

    # To avoid rounding error, don't touch west if it's already in range.
    if west < -180 or west >= 180:
      self.west = west % 360
      self.west += 360 if self.west < -180 else -360 if self.west >= 180 else 0

    if east == west and allow_zero_lon_span:
      # lon_span can be zero only if east = west and zero is explicitly allowed.
      self.east = self.west
      self.lon_span = 0
    else:
      # To avoid rounding error, don't touch east if it's already in range.
      if east < -180 or east > 180:
        self.east = east % 360
        self.east += 360 if self.east < -180 else -360 if self.east > 180 else 0
      self.lon_span = self.east - self.west
      self.lon_span += 360 if self.lon_span <= 0 else 0  # negative not allowed

      # We make a special case for a box 360 degrees wide with extents on the
      # 180-degree meridian, just because it's so common.  We always normalize
      # it to (east, west) = (180, -180), never (-180, -180) or (180, 180).
      if self.lon_span == 360 and self.west == -180:
        self.east = 180

  def Pad(self, lat_pad, lon_pad):
    """Returns a box with the specified amount of padding added."""
    assert lat_pad >= 0
    assert lon_pad >= 0
    return BoundingBox(min(self.north + lat_pad, 90),
                       max(self.south - lat_pad, -90),
                       self.east + lon_pad, self.west - lon_pad)

  def Expand(self, margin_factor):
    """Returns a box that's expanded by adding margins on all four sides.

    Args:
      margin_factor: Fraction of the existing bounds by which to expand. For
          example, 0.1 adds a 10% margin on all four sides of the box.

    Returns:
      A new BoundingBox, with margins added on all four sides.
    """
    return self.Pad(
        margin_factor * abs(self.north - self.south),
        margin_factor * abs(self.east - self.west))

  def GetZoomLevel(self, width, height, clamp_lat=False):
    # Width of this box in pixels if displayed at zoom level 0.
    # At zoom level 0, a 360-degree longitude span fits in a 256-pixel square.
    box_w_zoom_0 = 256 * abs(self.east - self.west) / 360

    max_lat = BoundingBox.MAX_LATITUDE if clamp_lat else 90
    north = Clamp(self.north, -max_lat, max_lat)
    south = Clamp(self.south, -max_lat, max_lat)

    # Height of this box in pixels if displayed at zoom level 0.
    box_h_zoom_0 = LatToY(north) - LatToY(south)

    # Magnification factor at which the box would just fit in the window.
    scale_factor = min(width/box_w_zoom_0, height/box_h_zoom_0)

    # Maximum zoom level is measured in powers of 2.
    return int(max(0, math.floor(Log(scale_factor, 2))))

  def GetCenter(self):
    """Returns the center of the bounding box in latitude-longitude space.

    In general this is not the center of the region on the sphere.

    Returns:
      A Point instance for the coordinates at the center of this box in
      latitude-longitude space.
    """
    lat = 0.5 * (self.north + self.south)
    lon = (0.5 * self.lon_span) + self.west
    return Point(lat, lon)

  def GetDiagonalDistance(self):
    """Calculates the distance between SW and NE corners of the box.

    Returns:
      Length of the box diagonal in km.
    """
    vertex_0 = Point(self.south, self.west)
    vertex_2 = Point(self.north, self.east)
    return GetEarthDistance(vertex_0, vertex_2) / 1000

  def __iter__(self):
    """Returns coordinates in llbox ordering."""
    return iter((self.north, self.south, self.east, self.west))

  def __repr__(self):
    return 'BoundingBox(%s, %s, %s, %s, lon_span=%s)' % (
        tuple(self) + (self.lon_span,))


def GetAngularDistance(a, b):
  """Finds the great-circle distance between two points in degrees < 180."""
  # Haversine formula from http://en.wikipedia.org/wiki/Great-circle_distance
  a_lat, a_lon, b_lat, b_lon = map(ToRadians, [a.lat, a.lon, b.lat, b.lon])
  d_lat, d_lon = b_lat - a_lat, b_lon - a_lon
  a = sin(d_lat / 2)**2 + cos(a_lat) * cos(b_lat) * sin(d_lon / 2)**2
  return ToDegrees(2 * atan2(sqrt(a), sqrt(1 - a)))


def GetEarthDistance(a, b):
  """Finds the great-circle distance in meters between points on the Earth."""
  # Assume spherical Earth
  return ToRadians(GetAngularDistance(a, b)) * EARTH_MEAN_RADIUS


def GetLatitudeOnGreatCircle(a, b, longitude):
  """Computes the latitude where a given meridian intersects a great circle.

  Args:
    a: One point on the great circle (with 'lat' and 'lon' attributes).
    b: Another point on the great circle (with 'lat' and 'lon' attributes).
    longitude: A longitude in degrees, from -180 to 180.
  Returns:
    The latitude in [-90, 90) such that the point at (latitude, longitude)
    lies on the great circle defined by the two given points a and b.
  """
  a_lat, a_lon, b_lat, b_lon = map(ToRadians, [a.lat, a.lon, b.lat, b.lon])
  p_lon = ToRadians(longitude)
  p_lat = atan2(sin(a_lat) * cos(b_lat) * sin(p_lon - b_lon) -
                sin(b_lat) * cos(a_lat) * sin(p_lon - a_lon),
                cos(a_lat) * cos(b_lat) * sin(a_lon - b_lon))
  return (ToDegrees(p_lat) + 90) % 180 - 90  # ensure -90 <= result < 90


def EdgeTouchesMeridian(a, b, longitude):
  """Determines whether the edge from a to b touches a given meridian."""
  # To ensure that our crossing counts have the correct parity, we include the
  # left endpoint but not the right endpoint.
  low, high = min(a.lon, b.lon), max(a.lon, b.lon)
  if high - low >= 180:  # edge crosses the 180-degree meridian
    return longitude >= high or longitude < low
  return low <= longitude < high


def PolygonContainsPoint(vertices, point):
  """Tests whether a geodesic polygon contains a point.

  Args:
    vertices: A list of vertices (each with 'lat' and 'lon' attributes).
    point: A point (with 'lat' and 'lon' attributes).
  Returns:
    True if the point lies inside the polygon with the given vertices.  Each
    polygon edge is the great-circle segment between two adjacent vertices,
    and the interior is defined to be the side not containing the south pole.
    May return True or False for points that lie on the polygon boundary.
  """
  return sum(
      # Does the edge cross the segment from the south pole to the point?
      (EdgeTouchesMeridian(a, b, point.lon) and
       GetLatitudeOnGreatCircle(a, b, point.lon) < point.lat)
      for a, b in zip(vertices, vertices[1:] + [vertices[0]])
  ) % 2


def GetBoundingBoxOfCoordinates(coordinates):
  """Returns smallest box containing all lat/long coordinates in given list.

  Args:
    coordinates: list of (lat, lon) 2-tuples.
  Returns:
    BoundingBox object.
  """
  # Latitude is easy
  north = max(x[0] for x in coordinates)
  south = min(x[0] for x in coordinates)

  # Longitude must account for wrapping around the Earth
  sorted_longs = [x[1] for x in coordinates]
  sorted_longs.sort()  # Sort West to East
  diffs = []
  # diffs[i] stores difference in degrees between sorted_longs[i] and
  # sorted_longs[i-1].
  for i in range(len(sorted_longs)):
    diff = sorted_longs[i] - sorted_longs[i-1]
    if i == 0:
      diff += 360
    diffs.append(diff)

  # Split at the greatest diff
  west_index = max(itertools.izip(diffs, range(len(diffs))))[1]
  east_index = west_index - 1
  west = sorted_longs[west_index]
  east = sorted_longs[east_index]

  box = BoundingBox(north, south, east, west)
  return box


def GetBoundingBoxFromCenterAndSize(center, lat_size, lon_size):
  """Creates a BoundingBox of the given size centered around the given point."""
  box = BoundingBox(center.lat, center.lat, center.lon, center.lon)
  return box.Pad(lat_size * 0.5, lon_size * 0.5)


def GetAntipode(point):
  """Returns the antipode (point diametrically opposite) of the given point."""
  return Point(-point.lat, point.lon + 180)


def CrossProduct((x1, y1, z1), (x2, y2, z2)):
  """Computes cross product of 2 vectors, which is normal to both vectors."""
  return (y1 * z2 - z1 * y2, z1 * x2 - x1 * z2, x1 * y2 - y1 * x2)


def PointToUnitVector(point):
  """Returns a Cartesian unit vector in the direction defined by point.

  Uses 0 longitude as positive x-axis, 90-deg E as positive y-axis.  This
  results in a right-handed coordinate system.

  Args:
    point: A Point object
  Returns:
    A 3-tuple representing a unit vector in 3d Cartesian space.
  """
  lat_rad = ToRadians(point.lat)
  lon_rad = ToRadians(point.lon)
  return (cos(lat_rad) * cos(lon_rad), cos(lat_rad) * sin(lon_rad),
          sin(lat_rad))


def VectorToPoint((x, y, z)):
  """Returns a Point object in the direction of the given vector.

  Uses 0 longitude as positive x-axis, 90-deg E as positive y-axis.  This
  results in a right-handed coordinate system.

  Args:
    (x, y, z): A 3-tuple representing a vector in 3d Cartesian space.
  Returns:
    A Point object.
  """
  lat_rad = asin(z / sqrt(x**2 + y**2 + z**2))
  lon_rad = atan2(y, x)
  return Point(ToDegrees(lat_rad), ToDegrees(lon_rad))


def GetClosestPointOnGreatCircle(arc, point):
  """Returns point on great circle closest to the given point.

  Args:
    arc: An Arc object.  Defines a great circle.
    point: A Point object.
  Returns:
    2-tuple of (min_distance, closest_point).
  """
  # Vector normal to plane of given circle
  normal_vector = CrossProduct(PointToUnitVector(arc.start),
                               PointToUnitVector(arc.end))

  # Consider the circle through the given point and normal_point.
  # The intersection of our two circles is a single line segment with
  # endpoints diametrically opposite one another on the globe.
  # Since this segment is within the planes of both circles, it is in the
  # direction normal to the normal vectors of the two circles.
  intersection_vector = CrossProduct(PointToUnitVector(point),
                                     normal_vector)
  candidate = VectorToPoint(CrossProduct(normal_vector, intersection_vector))
  candidates = [(GetEarthDistance(p, point), p)
                for p in (candidate, GetAntipode(candidate))]
  # The endpoints of this segment are the closest and furthest points on the
  # given great circle to the given point.
  # Proof: Drop a perpendicular from the point to the circle.
  # Closest/farthest points on the circle lie on the diameter that contains the
  # foot of this perpendicular, by the triangle inequality.
  # This diameter is the same one we just found.
  return min(candidates)


def GetClosestPointOnArc(arc, point):
  """Returns point on arc closest to the given point.

  Args:
    arc: An Arc object.
    point: A Point object.
  Returns:
    2-tuple of (min_distance, closest_point).
  """
  min_distance, closest_point = GetClosestPointOnGreatCircle(arc, point)
  start_distance = GetEarthDistance(closest_point, arc.start)
  end_distance = GetEarthDistance(closest_point, arc.end)
  arc_length = GetEarthDistance(arc.start, arc.end)
  if start_distance + end_distance > arc_length + 1e-7:
    # Checks roughly if closest_point lies on the minor arc.
    # If global min doesn't lie within arc, min over arc must be at an endpoint.
    # Proof: There is only one local minimum of f(x) = arclen(x, p) when f is
    # defined on a circle, and it is the global minimum computed above.
    # This follows from great circle distance being strictly monotonic in
    # Euclidean distance (chord lengths <=> arc lengths), and law of cosines.
    candidates = [(GetEarthDistance(point, arc.start), arc.start),
                  (GetEarthDistance(point, arc.end), arc.end)]
    return min(candidates)
  else:
    return (min_distance, closest_point)


def GetClosestPointInPolygon(vertices, point):
  """Returns point on or inside polygon closest to the given point.

  Args:
    vertices: A list of Point objects that represent the vertices of a polygon.
    point: A Point object.
  Returns:
    2-tuple of (min_distance, closest_point).
  """
  if PolygonContainsPoint(vertices, point):
    return (0, point)
  else:
    # Iterate over all polygon edges
    edges = zip(vertices, vertices[1:] + [vertices[0]])
    return min(GetClosestPointOnArc(Arc(a, b), point) for a, b in edges)
