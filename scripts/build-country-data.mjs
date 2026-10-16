// Chuẩn hóa dữ liệu quốc gia từ GeoJSON gốc (Natural Earth) thành
// bộ dữ liệu gọn mà ứng dụng sử dụng.
//
// Chạy: npm run data:build
//
// Đầu vào : data/source/custom.geojson, data/source/boundary-lines.geojson
// Đầu ra  : public/data/countries.geojson, public/data/boundaries.geojson

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "data", "source");
const OUTPUT_DIR = path.join(ROOT, "public", "data");

// 4 chữ số thập phân ≈ 11 m, đủ chính xác cho bản đồ tỉ lệ 1:50m–1:110m.
const PRECISION = 4;

// Mã ISO trong Natural Earth không khớp với mã mà API countries.dev dùng.
const ISO2_FIXES = {
  "CN-TW": "TW",
};

// Tên tiếng Anh thông dụng thay cho tên đầy đủ trong Natural Earth.
const NAME_EN_FIXES = {
  CN: "China",
};

// Các vùng có vị thế chính trị hoặc ranh giới đang tranh chấp.
// Dùng để hiển thị một ghi chú trung lập trên thẻ thông tin.
// (Không dùng trường TYPE của Natural Earth vì trường này gắn nhãn
// "Disputed" cho cả một số quốc gia thành viên Liên Hợp Quốc.)
const DISPUTED_IDS = new Set(["CYN", "SOL", "XK", "TW", "PS", "EH", "FK"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Natural Earth dùng lẫn khóa viết hoa (NAME_VI) và viết thường (name_vi).
function lowerKeys(properties = {}) {
  const result = {};

  for (const [key, value] of Object.entries(properties)) {
    result[key.toLowerCase()] = value;
  }

  return result;
}

function clean(value) {
  if (value == null) return null;

  const text = String(value).trim();

  if (text === "" || text === "-99") return null;

  return text;
}

function cleanNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function round(value) {
  const factor = 10 ** PRECISION;

  return Math.round(value * factor) / factor;
}

function roundLine(points) {
  const rounded = [];

  for (const [lng, lat] of points) {
    const point = [round(lng), round(lat)];
    const last = rounded[rounded.length - 1];

    if (!last || last[0] !== point[0] || last[1] !== point[1]) {
      rounded.push(point);
    }
  }

  return rounded;
}

function roundRing(ring) {
  const rounded = roundLine(ring);

  // Một vòng đa giác hợp lệ cần ít nhất 4 điểm (điểm đầu = điểm cuối).
  if (rounded.length < 4) {
    return ring.map(([lng, lat]) => [round(lng), round(lat)]);
  }

  return rounded;
}

function roundGeometry(geometry) {
  switch (geometry.type) {
    case "Polygon":
      return { type: "Polygon", coordinates: geometry.coordinates.map(roundRing) };
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: geometry.coordinates.map((polygon) => polygon.map(roundRing)),
      };
    case "LineString":
      return { type: "LineString", coordinates: roundLine(geometry.coordinates) };
    case "MultiLineString":
      return {
        type: "MultiLineString",
        coordinates: geometry.coordinates.map(roundLine),
      };
    default:
      throw new Error(`Kiểu hình học không hỗ trợ: ${geometry.type}`);
  }
}

function normalizeCountry(feature) {
  const p = lowerKeys(feature.properties);

  let iso2 = clean(p.iso_a2) || clean(p.iso_a2_eh);
  iso2 = iso2 ? ISO2_FIXES[iso2] || iso2.toUpperCase() : null;

  const iso3 = clean(p.iso_a3) || clean(p.iso_a3_eh);
  const adm0 = clean(p.adm0_a3);

  // id ổn định dùng cho URL và tìm kiếm: ưu tiên mã alpha-2,
  // vùng không có mã ISO thì dùng mã ADM0 của Natural Earth.
  const id = iso2 || adm0;

  const nameEn = NAME_EN_FIXES[id] || clean(p.name_en) || clean(p.name) || clean(p.admin);
  const nameVi = clean(p.name_vi) || nameEn;

  return {
    type: "Feature",
    properties: {
      id,
      iso2,
      iso3: iso3 || adm0,
      // Mã gửi lên API; null nếu vùng không có mã ISO.
      apiCode: iso2,
      nameVi,
      nameEn,
      nameLong: clean(p.name_long),
      continent: clean(p.continent),
      subregion: clean(p.subregion),
      popEst: cleanNumber(p.pop_est),
      popYear: cleanNumber(p.pop_year),
      gdpMd: cleanNumber(p.gdp_md),
      gdpYear: cleanNumber(p.gdp_year),
      labelLat: round(Number(p.label_y)),
      labelLng: round(Number(p.label_x)),
      disputed: DISPUTED_IDS.has(id),
    },
    geometry: roundGeometry(feature.geometry),
  };
}

function validate(countries) {
  const errors = [];
  const seen = new Set();

  for (const { properties: c } of countries) {
    if (!c.id) errors.push(`Thiếu id: ${c.nameEn}`);
    if (seen.has(c.id)) errors.push(`Trùng id: ${c.id}`);
    seen.add(c.id);

    if (!c.nameVi || !c.nameEn) errors.push(`Thiếu tên: ${c.id}`);
    if (!Number.isFinite(c.labelLat) || !Number.isFinite(c.labelLng)) {
      errors.push(`Thiếu tọa độ nhãn: ${c.id}`);
    }
  }

  return errors;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));

  return fs.statSync(file).size;
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const countrySource = readJson(path.join(SOURCE_DIR, "custom.geojson"));
const boundarySource = readJson(path.join(SOURCE_DIR, "boundary-lines.geojson"));

const countries = countrySource.features
  .filter((feature) => ["Polygon", "MultiPolygon"].includes(feature.geometry?.type))
  .map(normalizeCountry)
  .sort((a, b) => a.properties.nameEn.localeCompare(b.properties.nameEn));

const errors = validate(countries);

if (errors.length > 0) {
  console.error("Dữ liệu không hợp lệ:\n" + errors.join("\n"));
  process.exit(1);
}

const boundaries = boundarySource.features
  .filter((feature) => feature.geometry)
  .map((feature) => ({
    type: "Feature",
    properties: {},
    geometry: roundGeometry(feature.geometry),
  }));

const countrySize = writeJson(path.join(OUTPUT_DIR, "countries.geojson"), {
  type: "FeatureCollection",
  features: countries,
});

const boundarySize = writeJson(path.join(OUTPUT_DIR, "boundaries.geojson"), {
  type: "FeatureCollection",
  features: boundaries,
});

const withoutIso = countries.filter((c) => !c.properties.iso2).map((c) => c.properties.id);

console.log(`Quốc gia/vùng lãnh thổ: ${countries.length}`);
console.log(`Không có mã ISO (không gọi API): ${withoutIso.join(", ") || "không có"}`);
console.log(`countries.geojson : ${formatSize(countrySize)}`);
console.log(`boundaries.geojson: ${formatSize(boundarySize)}`);
