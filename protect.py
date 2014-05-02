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

"""HTTP endpoint for form abuse protection.

This module prevents only the most casual attempts at automated form abuse
by requiring forms to be submitted with a signature of the form values that
is computed by executing some JavaScript, and limiting the time period during
which the same signature can be replayed with the same values.
"""

import json
import re
import time

import base_handler
import config

# Maximum total time difference we'll allow for a protected form submission,
# consisting of (a) the latency for a form submission to get from browser to
# server, plus (b) the *additional* clock offset introduced by any difference
# in rate between browser and server clocks from the moment that protection is
# initialized until the moment that the form submission is performed.
MAX_TIME_OFFSET_MS = 30000


def Adler32(data):
  """Computes the unsigned Adler-32 checksum of a string."""
  # We're using this instead of zlib.adler32() because it's easier to confirm
  # that this matches the JavaScript version of the same function below.  Also,
  # zlib.adler32() returns a signed result, and we want an unsigned result.
  a, b = 1, 0
  for ch in map(ord, data):
    a = (a + ch) % 0xfff1
    b = (b + a) % 0xfff1
  return b * 0x10000 + a


def Sign(request, salt, keys):
  """Computes a signature of the selected form parameters in the request."""
  total = 0
  for key in keys:
    term = Adler32(key + '=' + request.get(key, '') + salt)
    total = (total + term) % 0x100000000  # add terms so order doesn't matter
  return salt + ':' + str(total)


def Verify(request, keys):
  """Returns True if the request contains a valid signature."""
  signature = request.get('signature', '')

  # Limit how long requests can be replayed until they are required to have a
  # different timestamp and thus a different signature.
  try:
    timestamp = int(signature.split(':')[0])
  except ValueError:
    return False
  if abs(time.time() * 1000 - timestamp) > MAX_TIME_OFFSET_MS:
    return False

  return signature == Sign(request, str(timestamp), keys)


class Protect(base_handler.BaseHandler):
  """HTTP endpoint for form abuse protection."""

  def Get(self, domain=''):  # pylint: disable=unused-argument
    """Returns some JavaScript for initializing form protection."""
    callback = re.sub(r'[^a-zA-Z0-9_.]', '', self.request.get('callback'))
    keys = self.request.get('inputs').split(',')
    # The JS functions below must match Adler32 and Sign.  In JS, we avoid
    # &, | and only use *, +, % to ensure we get an unsigned 32-bit result.
    content = '''
(function() {
  var serverTimeOffset = %d - (new Date().getTime());

  function adler32(data) {
    var a = 1, b = 0;
    for (var i = 0; i < data.length; i++) {
      a = (a + data.charCodeAt(i)) %% 0xfff1;
      b = (b + a) %% 0xfff1;
    }
    return b * 0x10000 + a;
  }

  %s(function(params) {
    var total = 0, keys = %s;
    var salt = serverTimeOffset + (new Date().getTime()) + '';
    for (var i = 0; i < keys.length; i++) {
      var term = adler32(keys[i] + '=' + (params[keys[i]] || '') + salt);
      total = (total + term) %% 0x100000000;
    }
    params['signature'] = salt + ':' + total;
  });
})();
''' % (int(time.time() * 1000), callback, json.dumps(keys))

    self.response.headers['Content-Type'] = 'application/javascript'
    self.response.out.write(content)
