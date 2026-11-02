// Tầng gọi API dùng chung cho toàn bộ ứng dụng GlobeVision:
// - Hỗ trợ timeout tùy biến (mặc định 8s) dùng AbortController.
// - Tự động retry tối đa maxRetries lần (chỉ retry lỗi mạng và HTTP 5xx, có exponential backoff).
// - Hai tầng cache: Bộ nhớ RAM (Map) + localStorage (có TTL).
// - Chuẩn hóa kết quả trả về: { data, stale: boolean, savedAt: number, fromCache: boolean }.

const STORAGE_PREFIX = "globevision.cache.";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const INITIAL_BACKOFF_MS = 600;

const memoryCache = new Map();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readStorageCache(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStorageCache(key, entry) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quá dung lượng lưu trữ hoặc trình duyệt chặn: bỏ qua lỗi
  }
}

export function clearExpiredCache() {
  try {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey?.startsWith(STORAGE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(storageKey) || "{}");
          if (item?.expiresAt && item.expiresAt < now) {
            localStorage.removeItem(storageKey);
          }
        } catch {
          // Bỏ qua nếu parse hỏng
        }
      }
    }
  } catch {
    // Trình duyệt không cho phép duyệt localStorage
  }
}

/**
 * Thực hiện một HTTP request với timeout và retry có giới hạn.
 */
async function fetchWithRetry(url, options = {}, retries = DEFAULT_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        // Chỉ retry lỗi server 5xx, không retry lỗi client 4xx (vd: 404 không tìm thấy)
        const isServerError = response.status >= 500 && response.status < 600;
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.isServerError = isServerError;

        if (isServerError && attempt < retries) {
          lastError = error;
          attempt++;
          await wait(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
          continue;
        }

        throw error;
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timer);

      const isAbort = err.name === "AbortError";
      const isNetwork = !err.status && err.name !== "AbortError";

      // Retry khi lỗi mạng hoặc timeout
      if ((isAbort || isNetwork) && attempt < retries) {
        lastError = err;
        attempt++;
        await wait(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Quá số lần thử lại mà không thành công");
}

/**
 * Gọi API có cache 2 tầng:
 * - Nếu cache còn hạn: trả về ngay lập tức (fromCache: true, stale: false).
 * - Nếu không có cache hoặc hết hạn: gọi API.
 * - Nếu API lỗi mà còn cache cũ: trả về cache cũ kèm stale = true (cho phép hiển thị offline).
 *
 * @param {string} cacheKey - Khóa nhận diện dữ liệu
 * @param {string} url - Đường dẫn API
 * @param {object} [options]
 * @param {number} [options.ttlMs] - Thời gian sống của cache (ms)
 * @param {number} [options.timeoutMs] - Thời gian timeout mỗi lần thử (ms)
 * @param {number} [options.retries] - Số lần thử lại tối đa (mặc định: 2)
 * @param {RequestInit} [options.fetchOptions] - Các option fetch
 * @returns {Promise<{ data: any, stale: boolean, savedAt: number, fromCache: boolean }>}
 */
export async function apiRequest(cacheKey, url, options = {}) {
  const {
    ttlMs = 24 * 60 * 60 * 1000, // 24 giờ mặc định
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    fetchOptions = {},
  } = options;

  const now = Date.now();

  // 1. Kiểm tra RAM cache trước
  if (memoryCache.has(cacheKey)) {
    const entry = memoryCache.get(cacheKey);
    if (now - entry.savedAt < ttlMs) {
      return { data: entry.data, stale: false, savedAt: entry.savedAt, fromCache: true };
    }
  }

  // 2. Kiểm tra localStorage cache
  const storedEntry = readStorageCache(cacheKey);
  if (storedEntry) {
    memoryCache.set(cacheKey, storedEntry);
    if (now - storedEntry.savedAt < ttlMs) {
      return { data: storedEntry.data, stale: false, savedAt: storedEntry.savedAt, fromCache: true };
    }
  }

  // 3. Gọi API nếu cache đã hết hạn hoặc chưa có
  try {
    const data = await fetchWithRetry(url, fetchOptions, retries, timeoutMs);
    const entry = {
      savedAt: now,
      expiresAt: now + ttlMs,
      data,
    };

    memoryCache.set(cacheKey, entry);
    writeStorageCache(cacheKey, entry);

    return { data, stale: false, savedAt: now, fromCache: false };
  } catch (error) {
    // 4. Nếu gọi mạng thất bại, dùng lại cache cũ (kể cả đã hết hạn)
    const fallbackEntry = memoryCache.get(cacheKey) || storedEntry;
    if (fallbackEntry && fallbackEntry.data != null) {
      return { data: fallbackEntry.data, stale: true, savedAt: fallbackEntry.savedAt, fromCache: true };
    }

    throw error;
  }
}
