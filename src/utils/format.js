// Định dạng số liệu và tên hiển thị dùng chung cho thẻ thông tin và bảng so sánh.

// API trả 0 cho một số chỉ số không có dữ liệu (vd. dân số Đài Loan).
export function hasValue(number) {
  return Number.isFinite(number) && number > 0;
}

export function numberLocale(lang) {
  return lang === "en" ? "en-US" : "vi-VN";
}

export function formatNumber(value, lang) {
  return Math.round(value).toLocaleString(numberLocale(lang));
}

// Số gọn cho nhãn biểu đồ: 97,3 triệu / 97.3M
export function formatCompact(value, lang) {
  return new Intl.NumberFormat(numberLocale(lang), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

// Tên ngôn ngữ / tiền tệ theo ngôn ngữ giao diện (có sẵn trong trình duyệt).
export function displayName(lang, type, code, fallback) {
  try {
    return new Intl.DisplayNames([lang], { type }).of(code) || fallback;
  } catch {
    return fallback;
  }
}

export function formatCurrencies(currencies, lang) {
  return currencies
    ?.map((item) => {
      const name = displayName(lang, "currency", item.code, item.name);

      return item.symbol ? `${name} (${item.code}, ${item.symbol})` : `${name} (${item.code})`;
    })
    .join(", ");
}

export function formatLanguages(languages, lang) {
  return languages?.map((item) => displayName(lang, "language", item.iso639_1, item.name)).join(", ");
}

export function formatCallingCodes(codes) {
  return codes
    ?.filter(Boolean)
    .map((code) => `+${code}`)
    .join(", ");
}
