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

"""Unit tests for crowd_report_tasks.py."""

import datetime
import crowd_report_tasks
import model
import test_utils
import utils


class CleanupTests(test_utils.BaseTest):
  """Tests the Cleanup class."""

  def testGet(self):
    """Tests CrowdReport.GetWithoutLocation."""
    now = datetime.datetime.utcnow()
    def TimeAgo(days=0, hours=0):
      return now - datetime.timedelta(days=days, hours=hours)

    self.SetTime(utils.UtcToTimestamp(
        TimeAgo(days=crowd_report_tasks.CROWD_REPORT_TTL_DAYS-1)))
    cr1 = test_utils.NewCrowdReport(topic_ids=['foo'])

    self.SetTime(utils.UtcToTimestamp(
        TimeAgo(days=crowd_report_tasks.CROWD_REPORT_TTL_DAYS)))
    cr2 = test_utils.NewCrowdReport(topic_ids=['foo'])

    self.SetTime(utils.UtcToTimestamp(
        TimeAgo(days=crowd_report_tasks.CROWD_REPORT_TTL_DAYS, hours=1)))
    cr3 = test_utils.NewCrowdReport(topic_ids=['foo'])

    self.SetTime(utils.UtcToTimestamp(
        TimeAgo(days=crowd_report_tasks.CROWD_REPORT_TTL_DAYS+1)))
    cr4 = test_utils.NewCrowdReport(topic_ids=['foo'])

    self.SetTime(utils.UtcToTimestamp(now))

    self.assertEquals(
        [cr1.key, cr2.key, cr3.key, cr4.key],
        [x.key for x in model.CrowdReport.GetWithoutLocation(
            topic_ids=['foo'], count=10)])

    with test_utils.Login('owner'):
      self.DoGet('/.crowd_report_cleanup')

    # Should have deleted the two reports older than CROWD_REPORT_TTL_DAYS
    self.assertEquals(
        [cr1.key, cr2.key],
        [x.key for x in model.CrowdReport.GetWithoutLocation(
            topic_ids=['foo'], count=10)])

if __name__ == '__main__':
  test_utils.main()
