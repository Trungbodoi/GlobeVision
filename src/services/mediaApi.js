// Gọi Wikimedia Commons API để lấy ảnh địa danh, cảnh quan tiêu biểu của quốc gia.
// Giấy phép: Wikimedia Commons (Creative Commons / Public Domain).

import { apiRequest } from "./apiClient";

const MEDIA_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

function stripHtml(html) {
  if (!html) return "";
  return String(html).replace(/<[^>]+>/g, "").trim();
}

/**
 * Tìm kiếm ảnh phong cảnh / địa danh tiêu biểu từ Wikimedia Commons
 * @param {string} countryNameEn - Tên tiếng Anh của quốc gia
 * @param {number} [limit=6] - Số lượng ảnh tối đa
 * @returns {Promise<Array<{ id: string, title: string, url: string, description: string, artist: string, license: string, source: string }>>}
 */
export async function getCountryLandmarkPhotos(countryNameEn, limit = 6) {
  if (!countryNameEn) return [];

  const query = `${countryNameEn} landscape OR landmark`;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|extmetadata`;

  try {
    const res = await apiRequest(`commons.${countryNameEn}`, url, {
      ttlMs: MEDIA_TTL_MS,
      timeoutMs: 8000,
      retries: 1,
    });

    const pages = res.data?.query?.pages;
    if (!pages) return [];

    const results = [];
    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;

      const meta = info.extmetadata || {};
      const objectName = meta.ObjectName?.value || page.title.replace(/^File:/, "").replace(/\.[^.]+$/, "");
      const description = stripHtml(meta.ImageDescription?.value || objectName);
      const artist = stripHtml(meta.Artist?.value || "Wikimedia Commons");
      const license = meta.LicenseShortName?.value || "CC BY-SA";

      results.push({
        id: String(page.pageid),
        title: objectName,
        url: info.url,
        description: description.slice(0, 160),
        artist,
        license,
        source: `Wikimedia Commons (${license})`,
      });
    }

    return results;
  } catch (error) {
    console.warn(`Photos fetch failed for ${countryNameEn}:`, error.message);
    return [];
  }
}
