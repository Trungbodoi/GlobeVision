
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

// ============================================================
// FILE HIỆN TẠI - GEOJSON 110m
// ============================================================

const CURRENT_GEOJSON = path.join(
  ROOT,
  "public",
  "custom.geojson"
);

// ============================================================
// FILE NATURAL EARTH 50m ĐÃ TẢI VỀ
// ============================================================

const COUNTRIES_50M = path.join(
  ROOT,
  "ne_50m_countries.geojson"
);

// ============================================================
// OUTPUT
// ============================================================

const OUTPUT_DIR = path.join(
  ROOT,
  "src",
  "data"
);

const SMALL_OUTPUT = path.join(
  OUTPUT_DIR,
  "small-countries.geojson"
);

// ============================================================
// COUNTRY CODE NORMALIZATION
// ============================================================

function normalizeCode(feature) {
  const p = feature.properties || {};

  let code =
    p.ISO_A2 ||
    p.iso_a2 ||
    p.ISO_A2_EH ||
    p.iso_a2_eh ||
    null;

  if (!code) {
    return null;
  }

  code = String(code).trim().toUpperCase();

  // Natural Earth dùng -99 cho một số quốc gia
  if (code === "-99") {
    const name = String(
      p.NAME ||
      p.NAME_EN ||
      p.ADMIN ||
      p.name ||
      ""
    ).trim();

    if (name === "France") {
      return "FR";
    }

    if (name === "Norway") {
      return "NO";
    }

    if (name === "Kosovo") {
      return "XK";
    }

    // Không dùng 2 vùng này
    if (
      name === "N. Cyprus" ||
      name === "Northern Cyprus" ||
      name === "Somaliland"
    ) {
      return null;
    }

    return null;
  }

  // Taiwan
  if (code === "CN-TW") {
    return "TW";
  }

  return code;
}

// ============================================================
// LẤY TÊN
// ============================================================

function getName(feature) {
  const p = feature.properties || {};

  return (
    p.NAME ||
    p.NAME_EN ||
    p.ADMIN ||
    p.name ||
    "Unknown"
  );
}

// ============================================================
// ĐỌC GEOJSON
// ============================================================

function loadGeoJSON(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Không tìm thấy ${label}:\n${filePath}`
    );
  }

  console.log(`\n📂 Đọc ${label}:`);
  console.log(filePath);

  const raw = fs.readFileSync(
    filePath,
    "utf8"
  );

  const data = JSON.parse(raw);

  if (
    !data.features ||
    !Array.isArray(data.features)
  ) {
    throw new Error(
      `${label} không có features[]`
    );
  }

  return data;
}

// ============================================================
// MAIN
// ============================================================

function main() {
  console.log(
    "=============================================="
  );

  console.log(
    "   CHECK SMALL COUNTRIES - 110m vs 50m"
  );

  console.log(
    "=============================================="
  );

  // ==========================================================
  // 1. ĐỌC 110m
  // ==========================================================

  const current = loadGeoJSON(
    CURRENT_GEOJSON,
    "GeoJSON 110m"
  );

  console.log(
    `\n📍 GeoJSON 110m: ${current.features.length} features`
  );

  // ==========================================================
  // 2. LẤY CODE CÁC NƯỚC ĐÃ CÓ
  // ==========================================================

  const existingCodes = new Set();

  for (
    const feature of current.features
  ) {
    const code =
      normalizeCode(feature);

    if (code) {
      existingCodes.add(code);
    }
  }

  console.log(
    `🔑 Mã quốc gia hợp lệ trong 110m: ${existingCodes.size}`
  );

  // ==========================================================
  // 3. ĐỌC NATURAL EARTH 50m
  // ==========================================================

  const countries50 = loadGeoJSON(
    COUNTRIES_50M,
    "Natural Earth 50m"
  );

  console.log(
    `🌍 Natural Earth 50m: ${countries50.features.length} features`
  );

  // ==========================================================
  // 4. TÌM CÁC NƯỚC CÓ TRONG 50m NHƯNG KHÔNG CÓ Ở 110m
  // ==========================================================

  const missingFeatures = [];

  for (
    const feature of countries50.features
  ) {
    const code =
      normalizeCode(feature);

    if (!code) {
      continue;
    }

    if (
      !existingCodes.has(code)
    ) {
      missingFeatures.push(
        feature
      );
    }
  }

  // ==========================================================
  // 5. HIỂN THỊ
  // ==========================================================

  console.log(
    `\n➕ Quốc gia có trong 50m nhưng thiếu ở 110m: ${missingFeatures.length}`
  );

  console.log(
    "\n===== DANH SÁCH ====="
  );

  if (
    missingFeatures.length === 0
  ) {
    console.log(
      "Không có quốc gia nào bị thiếu."
    );
  } else {
    missingFeatures.forEach(
      (feature, index) => {
        const code =
          normalizeCode(feature);

        const name =
          getName(feature);

        console.log(
          `${index + 1}. ${name} (${code})`
        );
      }
    );
  }

  // ==========================================================
  // 6. SAVE
  // ==========================================================

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  const smallGeoJSON = {
    type: "FeatureCollection",
    features: missingFeatures,
  };

  fs.writeFileSync(
    SMALL_OUTPUT,
    JSON.stringify(
      smallGeoJSON
    )
  );

  console.log(
    `\n💾 Đã tạo:`
  );

  console.log(
    SMALL_OUTPUT
  );

  // ==========================================================
  // 7. SUMMARY
  // ==========================================================

  console.log(
    "\n=============================================="
  );

  console.log(
    "                 HOÀN TẤT"
  );

  console.log(
    "=============================================="
  );

  console.log(
    `110m features       : ${current.features.length}`
  );

  console.log(
    `110m country codes  : ${existingCodes.size}`
  );

  console.log(
    `50m features        : ${countries50.features.length}`
  );

  console.log(
    `Nước cần bổ sung    : ${missingFeatures.length}`
  );

  console.log(
    `Output              : ${path.relative(ROOT, SMALL_OUTPUT)}`
  );

  console.log(
    "==============================================\n"
  );
}

// ============================================================
// RUN
// ============================================================

try {
  main();
} catch (error) {
  console.error(
    "\n❌ ERROR:"
  );

  console.error(
    error.message || error
  );

  process.exit(1);
}
