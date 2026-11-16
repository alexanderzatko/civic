import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toExpoTokenPayload } from "./rovas-civic-auth.js";

describe("toExpoTokenPayload", () => {
  it("maps Rovas mint fields to Expo TokenResponseConfig names", () => {
    const payload = toExpoTokenPayload({
      rovas_uid: 42,
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "user_profile",
    });
    assert.equal(payload.accessToken, "access");
    assert.equal(payload.refreshToken, "refresh");
    assert.equal(payload.expiresIn, 3600);
    assert.equal(payload.tokenType, "bearer");
    assert.equal(payload.scope, "user_profile");
    assert.equal(payload.rovasUid, 42);
    assert.equal(typeof payload.issuedAt, "number");
  });
});
