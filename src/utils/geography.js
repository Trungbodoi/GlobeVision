const EARTH_RADIUS_KM = 6371.0088;

const VIRIDIS = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];

export const GROUP_MEMBER_COLOR = "#f59e0b";
export const GROUP_OUTSIDE_COLOR = "#334155";

/**
 * Màu của một quốc gia theo bộ lọc nhóm và chỉ số đang chọn.
 * Nhóm chỉ quyết định nước nào được làm mờ; nước trong nhóm vẫn tô theo chỉ số.
 * Trả về null khi không có màu riêng, nơi gọi sẽ dùng màu mặc định.
 */
export function getExplorerCountryColor(country, explorer) {
  const groupActive = Boolean(explorer?.group) && explorer.group !== "none";
  if (groupActive && !explorer.groupCountryIds?.has(country.id)) return GROUP_OUTSIDE_COLOR;

  const metricColor = explorer?.metricColors?.get(country.iso3);
  if (metricColor) return metricColor;

  const metricActive = Boolean(explorer?.metric) && explorer.metric !== "none";
  return groupActive && !metricActive ? GROUP_MEMBER_COLOR : null;
}

function parseHex(color) {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

function interpolateColor(start, end, amount) {
  const from = parseHex(start);
  const to = parseHex(end);
  return `#${from.map((value, index) =>
    Math.round(value + (to[index] - value) * amount).toString(16).padStart(2, "0")
  ).join("")}`;
}

export function getMetricColor(value, values, logarithmic = false) {
  if (!Number.isFinite(value) || values.length === 0) return null;

  const finiteValues = values.filter((item) => Number.isFinite(item) && item > 0);
  if (finiteValues.length === 0) return null;
  const transform = logarithmic ? Math.log : (item) => item;
  const transformed = finiteValues.map(transform);
  const min = Math.min(...transformed);
  const max = Math.max(...transformed);
  const current = transform(value);
  const ratio = max === min ? 0.5 : Math.max(0, Math.min(1, (current - min) / (max - min)));
  const position = ratio * (VIRIDIS.length - 1);
  const index = Math.min(Math.floor(position), VIRIDIS.length - 2);

  return interpolateColor(VIRIDIS[index], VIRIDIS[index + 1], position - index);
}

export function formatMetric(value, locale, style = "number") {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    // Dạng rút gọn giữ một số lẻ để 1,4 tỷ không bị làm tròn thành 1 tỷ.
    maximumFractionDigits: style === "decimal" || value >= 1_000_000_000 ? 1 : 0,
    notation: value >= 1_000_000_000 ? "compact" : "standard",
  }).format(value);
}

export function getSolarCoordinates(date = new Date()) {
  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const daysSinceJ2000 = julianDay - 2451545;
  const meanLongitude = ((280.46 + 0.9856474 * daysSinceJ2000) % 360 + 360) % 360;
  const meanAnomaly = ((357.528 + 0.9856003 * daysSinceJ2000) % 360 + 360) % 360;
  const radians = Math.PI / 180;
  const eclipticLongitude =
    meanLongitude +
    1.915 * Math.sin(meanAnomaly * radians) +
    0.02 * Math.sin(2 * meanAnomaly * radians);
  const obliquity = (23.439 - 0.0000004 * daysSinceJ2000) * radians;
  const lambda = eclipticLongitude * radians;
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(lambda),
    Math.cos(lambda)
  ) / radians;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(lambda)) / radians;
  const siderealTime =
    (280.46061837 + 360.98564736629 * daysSinceJ2000) % 360;
  const longitude = ((rightAscension - siderealTime + 540) % 360) - 180;

  return { lat: declination, lng: longitude };
}

export function getGreatCircleDistanceKm(first, second) {
  const radians = Math.PI / 180;
  const lat1 = first.lat * radians;
  const lat2 = second.lat * radians;
  const deltaLat = (second.lat - first.lat) * radians;
  const deltaLng = (second.lng - first.lng) * radians;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_KM * centralAngle;
}

export function createDidYouKnowFacts(countries, lang = "vi") {
  const populated = countries.filter((country) => Number.isFinite(country.popEst) && country.popEst > 0);
  if (populated.length === 0) return [];

  const mostPopulous = [...populated].sort((a, b) => b.popEst - a.popEst)[0];
  const leastPopulous = [...populated].sort((a, b) => a.popEst - b.popEst)[0];
  const continentTotals = new Map();
  for (const country of populated) {
    if (!country.continent) continue;
    continentTotals.set(country.continent, (continentTotals.get(country.continent) || 0) + country.popEst);
  }
  const largestContinent = [...continentTotals].sort((a, b) => b[1] - a[1])[0];

  return [
    {
      type: "largestPopulation",
      country: lang === "vi" ? mostPopulous.nameVi : mostPopulous.nameEn,
      population: formatMetric(mostPopulous.popEst, lang === "vi" ? "vi-VN" : "en-US"),
      year: mostPopulous.popYear || "—",
    },
    {
      type: "smallestPopulation",
      country: lang === "vi" ? leastPopulous.nameVi : leastPopulous.nameEn,
      population: formatMetric(leastPopulous.popEst, lang === "vi" ? "vi-VN" : "en-US"),
      year: leastPopulous.popYear || "—",
    },
    ...(largestContinent
      ? [{
          type: "largestContinentPopulation",
          continent: largestContinent[0],
          population: formatMetric(largestContinent[1], lang === "vi" ? "vi-VN" : "en-US"),
        }]
      : []),
  ];
}

export function getCapitalCoordinates(country, capitals) {
  const capital = capitals.find(
    (feature) =>
      (country.iso2 && feature.properties.iso2 === country.iso2) ||
      (country.iso3 && feature.properties.iso3 === country.iso3)
  );
  if (capital) {
    const [lng, lat] = capital.geometry.coordinates;
    return { lat, lng, name: capital.properties.name };
  }
  return { lat: country.labelLat, lng: country.labelLng, name: country.nameEn };
}
