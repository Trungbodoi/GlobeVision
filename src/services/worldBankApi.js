// Gọi World Bank Open Data API (không cần API key).
// Lấy các chỉ số phát triển: GDP/người, tuổi thọ, tỷ lệ đô thị hóa, CO2/người, tỷ lệ biết chữ.
// Giấy phép dữ liệu: Creative Commons Attribution 4.0 (CC BY 4.0).

import { apiRequest } from "./apiClient";

const WB_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 ngày

export const INDICATORS = {
  gdpPerCapita: {
    id: "NY.GDP.PCAP.CD",
    unitVi: "USD/người",
    unitEn: "USD/capita",
  },
  lifeExpectancy: {
    id: "SP.DYN.LE00.IN",
    unitVi: "năm",
    unitEn: "years",
  },
  urbanPopulationRate: {
    id: "SP.URB.TOTL.IN.ZS",
    unitVi: "% dân số",
    unitEn: "% of population",
  },
  co2PerCapita: {
    id: "EN.ATM.CO2E.PC",
    unitVi: "tấn/người",
    unitEn: "metric tons/capita",
  },
  literacyRate: {
    id: "SE.ADT.LITR.ZS",
    unitVi: "% người lớn",
    unitEn: "% adult",
  },
};

/**
 * Gọi 1 chỉ số của World Bank cho 1 quốc gia
 */
async function fetchIndicator(iso3, indicatorId, yearsCount = 6) {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(iso3)}/indicator/${indicatorId}?format=json&mrv=${yearsCount}`;
  const res = await apiRequest(`wb.${iso3}.${indicatorId}`, url, {
    ttlMs: WB_TTL_MS,
    timeoutMs: 8000,
    retries: 1,
  });

  const records = Array.isArray(res.data?.[1]) ? res.data[1] : [];
  // Lọc chỉ lấy các năm có giá trị hợp lệ, sắp xếp theo thứ tự thời gian tăng dần
  const history = records
    .filter((item) => item.value != null && Number.isFinite(item.value))
    .map((item) => ({
      year: Number(item.date),
      value: item.value,
    }))
    .sort((a, b) => a.year - b.year);

  const latest = history.length > 0 ? history[history.length - 1] : null;

  return {
    indicatorId,
    history,
    latest,
  };
}

/**
 * Lấy toàn bộ bộ chỉ số World Bank cho một quốc gia theo mã ISO 3
 * @param {string} iso3
 * @returns {Promise<Record<string, { latest: { year: number, value: number }|null, history: Array<{year: number, value: number}> }>>}
 */
export async function getCountryWorldBankData(iso3) {
  if (!iso3) return {};

  const keys = Object.keys(INDICATORS);
  const promises = keys.map((key) =>
    fetchIndicator(iso3, INDICATORS[key].id).catch(() => ({
      indicatorId: INDICATORS[key].id,
      history: [],
      latest: null,
    }))
  );

  const results = await Promise.all(promises);
  const output = {};

  keys.forEach((key, index) => {
    output[key] = {
      ...results[index],
      unitVi: INDICATORS[key].unitVi,
      unitEn: INDICATORS[key].unitEn,
      source: "World Bank Open Data (CC BY 4.0)",
    };
  });

  return output;
}
