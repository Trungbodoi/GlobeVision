// Ngày theo múi giờ của người dùng, để "ngày mới" bắt đầu lúc 0 giờ tại chỗ
// thay vì theo UTC (ở Việt Nam là 7 giờ sáng).
export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPreviousLocalDateKey(date = new Date()) {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return getLocalDateKey(previous);
}
