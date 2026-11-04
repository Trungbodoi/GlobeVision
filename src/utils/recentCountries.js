const STORAGE_KEY = "globevision.recentCountries";
const MAX_RECENT_COUNTRIES = 5;

export function readRecentCountryIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter((id) => typeof id === "string" && /^[A-Z]{2}$/.test(id)))]
      .slice(0, MAX_RECENT_COUNTRIES);
  } catch {
    return [];
  }
}

export function recordRecentCountry(id) {
  if (typeof id !== "string" || !/^[A-Z]{2}$/.test(id)) return;
  const next = [id, ...readRecentCountryIds().filter((recentId) => recentId !== id)]
    .slice(0, MAX_RECENT_COUNTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Recent history is optional when storage is unavailable.
  }
}

export function clearRecentCountries() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The page can continue without persisted history.
  }
}
