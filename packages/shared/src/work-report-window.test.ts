import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bratislavaDateKey,
  isWorkReportDateOutsideWindow,
  WORK_REPORT_REPORTING_WINDOW_DAYS,
} from "./work-report-window.js";

describe("isWorkReportDateOutsideWindow", () => {
  const now = new Date("2026-10-09T12:00:00Z");

  it("allows work on today and exactly window days ago (Bratislava calendar)", () => {
    assert.equal(bratislavaDateKey(now), "2026-10-09");

    const todayUnix = Math.floor(
      new Date("2026-10-09T12:00:00Z").getTime() / 1000,
    );
    assert.equal(isWorkReportDateOutsideWindow(todayUnix, now), false);

    const oldestUnix = Math.floor(
      new Date("2026-09-09T12:00:00Z").getTime() / 1000,
    );
    assert.equal(
      bratislavaDateKey(new Date(oldestUnix * 1000)),
      "2026-09-09",
    );
    assert.equal(isWorkReportDateOutsideWindow(oldestUnix, now), false);
    assert.equal(WORK_REPORT_REPORTING_WINDOW_DAYS, 30);
  });

  it("rejects work older than the window", () => {
    const tooOldUnix = Math.floor(
      new Date("2026-09-08T12:00:00Z").getTime() / 1000,
    );
    assert.equal(
      bratislavaDateKey(new Date(tooOldUnix * 1000)),
      "2026-09-08",
    );
    assert.equal(isWorkReportDateOutsideWindow(tooOldUnix, now), true);
  });
});
