// Gọi Wikipedia REST API để lấy đoạn mô tả tóm tắt, ảnh đại diện và link bài viết gốc.
// Ưu tiên tiếng Việt, tự động dự phòng sang tiếng Anh nếu tiếng Việt chưa có bài.
// Giấy phép nội dung: Creative Commons Attribution-ShareAlike (CC BY-SA 4.0).

import { apiRequest } from "./apiClient";

const WIKI_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

/**
 * Lấy tóm tắt Wikipedia cho quốc gia
 * @param {string} nameVi - Tên tiếng Việt
 * @param {string} nameEn - Tên tiếng Anh
 * @returns {Promise<{ title: string, extract: string, thumbnail?: string, pageUrl?: string, lang: 'vi'|'en' } | null>}
 */
export async function getCountryWikiSummary(nameVi, nameEn) {
  if (!nameVi && !nameEn) return null;

  // Thử tiếng Việt trước
  if (nameVi) {
    try {
      const urlVi = `https://vi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nameVi.replace(/\s+/g, "_"))}`;
      const resVi = await apiRequest(`wiki.vi.${nameVi}`, urlVi, {
        ttlMs: WIKI_TTL_MS,
        timeoutMs: 6000,
        retries: 1,
      });

      if (resVi.data?.extract && resVi.data.type !== "disambiguation") {
        return {
          title: resVi.data.title || nameVi,
          extract: resVi.data.extract,
          thumbnail: resVi.data.thumbnail?.source || null,
          pageUrl: resVi.data.content_urls?.desktop?.page || null,
          lang: "vi",
          source: "Wikipedia (CC BY-SA 4.0)",
        };
      }
    } catch {
      // Chuyển tiếp sang thử tiếng Anh
    }
  }

  // Dự phòng sang tiếng Anh
  if (nameEn) {
    try {
      const urlEn = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nameEn.replace(/\s+/g, "_"))}`;
      const resEn = await apiRequest(`wiki.en.${nameEn}`, urlEn, {
        ttlMs: WIKI_TTL_MS,
        timeoutMs: 6000,
        retries: 1,
      });

      if (resEn.data?.extract && resEn.data.type !== "disambiguation") {
        return {
          title: resEn.data.title || nameEn,
          extract: resEn.data.extract,
          thumbnail: resEn.data.thumbnail?.source || null,
          pageUrl: resEn.data.content_urls?.desktop?.page || null,
          lang: "en",
          source: "Wikipedia (CC BY-SA 4.0)",
        };
      }
    } catch (err) {
      console.warn(`Wikipedia summary failed for ${nameEn}:`, err.message);
    }
  }

  return null;
}
