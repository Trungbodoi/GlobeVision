import { useCallback, useEffect, useMemo, useState } from "react";
import { I18nContext } from "./I18nContext";
import { DEFAULT_LANGUAGE, LANGUAGES, PLACE_NAMES_VI, STRINGS } from "./strings";

const STORAGE_KEY = "globevision.lang";

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGUAGES.includes(next)) return;

    setLangState(next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Trình duyệt chặn localStorage: vẫn đổi ngôn ngữ trong phiên hiện tại.
    }
  }, []);

  const value = useMemo(() => {
    const dictionary = STRINGS[lang];

    const t = (key, vars) => {
      const template = dictionary[key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;

      if (!vars) return template;

      return template.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
    };

    // Dịch tên châu lục / khu vực; giữ nguyên nếu chưa có bản dịch.
    const place = (name) => {
      if (!name) return name;

      return lang === "vi" ? PLACE_NAMES_VI[name] || name : name;
    };

    return { lang, setLang, t, place };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export default I18nProvider;
