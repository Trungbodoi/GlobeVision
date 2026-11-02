import { useEffect, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import { getQuizHistory, startQuiz, submitQuiz } from "../services/quizApi";
import { startAssignment } from "../services/classroomApi";
import { REGIONS, QUIZ_KINDS as KINDS } from "../data/quiz";
import { numberLocale } from "../utils/format";
import "./QuizPanel.css";

function localized(item, prefix, lang) {
  return item[`${prefix}name_${lang}`];
}

function Setup({ onStart, onClose }) {
  const { lang, t, place } = useI18n();
  const [region, setRegion] = useState("");
  const [kinds, setKinds] = useState(KINDS);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;

    getQuizHistory()
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleKind(kind) {
    setKinds((current) =>
      current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]
    );
  }

  async function handleStart() {
    setBusy(true);
    setFailed(false);

    try {
      onStart(await startQuiz({ region: region || null, kinds }));
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="quiz-overlay">
      <div className="quiz-dialog" role="dialog" aria-modal="true" aria-label={t("quiz.title")}>
        <header className="quiz-header">
          <h2>{t("quiz.title")}</h2>
          <button type="button" className="quiz-close" onClick={onClose} aria-label={t("card.close")}>
            ×
          </button>
        </header>

        <label className="quiz-field">
          {t("quiz.region")}
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="">{t("quiz.allRegions")}</option>
            {REGIONS.map((item) => (
              <option key={item} value={item}>
                {place(item)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="quiz-kinds">
          <legend>{t("quiz.kinds")}</legend>
          {KINDS.map((kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={kinds.includes(kind)}
                onChange={() => toggleKind(kind)}
              />
              {t(`quiz.kind.${kind}`)}
            </label>
          ))}
        </fieldset>

        {failed && <p className="quiz-error" role="status">{t("auth.errorGeneric")}</p>}

        <button
          type="button"
          className="quiz-primary"
          onClick={handleStart}
          disabled={busy || kinds.length === 0}
        >
          {t("quiz.start")}
        </button>

        {history.length > 0 && (
          <section className="quiz-history">
            <h3>{t("quiz.history")}</h3>
            <ul>
              {history.map((row) => (
                <li key={row.id}>
                  <span>
                    {row.region ? place(row.region) : t("quiz.allRegions")}
                    {" · "}
                    {new Date(row.submitted_at).toLocaleDateString(numberLocale(lang))}
                  </span>
                  <strong>
                    {row.score}/{row.question_count}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Playing({ quiz, pick, onPick, onKindChange, onFinished, onClose }) {
  const { lang, t } = useI18n();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [optionIndex, setOptionIndex] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const question = quiz.questions[index];
  const isLast = index === quiz.questions.length - 1;
  const hasAnswer = question.kind === "locate" ? Boolean(pick) : optionIndex !== null;

  async function submit(allAnswers) {
    setSubmitting(true);
    setFailed(false);

    try {
      onFinished(await submitQuiz(quiz.attempt_id, allAnswers));
    } catch {
      setFailed(true);
      setSubmitting(false);
    }
  }

  function goNext() {
    const answer =
      question.kind === "locate"
        ? { question_id: question.id, answer_id: pick }
        : { question_id: question.id, option_index: optionIndex };
    const allAnswers = hasAnswer ? [...answers, answer] : answers;

    setAnswers(allAnswers);
    setOptionIndex(null);
    onPick(null);

    if (isLast) {
      submit(allAnswers);
    } else {
      setIndex(index + 1);
      onKindChange(quiz.questions[index + 1].kind);
    }
  }

  const name = localized(question, "", lang);

  return (
    <section className="quiz-play" aria-label={t("quiz.title")}>
      <header className="quiz-play-header">
        <span>{t("quiz.progress", { current: index + 1, total: quiz.questions.length })}</span>
        <button type="button" className="quiz-link" onClick={onClose}>
          {t("quiz.quit")}
        </button>
      </header>

      <h2 className="quiz-prompt">
        {question.kind === "locate" && t("quiz.prompt.locate", { name })}
        {question.kind === "capital" && t("quiz.prompt.capital", { name })}
        {question.kind === "flag" && t("quiz.prompt.flag")}
      </h2>

      {question.kind === "flag" && (
        <img
          className="quiz-flag"
          src={`https://flagcdn.com/${question.flag}.svg`}
          alt={t("quiz.prompt.flag")}
        />
      )}

      {question.kind === "locate" ? (
        <p className="quiz-hint">{t(pick ? "quiz.locatePicked" : "quiz.locateHint")}</p>
      ) : (
        <div className="quiz-options">
          {question.options.map((option, position) => (
            <button
              key={position}
              type="button"
              className={"quiz-option" + (optionIndex === position ? " is-selected" : "")}
              aria-pressed={optionIndex === position}
              onClick={() => setOptionIndex(position)}
            >
              {option.label ?? localized(option, "", lang)}
            </button>
          ))}
        </div>
      )}

      {failed && <p className="quiz-error" role="status">{t("auth.errorGeneric")}</p>}

      {failed ? (
        <button type="button" className="quiz-primary" onClick={() => submit(answers)} disabled={submitting}>
          {t("card.retry")}
        </button>
      ) : (
        <button type="button" className="quiz-primary" onClick={goNext} disabled={submitting}>
          {!hasAnswer ? t("quiz.skip") : isLast ? t("quiz.submit") : t("quiz.next")}
        </button>
      )}
    </section>
  );
}

function Result({ result, onReview, onAgain, onClose }) {
  const { lang, t } = useI18n();

  const display = (row, prefix) => {
    if (row.kind === "capital") return row[`${prefix}capital`];

    return localized(row, prefix, lang);
  };

  return (
    <section className="quiz-result" aria-label={t("quiz.resultTitle")}>
      <header className="quiz-header">
        <h2>{t("quiz.resultTitle")}</h2>
        <button type="button" className="quiz-close" onClick={onClose} aria-label={t("card.close")}>
          ×
        </button>
      </header>

      <p className="quiz-score">
        {result.score}/{result.total}
      </p>

      <ol className="quiz-review">
        {result.review.map((row) => (
          <li key={row.position}>
            <button type="button" onClick={() => onReview(row.target_id)}>
              <span className={row.is_correct ? "quiz-mark is-correct" : "quiz-mark is-wrong"}>
                {row.is_correct ? t("quiz.correct") : t("quiz.wrong")}
              </span>
              <strong>{localized(row, "target_", lang)}</strong>
              {row.kind === "capital" && <span>{t("quiz.capitalIs", { capital: row.target_capital })}</span>}
              {!row.is_correct && (
                <span>{t("quiz.yourAnswer", { answer: display(row, "answer_") || "—" })}</span>
              )}
            </button>
          </li>
        ))}
      </ol>

      {onAgain && (
        <button type="button" className="quiz-primary" onClick={onAgain}>
          {t("quiz.again")}
        </button>
      )}
    </section>
  );
}

// Mở bài được giao: máy chủ phát đề ngay, tính là một lần làm.
function AssignmentLoader({ assignment, onStart, onClose }) {
  const { t } = useI18n();
  const [errorKey, setErrorKey] = useState(null);

  useEffect(() => {
    let cancelled = false;

    startAssignment(assignment.id)
      .then((quiz) => {
        if (!cancelled) onStart(quiz);
      })
      .catch((error) => {
        if (cancelled) return;

        const message = error?.message ?? "";

        if (/past_due/.test(message)) setErrorKey("class.closed");
        else if (/no_attempts_left/.test(message)) setErrorKey("class.noAttemptsLeft");
        else setErrorKey("auth.errorGeneric");
      });

    return () => {
      cancelled = true;
    };
    // Chỉ phát đề một lần cho mỗi bài.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment.id]);

  return (
    <div className="quiz-overlay">
      <div className="quiz-dialog" role="dialog" aria-modal="true" aria-label={assignment.title}>
        <header className="quiz-header">
          <h2>{assignment.title}</h2>
          <button type="button" className="quiz-close" onClick={onClose} aria-label={t("card.close")}>
            ×
          </button>
        </header>
        {errorKey ? (
          <p className="quiz-error" role="status">{t(errorKey)}</p>
        ) : (
          <p className="quiz-hint">{t("card.loading")}</p>
        )}
      </div>
    </div>
  );
}

function QuizPanel({ assignment, pick, onPick, onKindChange, onReview, onClose }) {
  const [stage, setStage] = useState({ name: assignment ? "assignment" : "setup" });

  if (stage.name === "assignment") {
    return (
      <AssignmentLoader
        assignment={assignment}
        onClose={onClose}
        onStart={(quiz) => {
          onKindChange(quiz.questions[0].kind);
          setStage({ name: "playing", quiz });
        }}
      />
    );
  }

  if (stage.name === "setup") {
    return (
      <Setup
        onClose={onClose}
        onStart={(quiz) => {
          onKindChange(quiz.questions[0].kind);
          setStage({ name: "playing", quiz });
        }}
      />
    );
  }

  if (stage.name === "playing") {
    return (
      <Playing
        quiz={stage.quiz}
        pick={pick}
        onPick={onPick}
        onKindChange={onKindChange}
        onClose={onClose}
        onFinished={(result) => {
          onKindChange("review");
          setStage({ name: "result", result });
        }}
      />
    );
  }

  return (
    <Result
      result={stage.result}
      onReview={onReview}
      onClose={onClose}
      onAgain={
        assignment
          ? null
          : () => {
              onKindChange(null);
              onPick(null);
              setStage({ name: "setup" });
            }
      }
    />
  );
}

export default QuizPanel;
