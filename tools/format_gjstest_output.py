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

"""Colorizes the output of gjstest and removes a few needless lines."""

import sys

passed = failed = 0
for line in sys.stdin:
  if line.rstrip() in ['[----------]', '[  PASSED  ]', '[  FAILED  ]']:
    pass  # omit overall summary messages.
  elif line[:12] == '[ RUN      ]':
    name = line[12:].strip()
  elif line[:12] == '[       OK ]':
    print '\x1b[32m' + line.rstrip() + '\x1b[0m'  # show success in green
    passed += 1
  elif line[:12] == '[  FAILED  ]' and line[12:].strip():
    print '\x1b[31m' + line.rstrip() + '\x1b[0m'  # show failure in red
    failed += 1
  else:
    print line.rstrip()

print '%d passed, %d failed.' % (passed, failed)
sys.exit(passed == 0 or failed > 0)
