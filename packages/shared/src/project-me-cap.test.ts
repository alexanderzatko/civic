import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayMerits } from "./merits.js";
import { capProjectRowsToCategory } from "./project-me-cap.js";

describe("capProjectRowsToCategory", () => {
  it("leaves rows unchanged when category covers the sum", () => {
    const rows = [
      { project_nid: "1", name: "A", me: 4 },
      { project_nid: "2", name: "B", me: 3 },
    ];
    assert.deepEqual(capProjectRowsToCategory(rows, 7), rows);
    assert.deepEqual(capProjectRowsToCategory(rows, 11.7), rows);
  });

  it("scales LAO-shaped volunteer rows so display sum equals tab", () => {
    // Gross ~7.53 → post-penalty volunteer ~2.96 (display 3).
    const rows = [
      { project_nid: "a", name: "User Lao74 Na bezky posts", me: 6.02 },
      { project_nid: "b", name: "User LAO Na bezky posts", me: 1.01 },
      { project_nid: "c", name: "Na bežky! web aplikácia", me: 0.5 },
    ];
    const capped = capProjectRowsToCategory(rows, 2.96);
    const sum = capped.reduce((s, r) => s + displayMerits(r.me), 0);
    assert.equal(sum, displayMerits(2.96));
    assert.equal(sum, 3);
    assert.ok(capped.every((r) => r.me >= 0));
    // Relative order preserved for positive weights.
    assert.ok(capped[0]!.me >= capped[1]!.me);
  });

  it("zeros rows when category is non-positive", () => {
    const rows = [{ name: "X", me: 5 }];
    assert.deepEqual(capProjectRowsToCategory(rows, 0), [{ name: "X", me: 0 }]);
    assert.deepEqual(capProjectRowsToCategory(rows, -2), [
      { name: "X", me: 0 },
    ]);
  });

  it("is a no-op for empty rows", () => {
    assert.deepEqual(capProjectRowsToCategory([], 3), []);
  });
});
