import { useMemo, useState } from "react";
import { getCountryName } from "../data/countries";
import { useI18n } from "../i18n/useI18n";
import { saveTour } from "../services/classroomApi";

const newStop = () => ({ country_id: "", note: "" });

function TourEditor({ classId, countries, onSaved }) {
  const { lang, t } = useI18n();
  const [title, setTitle] = useState("");
  const [stops, setStops] = useState([newStop()]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const sorted = useMemo(
    () =>
      [...countries].sort((a, b) =>
        getCountryName(a, lang).localeCompare(getCountryName(b, lang), lang)
      ),
    [countries, lang]
  );

  const update = (index, patch) =>
    setStops(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);

    try {
      await saveTour({ classId, title, stops });
      setTitle("");
      setStops([newStop()]);
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="class-form" onSubmit={handleSubmit}>
      <h4>{t("tour.new")}</h4>
      <label>
        {t("tour.name")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </label>

      {stops.map((stop, index) => (
        <fieldset key={index} className="class-stop">
          <legend>{t("tour.stop", { number: index + 1 })}</legend>
          <label>
            {t("tour.country")}
            <select value={stop.country_id} onChange={(e) => update(index, { country_id: e.target.value })} required>
              <option value="">{t("bank.chooseCountry")}</option>
              {sorted.map((country) => (
                <option key={country.id} value={country.id}>
                  {getCountryName(country, lang)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("tour.note")}
            <textarea value={stop.note} onChange={(e) => update(index, { note: e.target.value })} maxLength={1000} rows={2} />
          </label>
          {stops.length > 1 && (
            <button
              type="button"
              className="class-link is-danger"
              onClick={() => setStops(stops.filter((_, i) => i !== index))}
            >
              {t("class.remove")}
            </button>
          )}
        </fieldset>
      ))}

      {stops.length < 30 && (
        <button type="button" className="class-link" onClick={() => setStops([...stops, newStop()])}>
          + {t("tour.addStop")}
        </button>
      )}

      {failed && <p className="class-error" role="status">{t("auth.errorGeneric")}</p>}

      <button type="submit" className="class-primary" disabled={busy}>
        {t("tour.save")}
      </button>
    </form>
  );
}

export default TourEditor;
