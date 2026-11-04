import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { loadStaticGeoJson } from "../src/services/staticDataApi.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("static GeoJSON uses the shared API client and validates FeatureCollections", async () => {
  let requestedUrl = "";
  vi.stubGlobal("fetch", async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ type: "FeatureCollection", features: [] }),
    };
  });

  const result = await loadStaticGeoJson(`test-${Date.now()}.geojson`);

  assert.match(requestedUrl, /\/data\/test-\d+\.geojson$/);
  assert.deepEqual(result.data, { type: "FeatureCollection", features: [] });
  assert.equal(result.fromCache, false);
});

test("static GeoJSON rejects invalid feature collections", async () => {
  vi.stubGlobal("fetch", async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ type: "Feature", geometry: null }),
  }));

  await assert.rejects(
    loadStaticGeoJson(`invalid-${Date.now()}.geojson`),
    /Invalid GeoJSON FeatureCollection/
  );
});
