// Gọi Open-Meteo API để lấy thời tiết thời gian thực và khí hậu tại thủ đô.
// Không cần API key, miễn phí cho mục đích phi thương mại.
// Giấy phép dữ liệu: Creative Commons Attribution 4.0 (CC BY 4.0).

import { apiRequest } from "./apiClient";

const WEATHER_TTL_MS = 30 * 60 * 1000; // 30 phút

// Bảng mô tả mã thời tiết WMO (World Meteorological Organization)
const WMO_WEATHER_CODES = {
  0: { labelKey: "weather.code.clear", icon: "Sun" },
  1: { labelKey: "weather.code.mainlyClear", icon: "CloudSun" },
  2: { labelKey: "weather.code.partlyCloudy", icon: "CloudSun" },
  3: { labelKey: "weather.code.overcast", icon: "Cloud" },
  45: { labelKey: "weather.code.fog", icon: "CloudFog" },
  48: { labelKey: "weather.code.rimeFog", icon: "CloudFog" },
  51: { labelKey: "weather.code.lightDrizzle", icon: "CloudDrizzle" },
  53: { labelKey: "weather.code.moderateDrizzle", icon: "CloudDrizzle" },
  55: { labelKey: "weather.code.denseDrizzle", icon: "CloudRain" },
  61: { labelKey: "weather.code.lightRain", icon: "CloudRain" },
  63: { labelKey: "weather.code.moderateRain", icon: "CloudRain" },
  65: { labelKey: "weather.code.heavyRain", icon: "CloudRain" },
  71: { labelKey: "weather.code.lightSnow", icon: "CloudSnow" },
  73: { labelKey: "weather.code.moderateSnow", icon: "CloudSnow" },
  75: { labelKey: "weather.code.heavySnow", icon: "CloudSnow" },
  80: { labelKey: "weather.code.lightShowers", icon: "CloudDrizzle" },
  81: { labelKey: "weather.code.moderateShowers", icon: "CloudRain" },
  82: { labelKey: "weather.code.heavyShowers", icon: "CloudRain" },
  95: { labelKey: "weather.code.thunderstorm", icon: "CloudLightning" },
  96: { labelKey: "weather.code.lightHail", icon: "CloudHail" },
  99: { labelKey: "weather.code.heavyHail", icon: "CloudHail" },
};

export function getWeatherDescription(code) {
  const item = WMO_WEATHER_CODES[code];
  return item || { labelKey: "weather.code.unknown", icon: "CloudSun" };
}

/**
 * Lấy thời tiết thời gian thực tại tọa độ thủ đô
 * @param {number} lat - Vĩ độ
 * @param {number} lng - Kinh độ
 * @returns {Promise<{ temperature: number, apparentTemperature: number, humidity: number, windSpeed: number, weatherCode: number, time: string, source: string } | null>}
 */
export async function getCapitalWeather(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`;

  try {
    const res = await apiRequest(`weather.${lat.toFixed(2)}.${lng.toFixed(2)}`, url, {
      ttlMs: WEATHER_TTL_MS,
      timeoutMs: 6000,
      retries: 1,
    });

    const current = res.data?.current;
    if (!current) return null;

    return {
      temperature: Math.round(current.temperature_2m),
      apparentTemperature: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      weatherCode: current.weather_code,
      time: current.time,
      source: "Open-Meteo (CC BY 4.0)",
    };
  } catch (error) {
    console.warn(`Weather fetch failed for (${lat}, ${lng}):`, error.message);
    return null;
  }
}
