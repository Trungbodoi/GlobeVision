import { apiRequest } from "./apiClient";

const STATIC_DATA_TTL_MS = 24 * 60 * 60 * 1000;

function isFeatureCollection(data) {
  return data?.type === "FeatureCollection" && Array.isArray(data.features);
}

export function loadStaticGeoJson(fileName) {
  const cacheKey = `geojson.${fileName}`;
  const url = `${import.meta.env.BASE_URL}data/${encodeURIComponent(fileName)}`;

  return apiRequest(cacheKey, url, {
    ttlMs: STATIC_DATA_TTL_MS,
    retries: 2,
    timeoutMs: 8000,
    getResponseError: (data) =>
      isFeatureCollection(data) ? null : `Invalid GeoJSON FeatureCollection: ${fileName}`,
  });
}
