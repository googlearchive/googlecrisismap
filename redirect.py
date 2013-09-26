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

"""Configurable redirection service."""
# TODO(kpy): Fold this into the CatalogEntry system so users can easily
# set up redirections for map URLs.

__author__ = 'kpy@google.com (Ka-Ping Yee)'

import base_handler

from google.appengine.ext import db


class Redirection(db.Model):
  url = db.StringProperty()


class Redirect(base_handler.BaseHandler):
  """Configurable redirection service."""

  def Get(self, label):
    redirection = Redirection.get_by_key_name(label)
    self.redirect(redirection and str(redirection.url) or '/')
