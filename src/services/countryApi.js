// Gọi API countries.dev, có cache để:
// - không gọi lại API khi xem lại một quốc gia,
// - vẫn hiển thị dữ liệu đã lưu khi mất mạng hoặc API lỗi.

const API_BASE = "https://countries.dev";
const REQUEST_TIMEOUT_MS = 8000;

const COUNTRY_TTL_MS = 24 * 60 * 60 * 1000; // 1 ngày
const CITY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

const STORAGE_PREFIX = "globevision.api.";

const memoryCache = new Map();

function readCache(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);

  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);

    if (!raw) return null;

    const entry = JSON.parse(raw);

    memoryCache.set(key, entry);

    return entry;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  const entry = { savedAt: Date.now(), data };

  memoryCache.set(key, entry);

  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Hết dung lượng hoặc bị chặn: vẫn còn cache trong bộ nhớ.
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      const error = new Error(`API error: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lấy dữ liệu có cache.
 * - Cache còn hạn: trả ngay, không gọi API.
 * - Cache hết hạn hoặc chưa có: gọi API; nếu lỗi mà còn cache cũ thì trả
 *   cache cũ với stale = true.
 * @returns {Promise<{ data, stale: boolean, savedAt: number }>}
 */
async function cachedRequest(key, url, ttl) {
  const cached = readCache(key);

  if (cached && Date.now() - cached.savedAt < ttl) {
    return { data: cached.data, stale: false, savedAt: cached.savedAt };
  }

  try {
    const data = await fetchJson(url);

    writeCache(key, data);

    return { data, stale: false, savedAt: Date.now() };
  } catch (error) {
    if (cached) {
      return { data: cached.data, stale: true, savedAt: cached.savedAt };
    }

    throw error;
  }
}

/** Thông tin chi tiết quốc gia theo mã alpha-2 hoặc alpha-3. */
export function getCountryInfo(code) {
  if (!code) {
    return Promise.reject(new Error("Không có mã quốc gia để gọi API"));
  }

  return cachedRequest(
    `country.${code}`,
    `${API_BASE}/alpha/${encodeURIComponent(code)}`,
    COUNTRY_TTL_MS
  );
}

/**
 * Múi giờ IANA (vd. "Asia/Bangkok") của thủ đô, dùng để tính giờ địa phương
 * chính xác cho cả quốc gia có nhiều múi giờ.
 * @returns {Promise<{ timezone: string, city: string } | null>}
 */
export async function getCapitalTimezone(capital, countryCode) {
  if (!capital || !countryCode) return null;

  const { data } = await cachedRequest(
    `city.${countryCode}.${capital}`,
    `${API_BASE}/cities?q=${encodeURIComponent(capital)}`,
    CITY_TTL_MS
  );

  const cities = Array.isArray(data) ? data : [];
  const inCountry = cities.filter((city) => city.countryCode === countryCode && city.timezone);

  const match =
    inCountry.find((city) => city.featureCode === "PPLC") ||
    inCountry.sort((a, b) => (b.population || 0) - (a.population || 0))[0];

  return match ? { timezone: match.timezone, city: match.name } : null;
}
