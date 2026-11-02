import { useEffect, useMemo, useState } from "react";
import { getCountryName } from "../data/countries";
import { MASTERY_LEVELS, masteryLevel } from "../data/quiz";
import { useLoad } from "../hooks/useLoad";
import { useI18n } from "../i18n/useI18n";
import { getMyMastery } from "../services/quizApi";
import { LoadState } from "./ClassroomParts";
import "./GuidedPanels.css";

// Tô địa cầu theo tỉ lệ đúng; danh sách bên dưới bảo đảm không chỉ dựa vào màu.
export function MasteryPanel({ byId, onData, onFocus, onClose }) {
  const { lang, t } = useI18n();
  const state = useLoad(getMyMastery);

  const rows = useMemo(
    () =>
      (state.data ?? [])
        .map((row) => ({ ...row, ratio: row.correct / row.answered, country: byId.get(row.target_id) }))
        .filter((row) => row.country),
    [state.data, byId]
  );

  useEffect(() => {
    onData(
      new Map(
        rows.map((row) => [
          row.target_id,
          { color: masteryLevel(row.ratio).color, percent: Math.round(row.ratio * 100) },
        ])
      )
    );
  }, [rows, onData]);

  const weakest = [...rows].sort((a, b) => a.ratio - b.ratio || b.answered - a.answered).slice(0, 8);

  return (
    <section className="guided-panel" aria-label={t("mastery.title")}>
      <header className="guided-header">
        <h2>{t("mastery.title")}</h2>
        <button type="button" className="guided-close" onClick={onClose} aria-label={t("card.close")}>
          ×
        </button>
      </header>

      <LoadState state={state}>
        {rows.length === 0 ? (
          <p className="guided-text">{t("mastery.empty")}</p>
        ) : (
          <>
            <p className="guided-text">{t("mastery.summary", { count: rows.length })}</p>
            <ul className="guided-legend">
              {MASTERY_LEVELS.map((level) => (
                <li key={level.key}>
                  <span className="guided-swatch" style={{ background: level.color }} aria-hidden="true" />
                  {t(`mastery.${level.key}`)}
                </li>
              ))}
            </ul>
            <h3>{t("mastery.weakest")}</h3>
            <ul className="guided-list">
              {weakest.map((row) => (
                <li key={row.target_id}>
                  <button type="button" onClick={() => onFocus(row.target_id)}>
                    <span>{getCountryName(row.country, lang)}</span>
                    <strong>
                      {row.correct}/{row.answered}
                    </strong>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </LoadState>
    </section>
  );
}

export function TourPlayer({ tour, byId, onStop, onClose }) {
  const { lang, t } = useI18n();
  const [index, setIndex] = useState(0);

  const stops = useMemo(
    () => [...tour.tour_stops].sort((a, b) => a.position - b.position),
    [tour.tour_stops]
  );
  const stop = stops[index];
  const country = byId.get(stop.country_id);

  useEffect(() => {
    onStop(stop.country_id);
  }, [stop.country_id, onStop]);

  return (
    <section className="guided-panel" aria-label={tour.title}>
      <header className="guided-header">
        <h2>{tour.title}</h2>
        <button type="button" className="guided-close" onClick={onClose} aria-label={t("card.close")}>
          ×
        </button>
      </header>

      <p className="guided-progress">{t("tour.progress", { current: index + 1, total: stops.length })}</p>
      <h3 className="guided-stop">{country ? getCountryName(country, lang) : stop.country_id}</h3>
      {stop.note && <p className="guided-text guided-note">{stop.note}</p>}

      <div className="guided-actions">
        <button type="button" className="guided-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t("tour.prev")}
        </button>
        {index < stops.length - 1 ? (
          <button type="button" className="guided-button is-primary" onClick={() => setIndex(index + 1)}>
            {t("tour.next")}
          </button>
        ) : (
          <button type="button" className="guided-button is-primary" onClick={onClose}>
            {t("tour.finish")}
          </button>
        )}
      </div>
    </section>
  );
}
