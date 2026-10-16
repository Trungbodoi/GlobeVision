// Đồng bộ quốc gia đang xem với URL (?country=VN) để chia sẻ liên kết
// và dùng được nút Back/Forward của trình duyệt.

const PARAM = "country";

export function readCountryParam() {
  const value = new URLSearchParams(window.location.search).get(PARAM);

  return value ? value.trim().toUpperCase() : null;
}

/**
 * Ghi mã quốc gia lên URL. id = null để xóa.
 * replace = true: thay mục lịch sử hiện tại thay vì thêm mục mới.
 */
export function writeCountryParam(id, { replace = false } = {}) {
  if (readCountryParam() === id) return;

  const url = new URL(window.location.href);

  if (id) url.searchParams.set(PARAM, id);
  else url.searchParams.delete(PARAM);

  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}
