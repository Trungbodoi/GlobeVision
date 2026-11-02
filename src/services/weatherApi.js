// Gọi Open-Meteo API để lấy thời tiết thời gian thực và khí hậu tại thủ đô.
// Không cần API key, miễn phí cho mục đích phi thương mại.
// Giấy phép dữ liệu: Creative Commons Attribution 4.0 (CC BY 4.0).

import { apiRequest } from "./apiClient";

const WEATHER_TTL_MS = 30 * 60 * 1000; // 30 phút

// Bảng mô tả mã thời tiết WMO (World Meteorological Organization)
const WMO_WEATHER_CODES = {
  0: { vi: "Trời quang đãng", en: "Clear sky", icon: "☀️" },
  1: { vi: "Ít mây", en: "Mainly clear", icon: "🌤️" },
  2: { vi: "Mây rải rác", en: "Partly cloudy", icon: "⛅" },
  3: { vi: "Nhiều mây", en: "Overcast", icon: "☁️" },
  45: { vi: "Có sương mù", en: "Foggy", icon: "🌫️" },
  48: { vi: "Sương mù đóng băng", en: "Depositing rime fog", icon: "🌫️" },
  51: { vi: "Mưa phùn nhẹ", en: "Light drizzle", icon: "🌦️" },
  53: { vi: "Mưa phùn vừa", en: "Moderate drizzle", icon: "🌦️" },
  55: { vi: "Mưa phùn dày", en: "Dense drizzle", icon: "🌧️" },
  61: { vi: "Mưa nhẹ", en: "Slight rain", icon: "🌧️" },
  63: { vi: "Mưa vừa", en: "Moderate rain", icon: "🌧️" },
  65: { vi: "Mưa to", en: "Heavy rain", icon: "🌧️" },
  71: { vi: "Tuyết rơi nhẹ", en: "Slight snow fall", icon: "🌨️" },
  73: { vi: "Tuyết rơi vừa", en: "Moderate snow fall", icon: "🌨️" },
  75: { vi: "Tuyết rơi dày", en: "Heavy snow fall", icon: "❄️" },
  80: { vi: "Mưa rào nhẹ", en: "Slight rain showers", icon: "🌦️" },
  81: { vi: "Mưa rào vừa", en: "Moderate rain showers", icon: "🌧️" },
  82: { vi: "Mưa rào rất to", en: "Violent rain showers", icon: "⛈️" },
  95: { vi: "Dông sét", en: "Thunderstorm", icon: "⚡" },
  96: { vi: "Dông kèm mưa đá nhẹ", en: "Thunderstorm with slight hail", icon: "⛈️" },
  99: { vi: "Dông kèm mưa đá nặng hạt", en: "Thunderstorm with heavy hail", icon: "⛈️" },
};

export function getWeatherDescription(code, lang = "vi") {
  const item = WMO_WEATHER_CODES[code];
  if (!item) {
    return {
      text: lang === "vi" ? "Thời tiết bình thường" : "Normal weather",
      icon: "🌤️",
    };
  }
  return {
    text: lang === "vi" ? item.vi : item.en,
    icon: item.icon,
  };
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
