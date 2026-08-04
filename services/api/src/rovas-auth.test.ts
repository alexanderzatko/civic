import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseBearerAuthorization,
  rovasUidFromToken,
  type RovasTokenInfo,
} from "./rovas-auth.js";

describe("parseBearerAuthorization", () => {
  it("extracts the token", () => {
    assert.equal(parseBearerAuthorization("Bearer abc.def"), "abc.def");
    assert.equal(parseBearerAuthorization("bearer xyz"), "xyz");
  });

  it("rejects missing or malformed headers", () => {
    assert.equal(parseBearerAuthorization(undefined), null);
    assert.equal(parseBearerAuthorization("Basic x"), null);
    assert.equal(parseBearerAuthorization("Bearer"), null);
  });
});

describe("rovasUidFromToken", () => {
  it("stringifies numeric and string user ids", () => {
    const base: Omit<RovasTokenInfo, "user_id"> = {
      client_id: "civic",
      access_token: "t",
      expires: 9_999_999_999,
    };
    assert.equal(rovasUidFromToken({ ...base, user_id: 42 }), "42");
    assert.equal(rovasUidFromToken({ ...base, user_id: "7" }), "7");
  });
});
