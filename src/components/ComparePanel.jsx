import { useEffect, useRef, useState } from "react";
import { COMPARE_COLORS } from "../data/compare";
import { getCountryName } from "../data/countries";
import { getCountryInfo } from "../services/countryApi";
import { useI18n } from "../i18n/useI18n";
import {
  formatCallingCodes,
  formatCompact,
  formatCurrencies,
  formatLanguages,
  formatNumber,
  hasValue,
} from "../utils/format";
import ShareButton from "./ShareButton";
import "./ComparePanel.css";

// Tải thông tin chi tiết cho từng quốc gia đang so sánh (dùng cache của API).
function useCompareDetails(countries) {
  const [results, setResults] = useState({});
  const codes = countries.map((country) => country.apiCode).filter(Boolean);
  const codesKey = codes.join(",");

  useEffect(() => {
    if (!codesKey) return;

    let cancelled = false;

    for (const code of codesKey.split(",")) {
      getCountryInfo(code)
        .then((result) => {
          if (!cancelled) setResults((prev) => ({ ...prev, [code]: { data: result.data } }));
        })
        .catch((error) => {
          if (!cancelled) setResults((prev) => ({ ...prev, [code]: { data: null, error } }));
        });
    }

    return () => {
      cancelled = true;
    };
  }, [codesKey]);

  return results;
}

function ColumnChart({ title, unit, items }) {
  const { lang, t } = useI18n();
  const [hoveredId, setHoveredId] = useState(null);

  const max = Math.max(0, ...items.map((item) => item.value ?? 0));
  const hovered = items.find((item) => item.id === hoveredId);

  return (
    <figure className="column-chart">
      <figcaption className="column-chart-title">{title}</figcaption>

      <div className="column-chart-plot">
        {items.map((item) => {
          const hasData = hasValue(item.value) && max > 0;
          // Giá trị khác 0 luôn cao ít nhất 2px để vẫn nhìn thấy.
          const height = hasData ? Math.max((item.value / max) * 100, 1.5) : 0;

          return (
            <div
              key={item.id}
              className="column-chart-slot"
              tabIndex={hasData ? 0 : -1}
              aria-label={
                hasData
                  ? `${item.name}: ${formatNumber(item.value, lang)} ${unit}`
                  : `${item.name}: ${t("compare.chartEmpty")}`
              }
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(item.id)}
              onBlur={() => setHoveredId(null)}
            >
              <span className="column-chart-value">
                {hasData ? formatCompact(item.value, lang) : "—"}
              </span>

              <span
                className={
                  "column-chart-bar" +
                  (hoveredId && hoveredId !== item.id ? " is-dimmed" : "")
                }
                style={{ height: `${height}%`, background: item.color }}
              />
            </div>
          );
        })}

        {hovered && hasValue(hovered.value) && (
          <div className="column-chart-tooltip" role="status">
            <span className="column-chart-tooltip-swatch" style={{ background: hovered.color }} />
            <strong>{hovered.name}</strong>
            <span>
              {formatNumber(hovered.value, lang)} {unit}
            </span>
          </div>
        )}
      </div>

      <div className="column-chart-labels" aria-hidden="true">
        {items.map((item) => (
          <span key={item.id} className="column-chart-label">
            {item.name}
          </span>
        ))}
      </div>
    </figure>
  );
}

function ComparePanel({ countries, byIso3, onClose }) {
  const { lang, t, place } = useI18n();
  const results = useCompareDetails(countries);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const columns = countries.map((country, index) => {
    const result = country.apiCode ? results[country.apiCode] : { data: null };
    const data = result?.data ?? null;
    const loaded = Boolean(result);

    // Không có dữ liệu API: dùng dân số ước tính trong dữ liệu bản đồ.
    const usesFallback = loaded && !hasValue(data?.population) && hasValue(country.popEst);

    return {
      country,
      data,
      loaded,
      usesFallback,
      name: getCountryName(country, lang),
      color: COMPARE_COLORS[index],
      population: hasValue(data?.population) ? data.population : usesFallback ? country.popEst : null,
    };
  });

  const neighborNames = (data) =>
    (data?.borders ?? [])
      .map((code) => byIso3.get(code))
      .filter(Boolean)
      .map((neighbor) => getCountryName(neighbor, lang));

  const rows = [
    { label: t("field.capital"), value: (c) => c.data?.capital },
    {
      label: t("field.region"),
      value: (c) => place(c.data?.region || c.country.continent),
    },
    {
      label: t("field.subregion"),
      value: (c) => place(c.data?.subregion || c.country.subregion),
    },
    {
      label: t("field.population"),
      numeric: true,
      value: (c) =>
        hasValue(c.population) &&
        `${c.usesFallback ? "≈ " : ""}${formatNumber(c.population, lang)} ${t("unit.people")}${
          c.usesFallback ? ` (${c.country.popYear})` : ""
        }`,
    },
    {
      label: t("field.area"),
      numeric: true,
      value: (c) => hasValue(c.data?.area) && `${formatNumber(c.data.area, lang)} ${t("unit.km2")}`,
    },
    {
      label: t("field.density"),
      numeric: true,
      value: (c) =>
        hasValue(c.data?.populationDensity) &&
        `${formatNumber(c.data.populationDensity, lang)} ${t("unit.perKm2")}`,
    },
    {
      label: t("field.neighbors"),
      value: (c) => {
        if (!c.data) return null;

        const names = neighborNames(c.data);

        return names.length === 0
          ? t("neighbors.none")
          : `${t("compare.neighborCount", { count: names.length })}: ${names.join(", ")}`;
      },
    },
    { label: t("field.languages"), value: (c) => formatLanguages(c.data?.languages, lang) },
    { label: t("field.currencies"), value: (c) => formatCurrencies(c.data?.currencies, lang) },
    { label: t("field.timezones"), value: (c) => c.data?.timezones?.join(", ") },
    { label: t("field.callingCode"), value: (c) => formatCallingCodes(c.data?.callingCodes) },
  ];

  const chartItems = (getValue) =>
    columns.map((c) => ({ id: c.country.id, name: c.name, color: c.color, value: getValue(c) }));

  return (
    <div
      className="compare-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="compare-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-panel-title"
      >
        <header className="compare-panel-header">
          <h2 id="compare-panel-title">{t("compare.title")}</h2>

          <div className="compare-panel-actions">
            <ShareButton className="compare-panel-action" />

            <button
              ref={closeRef}
              type="button"
              className="compare-panel-close"
              onClick={onClose}
              aria-label={t("compare.close")}
            >
              ×
            </button>
          </div>
        </header>

        <div className="compare-panel-body">
          <h3 className="compare-section-title">{t("compare.charts")}</h3>

          <div className="compare-charts">
            <ColumnChart
              title={t("compare.chartPopulation")}
              unit={t("unit.people")}
              items={chartItems((c) => c.population)}
            />
            <ColumnChart
              title={t("compare.chartArea")}
              unit={t("unit.km2")}
              items={chartItems((c) => c.data?.area)}
            />
            <ColumnChart
              title={t("compare.chartDensity")}
              unit={t("unit.perKm2")}
              items={chartItems((c) => c.data?.populationDensity)}
            />
          </div>

          <h3 className="compare-section-title">{t("compare.table")}</h3>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <td />
                  {columns.map((c) => (
                    <th key={c.country.id} scope="col">
                      <span className="compare-table-country">
                        <span
                          className="compare-swatch"
                          style={{ background: c.color }}
                          aria-hidden="true"
                        />
                        {c.data?.flags?.svg && (
                          <img
                            className="compare-table-flag"
                            src={c.data.flags.svg}
                            alt={t("card.flagAlt", { name: c.name })}
                          />
                        )}
                        {c.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {columns.map((c) => (
                      <td key={c.country.id} className={row.numeric ? "is-numeric" : undefined}>
                        {row.value(c) || (c.loaded ? t("card.noData") : "…")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {columns
            .filter((c) => c.usesFallback)
            .map((c) => (
              <p key={c.country.id} className="compare-note">
                {t("compare.fallback", { name: c.name, year: c.country.popYear })}
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}

export default ComparePanel;
