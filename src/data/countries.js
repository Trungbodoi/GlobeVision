// Bộ dữ liệu quốc gia chuẩn hóa (tạo bởi scripts/build-country-data.mjs).
// Mọi thành phần khác lấy thông tin quốc gia qua module này thay vì
// đọc trực tiếp thuộc tính GeoJSON.

const DATA_URL = `${import.meta.env.BASE_URL}data/countries.geojson`;

// Tên gọi thông dụng không có trong dữ liệu Natural Earth.
const ALIASES = {
  US: ["Mỹ", "USA", "America"],
  GB: ["Anh", "UK", "Britain", "England"],
  KP: ["Triều Tiên", "Bắc Triều Tiên"],
  KR: ["Nam Hàn", "Korea"],
  RU: ["Russian Federation"],
  CZ: ["Czechia", "Séc"],
  MM: ["Miến Điện", "Burma"],
  CI: ["Côte d'Ivoire"],
  AE: ["UAE"],
  NL: ["Holland", "Hà Lan"],
};

/** Bỏ dấu, chữ thường: "Việt Nam" -> "viet nam". */
export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

function buildCountry(feature) {
  const p = feature.properties;

  const names = [p.nameVi, p.nameEn, p.nameLong, ...(ALIASES[p.id] || [])].filter(Boolean);

  return {
    ...p,
    feature,
    searchNames: [...new Set(names.map(normalizeText))],
    searchCodes: [p.id, p.iso2, p.iso3].filter(Boolean).map((code) => code.toLowerCase()),
  };
}

let cache = null;

/**
 * Tải và lập chỉ mục dữ liệu quốc gia (chỉ tải một lần).
 * @returns {Promise<{ list, byId, byIso3, features }>}
 */
export function loadCountries() {
  if (!cache) {
    cache = fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Không tải được dữ liệu quốc gia (${response.status})`);
        }

        return response.json();
      })
      .then((geojson) => {
        const list = geojson.features.map(buildCountry);

        return {
          list,
          features: geojson.features,
          byId: new Map(list.map((country) => [country.id, country])),
          byIso3: new Map(list.map((country) => [country.iso3, country])),
        };
      })
      .catch((error) => {
        cache = null;
        throw error;
      });
  }

  return cache;
}

export function getCountryName(country, lang) {
  if (!country) return "";

  return lang === "en" ? country.nameEn : country.nameVi;
}

/**
 * Tìm quốc gia theo tên tiếng Việt, tiếng Anh, tên gọi khác hoặc mã ISO.
 * Kết quả được xếp hạng: trùng mã > tên bắt đầu bằng từ khóa >
 * một từ trong tên bắt đầu bằng từ khóa > tên chứa từ khóa.
 */
export function searchCountries(list, query, lang, limit = 8) {
  const q = normalizeText(query);

  if (!q) return [];

  const results = [];

  for (const country of list) {
    let score = 0;

    if (country.searchCodes.includes(q)) {
      score = 100;
    } else {
      for (const name of country.searchNames) {
        if (name === q) score = Math.max(score, 90);
        else if (name.startsWith(q)) score = Math.max(score, 70);
        else if (name.split(/[\s-]+/).some((word) => word.startsWith(q))) {
          score = Math.max(score, 50);
        } else if (q.length >= 3 && name.includes(q)) score = Math.max(score, 30);
      }
    }

    if (score > 0) results.push({ country, score });
  }

  return results
    .sort(
      (a, b) =>
        b.score - a.score ||
        getCountryName(a.country, lang).localeCompare(getCountryName(b.country, lang), lang)
    )
    .slice(0, limit)
    .map((result) => result.country);
}
