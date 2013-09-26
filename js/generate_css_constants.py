#!/usr/bin/python

# Copyright 2013 Google Inc.  All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain a copy
# of the License at: http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distrib-
# uted under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, either express or implied.  See the License for
# specific language governing permissions and limitations under the License.

"""Generate JS to map cm.css. constant expressions to CSS class names.

Prints the contents of a JavaScript source file containing constant
definitions that map to CSS class name string literals wrapped in
goog.getCssName.

This allows the JavaScript compiler to perform CSS class renaming to
reduce stylesheet size (and JS code size).
"""

import fileinput
import re


def main():
  """Prints out JS constant declarations for the files named in argv."""
  constants = set(re.findall(r'cm\.css\.([A-Z_]+)', ''.join(fileinput.input())))
  print "goog.require('cm');"
  print "goog.provide('cm.css');"
  for constant in sorted(constants):
    class_name = 'cm-' + constant.lower().replace('_', '-')
    print '/** @const */ cm.css.%s = goog.getCssName(%r);' % (constant,
                                                              class_name)


if __name__ == '__main__':
  main()
