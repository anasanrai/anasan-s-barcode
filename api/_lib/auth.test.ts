import { beforeAll, describe, expect, it } from "vitest";
import { hashPin, rateLimit, signToken, verifyPin, verifyToken } from "./auth";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-for-vitest";
});

describe("pin hashing", () => {
  it("round-trips a valid PIN", () => {
    const hash = hashPin("1234");
    expect(verifyPin("1234", hash)).toBe(true);
  });

  it("rejects a wrong PIN", () => {
    const hash = hashPin("1234");
    expect(verifyPin("9999", hash)).toBe(false);
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPin("1234", "")).toBe(false);
    expect(verifyPin("1234", "garbage")).toBe(false);
    expect(verifyPin("1234", "md5$aabbcc")).toBe(false);
  });

  it("produces unique salts for identical PINs", () => {
    const a = hashPin("1234");
    const b = hashPin("1234");
    expect(a).not.toBe(b);
    expect(verifyPin("1234", a)).toBe(true);
    expect(verifyPin("1234", b)).toBe(true);
  });
});

describe("tokens", () => {
  it("round-trips a manager payload", () => {
    const token = signToken({ role: "manager", storeId: "store_1" });
    const payload = verifyToken(token);
    expect(payload?.role).toBe("manager");
    expect(payload?.storeId).toBe("store_1");
  });

  it("round-trips an owner payload", () => {
    const payload = verifyToken(signToken({ role: "owner" }));
    expect(payload?.role).toBe("owner");
    expect(payload?.storeId).toBeUndefined();
  });

  it("rejects tampered tokens", () => {
    const token = signToken({ role: "owner" });
    const [body] = token.split(".");
    expect(verifyToken(`${body}.invalidsignature`)).toBeNull();
    expect(verifyToken("not.a.token")).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
    expect(verifyToken("")).toBeNull();
  });
});

describe("rateLimit", () => {
  it("allows requests under the limit and blocks after it", () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key).ok).toBe(true);
    expect(rateLimit(key).ok).toBe(true);
    expect(rateLimit(key).ok).toBe(true);
    expect(rateLimit(key).ok).toBe(true);
    expect(rateLimit(key).ok).toBe(true);
    const blocked = rateLimit(key);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("key-a").ok).toBe(true);
    expect(rateLimit("key-b").ok).toBe(true);
  });
});
