import { useState } from "react";
import { getCountryNameByLang } from "../data/quiz";
import { useLoad } from "../hooks/useLoad";
import { useI18n } from "../i18n/useI18n";
import {
  deleteCustomQuestion,
  listCustomQuestions,
  listQuizCountries,
  saveCustomQuestion,
} from "../services/classroomApi";
import { LoadState } from "./ClassroomParts";

const EMPTY_OPTIONS = ["", ""];

function QuestionBank({ onBack }) {
  const { lang, t } = useI18n();
  const bank = useLoad(listCustomQuestions);
  const countries = useLoad(listQuizCountries);
  const [editingId, setEditingId] = useState(null);
  const [kind, setKind] = useState("custom_choice");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(EMPTY_OPTIONS);
  const [correct, setCorrect] = useState(0);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState(null);

  function reset() {
    setEditingId(null);
    setKind("custom_choice");
    setPrompt("");
    setOptions(EMPTY_OPTIONS);
    setCorrect(0);
    setTarget("");
  }

  function edit(item) {
    setEditingId(item.id);
    setKind(item.kind);
    setPrompt(item.prompt);
    setOptions(item.option_labels ?? EMPTY_OPTIONS);
    setCorrect(item.correct_index ?? 0);
    setTarget(item.target_id ?? "");
    setErrorKey(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErrorKey(null);

    try {
      await saveCustomQuestion({ id: editingId, kind, prompt, options, correct, target });
      reset();
      bank.reload();
    } catch {
      setErrorKey("bank.error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(t("bank.confirmDelete"))) return;

    try {
      await deleteCustomQuestion(item.id);
      if (editingId === item.id) reset();
      bank.reload();
    } catch {
      setErrorKey("auth.errorGeneric");
    }
  }

  function answerOf(item) {
    if (item.kind === "custom_choice") return item.option_labels[item.correct_index];

    const country = countries.data?.find((entry) => entry.id === item.target_id);

    return country ? getCountryNameByLang(country, lang) : item.target_id;
  }

  return (
    <>
      <button type="button" className="class-link" onClick={onBack}>
        ← {t("class.back")}
      </button>
      <h3>{t("bank.title")}</h3>

      <form className="class-form" onSubmit={handleSubmit}>
        <h4>{t(editingId ? "bank.edit" : "bank.new")}</h4>

        <label>
          {t("bank.kind")}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="custom_choice">{t("bank.kind.choice")}</option>
            <option value="custom_locate">{t("bank.kind.locate")}</option>
          </select>
        </label>

        <label>
          {t("bank.prompt")}
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={300} required />
        </label>

        {kind === "custom_choice" ? (
          <fieldset>
            <legend>{t("bank.options")}</legend>
            {options.map((option, index) => (
              <div key={index} className="class-option-row">
                <input
                  type="radio"
                  name="bank-correct"
                  checked={correct === index}
                  onChange={() => setCorrect(index)}
                  aria-label={t("bank.markCorrect", { index: index + 1 })}
                />
                <input
                  value={option}
                  onChange={(e) =>
                    setOptions(options.map((item, i) => (i === index ? e.target.value : item)))
                  }
                  maxLength={200}
                  required
                  aria-label={t("bank.option", { index: index + 1 })}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="class-link is-danger"
                    onClick={() => {
                      setOptions(options.filter((_, i) => i !== index));
                      setCorrect(0);
                    }}
                  >
                    {t("class.remove")}
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button type="button" className="class-link" onClick={() => setOptions([...options, ""])}>
                + {t("bank.addOption")}
              </button>
            )}
            <p className="class-muted">{t("bank.correctHint")}</p>
          </fieldset>
        ) : (
          <label>
            {t("bank.target")}
            <select value={target} onChange={(e) => setTarget(e.target.value)} required>
              <option value="">{t("bank.chooseCountry")}</option>
              {(countries.data ?? []).map((country) => (
                <option key={country.id} value={country.id}>
                  {getCountryNameByLang(country, lang)}
                </option>
              ))}
            </select>
          </label>
        )}

        {errorKey && <p className="class-error" role="status">{t(errorKey)}</p>}

        <div className="class-form-row">
          <button type="submit" className="class-primary" disabled={busy}>
            {t("class.save")}
          </button>
          {editingId && (
            <button type="button" className="class-secondary" onClick={reset}>
              {t("bank.cancel")}
            </button>
          )}
        </div>
      </form>

      <h4>{t("bank.saved")}</h4>
      <LoadState state={bank}>
        {bank.data?.length ? (
          <ul className="class-list">
            {bank.data.map((item) => (
              <li key={item.id}>
                <div className="class-row-text">
                  <strong>{item.prompt}</strong>
                  <span>{t("class.correctAnswer", { answer: answerOf(item) })}</span>
                </div>
                <div className="class-row-actions">
                  <button type="button" className="class-link" onClick={() => edit(item)}>
                    {t("bank.editShort")}
                  </button>
                  <button type="button" className="class-link is-danger" onClick={() => remove(item)}>
                    {t("class.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="class-muted">{t("bank.empty")}</p>
        )}
      </LoadState>
    </>
  );
}

export default QuestionBank;
