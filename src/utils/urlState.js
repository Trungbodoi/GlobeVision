// Đồng bộ trạng thái với URL để chia sẻ liên kết và dùng được nút
// Back/Forward của trình duyệt:
//   ?country=VN          quốc gia đang xem
//   ?compare=VN,JP,FR    danh sách so sánh

const COUNTRY_PARAM = "country";
const COMPARE_PARAM = "compare";
const APP_STATE_PARAMS = [
  "country",
  "compare",
  "quiz",
  "difficulty",
  "quizType",
  "path",
  "metric",
  "layer",
  "layers",
  "group",
  "intent",
];

function parseHashRoute(hash = "") {
  if (!hash.startsWith("#/")) return { path: null, params: new URLSearchParams() };
  const route = hash.slice(1);
  const queryIndex = route.indexOf("?");
  return {
    path: queryIndex === -1 ? route : route.slice(0, queryIndex),
    params: new URLSearchParams(queryIndex === -1 ? "" : route.slice(queryIndex + 1)),
  };
}

function serializeHashRoute(path, params) {
  const query = params.toString().replace(/%2C/gi, ",");
  return `#${path}${query ? `?${query}` : ""}`;
}

function hasAppState(params) {
  return APP_STATE_PARAMS.some((param) => params.has(param));
}

function dispatchNavigation() {
  window.dispatchEvent(new Event("globevision:navigate"));
}

export function createUrlWithParams(href, updates) {
  const url = new URL(href);
  const hashRoute = parseHashRoute(url.hash);
  const params = hashRoute.path ? hashRoute.params : url.searchParams;
  for (const [param, value] of Object.entries(updates)) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
      params.delete(param);
    } else {
      params.set(param, Array.isArray(value) ? value.join(",") : String(value));
    }
  }
  if (hashRoute.path) url.hash = serializeHashRoute(hashRoute.path, params);
  return url.toString().replace(/%2C/gi, ",");
}

export function updateUrlParams(updates, { replace = true } = {}) {
  const next = createUrlWithParams(window.location.href, updates);
  if (replace) window.history.replaceState(null, "", next);
  else window.history.pushState(null, "", next);
}

export function readRoutePath() {
  const { path } = parseHashRoute(window.location.hash || "");
  return path || "/";
}

export function readRouteSearchParams() {
  const { path, params } = parseHashRoute(window.location.hash || "");
  return path ? params : new URLSearchParams(window.location.search || "");
}

export function navigateToRoute(path, updates = {}, { replace = false } = {}) {
  const url = new URL(window.location.href);
  const currentRoute = parseHashRoute(url.hash);
  const params = currentRoute.path === path
    ? currentRoute.params
    : new URLSearchParams();

  for (const [param, value] of Object.entries(updates)) {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
      params.delete(param);
    } else {
      params.set(param, Array.isArray(value) ? value.join(",") : String(value));
    }
  }

  for (const param of APP_STATE_PARAMS) url.searchParams.delete(param);
  url.hash = serializeHashRoute(path, params);
  if (replace) window.history.replaceState(null, "", url.toString());
  else window.history.pushState(null, "", url.toString());
  dispatchNavigation();
}

export function canonicalizeInitialRoute() {
  const url = new URL(window.location.href);
  const current = parseHashRoute(url.hash);
  const legacyParams = url.searchParams;
  const hasLegacyState = hasAppState(legacyParams);

  if (current.path === "/globe") {
    if (hasLegacyState) {
      for (const param of APP_STATE_PARAMS) {
        if (!current.params.has(param) && legacyParams.has(param)) {
          current.params.set(param, legacyParams.get(param));
        }
        url.searchParams.delete(param);
      }
      url.hash = serializeHashRoute("/globe", current.params);
      window.history.replaceState(null, "", url.toString());
    }
    return "/globe";
  }

  if (hasLegacyState) {
    const params = new URLSearchParams();
    for (const param of APP_STATE_PARAMS) {
      const values = legacyParams.getAll(param);
      values.forEach((value) => params.append(param, value));
      url.searchParams.delete(param);
    }
    url.hash = serializeHashRoute("/globe", params);
    window.history.replaceState(null, "", url.toString());
    return "/globe";
  }

  if (current.path !== "/") {
    url.hash = "#/";
    window.history.replaceState(null, "", url.toString());
  } else if (!url.hash) {
    url.hash = "#/";
    window.history.replaceState(null, "", url.toString());
  }
  return "/";
}

function updateUrl(param, value, replace) {
  updateUrlParams({ [param]: value }, { replace });
}

export function readCountryParam() {
  const value = readRouteSearchParams().get(COUNTRY_PARAM);

  return value ? value.trim().toUpperCase() : null;
}

/**
 * Ghi mã quốc gia lên URL. id = null để xóa.
 * replace = true: thay mục lịch sử hiện tại thay vì thêm mục mới.
 */
export function writeCountryParam(id, { replace = false } = {}) {
  const normalizedId = id ? id.trim().toUpperCase() : null;
  if (readCountryParam() === normalizedId) return;

  updateUrl(COUNTRY_PARAM, normalizedId, replace);
}

export function readCompareParam() {
  const value = readRouteSearchParams().get(COMPARE_PARAM);

  if (!value) return [];

  return value
    .split(",")
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);
}

// Thay đổi danh sách so sánh không tạo mục lịch sử mới để nút Back
// vẫn quay lại quốc gia đã xem trước đó.
export function writeCompareParam(ids) {
  updateUrl(
    COMPARE_PARAM,
    [...new Set(ids.map((id) => id.trim().toUpperCase()))].join(","),
    true
  );
}
