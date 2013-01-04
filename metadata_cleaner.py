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

"""Deletes stale SourceMetadata entities haven't been checked for long."""

__author__ = 'cimamoglu@google.com (Cihat Imamoglu)'

import datetime
import webapp2

from base_handler import BaseHandler
import metadata_retriever

# Number of minutes after which unchecked SourceMetadataModel entries are
# removed.
SOURCE_METADATA_TTL_MINUTES = 24 * 60


class MetadataCleaner(BaseHandler):
  """Handler for deletion of a CatalogEntry."""

  # "get" is part of the RequestHandler interface.  # pylint: disable-msg=C6409
  def get(self):
    # If a data source is last checked before date_limit, it can be deleted.
    date_limit = (datetime.datetime.utcnow() -
                  datetime.timedelta(seconds=60 * SOURCE_METADATA_TTL_MINUTES))
    entries = metadata_retriever.SourceMetadataModel.all()
    entries = entries.filter('last_checked <', date_limit)
    for metadata in entries:
      metadata.delete()


app = webapp2.WSGIApplication([(r'.*', MetadataCleaner)])

