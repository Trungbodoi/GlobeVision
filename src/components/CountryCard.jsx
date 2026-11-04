import { useEffect, useState } from "react";
import { getCountryName } from "../data/countries";
import { getCapitalTimezone } from "../services/countryApi";
import { getCountryWikiSummary } from "../services/wikiApi";
import { getCountryWorldBankData } from "../services/worldBankApi";
import { getCapitalWeather, getWeatherDescription } from "../services/weatherApi";
import { getNextPublicHolidays } from "../services/holidayApi";
import { useI18n } from "../i18n/useI18n";
import { MAX_COMPARE } from "../data/compare";
import ShareButton from "./ShareButton";
import SparklineChart from "./SparklineChart";
import Icon from "./Icon";
import {
  formatCallingCodes,
  formatCurrencies,
  formatLanguages,
  formatNumber,
  hasValue,
  numberLocale,
} from "../utils/format";
import "./CountryCard.css";

function AnimatedNumber({ value, duration = 1000 }) {
  const { lang } = useI18n();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value);
    if (!Number.isFinite(target)) return;

    let startTime = null;
    let frameId;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setDisplayValue(target * easeOutCubic(progress));

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <>{Math.round(displayValue).toLocaleString(numberLocale(lang))}</>;
}

function parseUtcOffset(text) {
  const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(text || "");
  if (!match) return text === "UTC" ? 0 : null;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function LocalTime({ capital, countryCode, timezones }) {
  const { lang, t } = useI18n();
  const [zone, setZone] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    getCapitalTimezone(capital, countryCode)
      .then((result) => {
        if (!cancelled) setZone({ key: `${countryCode}.${capital}`, ...result });
      })
      .catch(() => {
        if (!cancelled) setZone({ key: `${countryCode}.${capital}`, timezone: null });
      });

    return () => {
      cancelled = true;
    };
  }, [capital, countryCode]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const currentZone = zone?.key === `${countryCode}.${capital}` ? zone : null;
  const formatOptions = { hour: "2-digit", minute: "2-digit", weekday: "short" };

  let text = null;

  if (currentZone?.timezone) {
    try {
      text = new Intl.DateTimeFormat(numberLocale(lang), {
        ...formatOptions,
        timeZone: currentZone.timezone,
      }).format(now);
    } catch {
      text = null;
    }
  }

  if (!text && timezones?.length === 1) {
    const offset = parseUtcOffset(timezones[0]);
    if (offset != null) {
      text = new Intl.DateTimeFormat(numberLocale(lang), {
        ...formatOptions,
        timeZone: "UTC",
      }).format(now + offset * 60000);
    }
  }

  if (!text) return currentZone ? t("card.noData") : "…";

  return (
    <>
      {text}
      {currentZone?.city && (
        <span className="unit"> {t("time.atCapital", { city: currentZone.city })}</span>
      )}
    </>
  );
}

function Neighbors({ neighbors, onSelect }) {
  const { lang, t } = useI18n();

  if (neighbors.length === 0) {
    return <span className="country-info-muted">{t("neighbors.none")}</span>;
  }

  return (
    <div className="country-neighbors">
      {neighbors.map((neighbor) => {
        const name = getCountryName(neighbor, lang);
        return (
          <button
            key={neighbor.id}
            type="button"
            className="country-neighbor"
            onClick={() => onSelect(neighbor.id)}
            title={t("neighbors.goTo", { name })}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

function CountryCard({
  country,
  details,
  loading,
  neighbors,
  onNeighborVisibilityChange,
  onSelectNeighbor,
  onRetry,
  onClose,
  compareIds,
  onToggleCompare,
  onOpenSources,
}) {
  const { lang, t, place } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");
  const [showNeighbors, setShowNeighbors] = useState(true);

  // State các nguồn mở rộng (Phase 2)
  const [wikiData, setWikiData] = useState(null);
  const [wbData, setWbData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [holidays, setHolidays] = useState(null);

  // Lazy Fetching khi chuyển tab
  useEffect(() => {
    if (!country) return;
    let cancelled = false;

    if (activeTab === "culture") {
      if (wikiData === null) {
        getCountryWikiSummary(country.nameVi, country.nameEn).then((res) => {
          if (!cancelled) setWikiData(res || false);
        });
      }
      if (holidays === null && country.iso2) {
        getNextPublicHolidays(country.iso2).then((res) => {
          if (!cancelled) setHolidays(res || []);
        });
      }
    } else if (activeTab === "economy") {
      if (wbData === null && country.iso3) {
        getCountryWorldBankData(country.iso3).then((res) => {
          if (!cancelled) setWbData(res || false);
        });
      }
    } else if (activeTab === "climate") {
      if (weatherData === null) {
        getCapitalWeather(country.labelLat, country.labelLng).then((res) => {
          if (!cancelled) setWeatherData(res || false);
        });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, country, wikiData, holidays, wbData, weatherData]);

  if (!country) return null;

  const data = details?.data ?? null;
  const name = getCountryName(country, lang);

  const currencies = formatCurrencies(data?.currencies, lang);
  const languages = formatLanguages(data?.languages, lang);
  const callingCodes = formatCallingCodes(data?.callingCodes);

  const inCompare = compareIds.includes(country.id);
  const compareFull = !inCompare && compareIds.length >= MAX_COMPARE;

  return (
    <div className="country-card" role="dialog" aria-label={name}>
      {/* Nút đóng */}
      <button
        type="button"
        className="country-card-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        aria-label={t("card.close")}
      >
        <Icon name="X" size={18} />
      </button>

      {/* Header */}
      <div className="country-card-header">
        {data?.flags?.svg && (
          <img className="country-flag" src={data.flags.svg} alt={t("card.flagAlt", { name })} />
        )}

        <h1 className="country-title">{name}</h1>

        <div className="country-code">
          {country.iso2 || "--"}
          {" · "}
          {country.iso3 || "--"}
        </div>

        <div className="country-card-actions">
          <button
            type="button"
            className={"country-card-action" + (inCompare ? " is-active" : "")}
            onClick={() => onToggleCompare(country.id)}
            disabled={compareFull}
            aria-pressed={inCompare}
            title={compareFull ? t("compare.full", { max: MAX_COMPARE }) : undefined}
          >
            {inCompare && <Icon name="Check" size={16} />}
            {inCompare ? t("compare.remove") : t("compare.add")}
          </button>

          <ShareButton />
        </div>
      </div>

      {/* Tab Bar Điều Hướng */}
      <nav className="country-card-tabs" aria-label={t("tab.navigationLabel")}>
        <button
          type="button"
          className={"country-tab-btn" + (activeTab === "overview" ? " is-active" : "")}
          onClick={() => setActiveTab("overview")}
        >
          {t("tab.overview")}
        </button>
        <button
          type="button"
          className={"country-tab-btn" + (activeTab === "economy" ? " is-active" : "")}
          onClick={() => setActiveTab("economy")}
        >
          {t("tab.economy")}
        </button>
        <button
          type="button"
          className={"country-tab-btn" + (activeTab === "climate" ? " is-active" : "")}
          onClick={() => setActiveTab("climate")}
        >
          {t("tab.climate")}
        </button>
        <button
          type="button"
          className={"country-tab-btn" + (activeTab === "culture" ? " is-active" : "")}
          onClick={() => setActiveTab("culture")}
        >
          {t("tab.culture")}
        </button>
      </nav>

      {/* Nội dung chi tiết */}
      <div className="country-info">
        {country.disputed && <p className="country-notice">{t("card.disputed")}</p>}
        {!country.apiCode && <p className="country-notice">{t("card.noIso")}</p>}

        {details?.error && (
          <p className="country-notice is-error">
            {t("card.apiError")}{" "}
            <button type="button" className="country-notice-retry" onClick={onRetry}>
              {t("card.retry")}
            </button>
          </p>
        )}

        {details?.stale && (
          <p className="country-notice">
            {t("card.staleNotice", {
              date: new Date(details.savedAt).toLocaleDateString(numberLocale(lang)),
            })}
          </p>
        )}

        {/* TAB 1: TỔNG QUAN */}
        {activeTab === "overview" && (
          <>
            {loading ? (
              <div className="country-loading">
                <div className="loading-spinner"></div>
                <span>{t("card.loading")}</span>
              </div>
            ) : data ? (
              <>
                <InfoItem label={t("field.capital")} value={data.capital} />
                <InfoItem
                  label={t("field.localTime")}
                  value={
                    <LocalTime
                      capital={data.capital}
                      countryCode={country.apiCode}
                      timezones={data.timezones}
                    />
                  }
                />
                <InfoItem
                  label={t("field.population")}
                  value={
                    hasValue(data.population) ? (
                      <>
                        <AnimatedNumber value={data.population} />
                        <span className="unit"> {t("unit.people")}</span>
                      </>
                    ) : null
                  }
                />
                <InfoItem
                  label={t("field.area")}
                  value={
                    hasValue(data.area) ? (
                      <>
                        <AnimatedNumber value={data.area} />
                        <span className="unit"> {t("unit.km2")}</span>
                      </>
                    ) : null
                  }
                />
                <InfoItem
                  label={t("field.density")}
                  value={
                    hasValue(data.populationDensity) ? (
                      <>
                        <AnimatedNumber value={data.populationDensity} />
                        <span className="unit"> {t("unit.perKm2")}</span>
                      </>
                    ) : null
                  }
                />
                <InfoItem label={t("field.region")} value={place(data.region)} />
                <InfoItem label={t("field.subregion")} value={place(data.subregion)} />
                <InfoItem
                  label={t("field.neighbors")}
                  value={
                    <div className="country-neighbors-control">
                      <button
                        type="button"
                        className="country-neighbors-toggle"
                        aria-expanded={showNeighbors}
                        onClick={() => {
                          setShowNeighbors((visible) => {
                            onNeighborVisibilityChange?.(!visible);
                            return !visible;
                          });
                        }}
                      >
                        <Icon name={showNeighbors ? "EyeOff" : "Eye"} size={15} />
                        {t(showNeighbors ? "neighbors.hide" : "neighbors.show")}
                      </button>
                      {showNeighbors && (
                        <Neighbors neighbors={neighbors} onSelect={onSelectNeighbor} />
                      )}
                    </div>
                  }
                  wide
                />
                <InfoItem label={t("field.currencies")} value={currencies} />
                <InfoItem label={t("field.languages")} value={languages} />
                <InfoItem label={t("field.timezones")} value={data.timezones?.join(", ")} />
                <InfoItem label={t("field.callingCode")} value={callingCodes} />
              </>
            ) : (
              <>
                <InfoItem label={t("field.continent")} value={place(country.continent)} />
                <InfoItem label={t("field.subregion")} value={place(country.subregion)} />
                <InfoItem
                  label={t("field.populationEst", { year: country.popYear ?? "?" })}
                  value={
                    hasValue(country.popEst) ? (
                      <>
                        <AnimatedNumber value={country.popEst} />
                        <span className="unit"> {t("unit.people")}</span>
                      </>
                    ) : null
                  }
                />
              </>
            )}
          </>
        )}

        {/* TAB 2: KINH TẾ & XÃ HỘI (World Bank Open Data) */}
        {activeTab === "economy" && (
          <div className="tab-pane-content">
            {wbData === null ? (
              <div className="country-loading">
                <div className="loading-spinner"></div>
                <span>{t("card.loading")}</span>
              </div>
            ) : wbData ? (
              <>
                {/* GDP bình quân đầu người */}
                <div className="wb-metric-card">
                  <div className="wb-metric-header">
                    <span className="wb-metric-label">{t("wb.gdp")}</span>
                    <span className="wb-metric-value">
                      {wbData.gdpPerCapita?.latest
                        ? `$${formatNumber(wbData.gdpPerCapita.latest.value, lang)}`
                        : t("card.noData")}
                    </span>
                  </div>
                  {wbData.gdpPerCapita?.latest && (
                    <span className="wb-metric-year">
                      {t("wb.year", { year: wbData.gdpPerCapita.latest.year })} · World Bank
                    </span>
                  )}
                  {wbData.gdpPerCapita?.history?.length > 1 && (
                    <SparklineChart
                      history={wbData.gdpPerCapita.history}
                      unit="$"
                      color="#339af0"
                    />
                  )}
                </div>

                {/* Tuổi thọ trung bình */}
                <div className="wb-metric-card">
                  <div className="wb-metric-header">
                    <span className="wb-metric-label">{t("wb.lifeExpectancy")}</span>
                    <span className="wb-metric-value">
                      {wbData.lifeExpectancy?.latest
                        ? `${wbData.lifeExpectancy.latest.value.toFixed(1)} ${t("unit.years")}`
                        : t("card.noData")}
                    </span>
                  </div>
                  {wbData.lifeExpectancy?.latest && (
                    <span className="wb-metric-year">
                      {t("wb.year", { year: wbData.lifeExpectancy.latest.year })} · World Bank
                    </span>
                  )}
                  {wbData.lifeExpectancy?.history?.length > 1 && (
                    <SparklineChart
                      history={wbData.lifeExpectancy.history}
                      unit={t("unit.yearsShort")}
                      color="#20c997"
                    />
                  )}
                </div>

                {/* Tỷ lệ đô thị hóa */}
                <div className="wb-metric-card">
                  <div className="wb-metric-header">
                    <span className="wb-metric-label">{t("wb.urbanRate")}</span>
                    <span className="wb-metric-value">
                      {wbData.urbanPopulationRate?.latest
                        ? `${wbData.urbanPopulationRate.latest.value.toFixed(1)}%`
                        : t("card.noData")}
                    </span>
                  </div>
                  {wbData.urbanPopulationRate?.latest && (
                    <span className="wb-metric-year">
                      {t("wb.year", { year: wbData.urbanPopulationRate.latest.year })} · World Bank
                    </span>
                  )}
                </div>

                {/* Phát thải CO2 bình quân */}
                <div className="wb-metric-card">
                  <div className="wb-metric-header">
                    <span className="wb-metric-label">{t("wb.co2")}</span>
                    <span className="wb-metric-value">
                      {wbData.co2PerCapita?.latest
                        ? `${wbData.co2PerCapita.latest.value.toFixed(2)} ${t("unit.tons")}`
                        : t("card.noData")}
                    </span>
                  </div>
                  {wbData.co2PerCapita?.latest && (
                    <span className="wb-metric-year">
                      {t("wb.year", { year: wbData.co2PerCapita.latest.year })} · World Bank
                    </span>
                  )}
                </div>

                {/* Tỷ lệ biết chữ */}
                <div className="wb-metric-card">
                  <div className="wb-metric-header">
                    <span className="wb-metric-label">{t("wb.literacy")}</span>
                    <span className="wb-metric-value">
                      {wbData.literacyRate?.latest
                        ? `${wbData.literacyRate.latest.value.toFixed(1)}%`
                        : t("card.noData")}
                    </span>
                  </div>
                  {wbData.literacyRate?.latest && (
                    <span className="wb-metric-year">
                      {t("wb.year", { year: wbData.literacyRate.latest.year })} · World Bank
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="tab-empty-msg">{t("card.noData")}</p>
            )}
          </div>
        )}

        {/* TAB 3: KHÍ HẬU & THỜI TIẾT (Open-Meteo) */}
        {activeTab === "climate" && (
          <div className="tab-pane-content">
            {weatherData === null ? (
              <div className="country-loading">
                <div className="loading-spinner"></div>
                <span>{t("card.loading")}</span>
              </div>
            ) : weatherData ? (
              <div className="weather-card">
                <div className="weather-hero">
                  <span className="weather-icon" aria-hidden="true">
                    <Icon name={getWeatherDescription(weatherData.weatherCode).icon} size={26} />
                  </span>
                  <div className="weather-temp-wrap">
                    <span className="weather-temp">{weatherData.temperature}°C</span>
                    <span className="weather-desc">
                      {t(getWeatherDescription(weatherData.weatherCode).labelKey)}
                    </span>
                  </div>
                </div>

                <div className="weather-metrics-grid">
                  <div className="weather-metric">
                    <span className="weather-metric-label">{t("weather.apparent")}</span>
                    <span className="weather-metric-val">{weatherData.apparentTemperature}°C</span>
                  </div>
                  <div className="weather-metric">
                    <span className="weather-metric-label">{t("weather.humidity")}</span>
                    <span className="weather-metric-val">{weatherData.humidity}%</span>
                  </div>
                  <div className="weather-metric">
                    <span className="weather-metric-label">{t("weather.wind")}</span>
                    <span className="weather-metric-val">{weatherData.windSpeed} km/h</span>
                  </div>
                </div>

                <p className="weather-source-note">
                  {weatherData.source} · {t("time.atCapital", { city: data?.capital || name })}
                </p>
              </div>
            ) : (
              <p className="tab-empty-msg">{t("card.noData")}</p>
            )}
          </div>
        )}

        {/* TAB 4: VĂN HÓA & LỊCH SỬ (Wikipedia & Nager.Date) */}
        {activeTab === "culture" && (
          <div className="tab-pane-content">
            {/* Tóm tắt Wikipedia */}
            <div className="wiki-section">
              <h3 className="section-subtitle">{t("culture.wikiSummary")}</h3>
              {wikiData === null ? (
                <div className="country-loading">
                  <div className="loading-spinner"></div>
                  <span>{t("card.loading")}</span>
                </div>
              ) : wikiData ? (
                <div className="wiki-card">
                  {wikiData.thumbnail && (
                    <img
                      src={wikiData.thumbnail}
                      alt={wikiData.title}
                      className="wiki-thumbnail"
                      loading="lazy"
                    />
                  )}
                  <p className="wiki-extract">{wikiData.extract}</p>
                  {wikiData.pageUrl && (
                    <a
                      href={wikiData.pageUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="wiki-link"
                    >
                      {t("culture.readMore")}
                      <Icon name="ArrowUpRight" size={15} />
                    </a>
                  )}
                  <span className="source-tag">{wikiData.source}</span>
                </div>
              ) : (
                <p className="tab-empty-msg">{t("card.noData")}</p>
              )}
            </div>

            {/* Ngày lễ quốc gia */}
            <div className="holidays-section">
              <h3 className="section-subtitle">{t("culture.holidays")}</h3>
              {holidays === null ? (
                <div className="country-loading">
                  <div className="loading-spinner"></div>
                </div>
              ) : holidays.length > 0 ? (
                <ul className="holidays-list">
                  {holidays.map((h, idx) => (
                    <li key={idx} className="holiday-item">
                      <span className="holiday-date">{h.date}</span>
                      <div className="holiday-info">
                        <strong>{h.localName}</strong>
                        {h.name !== h.localName && (
                          <span className="holiday-en">{h.name}</span>
                        )}
                      </div>
                    </li>
                  ))}
                  <li className="holiday-source-tag">{t("culture.holidaySource")}</li>
                </ul>
              ) : (
                <p className="tab-empty-msg">{t("culture.noHolidays")}</p>
              )}
            </div>
          </div>
        )}

        {/* Nút xem nguồn dữ liệu & giấy phép */}
        <div className="country-card-footer">
          <button
            type="button"
            className="sources-modal-trigger"
            onClick={onOpenSources}
          >
            <Icon name="Database" size={16} />
            {t("sources.button")}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, wide = false }) {
  const { t } = useI18n();

  return (
    <div className={"country-info-item" + (wide ? " is-wide" : "")}>
      <div className="country-info-label">{label}</div>
      <div className="country-info-value">{value || t("card.noData")}</div>
    </div>
  );
}

export default CountryCard;
