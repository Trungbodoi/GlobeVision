import { COMPARE_COLORS } from "../data/compare";
import { getCountryName } from "../data/countries";
import { useI18n } from "../i18n/useI18n";
import "./CompareTray.css";

function CompareTray({ countries, onRemove, onClear, onOpen }) {
  const { lang, t } = useI18n();

  if (countries.length === 0) return null;

  const canCompare = countries.length >= 2;

  return (
    <section className="compare-tray" aria-label={t("compare.trayLabel")}>
      <ul className="compare-tray-list">
        {countries.map((country, index) => {
          const name = getCountryName(country, lang);

          return (
            <li key={country.id} className="compare-chip">
              <span
                className="compare-swatch"
                style={{ background: COMPARE_COLORS[index] }}
                aria-hidden="true"
              />
              <span className="compare-chip-name">{name}</span>
              <button
                type="button"
                className="compare-chip-remove"
                onClick={() => onRemove(country.id)}
                aria-label={t("compare.removeOne", { name })}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      <div className="compare-tray-actions">
        <button
          type="button"
          className="compare-open"
          onClick={onOpen}
          disabled={!canCompare}
          title={canCompare ? undefined : t("compare.needMore")}
        >
          {t("compare.open", { count: countries.length })}
        </button>

        <button type="button" className="compare-clear" onClick={onClear}>
          {t("compare.clear")}
        </button>
      </div>

      {!canCompare && <p className="compare-tray-hint">{t("compare.needMore")}</p>}
    </section>
  );
}

export default CompareTray;
