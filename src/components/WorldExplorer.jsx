import { useEffect, useMemo, useState } from "react";
import { area } from "@turf/turf";
import { getGroupCountryIds, GROUP_OPTIONS } from "../data/organizations";
import { INDICATORS } from "../services/worldBankApi";
import { getWorldBankIndicatorWorld, loadGeographyData } from "../services/geographyApi";
import {
  createDidYouKnowFacts,
  formatMetric,
  getCapitalCoordinates,
  getMetricColor,
  getGreatCircleDistanceKm,
} from "../utils/geography";
import { readRouteSearchParams, updateUrlParams } from "../utils/urlState";
import { useI18n } from "../i18n/useI18n";
import Icon from "./Icon";
import "./WorldExplorer.css";

const METRICS = {
  population: { labelKey: "explorer.metric.population", unitKey: "explorer.unit.people", local: true, logarithmic: true },
  density: { labelKey: "explorer.metric.density", unitKey: "explorer.unit.density", local: true, logarithmic: true },
  gdpPerCapita: {
    labelKey: "explorer.metric.gdp",
    unitKey: "explorer.unit.gdp",
    indicator: INDICATORS.gdpPerCapita.id,
    logarithmic: true,
  },
  lifeExpectancy: {
    labelKey: "explorer.metric.life",
    unitKey: "explorer.unit.years",
    indicator: INDICATORS.lifeExpectancy.id,
  },
  co2PerCapita: {
    labelKey: "explorer.metric.co2",
    unitKey: "explorer.unit.co2",
    indicator: INDICATORS.co2PerCapita.id,
    logarithmic: true,
  },
};

const OVERLAY_LAYERS = ["rivers", "lakes", "mountainRanges", "mountainPeaks", "capitals", "dateLine", "dayNight"];
const LAYER_FEATURES = {
  rivers: "river",
  lakes: "lake",
  mountainRanges: "mountainRange",
  mountainPeaks: "mountainPeak",
  capitals: "capital",
  dateLine: "dateLine",
};
const FEATURE_LAYERS = Object.fromEntries(
  Object.entries(LAYER_FEATURES).map(([layer, feature]) => [feature, layer])
);
const WORLD_CLOCK_IDS = ["US", "GB", "IN", "SG", "JP", "AU"];
const GEO_FEATURE_LAYERS = OVERLAY_LAYERS.filter((layer) => layer !== "dayNight");

function readExplorerSettings() {
  const params = readRouteSearchParams();
  const requestedMetric = params.get("metric") || params.get("layer");
  const layerList = (params.get("layers") || "").split(",").filter(Boolean);
  if (OVERLAY_LAYERS.includes(params.get("layer"))) layerList.push(params.get("layer"));

  return {
    metric: METRICS[requestedMetric] ? requestedMetric : "none",
    group: GROUP_OPTIONS.some((option) => option.id === params.get("group"))
      ? params.get("group")
      : "none",
    layers: Object.fromEntries(OVERLAY_LAYERS.map((layer) => [layer, layerList.includes(layer)])),
  };
}

function countryName(country, lang) {
  return lang === "en" ? country.nameEn : country.nameVi;
}

function getLocalMetric(country, metric) {
  if (metric === "population") {
    return Number.isFinite(country.popEst) && country.popEst > 0
      ? { value: country.popEst, year: country.popYear }
      : null;
  }
  if (metric === "density" && country.popEst > 0) {
    const areaKm2 = area(country.feature) / 1_000_000;
    return areaKm2 > 0 ? { value: country.popEst / areaKm2, year: country.popYear } : null;
  }
  return null;
}

function Clock({ city, lang, now }) {
  if (!city.properties.timezone) return null;
  let time;
  try {
    time = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-US", {
      timeZone: city.properties.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
  } catch {
    return null;
  }
  return (
    <span className="explorer-clock">
      <strong>{city.properties.name}</strong>
      <time dateTime={new Date(now).toISOString()}>{time}</time>
    </span>
  );
}

function WorldExplorer({ countries, isOpen, onToggleOpen, onChange }) {
  const { lang, t, place } = useI18n();
  const [settings, setSettings] = useState(readExplorerSettings);
  const [geoFeatures, setGeoFeatures] = useState(null);
  const [geoError, setGeoError] = useState("");
  const [worldBank, setWorldBank] = useState({});
  const [startId, setStartId] = useState("");
  const [endId, setEndId] = useState("");
  const [factIndex, setFactIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState("");

  const selectedMetric = METRICS[settings.metric];
  const groupCountryIds = useMemo(
    () => getGroupCountryIds(settings.group),
    [settings.group]
  );

  const needsGeography = Boolean(
    isOpen && (
      GEO_FEATURE_LAYERS.some((layer) => settings.layers[layer]) ||
      (startId && endId)
    )
  );

  useEffect(() => {
    if (!needsGeography || geoFeatures || geoError) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => loadGeographyData()).then((features) => {
      if (!cancelled) setGeoFeatures(features);
    }).catch((error) => {
      if (!cancelled) setGeoError(error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [needsGeography, geoFeatures, geoError]);

  useEffect(() => {
    const indicatorId = selectedMetric?.indicator;
    if (!isOpen || !indicatorId || worldBank[settings.metric]) return undefined;
    let cancelled = false;
    getWorldBankIndicatorWorld(indicatorId, countries.map((country) => country.iso3))
      .then((result) => {
        if (!cancelled) {
          setWorldBank((current) => ({ ...current, [settings.metric]: { ...result, error: null } }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWorldBank((current) => ({
            ...current,
            [settings.metric]: { values: new Map(), error: error.message },
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedMetric, settings.metric, worldBank, countries]);

  useEffect(() => {
    if (!isOpen || (!settings.layers.capitals && !settings.layers.dayNight)) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen, settings.layers.capitals, settings.layers.dayNight]);

  const valuesByIso3 = useMemo(() => {
    const output = new Map();
    if (!selectedMetric) return output;
    const bankValues = worldBank[settings.metric]?.values;
    for (const country of countries) {
      const value = selectedMetric.local
        ? getLocalMetric(country, settings.metric)
        : bankValues?.get(country.iso3);
      if (value && Number.isFinite(value.value)) output.set(country.iso3, value);
    }
    return output;
  }, [countries, selectedMetric, settings.metric, worldBank]);

  const metricColors = useMemo(() => {
    const values = [...valuesByIso3.values()].map(({ value }) => value);
    return new Map(
      [...valuesByIso3].map(([iso3, record]) => [
        iso3,
        getMetricColor(record.value, values, selectedMetric?.logarithmic),
      ])
    );
  }, [valuesByIso3, selectedMetric]);

  const visibleFeatures = useMemo(
    () => (geoFeatures || []).filter((item) => settings.layers[FEATURE_LAYERS[item.properties.layer]]),
    [geoFeatures, settings.layers]
  );

  const route = useMemo(() => {
    if (!startId || !endId || startId === endId) return null;
    const start = countries.find((country) => country.id === startId);
    const end = countries.find((country) => country.id === endId);
    if (!start || !end) return null;
    const startPoint = getCapitalCoordinates(
      start,
      (geoFeatures || []).filter((item) => item.properties.layer === "capital")
    );
    const endPoint = getCapitalCoordinates(
      end,
      (geoFeatures || []).filter((item) => item.properties.layer === "capital")
    );
    return {
      startId,
      endId,
      start: startPoint,
      end: endPoint,
      distanceKm: getGreatCircleDistanceKm(startPoint, endPoint),
    };
  }, [startId, endId, countries, geoFeatures]);

  const facts = useMemo(() => createDidYouKnowFacts(countries, lang), [countries, lang]);
  const clockCities = useMemo(
    () => (geoFeatures || []).filter(
      (item) => item.properties.layer === "capital" && WORLD_CLOCK_IDS.includes(item.properties.iso2)
    ),
    [geoFeatures]
  );
  const bankState = worldBank[settings.metric];
  const minValue = valuesByIso3.size
    ? Math.min(...[...valuesByIso3.values()].map(({ value }) => value))
    : null;
  const maxValue = valuesByIso3.size
    ? Math.max(...[...valuesByIso3.values()].map(({ value }) => value))
    : null;

  useEffect(() => {
    const explorerState = {
      layers: settings.layers,
      metric: settings.metric,
      metricColors,
      metricValues: valuesByIso3,
      metricLabel: selectedMetric ? t(selectedMetric.labelKey) : "",
      group: settings.group,
      groupCountryIds,
      features: visibleFeatures,
      route,
    };
    onChange(explorerState);
  }, [
    settings,
    metricColors,
    valuesByIso3,
    selectedMetric,
    groupCountryIds,
    visibleFeatures,
    route,
    onChange,
    t,
  ]);

  useEffect(() => {
    const enabled = OVERLAY_LAYERS.filter((layer) => settings.layers[layer]);
    updateUrlParams({
      layer: null,
      metric: settings.metric === "none" ? null : settings.metric,
      group: settings.group === "none" ? null : settings.group,
      layers: enabled,
    });
  }, [settings]);

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateLayer(layer, enabled) {
    setSettings((current) => ({
      ...current,
      layers: { ...current.layers, [layer]: enabled },
    }));
  }

  function retryGeography() {
    setGeoError("");
  }

  function retryMetric() {
    setWorldBank((current) => {
      const next = { ...current };
      delete next[settings.metric];
      return next;
    });
  }

  async function shareView() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      setActionError(`${t("explorer.shareError")} ${error.message}`);
    }
  }

  const loadingGeography = needsGeography && !geoFeatures && !geoError;
  const loadingMetric = Boolean(selectedMetric?.indicator) && !bankState;
  const currentFact = facts.length ? facts[factIndex % facts.length] : null;

  return (
    <>
      <button
        type="button"
        className="explorer-launcher"
        aria-expanded={isOpen}
        aria-controls="world-explorer-panel"
        aria-label={t("explorer.launch")}
        onClick={onToggleOpen}
      >
        <Icon name="Globe2" size={18} />
        {t("explorer.launch")}
      </button>
      <section
        id="world-explorer-panel"
        className="world-explorer-panel"
        aria-label={t("explorer.title")}
        hidden={!isOpen}
      >
        <header className="explorer-header">
          <div>
            <p className="explorer-eyebrow">{t("explorer.eyebrow")}</p>
            <h2>{t("explorer.title")}</h2>
          </div>
          <button type="button" className="explorer-share" onClick={shareView} title={t("explorer.share")}>
            {copied ? t("education.linkCopied") : t("explorer.share")}
          </button>
        </header>

        <label className="explorer-field">
          {t("explorer.choropleth")}
          <select value={settings.metric} onChange={(event) => updateSetting("metric", event.target.value)}>
            <option value="none">{t("explorer.metric.none")}</option>
            {Object.entries(METRICS).map(([id, metric]) => (
              <option value={id} key={id}>{t(metric.labelKey)}</option>
            ))}
          </select>
        </label>

        {selectedMetric && (
          <div className="explorer-legend" aria-live="polite">
            <div className="explorer-legend-labels">
              <span>{minValue == null ? "—" : formatMetric(minValue, lang === "vi" ? "vi-VN" : "en-US")}</span>
              <strong>{t("explorer.legend")} · {t(selectedMetric.unitKey)}</strong>
              <span>{maxValue == null ? "—" : formatMetric(maxValue, lang === "vi" ? "vi-VN" : "en-US")}</span>
            </div>
            <div className="explorer-gradient" />
            <p>
              {loadingMetric
                ? t("explorer.loadingMetric")
                : bankState?.error
                  ? t("explorer.metricUnavailable", { error: bankState.error })
                  : t("explorer.metricSource", {
                      source: selectedMetric.local
                        ? "Natural Earth"
                        : `World Bank · ${bankState?.stale ? t("card.staleNotice", { date: new Date(bankState.savedAt).toLocaleDateString() }) : "CC BY 4.0"}`,
                    })}
            </p>
          </div>
        )}

        <label className="explorer-field">
          {t("explorer.groupFilter")}
          <select value={settings.group} onChange={(event) => updateSetting("group", event.target.value)}>
            {GROUP_OPTIONS.map((group) => (
              <option value={group.id} key={group.id}>{t(group.labelKey)}</option>
            ))}
          </select>
        </label>

        <fieldset className="explorer-layer-list">
          <legend>{t("explorer.layers")}</legend>
          {OVERLAY_LAYERS.map((layer) => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={settings.layers[layer]}
                onChange={(event) => updateLayer(layer, event.target.checked)}
              />
              <span>{t(`explorer.layer.${layer}`)}</span>
            </label>
          ))}
        </fieldset>

        {loadingGeography && <p className="explorer-status" role="status">{t("explorer.loadingLayers")}</p>}
        {actionError && <p className="explorer-error" role="alert">{actionError}</p>}
        {geoError && (
          <p className="explorer-error" role="alert">
            {t("explorer.dataError", { error: geoError })}
            <button type="button" onClick={retryGeography}>{t("card.retry")}</button>
          </p>
        )}
        {bankState?.error && selectedMetric?.indicator && (
          <p className="explorer-error" role="alert">
            {t("explorer.dataError", { error: bankState.error })}
            <button type="button" onClick={retryMetric}>{t("card.retry")}</button>
          </p>
        )}

        {settings.layers.capitals && (
          <div className="explorer-clocks">
            <h3>{t("explorer.worldClocks")}</h3>
            {clockCities.map((city) => (
              <Clock key={city.properties.iso2} city={city} lang={lang} now={now} />
            ))}
          </div>
        )}

        <div className="explorer-distance">
          <h3>{t("explorer.distanceTitle")}</h3>
          <div className="explorer-route-selects">
            <label>
              {t("explorer.from")}
              <select value={startId} onChange={(event) => setStartId(event.target.value)}>
                <option value="">{t("explorer.distanceNone")}</option>
                {countries.filter((country) => country.apiCode).map((country) => (
                  <option value={country.id} key={country.id}>{countryName(country, lang)}</option>
                ))}
              </select>
            </label>
            <label>
              {t("explorer.to")}
              <select value={endId} onChange={(event) => setEndId(event.target.value)}>
                <option value="">{t("explorer.distanceNone")}</option>
                {countries.filter((country) => country.apiCode).map((country) => (
                  <option value={country.id} key={country.id}>{countryName(country, lang)}</option>
                ))}
              </select>
            </label>
          </div>
          {route && (
            <p className="explorer-distance-value">
              {formatMetric(route.distanceKm, lang === "vi" ? "vi-VN" : "en-US")} km
              <small>{t("explorer.distanceNote", { from: route.start.name, to: route.end.name })}</small>
            </p>
          )}
        </div>

        {currentFact && (
          <div className="explorer-fact">
            <div>
              <span>{t("explorer.didYouKnow")}</span>
              <strong>{t(`fact.${currentFact.type}.label`)}</strong>
            </div>
            <p>
              {t(`fact.${currentFact.type}.text`, {
                country: currentFact.country,
                continent: place(currentFact.continent),
                population: currentFact.population,
                year: currentFact.year,
              })}
            </p>
            <small>{t("explorer.factSource")}</small>
            {facts.length > 1 && (
              <button type="button" onClick={() => setFactIndex((index) => (index + 1) % facts.length)}>
                {t("explorer.anotherFact")}
              </button>
            )}
          </div>
        )}

        <p className="explorer-neutral-note">{t("card.disputed")}</p>
      </section>
    </>
  );
}

export default WorldExplorer;
