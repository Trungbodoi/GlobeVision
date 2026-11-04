import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useI18n } from "./i18n/useI18n";
import ErrorBoundary from "./components/ErrorBoundary";
import Icon from "./components/Icon";
import LandingPage from "./components/LandingPage";
import LoadingScreen from "./components/LoadingScreen";
import {
  canonicalizeInitialRoute,
  navigateToRoute,
  readRoutePath,
} from "./utils/urlState";
import "./App.css";

let globeModulePromise;

function loadWorldGlobe() {
  if (!globeModulePromise) {
    globeModulePromise = import("./components/WorldGlobe.jsx").catch((error) => {
      globeModulePromise = null;
      throw error;
    });
  }
  return globeModulePromise;
}

const WorldGlobe = lazy(loadWorldGlobe);

function readTheme() {
  try {
    const stored = localStorage.getItem("globevision.theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function GlobeRoute({ theme, onToggleTheme, onHome }) {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleLoaded = useCallback(() => {
    setProgress(100);
    window.setTimeout(() => setLoading(false), 350);
  }, []);

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="globe-chunk-loading" role="status">
            <Icon name="Globe2" size={30} />
            <span>{t("app.loading")}</span>
          </div>
        }
      >
        {loading && <LoadingScreen progress={progress} />}
        <WorldGlobe
          onProgress={setProgress}
          onLoaded={handleLoaded}
          onHome={onHome}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  const { lang, t } = useI18n();
  const [route, setRoute] = useState(canonicalizeInitialRoute);
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const initialLoader = document.getElementById("initial-loader");
    if (initialLoader) initialLoader.remove();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t("app.title");
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t("home.hero.description");
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = t("app.title");
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = t("home.hero.description");
    const ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.content = lang === "vi" ? "vi_VN" : "en_US";
    const ogAlternateLocale = document.querySelector('meta[property="og:locale:alternate"]');
    if (ogAlternateLocale) ogAlternateLocale.content = lang === "vi" ? "en_US" : "vi_VN";
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.content = t("app.title");
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.content = t("home.hero.description");
  }, [lang, t]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("globevision.theme", theme);
    } catch {
      // The selected theme remains active for the current page.
    }
  }, [theme]);

  useEffect(() => {
    const syncRoute = () => setRoute(readRoutePath());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("globevision:navigate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("globevision:navigate", syncRoute);
    };
  }, []);

  useEffect(() => {
    if (route !== "/globe" || !import.meta.env.PROD || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) => {
        console.error("GlobeVision offline support could not be enabled.", error);
      });
  }, [route]);

  const prefetchGlobe = useCallback(() => {
    loadWorldGlobe().catch((error) => {
      console.error("GlobeVision could not preload the 3D globe.", error);
    });
  }, []);

  const goToGlobe = useCallback((query = {}) => {
    navigateToRoute("/globe", query);
  }, []);

  const goHome = useCallback(() => {
    navigateToRoute("/");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => current === "light" ? "dark" : "light");
  }, []);

  return route === "/globe" ? (
    <GlobeRoute
      theme={theme}
      onToggleTheme={toggleTheme}
      onHome={goHome}
    />
  ) : (
    <ErrorBoundary>
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenGlobe={goToGlobe}
        onPrefetchGlobe={prefetchGlobe}
      />
    </ErrorBoundary>
  );
}

export default App;
