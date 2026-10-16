import { useEffect, useState } from "react";
import { getCountryName } from "../data/countries";
import { getCapitalTimezone } from "../services/countryApi";
import { useI18n } from "../i18n/useI18n";
import { MAX_COMPARE } from "../data/compare";
import ShareButton from "./ShareButton";
import {
  formatCallingCodes,
  formatCurrencies,
  formatLanguages,
  hasValue,
  numberLocale,
} from "../utils/format";
import "./CountryCard.css";

function AnimatedNumber({ value, duration = 1200 }) {
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

// "UTC+07:00" -> 420 (phút)
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

  // Không tìm được thủ đô: chỉ tính được khi quốc gia có đúng một múi giờ.
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
  onSelectNeighbor,
  onRetry,
  onClose,
  compareIds,
  onToggleCompare,
}) {
  const { lang, t, place } = useI18n();

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
        ×
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
            {inCompare ? t("compare.remove") : t("compare.add")}
          </button>

          <ShareButton />
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="country-loading">
          <div className="loading-spinner"></div>
          <span>{t("card.loading")}</span>
        </div>
      ) : (
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

          {data ? (
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
                value={<Neighbors neighbors={neighbors} onSelect={onSelectNeighbor} />}
                wide
              />

              <InfoItem label={t("field.currencies")} value={currencies} />

              <InfoItem label={t("field.languages")} value={languages} />

              <InfoItem label={t("field.timezones")} value={data.timezones?.join(", ")} />

              <InfoItem label={t("field.callingCode")} value={callingCodes} />

              <InfoItem label={t("field.nativeName")} value={data.nativeName} />
            </>
          ) : (
            // Không có dữ liệu API: dùng dữ liệu cơ bản trong bản đồ.
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
        </div>
      )}
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
