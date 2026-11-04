import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { apiRequest } from "../src/services/apiClient.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(implementation) {
  vi.stubGlobal("fetch", implementation);
}

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 503 ? "Unavailable" : "OK",
    json: async () => data,
  };
}

test("API responses are cached in memory", async () => {
  let requests = 0;
  mockFetch(async () => {
    requests += 1;
    return response({ value: 42 });
  });
  const key = `test.memory.${Date.now()}`;

  const first = await apiRequest(key, "https://example.test/data", { retries: 0 });
  const second = await apiRequest(key, "https://example.test/data", { retries: 0 });

  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(second.data.value, 42);
  assert.equal(requests, 1);
});

test("API requests retry network failures before caching a response", async () => {
  let requests = 0;
  mockFetch(async () => {
    requests += 1;
    if (requests === 1) throw new TypeError("Network unavailable");
    return response({ value: "recovered" });
  });

  const result = await apiRequest(`test.retry.${Date.now()}`, "https://example.test/data", {
    retries: 1,
  });
  assert.equal(requests, 2);
  assert.equal(result.data.value, "recovered");
  assert.equal(result.fromCache, false);
});

test("API requests use expired stored data as a stale offline fallback", async () => {
  const values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  });
  mockFetch(async () => {
    throw new TypeError("Network unavailable");
  });

  const key = `test.stale.${Date.now()}`;
  globalThis.localStorage.setItem(`globevision.cache.${key}`, JSON.stringify({
    savedAt: Date.now() - 10_000,
    expiresAt: Date.now() - 5_000,
    data: { value: "saved" },
  }));
  const result = await apiRequest(key, "https://example.test/data", {
    ttlMs: 1,
    retries: 0,
  });

  assert.equal(result.data.value, "saved");
  assert.equal(result.stale, true);
  assert.equal(result.fromCache, true);
});

test("API response errors are surfaced without caching the error payload", async () => {
  const responses = [
    [{ message: [{ value: "Indicator not found." }] }],
    [{ page: 1, pages: 1, total: 1 }, [{ countryiso3code: "USA", value: 12, date: "2024" }]],
  ];
  mockFetch(async () => response(responses.shift()));

  const options = {
    getResponseError: (data) =>
      data?.[0]?.message?.map(({ value }) => value).filter(Boolean).join("; ") || null,
  };
  const cacheKey = `test.response-error.${Date.now()}`;
  await assert.rejects(apiRequest(cacheKey, "https://example.test/indicator", options), /Indicator not found/);

  const retry = await apiRequest(cacheKey, "https://example.test/indicator", options);
  assert.equal(retry.data[1][0].countryiso3code, "USA");
  assert.equal(retry.fromCache, false);
});
