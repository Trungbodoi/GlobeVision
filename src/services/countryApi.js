// Gọi API countries.dev, kế thừa từ apiClient để có retry, timeout và cache 2 tầng.

import { apiRequest } from "./apiClient";

const API_BASE = "https://countries.dev";
const COUNTRY_TTL_MS = 24 * 60 * 60 * 1000; // 1 ngày
const CITY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

/**
 * Thông tin chi tiết quốc gia theo mã alpha-2 hoặc alpha-3.
 * @returns {Promise<{ data: any, stale: boolean, savedAt: number }>}
 */
export function getCountryInfo(code) {
  if (!code) {
    return Promise.reject(new Error("Không có mã quốc gia để gọi API"));
  }

  return apiRequest(
    `country.${code}`,
    `${API_BASE}/alpha/${encodeURIComponent(code)}`,
    {
      ttlMs: COUNTRY_TTL_MS,
      retries: 2,
      timeoutMs: 8000,
    }
  );
}

/**
 * Múi giờ IANA (vd. "Asia/Bangkok") của thủ đô, dùng để tính giờ địa phương
 * chính xác cho cả quốc gia có nhiều múi giờ.
 * @returns {Promise<{ timezone: string, city: string } | null>}
 */
export async function getCapitalTimezone(capital, countryCode) {
  if (!capital || !countryCode) return null;

  try {
    const { data } = await apiRequest(
      `city.${countryCode}.${capital}`,
      `${API_BASE}/cities?q=${encodeURIComponent(capital)}`,
      {
        ttlMs: CITY_TTL_MS,
        retries: 1,
        timeoutMs: 8000,
      }
    );

    const cities = Array.isArray(data) ? data : [];
    const inCountry = cities.filter((city) => city.countryCode === countryCode && city.timezone);

    const match =
      inCountry.find((city) => city.featureCode === "PPLC") ||
      inCountry.sort((a, b) => (b.population || 0) - (a.population || 0))[0];

    return match ? { timezone: match.timezone, city: match.name } : null;
  } catch (error) {
    console.warn(`Không lấy được múi giờ thủ đô (${capital}, ${countryCode}):`, error.message);
    return null;
  }
}
