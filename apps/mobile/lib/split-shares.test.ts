import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyManualShare,
  equalWholeParts,
  equalWholePercents,
  shareSum,
  withEqualShares,
  type SplitRecipient,
} from "./split-shares.js";

function recipient(
  uid: string,
  sharePct: number,
  opts?: Partial<SplitRecipient>,
): SplitRecipient {
  return {
    rovas_uid: uid,
    username: uid,
    display_name: uid,
    sharePct,
    isScanner: uid === "scanner",
    alwaysShare: false,
    ...opts,
  };
}

describe("equalWholePercents", () => {
  it("splits three ways with remainder on first", () => {
    assert.deepEqual(equalWholePercents(3), [34, 33, 33]);
  });
});

describe("equalWholeParts", () => {
  it("splits an arbitrary total", () => {
    assert.deepEqual(equalWholeParts(80, 2), [40, 40]);
    assert.deepEqual(equalWholeParts(30, 1), [30]);
  });
});

describe("applyManualShare", () => {
  it("recalculates untouched shares after each manual edit", () => {
    const start = withEqualShares([
      {
        rovas_uid: "scanner",
        username: "scanner",
        display_name: "You",
        isScanner: true,
        alwaysShare: false,
      },
      {
        rovas_uid: "a",
        username: "a",
        display_name: "A",
        isScanner: false,
        alwaysShare: true,
      },
      {
        rovas_uid: "b",
        username: "b",
        display_name: "B",
        isScanner: false,
        alwaysShare: false,
      },
    ]);
    assert.deepEqual(
      start.map((r) => r.sharePct),
      [34, 33, 33],
    );

    const step1 = applyManualShare(start, "scanner", 20, new Set());
    assert.deepEqual(
      step1.recipients.map((r) => r.sharePct),
      [20, 40, 40],
    );
    assert.equal(shareSum(step1.recipients), 100);
    assert.ok(step1.manuallyAdjustedUids.has("scanner"));

    const step2 = applyManualShare(
      step1.recipients,
      "a",
      50,
      step1.manuallyAdjustedUids,
    );
    assert.deepEqual(
      step2.recipients.map((r) => r.sharePct),
      [20, 50, 30],
    );
    assert.equal(shareSum(step2.recipients), 100);
    assert.ok(step2.manuallyAdjustedUids.has("scanner"));
    assert.ok(step2.manuallyAdjustedUids.has("a"));
    assert.ok(!step2.manuallyAdjustedUids.has("b"));
  });

  it("does not change other locked shares when none are untouched", () => {
    const recipients = [
      recipient("scanner", 20),
      recipient("a", 50),
      recipient("b", 30),
    ];
    const locked = new Set(["scanner", "a", "b"]);
    const next = applyManualShare(recipients, "b", 25, locked);
    assert.deepEqual(
      next.recipients.map((r) => r.sharePct),
      [20, 50, 25],
    );
    assert.equal(shareSum(next.recipients), 95);
  });

  it("clamps negative edits to zero and fills the rest", () => {
    const recipients = [
      recipient("scanner", 34),
      recipient("a", 33),
      recipient("b", 33),
    ];
    const next = applyManualShare(recipients, "scanner", -5, new Set());
    assert.equal(next.recipients[0]!.sharePct, 0);
    assert.deepEqual(
      next.recipients.slice(1).map((r) => r.sharePct),
      [50, 50],
    );
  });
});
