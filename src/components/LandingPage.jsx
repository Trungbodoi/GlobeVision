import { useEffect, useMemo, useState } from "react";
import { createDidYouKnowFacts } from "../utils/geography";
import { getCountryName, loadCountries } from "../data/countries";
import { clearRecentCountries, readRecentCountryIds } from "../utils/recentCountries";
import { FEATURES, FEATURE_GROUPS, INTENTS } from "../config/features";
import { useI18n } from "../i18n/useI18n";
import CountrySearch from "./CountrySearch";
import Icon from "./Icon";
import "./LandingPage.css";

const DATA_SOURCES = [
  { id: "naturalEarth", url: "https://www.naturalearthdata.com/" },
  { id: "countries", url: "https://countries.dev/" },
  { id: "worldBank", url: "https://data.worldbank.org/" },
  { id: "wikipedia", url: "https://www.wikimedia.org/" },
  { id: "weather", url: "https://open-meteo.com/" },
  { id: "holidays", url: "https://date.nager.at/" },
];

function getRandomCountry(countries, excludedId) {
  const candidates = countries.filter((country) => country.apiCode && country.id !== excludedId);
  if (!candidates.length) return countries.find((country) => country.apiCode) || null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function LandingPage({ theme, onToggleTheme, onOpenGlobe, onPrefetchGlobe }) {
  const { lang, setLang, t, place } = useI18n();
  const [countries, setCountries] = useState(null);
  const [countryError, setCountryError] = useState("");
  const [recentIds, setRecentIds] = useState(readRecentCountryIds);
  const [randomCountry, setRandomCountry] = useState(null);
  const [factIndex, setFactIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCountries()
      .then((data) => {
        if (cancelled) return;
        setCountries(data.list);
        setRandomCountry(getRandomCountry(data.list));
      })
      .catch((error) => {
        if (!cancelled) setCountryError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const countriesById = useMemo(
    () => new Map((countries || []).map((country) => [country.id, country])),
    [countries]
  );
  const recentCountries = useMemo(
    () => recentIds.map((id) => countriesById.get(id)).filter(Boolean),
    [recentIds, countriesById]
  );
  const facts = useMemo(
    () => createDidYouKnowFacts(countries || [], lang),
    [countries, lang]
  );
  const currentFact = facts.length ? facts[factIndex % facts.length] : null;

  function prefetchHandlers() {
    return {
      onPointerEnter: onPrefetchGlobe,
      onTouchStart: onPrefetchGlobe,
      onFocus: onPrefetchGlobe,
    };
  }

  function openFeature(feature) {
    if (feature.action === "toggleTheme") {
      onToggleTheme();
    } else if (feature.action === "toggleLanguage") {
      setLang(lang === "vi" ? "en" : "vi");
    } else if (feature.action === "focusCountrySearch") {
      document.getElementById("landing-country-search")?.focus();
    } else {
      onOpenGlobe(feature.query || {});
    }
  }

  function openCountry(id) {
    onOpenGlobe({ country: id });
  }

  function openIntent(intent) {
    const feature = FEATURES.find((item) => item.id === intent.featureId);
    if (feature?.id === "country-search") {
      document.getElementById("landing-country-search")?.focus();
      return;
    }
    if (feature?.status === "available") openFeature(feature);
  }

  function clearHistory() {
    clearRecentCountries();
    setRecentIds([]);
  }

  function chooseAnotherRandom() {
    setRandomCountry(getRandomCountry(countries || [], randomCountry?.id));
  }

  const globePreload = prefetchHandlers();

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#home-main">{t("home.skipToContent")}</a>

      <header className="landing-header">
        <div className="landing-header-inner">
          <a className="landing-brand" href="#/" aria-label={`GlobeVision — ${t("home.nav.home")}`}>
            <Icon name="Compass" size={25} />
            <span>GlobeVision</span>
          </a>

          <button
            type="button"
            className="landing-menu-toggle"
            aria-label={menuOpen ? t("home.nav.closeMenu") : t("home.nav.menu")}
            aria-expanded={menuOpen}
            aria-controls="landing-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? "X" : "Menu"} size={21} />
          </button>

          <nav
            id="landing-navigation"
            className={`landing-navigation${menuOpen ? " is-open" : ""}`}
            aria-label={t("home.nav.explore")}
          >
            <a href="#home-intents" onClick={() => setMenuOpen(false)}>{t("home.nav.explore")}</a>
            <a href="#group-learn" onClick={() => setMenuOpen(false)}>{t("home.nav.learn")}</a>
            <a href="#home-features" onClick={() => setMenuOpen(false)}>{t("home.nav.features")}</a>
            <a href="#home-sources" onClick={() => setMenuOpen(false)}>{t("home.nav.sources")}</a>
          </nav>

          <div className="landing-header-actions">
            <button
              type="button"
              className="landing-language-toggle"
              onClick={() => setLang(lang === "vi" ? "en" : "vi")}
              aria-label={t("app.languageSwitch")}
              title={t("app.languageSwitch")}
            >
              <span className={lang === "vi" ? "is-current" : ""}>VI</span>
              <span className={lang === "en" ? "is-current" : ""}>EN</span>
            </button>
            <button
              type="button"
              className="landing-icon-button"
              onClick={onToggleTheme}
              aria-label={t("home.theme.toggle")}
              title={t("home.theme.toggle")}
            >
              <Icon name={theme === "light" ? "Moon" : "Sun"} size={19} />
            </button>
            <button
              type="button"
              className="landing-header-cta"
              onClick={() => onOpenGlobe()}
              {...globePreload}
            >
              {t("home.nav.openGlobe")}
              <Icon name="ArrowUpRight" size={17} />
            </button>
          </div>
        </div>
      </header>

      <main id="home-main" className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">
              <span className="landing-eyebrow-line" aria-hidden="true" />
              {t("home.hero.eyebrow")}
            </p>
            <h1 id="landing-title">{t("home.hero.title")}</h1>
            <p className="landing-hero-description">{t("home.hero.description")}</p>
            <div className="landing-hero-actions">
              <button
                type="button"
                className="landing-primary-button"
                onClick={() => onOpenGlobe()}
                {...globePreload}
              >
                {t("home.hero.openGlobe")}
                <Icon name="ArrowRight" size={19} />
              </button>
              <button
                type="button"
                className="landing-secondary-button"
                onClick={() => onOpenGlobe({ quiz: "all" })}
                {...globePreload}
              >
                <Icon name="Lightbulb" size={18} />
                {t("home.hero.startQuiz")}
              </button>
            </div>
            <div className="landing-hero-index" aria-hidden="true">
              <span>01</span>
              <span className="landing-hero-index-rule" />
              <span>{t("home.hero.index")}</span>
            </div>
          </div>

          <div className="landing-orbit-art" aria-hidden="true">
            <div className="landing-orbit-halo" />
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            <div className="landing-orbit landing-orbit-three" />
            <div className="landing-planet">
              <svg viewBox="0 0 420 420" focusable="false">
                <defs>
                  <radialGradient id="landing-ocean" cx="34%" cy="28%" r="74%">
                    <stop offset="0%" stopColor="#285b8f" />
                    <stop offset="56%" stopColor="#10365f" />
                    <stop offset="100%" stopColor="#07172c" />
                  </radialGradient>
                  <clipPath id="landing-globe-clip">
                    <circle cx="210" cy="210" r="171" />
                  </clipPath>
                </defs>
                <circle cx="210" cy="210" r="179" fill="none" stroke="rgba(111,190,255,.32)" strokeWidth="1" />
                <g clipPath="url(#landing-globe-clip)">
                  <circle cx="210" cy="210" r="171" fill="url(#landing-ocean)" />
                  <g className="landing-globe-grid" fill="none">
                    <ellipse cx="210" cy="210" rx="62" ry="171" />
                    <ellipse cx="210" cy="210" rx="125" ry="171" />
                    <ellipse cx="210" cy="210" rx="171" ry="56" />
                    <ellipse cx="210" cy="210" rx="171" ry="112" />
                    <path d="M39 210h342M48 143h324M48 277h324" />
                  </g>
                  <g className="landing-globe-land">
                    <path d="m110 91 24-17 36 4 22 17-8 19-25 3-10 18-21-5-8-18-22-3-7-11 19-7Z" />
                    <path d="m173 137 23 5 17 20-7 25 11 19-12 37-20 23-5 37-17 31-13-14 3-35-16-29 5-33-10-25 10-28-3-20 17-13Z" />
                    <path d="m222 88 17-13 20 8 9 18-16 13-21-8-9-18Z" />
                    <path d="m267 117 25-11 21 9 23 2 17 17-10 17-27 4-11 22-18-9-7-24-20-10 7-17Z" />
                    <path d="m292 190 27 3 19 18-8 28-14 12-10 32-19 25-15-17 3-28-13-19 8-24 22-30Z" />
                    <path d="m235 57 42-9 37 15-15 10-29-7-18 10-20-19Z" />
                    <path d="m331 90 18-5 14 15-17 8-15-18Z" />
                  </g>
                  <circle cx="210" cy="210" r="171" fill="none" stroke="rgba(174,222,255,.34)" strokeWidth="1.5" />
                </g>
              </svg>
            </div>
            <span className="landing-orbit-label landing-orbit-label-one">21° N</span>
            <span className="landing-orbit-label landing-orbit-label-two">{t("home.hero.artLabel")}</span>
            <span className="landing-orbit-point landing-orbit-point-one" />
            <span className="landing-orbit-point landing-orbit-point-two" />
          </div>
        </section>

        <section className="landing-quick-search" aria-labelledby="quick-search-title">
          <div className="landing-section-heading">
            <span className="landing-section-index">{t("home.section.find")}</span>
            <h2 id="quick-search-title">{t("home.search.title")}</h2>
            <p>{t("home.search.hint")}</p>
          </div>
          {countries ? (
            <CountrySearch
              countries={countries}
              onSelect={openCountry}
              variant="landing"
              showLanguageToggle={false}
              inputId="landing-country-search"
            />
          ) : (
            <p className="landing-country-status" role={countryError ? "alert" : "status"}>
              {countryError ? t("home.error.countries", { error: countryError }) : t("card.loading")}
            </p>
          )}
        </section>

        <section id="home-intents" className="landing-intents" aria-labelledby="intent-title">
          <div className="landing-section-heading">
            <span className="landing-section-index">{t("home.section.intents")}</span>
            <h2 id="intent-title">{t("home.intent.title")}</h2>
          </div>
          <div className="landing-intent-grid">
            {INTENTS.map((intent, index) => (
              <button
                type="button"
                className="landing-intent-card"
                key={intent.id}
                onClick={() => openIntent(intent)}
                {...globePreload}
              >
                <span className="landing-intent-number">0{index + 1}</span>
                <span className="landing-intent-icon"><Icon name={intent.icon} size={22} /></span>
                <span className="landing-intent-title">{t(intent.titleKey)}</span>
                <span className="landing-intent-description">{t(intent.descriptionKey)}</span>
                <Icon className="landing-intent-arrow" name="ArrowUpRight" size={18} />
              </button>
            ))}
          </div>
        </section>

        <section id="home-features" className="landing-features" aria-labelledby="features-title">
          <div className="landing-section-heading">
            <span className="landing-section-index">{t("home.section.features")}</span>
            <h2 id="features-title">{t("home.features.title")}</h2>
          </div>
          <div className="landing-feature-groups">
            {FEATURE_GROUPS.map((group) => (
              <section className="landing-feature-group" key={group.id} aria-labelledby={`group-${group.id}`}>
                <h3 id={`group-${group.id}`}>
                  <Icon name={group.icon} size={18} />
                  {t(group.labelKey)}
                </h3>
                <div className="landing-feature-list">
                  {FEATURES.filter((feature) => feature.group === group.id).map((feature) => (
                    <FeatureCard
                      feature={feature}
                      key={feature.id}
                      lang={lang}
                      t={t}
                      onActivate={() => openFeature(feature)}
                      onPrefetch={onPrefetchGlobe}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        {recentCountries.length > 0 && (
          <section className="landing-recent" aria-labelledby="recent-title">
            <div className="landing-section-heading landing-section-heading-inline">
              <div>
                <span className="landing-section-index">{t("home.section.recent")}</span>
                <h2 id="recent-title">{t("home.recent.title")}</h2>
                <p>{t("home.recent.description")}</p>
              </div>
              <button
                type="button"
                className="landing-text-button"
                onClick={clearHistory}
                aria-label={t("home.recent.clearLabel")}
              >
                <Icon name="RotateCcw" size={16} />
                {t("home.recent.clear")}
              </button>
            </div>
            <div className="landing-recent-grid">
              {recentCountries.map((country, index) => (
                <button
                  type="button"
                  className="landing-recent-card"
                  key={country.id}
                  onClick={() => openCountry(country.id)}
                  aria-label={t("home.random.aria", { name: getCountryName(country, lang) })}
                  {...globePreload}
                >
                  <span className="landing-recent-index">0{index + 1}</span>
                  <span>{getCountryName(country, lang)}</span>
                  <span className="landing-recent-code">{country.iso2}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="landing-discover-cards" aria-label={t("home.random.title")}>
          <article className="landing-random-card">
            <div className="landing-card-topline">
              <span className="landing-section-index">{t("home.section.random")}</span>
              <Icon name="Sparkles" size={18} />
            </div>
            <h2>{t("home.random.title")}</h2>
            {randomCountry ? (
              <>
                <p className="landing-random-country">{getCountryName(randomCountry, lang)}</p>
                <span className="landing-random-meta">{place(randomCountry.continent)} · {randomCountry.iso2}</span>
                <div className="landing-random-actions">
                  <button type="button" className="landing-text-button" onClick={chooseAnotherRandom}>
                    <Icon name="RotateCcw" size={16} />
                    {t("home.random.next")}
                  </button>
                  <button
                    type="button"
                    className="landing-random-open"
                    onClick={() => openCountry(randomCountry.id)}
                    aria-label={t("home.random.aria", { name: getCountryName(randomCountry, lang) })}
                    {...globePreload}
                  >
                    {t("home.random.open")}
                    <Icon name="ArrowRight" size={17} />
                  </button>
                </div>
              </>
            ) : (
              <p className="landing-country-status" role={countryError ? "alert" : "status"}>
                {countryError ? t("home.error.countries", { error: countryError }) : t("card.loading")}
              </p>
            )}
          </article>

          <article className="landing-fact-card">
            <div className="landing-card-topline">
              <span className="landing-section-index">{t("home.section.fact")}</span>
              <Icon name="Lightbulb" size={18} />
            </div>
            <h2>{t("home.fact.title")}</h2>
            {currentFact && (
              <>
                <p className="landing-fact-label">{t(`fact.${currentFact.type}.label`)}</p>
                <p className="landing-fact-text">
                  {t(`fact.${currentFact.type}.text`, {
                    country: currentFact.country,
                    continent: place(currentFact.continent),
                    population: currentFact.population,
                    year: currentFact.year,
                  })}
                </p>
                <p className="landing-fact-source">{t("home.fact.source")}</p>
                {facts.length > 1 && (
                  <button
                    type="button"
                    className="landing-text-button"
                    onClick={() => setFactIndex((index) => index + 1)}
                  >
                    <Icon name="RotateCcw" size={16} />
                    {t("explorer.anotherFact")}
                  </button>
                )}
              </>
            )}
          </article>
        </section>

        <section id="home-sources" className="landing-sources" aria-labelledby="sources-title">
          <div className="landing-section-heading">
            <span className="landing-section-index">{t("home.section.sources")}</span>
            <h2 id="sources-title">{t("home.sources.title")}</h2>
            <p>{t("home.sources.description")}</p>
          </div>
          <div className="landing-source-grid">
            {DATA_SOURCES.map((source) => (
              <a
                className="landing-source-card"
                href={source.url}
                key={source.id}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="landing-source-name">{t(`home.sources.${source.id}.name`)}</span>
                <span className="landing-source-description">{t(`home.sources.${source.id}`)}</span>
                <span className="landing-source-license">{t(`home.sources.${source.id}.license`)}</span>
                <Icon name="ArrowUpRight" size={16} />
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <a href="https://github.com/trungbodoi/GlobeVision" target="_blank" rel="noreferrer noopener">
            <Icon name="ArrowUpRight" size={16} />
            {t("home.footer.github")}
          </a>
          <p>{t("home.footer.neutrality")}</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ feature, lang, t, onActivate, onPrefetch }) {
  const title = t(feature.titleKey);
  const content = (
    <>
      <span className="landing-feature-icon"><Icon name={feature.icon} size={19} /></span>
      <span className="landing-feature-copy">
        <span className="landing-feature-title">{title}</span>
        <span className="landing-feature-description">{t(feature.descriptionKey)}</span>
      </span>
      <span className={`landing-feature-status${feature.status === "soon" ? " is-soon" : ""}`}>
        {t(`home.status.${feature.status}`)}
      </span>
    </>
  );

  if (feature.status === "soon") {
    return (
      <div className="landing-feature-card is-disabled" aria-disabled="true">
        {content}
      </div>
    );
  }

  if (feature.action) {
    return (
      <button type="button" className="landing-feature-card" onClick={onActivate}>
        {content}
      </button>
    );
  }

  const query = feature.query
    ? `?${new URLSearchParams(feature.query).toString().replace(/%2C/gi, ",")}`
    : "";
  return (
    <a
      className="landing-feature-card"
      href={`#${feature.href}${query}`}
      onClick={(event) => {
        event.preventDefault();
        onActivate();
      }}
      onPointerEnter={onPrefetch}
      onTouchStart={onPrefetch}
      onFocus={onPrefetch}
      aria-label={title}
      lang={lang}
    >
      {content}
    </a>
  );
}

export default LandingPage;
