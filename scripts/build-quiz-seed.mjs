// Tạo migration dữ liệu quiz: tên từ public/data/countries.geojson,
// thủ đô và khu vực từ API countries.dev (GeoNames, CC BY 4.0).
// Chỉ gồm quốc gia độc lập, không thuộc nhóm vùng có tranh chấp.
//
// Chạy sau npm run data:build: npm run data:quiz

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(ROOT, "public", "data", "countries.geojson");
const OUTPUT = path.join(ROOT, "supabase", "migrations", "20261102000300_quiz_seed.sql");

// Nước quá nhỏ khó bấm trên địa cầu: không dùng cho câu "tìm trên địa cầu".
const MIN_LOCATE_SPAN = 1;

// API đánh dấu độc lập nhưng thực tế là lãnh thổ phụ thuộc hoặc tự trị;
// IL: vị thế thủ đô đang tranh chấp nên không đưa vào câu hỏi.
const EXCLUDED = new Set(["AW", "CK", "IO", "IL", "NU", "PN"]);

// Dữ liệu API đã cũ.
const CAPITAL_FIXES = {
  KZ: "Astana",
};

const countries = JSON.parse(fs.readFileSync(INPUT, "utf8"))
  .features.map((feature) => feature.properties)
  .filter((country) => country.iso2 && !country.disputed && !EXCLUDED.has(country.iso2));

const details = new Map();
let next = 0;

async function fetchWithRetry(url, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(20000) });
    } catch (error) {
      if (attempt >= attempts) throw error;
    }
  }
}

async function worker() {
  while (next < countries.length) {
    const { iso2 } = countries[next++];
    const response = await fetchWithRetry(`https://countries.dev/alpha/${iso2}`);

    if (response.ok) details.set(iso2, await response.json());
    else if (response.status !== 404) throw new Error(`${iso2}: HTTP ${response.status}`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));

const quote = (text) => `'${String(text).replaceAll("'", "''")}'`;

const rows = countries
  .filter((country) => {
    const data = details.get(country.iso2);

    return data?.independent && data.capital && data.region;
  })
  .map((country) => {
    const data = details.get(country.iso2);

    return `  (${[
      quote(country.iso2),
      quote(country.nameVi),
      quote(country.nameEn),
      quote(CAPITAL_FIXES[country.iso2] || data.capital),
      quote(data.region),
      country.span >= MIN_LOCATE_SPAN,
    ].join(", ")})`;
  });

fs.writeFileSync(
  OUTPUT,
  `-- Tạo bởi scripts/build-quiz-seed.mjs. Không sửa tay.\n` +
    `insert into public.quiz_countries (id, name_vi, name_en, capital, region, locatable) values\n` +
    `${rows.join(",\n")}\n` +
    `on conflict (id) do update set\n` +
    `  name_vi = excluded.name_vi,\n` +
    `  name_en = excluded.name_en,\n` +
    `  capital = excluded.capital,\n` +
    `  region = excluded.region,\n` +
    `  locatable = excluded.locatable;\n`
);

console.log(`Quốc gia trong quiz: ${rows.length}`);
