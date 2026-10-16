// Đồng bộ trạng thái với URL để chia sẻ liên kết và dùng được nút
// Back/Forward của trình duyệt:
//   ?country=VN          quốc gia đang xem
//   ?compare=VN,JP,FR    danh sách so sánh

const COUNTRY_PARAM = "country";
const COMPARE_PARAM = "compare";

function updateUrl(param, value, replace) {
  const url = new URL(window.location.href);

  if (value) url.searchParams.set(param, value);
  else url.searchParams.delete(param);

  // Giữ dấu phẩy dễ đọc thay vì %2C
  const next = url.toString().replace(/%2C/gi, ",");

  if (replace) window.history.replaceState(null, "", next);
  else window.history.pushState(null, "", next);
}

export function readCountryParam() {
  const value = new URLSearchParams(window.location.search).get(COUNTRY_PARAM);

  return value ? value.trim().toUpperCase() : null;
}

/**
 * Ghi mã quốc gia lên URL. id = null để xóa.
 * replace = true: thay mục lịch sử hiện tại thay vì thêm mục mới.
 */
export function writeCountryParam(id, { replace = false } = {}) {
  if (readCountryParam() === id) return;

  updateUrl(COUNTRY_PARAM, id, replace);
}

export function readCompareParam() {
  const value = new URLSearchParams(window.location.search).get(COMPARE_PARAM);

  if (!value) return [];

  return value
    .split(",")
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);
}

// Thay đổi danh sách so sánh không tạo mục lịch sử mới để nút Back
// vẫn quay lại quốc gia đã xem trước đó.
export function writeCompareParam(ids) {
  updateUrl(COMPARE_PARAM, ids.join(","), true);
}
