// Gọi Nager.Date Public Holidays API để lấy các ngày lễ quốc gia sắp tới.
// Giấy phép dữ liệu: Open Data / Public Domain.

import { apiRequest } from "./apiClient";

const HOLIDAY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

/**
 * Lấy danh sách ngày lễ quốc gia sắp tới cho một quốc gia theo mã alpha-2
 * @param {string} iso2 - Mã quốc gia 2 ký tự (vd: "VN", "US", "JP")
 * @returns {Promise<Array<{ date: string, localName: string, name: string, source: string }>>}
 */
export async function getNextPublicHolidays(iso2) {
  if (!iso2) return [];

  const url = `https://date.nager.at/api/v3/NextPublicHolidays/${encodeURIComponent(iso2.toUpperCase())}`;

  try {
    const res = await apiRequest(`holidays.${iso2.toUpperCase()}`, url, {
      ttlMs: HOLIDAY_TTL_MS,
      timeoutMs: 6000,
      retries: 1,
    });

    const holidays = Array.isArray(res.data) ? res.data : [];
    return holidays.slice(0, 5).map((item) => ({
      date: item.date,
      localName: item.localName || item.name,
      name: item.name,
      source: "Nager.Date (Public Domain)",
    }));
  } catch (error) {
    console.warn(`Holidays fetch failed for ${iso2}:`, error.message);
    return [];
  }
}
