import { useCallback, useState } from "react";
import { useLoad } from "../hooks/useLoad";
import { useI18n } from "../i18n/useI18n";
import {
  addCustomToAssignment,
  getAssignmentPreview,
  listCustomQuestions,
  publishAssignment,
  removeAssignmentQuestion,
  swapAssignmentQuestion,
  updateAssignment,
} from "../services/classroomApi";
import { questionAnswer, questionText } from "../utils/quizText";
import { LoadState } from "./ClassroomParts";

function toLocalInput(value) {
  const date = new Date(value);

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  return date.toISOString().slice(0, 16);
}

export function AssignmentSettings({ assignment, onSaved }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(assignment.title);
  const [maxAttempts, setMaxAttempts] = useState(assignment.max_attempts);
  const [dueAt, setDueAt] = useState(() => toLocalInput(assignment.due_at));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      onSaved(
        await updateAssignment({
          id: assignment.id,
          title,
          maxAttempts: Number(maxAttempts),
          dueAt: new Date(dueAt).toISOString(),
        })
      );
      setMessage({ ok: true, text: t("class.saved") });
    } catch {
      setMessage({ ok: false, text: t("class.assignmentError") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="class-form" onSubmit={handleSubmit}>
      <h4>{t("class.settings")}</h4>
      <label>
        {t("class.assignmentTitle")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </label>
      <div className="class-form-row">
        <label>
          {t("class.maxAttempts")}
          <input type="number" min="1" max="10" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} required />
        </label>
        <label>
          {t("class.dueAt")}
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
        </label>
      </div>
      {message && (
        <p className={message.ok ? "class-muted" : "class-error"} role="status">
          {message.text}
        </p>
      )}
      <button type="submit" className="class-secondary" disabled={busy}>
        {t("class.save")}
      </button>
    </form>
  );
}

function AssignmentEditor({ assignment, onBack, onPublished, onChanged }) {
  const { lang, t } = useI18n();
  const previewLoader = useCallback(() => getAssignmentPreview(assignment.id), [assignment.id]);
  const preview = useLoad(previewLoader);
  const bank = useLoad(listCustomQuestions);
  const [current, setCurrent] = useState(assignment);
  const [failed, setFailed] = useState(null);
  const [busy, setBusy] = useState(false);

  async function act(action, after) {
    setBusy(true);
    setFailed(null);

    try {
      await action();
      after?.();
    } catch (error) {
      setFailed(/no_more_questions/.test(error?.message ?? "") ? "class.noMoreQuestions" : "auth.errorGeneric");
    } finally {
      setBusy(false);
    }
  }

  const questions = preview.data ?? [];

  return (
    <>
      <button type="button" className="class-link" onClick={onBack}>
        ← {t("class.back")}
      </button>
      <h3>
        {current.title} <span className="class-tag">{t("class.draft")}</span>
      </h3>
      <p className="class-muted">{t("class.draftHint")}</p>

      {failed && <p className="class-error" role="status">{t(failed)}</p>}

      <h4>{t("class.questionsTitle", { count: questions.length })}</h4>
      <LoadState state={preview}>
        <ol className="class-list class-questions">
          {questions.map((question) => (
            <li key={question.id}>
              <div className="class-row-text">
                <strong>{questionText(question, lang, t)}</strong>
                <span>{t("class.correctAnswer", { answer: questionAnswer(question, lang) })}</span>
              </div>
              <div className="class-row-actions">
                {!question.kind.startsWith("custom") && (
                  <button
                    type="button"
                    className="class-link"
                    disabled={busy}
                    onClick={() => act(() => swapAssignmentQuestion(question.id), preview.reload)}
                  >
                    {t("class.swap")}
                  </button>
                )}
                <button
                  type="button"
                  className="class-link is-danger"
                  disabled={busy || questions.length <= 1}
                  onClick={() => act(() => removeAssignmentQuestion(question.id), preview.reload)}
                >
                  {t("class.remove")}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </LoadState>

      <h4>{t("class.addFromBank")}</h4>
      <LoadState state={bank}>
        {bank.data?.length ? (
          <ul className="class-list">
            {bank.data.map((item) => (
              <li key={item.id}>
                <span className="class-row-text">{item.prompt}</span>
                <button
                  type="button"
                  className="class-link"
                  disabled={busy}
                  onClick={() => act(() => addCustomToAssignment(assignment.id, item.id), preview.reload)}
                >
                  {t("class.add")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="class-muted">{t("bank.empty")}</p>
        )}
      </LoadState>

      <AssignmentSettings
        assignment={current}
        onSaved={(saved) => {
          setCurrent(saved);
          onChanged();
        }}
      />

      <button
        type="button"
        className="class-primary"
        disabled={busy || questions.length === 0}
        onClick={() => act(() => publishAssignment(assignment.id), onPublished)}
      >
        {t("class.publish")}
      </button>
    </>
  );
}

export default AssignmentEditor;
