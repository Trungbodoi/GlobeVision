import { useCallback, useEffect, useState } from "react";

// Tải dữ liệu bất đồng bộ; gọi reload() để tải lại sau khi thay đổi.
// loader cần ổn định (useCallback hoặc hàm ở cấp module).
export function useLoad(loader) {
  const [state, setState] = useState({ loaded: false, data: null, failed: false });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loader()
      .then((data) => {
        if (!cancelled) setState({ loaded: true, data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ loaded: true, data: null, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, [loader, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { ...state, reload };
}
