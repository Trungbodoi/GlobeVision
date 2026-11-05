import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCountryName } from "../data/countries";
import { getCountryInfo } from "../services/countryApi";
import {
  answersOnGlobe,
  buildQuestionOptions,
  generateQuizQuestions,
  getAnswerFromCountryInfo,
  getDailySeed,
  getQuizCountries,
  getRegionOptions,
  getReplacementCountries,
  needsCountryInfo,
  QUIZ_DIFFICULTIES,
  QUIZ_TYPES,
} from "../education/quizEngine";
import { LEARNING_PATHS } from "../education/learningPaths";
import { selectDueCards } from "../education/srs";
import {
  createEmptyProgress,
  exportProgress,
  importProgress,
  loadProgress,
  recordAnswer,
  saveProgress,
} from "../education/progressStore";
import { useI18n } from "../i18n/useI18n";
import FlagImage from "./FlagImage";
import Icon from "./Icon";
import { createUrlWithParams } from "../utils/urlState";
import "./EducationCenter.css";

function countryFromCode(code, countries) {
  return countries.find((country) => country.id === code);
}

function shareUrl({ quiz, difficulty, type, path }) {
  return createUrlWithParams(window.location.href, {
    quiz: path ? null : quiz,
    difficulty: path ? null : difficulty,
    quizType: path || type === "mixed" ? null : type,
    path: path || null,
  });
}

// Lỗi 4xx nghĩa là API không có nước này, khác với lỗi mạng (có thể thử lại).
async function loadCountryInfoOrNull(country) {
  try {
    const { data } = await getCountryInfo(country.apiCode);
    return data;
  } catch (error) {
    if (error.status >= 400 && error.status < 500) return null;
    throw error;
  }
}

function getStoredProgress() {
  try {
    return { progress: loadProgress(), error: "" };
  } catch (error) {
    return { progress: createEmptyProgress(), error: error.message };
  }
}

function EducationCenter({
  countries,
  onClose,
  onSelectCountry,
  onGlobeAnswer,
  onDockChange,
  onQuizStateChange,
  initialConfig,
}) {
  const { lang, t, place } = useI18n();
  const [view, setView] = useState(initialConfig.path ? "paths" : initialConfig.view || "quiz");
  const [quizType, setQuizType] = useState(
    initialConfig.type === "mixed" || QUIZ_TYPES.includes(initialConfig.type)
      ? initialConfig.type
      : "mixed"
  );
  const [region, setRegion] = useState(initialConfig.region || "all");
  const [difficulty, setDifficulty] = useState(
    QUIZ_DIFFICULTIES.includes(initialConfig.difficulty) ? initialConfig.difficulty : "easy"
  );
  const [session, setSession] = useState(null);
  const [resolvedQuestion, setResolvedQuestion] = useState(null);
  const [resolutionError, setResolutionError] = useState("");
  const [resolveAttempt, setResolveAttempt] = useState(0);
  const [answerResult, setAnswerResult] = useState(null);
  const [storedProgress] = useState(getStoredProgress);
  const [progress, setProgress] = useState(storedProgress.progress);
  const [progressError, setProgressError] = useState(storedProgress.error);
  const [notice, setNotice] = useState("");
  const [pathId, setPathId] = useState(
    LEARNING_PATHS.some((path) => path.id === initialConfig.path)
      ? initialConfig.path
      : LEARNING_PATHS[0].id
  );
  const [pathStop, setPathStop] = useState(0);
  const [flashcardIds, setFlashcardIds] = useState([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  const quizCountries = useMemo(() => getQuizCountries(countries), [countries]);
  const regions = useMemo(() => getRegionOptions(quizCountries), [quizCountries]);
  const selectedRegion = regions.some((item) => item.value === region) ? region : "all";
  const sessionQuestions = session?.questions;
  const question = session?.questions[session.index] ?? null;
  const promptCountry = question
    ? countryFromCode(question.promptCountry.id, countries)
    : null;
  const answerHandlerRef = useRef(null);
  const dailyStartHandledRef = useRef(false);
  const quizFinished = Boolean(session) && session.index >= session.questions.length;
  const quizRunning = view === "quiz" && Boolean(session) && !quizFinished;
  const mapAnswerMode = Boolean(
    question &&
    resolvedQuestion?.key === question.id &&
    answersOnGlobe(question) &&
    !answerResult
  );
  // Khi làm quiz và đi theo hành trình, người học cần nhìn và bấm được vào địa cầu.
  const docked = quizRunning || view === "paths";

  useEffect(() => {
    onDockChange(docked);
    return () => onDockChange(false);
  }, [docked, onDockChange]);

  // Sau khi trả lời, địa cầu tô và bay đến đáp án. Khóa dạng chuỗi để chỉ báo
  // cho địa cầu khi đáp án thực sự đổi.
  let revealIds = "";
  if (answerResult && resolvedQuestion) {
    const { answerIds, shownAnswerId } = resolvedQuestion;
    revealIds = answerResult.correct
      ? answerResult.countryId
      : [shownAnswerId, ...answerIds.filter((id) => id !== shownAnswerId)].join(",");
  }
  const revealChosenId = answerResult && !answerResult.correct ? answerResult.countryId : null;

  useEffect(() => {
    const correctIds = revealIds ? revealIds.split(",") : null;
    onQuizStateChange(quizRunning ? {
      reveal: correctIds && { correctIds, chosenId: revealChosenId, focusId: correctIds[0] },
    } : null);
    return () => onQuizStateChange(null);
  }, [quizRunning, revealIds, revealChosenId, onQuizStateChange]);

  useEffect(() => {
    if (!question || !promptCountry) return;

    let cancelled = false;

    function updateQuestion(changes) {
      setSession((current) => current && {
        ...current,
        questions: current.questions.map((item) =>
          item.id === question.id ? { ...item, ...changes } : item
        ),
      });
    }

    function publishQuestion({ answerIds, shownAnswerId, capital }) {
      const optionIds = answersOnGlobe(question)
        ? []
        : buildQuestionOptions({
            countries: quizCountries,
            region: selectedRegion,
            promptId: promptCountry.id,
            answerIds,
            shownAnswerId,
            count: question.difficulty === "easy" ? 4 : 6,
            seed: question.seed,
          }).map((country) => country.id);
      setResolvedQuestion({ key: question.id, capital, answerIds, shownAnswerId, optionIds });
    }

    async function resolve() {
      try {
        if (!needsCountryInfo(question)) {
          publishQuestion({ answerIds: [promptCountry.id], shownAnswerId: promptCountry.id });
          return;
        }

        // Quốc đảo không có láng giềng, vài vùng không có thủ đô: thử lại không giúp
        // được gì nên tự đổi sang nước khác, hết nước thì đổi sang câu quốc kỳ.
        const candidates = [
          promptCountry,
          ...getReplacementCountries({
            countries: quizCountries,
            region: selectedRegion,
            questions: sessionQuestions,
            seed: question.seed,
          }),
        ];
        for (const candidate of candidates) {
          const info = await loadCountryInfoOrNull(candidate);
          if (cancelled) return;
          const answer = info && getAnswerFromCountryInfo(question, candidate, info, quizCountries);
          if (!answer) continue;
          if (candidate === promptCountry) publishQuestion(answer);
          else updateQuestion({ promptCountry: candidate });
          return;
        }
        updateQuestion({ type: "flag" });
      } catch (error) {
        if (!cancelled) {
          setResolutionError({
            key: question.id,
            message: error.message || t("education.questionError"),
          });
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [question, promptCountry, sessionQuestions, quizCountries, resolveAttempt, selectedRegion, t]);

  useEffect(() => {
    // Trong lúc làm quiz, bấm trên địa cầu ngoài lượt trả lời sẽ không làm gì,
    // để không chọn nhầm quốc gia và làm lộ đáp án của câu sau.
    const ignoreClick = () => {};
    const handler = mapAnswerMode
      ? (countryId) => answerHandlerRef.current?.(countryId)
      : quizRunning ? ignoreClick : null;
    onGlobeAnswer(handler);
    return () => onGlobeAnswer(null);
  }, [mapAnswerMode, quizRunning, onGlobeAnswer, answerHandlerRef]);

  useEffect(() => {
    answerHandlerRef.current = submitAnswer;
  });

  function persistProgress(next) {
    try {
      saveProgress(next);
      setProgress(next);
      setProgressError("");
    } catch (error) {
      setProgressError(`${t("education.saveError")} ${error.message}`);
    }
  }

  const startQuiz = useCallback((daily = false) => {
    try {
      const count = daily ? 5 : 10;
      const seed = daily
        ? `${getDailySeed()}-${selectedRegion}`
        : `quiz-${Date.now()}-${Math.random()}`;
      const questions = generateQuizQuestions({
        countries: quizCountries,
        region: selectedRegion,
        type: daily ? "mixed" : quizType,
        difficulty,
        seed,
        count,
      });
      setSession({ questions, index: 0, score: 0, daily, results: [] });
      setAnswerResult(null);
      setView("quiz");
    } catch (error) {
      setNotice(error.message);
    }
  }, [quizCountries, selectedRegion, quizType, difficulty]);

  useEffect(() => {
    if (initialConfig.intent !== "daily" || dailyStartHandledRef.current) return;
    dailyStartHandledRef.current = true;
    startQuiz(true);
  }, [initialConfig.intent, startQuiz]);

  function submitAnswer(countryId) {
    if (!resolvedQuestion || answerResult || !question) return;
    answerHandlerRef.current = null;
    const correct = resolvedQuestion.answerIds.includes(countryId);
    const nextProgress = recordAnswer(progress, promptCountry.id, correct);
    persistProgress(nextProgress);
    setAnswerResult({ countryId, correct });
    setSession((current) => ({
      ...current,
      score: current.score + Number(correct),
      results: [...current.results, correct],
    }));
  }

  function advanceQuestion() {
    if (!session) return;
    if (session.index + 1 >= session.questions.length) {
      setSession({ ...session, index: session.questions.length });
      setAnswerResult(null);
      return;
    }
    setSession({ ...session, index: session.index + 1 });
    setAnswerResult(null);
  }

  function startFlashcards() {
    const due = selectDueCards(progress.cards);
    const ids = due.length ? due : quizCountries.map((country) => country.id);
    setFlashcardIds(ids);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setView("flashcards");
  }

  function reviewFlashcard(correct) {
    const countryId = flashcardIds[flashcardIndex];
    if (!countryId) return;
    const nextProgress = recordAnswer(progress, countryId, correct);
    persistProgress(nextProgress);
    if (flashcardIndex + 1 >= flashcardIds.length) {
      setFlashcardIds(selectDueCards(nextProgress.cards));
      setFlashcardIndex(0);
    } else {
      setFlashcardIndex((index) => index + 1);
    }
    setFlashcardFlipped(false);
  }

  async function shareConfiguration(path = null) {
    const url = shareUrl({ quiz: selectedRegion, difficulty, type: quizType, path });
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t("education.linkCopied"));
    } catch {
      setNotice(url);
    }
  }

  function exportData() {
    const blob = new Blob([exportProgress(progress)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "globevision-learning-progress.json";
    link.click();
    URL.revokeObjectURL(href);
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = importProgress(await file.text());
      persistProgress(next);
      setNotice(t("education.importSuccess"));
    } catch (error) {
      setNotice(`${t("education.importError")} ${error.message}`);
    }
  }

  function clearData() {
    if (!window.confirm(t("education.confirmClear"))) return;
    try {
      localStorage.removeItem("globevision.learningProgress");
      setProgress(createEmptyProgress());
      setProgressError("");
      setNotice(t("education.cleared"));
    } catch (error) {
      setProgressError(`${t("education.saveError")} ${error.message}`);
    }
  }

  const activePath = LEARNING_PATHS.find((path) => path.id === pathId) ?? LEARNING_PATHS[0];
  const pathCountries = activePath.stops.map((id) => countryFromCode(id, countries)).filter(Boolean);
  const currentPathCountry = pathCountries[pathStop] ?? null;
  const activeFlashcard = countryFromCode(flashcardIds[flashcardIndex], countries);
  const totalAccuracy = progress.stats.totalAnswered
    ? Math.round((progress.stats.totalCorrect / progress.stats.totalAnswered) * 100)
    : 0;

  // Địa cầu luôn bay theo điểm dừng đang hiển thị của hành trình.
  const pathStopId = view === "paths" ? currentPathCountry?.id : null;
  useEffect(() => {
    if (pathStopId) onSelectCountry(pathStopId);
  }, [pathStopId, onSelectCountry]);

  // Cuộn để nút của điểm dừng hiện tại luôn nằm giữa dải điểm dừng.
  const pathStopsRef = useRef(null);
  useEffect(() => {
    const container = pathStopsRef.current;
    const active = container?.querySelector(".is-active");
    if (!active) return;
    const offset = active.getBoundingClientRect().left - container.getBoundingClientRect().left;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollBy({
      left: offset - (container.clientWidth - active.offsetWidth) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [pathStopId]);

  function questionPrompt() {
    if (!question || !promptCountry) return "";
    const name = getCountryName(promptCountry, lang);
    const isResolved = resolvedQuestion?.key === question.id;
    switch (question.type) {
      case "flag":
        return t("education.askFlag");
      case "capital":
        return t("education.askCapital", {
          capital: isResolved ? place(resolvedQuestion.capital) : "…",
        });
      case "neighbor":
        // Chưa hiện tên nước khi chưa biết nước này có hỏi được hay không.
        return t("education.askNeighbor", { name: isResolved ? name : "…" });
      default:
        return t("education.askFind", { name });
    }
  }

  return (
    <div className={`education-backdrop${docked ? " is-docked" : ""}`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="education-center"
        role="dialog"
        aria-modal={docked ? undefined : "true"}
        aria-labelledby="education-title"
      >
        <header className="education-header">
          <div>
            <p className="education-eyebrow">{t("education.eyebrow")}</p>
            <h2 id="education-title">{t("education.title")}</h2>
          </div>
          <button type="button" className="education-close" onClick={onClose} aria-label={t("card.close")}><Icon name="X" size={18} /></button>
        </header>

        <nav className="education-tabs" aria-label={t("education.navigation")}>
          {["quiz", "flashcards", "paths", "progress"].map((item) => (
            <button
              type="button"
              key={item}
              className={view === item ? "is-active" : ""}
              onClick={() => {
                setView(item);
                setSession(null);
                setAnswerResult(null);
              }}
            >
              {t(`education.tab.${item}`)}
            </button>
          ))}
        </nav>

        {progressError && <p className="education-alert" role="alert">{progressError}</p>}
        {notice && (
          <div className="education-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label={t("card.close")}><Icon name="X" size={16} /></button>
          </div>
        )}

        {view === "quiz" && (
          <div className="education-content">
            {!session && (
              <>
                <p className="education-intro">{t("education.quizIntro")}</p>
                <div className="education-settings">
                  <label>
                    {t("education.type")}
                    <select value={quizType} onChange={(event) => setQuizType(event.target.value)}>
                      <option value="mixed">{t("education.type.mixed")}</option>
                      {QUIZ_TYPES.map((type) => <option value={type} key={type}>{t(`education.type.${type}`)}</option>)}
                    </select>
                  </label>
                  <label>
                    {t("education.region")}
                    <select value={selectedRegion} onChange={(event) => setRegion(event.target.value)}>
                      {regions.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.value === "all" ? t("education.allRegions") : place(item.label)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("education.difficulty")}
                    <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                      {QUIZ_DIFFICULTIES.map((value) => <option value={value} key={value}>{t(`education.difficulty.${value}`)}</option>)}
                    </select>
                  </label>
                </div>
                <p className="education-hint">
                  {answersOnGlobe({ type: quizType, difficulty }) ? t("education.hardHint") : t("education.choiceHint", { count: difficulty === "easy" ? 4 : 6 })}
                </p>
                <div className="education-actions">
                  <button type="button" className="education-primary" onClick={() => startQuiz(false)}>{t("education.startQuiz")}</button>
                  <button type="button" className="education-secondary" onClick={() => startQuiz(true)}>{t("education.dailyChallenge")}</button>
                  <button type="button" className="education-secondary" onClick={() => shareConfiguration()}>{t("education.shareQuiz")}</button>
                </div>
              </>
            )}

            {session && !quizFinished && question && (
              <>
                <div className="education-progress-line">
                  <span>{session.daily ? t("education.dailyChallenge") : t("education.questionNumber", { current: session.index + 1, total: session.questions.length })}</span>
                  <span>{t("education.score", { score: session.score })}</span>
                </div>
                <div className="education-question">
                  <span className="education-question-type">{t(`education.type.${question.type}`)}</span>
                  {question.type === "flag" && (
                    <FlagImage
                      key={promptCountry.iso2}
                      className="education-flag"
                      iso2={promptCountry.iso2}
                      alt={t("education.flagPromptAlt")}
                      fallback={<span className="education-flag-missing" role="alert">{t("education.flagUnavailable")}</span>}
                    />
                  )}
                  <h3>{questionPrompt()}</h3>
                </div>

                {resolutionError?.key === question.id && (
                  <div className="education-alert" role="alert">
                    {resolutionError.message}
                    <button
                      type="button"
                      onClick={() => {
                        setResolutionError(null);
                        setResolveAttempt((attempt) => attempt + 1);
                      }}
                    >
                      {t("card.retry")}
                    </button>
                  </div>
                )}
                {resolutionError?.key !== question.id && resolvedQuestion?.key !== question.id && <p className="education-loading" role="status">{t("education.loadingQuestion")}</p>}
                {mapAnswerMode && (
                  <p className="education-hint">{t("education.hardHint")}</p>
                )}
                {resolvedQuestion?.key === question.id && !answersOnGlobe(question) && (
                  <div className="education-options">
                    {resolvedQuestion.optionIds.map((id) => {
                      const country = countryFromCode(id, countries);
                      const isCorrect = resolvedQuestion.answerIds.includes(id);
                      const isChosen = answerResult?.countryId === id;
                      return (
                        <button
                          type="button"
                          key={id}
                          disabled={Boolean(answerResult)}
                          className={`${isChosen ? (answerResult.correct ? "is-correct" : "is-wrong") : ""}${answerResult && isCorrect ? " is-answer" : ""}`}
                          onClick={() => submitAnswer(id)}
                        >
                          <span>{getCountryName(country, lang)}</span>
                          {answerResult && isCorrect && <Icon name="Check" size={17} />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {answerResult && (
                  <div className={`education-answer ${answerResult.correct ? "is-correct" : "is-wrong"}`} role="status">
                    <strong>{t(answerResult.correct ? "education.correct" : "education.incorrect")}</strong>
                    {!answerResult.correct && (
                      <span>
                        {resolvedQuestion.answerIds
                          .map((id) => getCountryName(countryFromCode(id, countries), lang))
                          .join(", ")}
                      </span>
                    )}
                    <button type="button" className="education-primary" onClick={advanceQuestion}>{t("education.next")}</button>
                  </div>
                )}
              </>
            )}

            {quizFinished && (
              <div className="education-finished">
                <span className="education-finished-icon">
                  <Icon name={session.score === session.questions.length ? "Trophy" : "Globe2"} size={32} />
                </span>
                <h3>{t("education.quizComplete")}</h3>
                <p>{t("education.finalScore", { score: session.score, total: session.questions.length })}</p>
                {session.daily && <p>{t("education.dailyDate", { date: getDailySeed().slice(-10) })}</p>}
                <button type="button" className="education-primary" onClick={() => setSession(null)}>{t("education.playAgain")}</button>
              </div>
            )}
          </div>
        )}

        {view === "flashcards" && (
          <div className="education-content">
            <div className="education-progress-line">
              <span>{t("education.dueCards", { count: selectDueCards(progress.cards).length })}</span>
              <span>{flashcardIds.length ? t("education.questionNumber", { current: flashcardIndex + 1, total: flashcardIds.length }) : ""}</span>
            </div>
            {!activeFlashcard ? (
              <div className="education-empty">
                <p>{t("education.flashcardIntro")}</p>
                <button type="button" className="education-primary" onClick={startFlashcards}>{t("education.startFlashcards")}</button>
              </div>
            ) : (
              <>
                <button type="button" className={`education-flashcard${flashcardFlipped ? " is-flipped" : ""}`} onClick={() => setFlashcardFlipped((flipped) => !flipped)}>
                  <span>{flashcardFlipped ? t("education.flashcardBack") : t("education.flashcardFront")}</span>
                  {flashcardFlipped ? (
                    <>
                      <strong><FlagImage key={activeFlashcard.iso2} className="education-inline-flag" iso2={activeFlashcard.iso2} /> {getCountryName(activeFlashcard, lang)}</strong>
                      <span>{place(activeFlashcard.continent)} · {place(activeFlashcard.subregion)}</span>
                      {activeFlashcard.popEst > 0 && <span>{t("field.population")}: {Math.round(activeFlashcard.popEst).toLocaleString(lang === "vi" ? "vi-VN" : "en-US")}</span>}
                    </>
                  ) : <strong>{getCountryName(activeFlashcard, lang)}</strong>}
                  <small>{t("education.flipCard")}</small>
                </button>
                {flashcardFlipped && (
                  <div className="education-actions">
                    <button type="button" className="education-secondary" onClick={() => reviewFlashcard(false)}>{t("education.reviewAgain")}</button>
                    <button type="button" className="education-primary" onClick={() => reviewFlashcard(true)}>{t("education.known")}</button>
                  </div>
                )}
                <button type="button" className="education-text-button" onClick={startFlashcards}>{t("education.restartFlashcards")}</button>
              </>
            )}
          </div>
        )}

        {view === "paths" && (
          <div className="education-content">
            <p className="education-intro">{t("education.pathsIntro")}</p>
            <label className="education-path-picker">
              {t("education.choosePath")}
              <select value={pathId} onChange={(event) => { setPathId(event.target.value); setPathStop(0); }}>
                {LEARNING_PATHS.map((path) => <option key={path.id} value={path.id}>{t(path.titleKey)}</option>)}
              </select>
            </label>
            <div className="education-path-card">
              <h3>{t(activePath.titleKey)}</h3>
              <p>{t(activePath.descriptionKey)}</p>
              <div className="education-path-stops" ref={pathStopsRef}>
                {pathCountries.map((country, index) => (
                  <button type="button" className={index === pathStop ? "is-active" : ""} key={country.id} onClick={() => setPathStop(index)}>
                    <span>{index + 1}</span>{getCountryName(country, lang)}
                  </button>
                ))}
              </div>
              {currentPathCountry && (
                <div className="education-stop-detail">
                  <span>{t("education.stop", { current: pathStop + 1, total: pathCountries.length })}</span>
                  <strong><FlagImage key={currentPathCountry.iso2} className="education-inline-flag" iso2={currentPathCountry.iso2} /> {getCountryName(currentPathCountry, lang)}</strong>
                  <p>{t("education.stopFact", { name: getCountryName(currentPathCountry, lang), region: place(currentPathCountry.subregion || currentPathCountry.continent), population: Math.round(currentPathCountry.popEst || 0).toLocaleString(lang === "vi" ? "vi-VN" : "en-US") })}</p>
                  <div className="education-actions">
                    <button type="button" className="education-secondary" disabled={pathStop === 0} onClick={() => setPathStop(pathStop - 1)}>{t("education.previousStop")}</button>
                    <button type="button" className="education-primary" disabled={pathStop >= pathCountries.length - 1} onClick={() => setPathStop(pathStop + 1)}>{t("education.nextStop")}</button>
                    <button type="button" className="education-secondary" onClick={() => shareConfiguration(activePath.id)}>{t("education.sharePath")}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === "progress" && (
          <div className="education-content">
            <div className="education-stats">
              <div><strong>{progress.stats.learnedCountryIds.length}</strong><span>{t("education.learned")}</span></div>
              <div><strong>{totalAccuracy}%</strong><span>{t("education.accuracy")}</span></div>
              <div><strong>{progress.stats.streak}</strong><span>{t("education.streak")}</span></div>
              <div><strong>{progress.stats.totalAnswered}</strong><span>{t("education.answered")}</span></div>
            </div>
            <h3 className="education-section-heading">{t("education.badges")}</h3>
            <div className="education-badges">
              {["first-answer", "ten-countries", "accuracy"].map((badge) => (
                <span className={progress.badges.includes(badge) ? "is-earned" : ""} key={badge}>
                  <Icon
                    name={progress.badges.includes(badge) ? "Trophy" : "LockKeyhole"}
                    size={16}
                  />
                  {t(`education.badge.${badge}`)}
                </span>
              ))}
            </div>
            <div className="education-actions">
              <button type="button" className="education-primary" onClick={exportData}>{t("education.export")}</button>
              <label className="education-file-button">{t("education.import")}<input type="file" accept="application/json,.json" onChange={importData} /></label>
              <button type="button" className="education-danger" onClick={clearData}>{t("education.clear")}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default EducationCenter;
