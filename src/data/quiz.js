export const REGIONS = ["Africa", "Americas", "Asia", "Europe", "Oceania"];
export const QUIZ_KINDS = ["locate", "flag", "capital"];

export const isLocateKind = (kind) => kind === "locate" || kind === "custom_locate";

export function getCountryNameByLang(item, lang) {
  return lang === "en" ? item.name_en : item.name_vi;
}

// Thang một sắc độ: càng đậm càng thành thạo.
export const MASTERY_LEVELS = [
  { key: "weak", min: 0, color: "#a8e2cd" },
  { key: "fair", min: 0.5, color: "#3fb68b" },
  { key: "strong", min: 0.8, color: "#0b6e4d" },
];

export function masteryLevel(ratio) {
  return MASTERY_LEVELS.filter((level) => ratio >= level.min).pop();
}
