import { apiRequest } from "./apiClient";
import { loadStaticGeoJson } from "./staticDataApi";

const WB_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let geographyPromise;
const indicatorPromises = new Map();
let countryCodesPromise;

function getWorldBankError(data) {
  const messages = data?.[0]?.message;
  if (!Array.isArray(messages)) return null;
  return messages.map((message) => message?.value).filter(Boolean).join("; ") ||
    "World Bank returned an error response.";
}

function loadSupportedCountryCodes() {
  if (!countryCodesPromise) {
    countryCodesPromise = apiRequest(
      "wb.countries.v1",
      "https://api.worldbank.org/v2/country?format=json&per_page=500",
      {
        ttlMs: WB_TTL_MS,
        retries: 2,
        timeoutMs: 12000,
        getResponseError: getWorldBankError,
      }
    )
      .then(({ data }) => {
        if (!Array.isArray(data?.[1])) {
          throw new Error("World Bank returned an invalid country list.");
        }
        return new Set(
          data[1]
            .filter((country) => country.region?.id !== "NA")
            .map((country) => country.id)
            .filter((code) => /^[A-Z]{3}$/.test(code))
        );
      })
      .catch((error) => {
        countryCodesPromise = null;
        throw error;
      });
  }
  return countryCodesPromise;
}

export function loadGeographyData() {
  if (!geographyPromise) {
    geographyPromise = loadStaticGeoJson("geography.geojson")
      .then(({ data }) => data.features)
      .catch((error) => {
        geographyPromise = null;
        throw error;
      });
  }
  return geographyPromise;
}

export function getWorldBankIndicatorWorld(indicatorId, countryCodes) {
  if (!indicatorId) return Promise.reject(new Error("An indicator ID is required."));
  const requestedCodes = [...new Set(
    (countryCodes || []).filter((code) => /^[A-Z]{3}$/.test(code))
  )].sort();
  if (requestedCodes.length === 0) {
    return Promise.reject(new Error("At least one valid country ISO3 code is required."));
  }
  const promiseKey = `${indicatorId}:${requestedCodes.join(",")}`;

  if (!indicatorPromises.has(promiseKey)) {
    const promise = loadSupportedCountryCodes()
      .then((supportedCodes) => {
        const codes = requestedCodes.filter((code) => supportedCodes.has(code));
        if (codes.length === 0) {
          throw new Error("World Bank has no data for the selected country codes.");
        }

        const url =
          `https://api.worldbank.org/v2/country/${codes.map(encodeURIComponent).join(";")}` +
          `/indicator/${encodeURIComponent(indicatorId)}?format=json&per_page=20000&mrv=5`;
        return apiRequest(`wb.world.v2.${indicatorId}.${codes.join(".")}`, url, {
          ttlMs: WB_TTL_MS,
          retries: 2,
          timeoutMs: 12000,
          getResponseError: getWorldBankError,
        });
      })
      .then(({ data, stale, savedAt }) => {
        const records = Array.isArray(data?.[1]) ? data[1] : [];
        const latestByIso3 = new Map();
        for (const record of records) {
          if (
            !record.countryiso3code ||
            !Number.isFinite(record.value) ||
            !record.date
          ) {
            continue;
          }
          const previous = latestByIso3.get(record.countryiso3code);
          if (!previous || Number(record.date) > Number(previous.year)) {
            latestByIso3.set(record.countryiso3code, {
              value: record.value,
              year: Number(record.date),
            });
          }
        }
        return { values: latestByIso3, stale, savedAt };
      })
      .catch((error) => {
        indicatorPromises.delete(promiseKey);
        throw error;
      });
    indicatorPromises.set(promiseKey, promise);
  }
  return indicatorPromises.get(promiseKey);
}
