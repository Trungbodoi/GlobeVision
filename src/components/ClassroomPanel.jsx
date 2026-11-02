import { useCallback, useEffect, useState } from "react";
import { useLoad } from "../hooks/useLoad";
import { useAuth } from "../auth/useAuth";
import { useI18n } from "../i18n/useI18n";
import {
  createAssignment,
  deleteTour,
  getAssignmentStats,
  grantAttempt,
  listTours,
  rotateJoinCode,
  createClass,
  deleteAssignment,
  deleteClass,
  getGradebook,
  getMyAssignments,
  getRoster,
  joinClass,
  leaveClass,
  listAssignments,
  listClasses,
  removeStudent,
} from "../services/classroomApi";
import { numberLocale } from "../utils/format";
import { REGIONS, QUIZ_KINDS } from "../data/quiz";
import { questionText } from "../utils/quizText";
import AssignmentEditor, { AssignmentSettings } from "./AssignmentEditor";
import { LoadState } from "./ClassroomParts";
import QuestionBank from "./QuestionBank";
import TourEditor from "./TourEditor";
import "./ClassroomPanel.css";

function useFormatDate() {
  const { lang } = useI18n();

  return (value) =>
    new Date(value).toLocaleString(numberLocale(lang), {
      dateStyle: "short",
      timeStyle: "short",
    });
}

// Chặn công thức khi mở bằng Excel (tên do người dùng tự đặt).
function csvCell(value) {
  let text = value == null ? "" : String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  const bom = String.fromCharCode(0xfeff);
  const lineBreak = String.fromCharCode(13, 10);
  const content = bom + rows.map((row) => row.map(csvCell).join(",")).join(lineBreak);
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Gradebook({ assignment: initial, onBack, onChanged }) {
  const { lang, t } = useI18n();
  const [assignment, setAssignment] = useState(initial);
  const [failed, setFailed] = useState(false);
  const statsLoader = useCallback(() => getAssignmentStats(initial.id), [initial.id]);
  const stats = useLoad(statsLoader);
  const formatDate = useFormatDate();
  const loader = useCallback(() => getGradebook(assignment.id), [assignment.id]);
  const state = useLoad(loader);
  const rows = state.data ?? [];

  const status = (row) => {
    if (row.submitted > 0) return t("class.status.submitted");

    return row.started > 0 ? t("class.status.started") : t("class.status.notStarted");
  };

  function exportCsv() {
    downloadCsv(`${assignment.title}.csv`, [
      [t("class.student"), t("class.status"), t("class.score"), t("class.total"), t("class.submittedAt")],
      ...rows.map((row) => [
        row.display_name,
        status(row),
        row.best_score,
        row.total ?? assignment.question_count,
        row.last_submitted_at ? formatDate(row.last_submitted_at) : "",
      ]),
    ]);
  }

  return (
    <>
      <button type="button" className="class-link" onClick={onBack}>
        ← {t("class.back")}
      </button>
      <h3>{assignment.title}</h3>
      <p className="class-muted">{t("class.due", { date: formatDate(assignment.due_at) })}</p>

      <LoadState state={state}>
        {rows.length === 0 ? (
          <p className="class-muted">{t("class.noStudents")}</p>
        ) : (
          <>
            <div className="class-table-wrap">
              <table className="class-table">
                <thead>
                  <tr>
                    <th scope="col">{t("class.student")}</th>
                    <th scope="col">{t("class.status")}</th>
                    <th scope="col">{t("class.score")}</th>
                    <th scope="col">{t("class.submittedAt")}</th>
                    <th scope="col">{t("class.attemptsCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.student_id}>
                      <th scope="row">{row.display_name}</th>
                      <td>{status(row)}</td>
                      <td>{row.best_score != null ? `${row.best_score}/${row.total}` : "—"}</td>
                      <td>{row.last_submitted_at ? formatDate(row.last_submitted_at) : "—"}</td>
                      <td>
                        {row.started}/{assignment.max_attempts}{" "}
                        {row.started > 0 && (
                          <button
                            type="button"
                            className="class-link"
                            onClick={async () => {
                              setFailed(false);

                              try {
                                await grantAttempt(assignment.id, row.student_id);
                                state.reload();
                              } catch {
                                setFailed(true);
                              }
                            }}
                          >
                            {t("class.grantAttempt")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="class-secondary" onClick={exportCsv}>
              {t("class.exportCsv")}
            </button>
          </>
        )}
      </LoadState>

      {failed && <p className="class-error" role="status">{t("auth.errorGeneric")}</p>}

      <h4>{t("class.statsTitle")}</h4>
      <LoadState state={stats}>
        <ul className="class-list">
          {(stats.data ?? []).map((item) => (
            <li key={item.id}>
              <span className="class-row-text">{questionText(item, lang, t)}</span>
              <strong className="class-stat">
                {item.answered > 0
                  ? t("class.statValue", { correct: item.correct, answered: item.answered })
                  : "—"}
              </strong>
            </li>
          ))}
        </ul>
      </LoadState>

      <AssignmentSettings
        assignment={assignment}
        onSaved={(saved) => {
          setAssignment(saved);
          onChanged();
        }}
      />
    </>
  );
}

function defaultDue() {
  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  due.setMinutes(due.getMinutes() - due.getTimezoneOffset());

  return due.toISOString().slice(0, 16);
}

function AssignmentForm({ classId, onCreated }) {
  const { t, place } = useI18n();
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [kinds, setKinds] = useState(QUIZ_KINDS);
  const [count, setCount] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [dueAt, setDueAt] = useState(defaultDue);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);

    try {
      const created = await createAssignment({
        classId,
        title,
        region: region || null,
        kinds,
        count: Number(count),
        maxAttempts: Number(maxAttempts),
        dueAt: new Date(dueAt).toISOString(),
      });
      setTitle("");
      onCreated(created);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="class-form" onSubmit={handleSubmit}>
      <h4>{t("class.newAssignment")}</h4>

      <label>
        {t("class.assignmentTitle")}
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </label>

      <label>
        {t("quiz.region")}
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">{t("quiz.allRegions")}</option>
          {REGIONS.map((item) => (
            <option key={item} value={item}>
              {place(item)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>{t("quiz.kinds")}</legend>
        {QUIZ_KINDS.map((kind) => (
          <label key={kind} className="class-check">
            <input
              type="checkbox"
              checked={kinds.includes(kind)}
              onChange={() =>
                setKinds((current) =>
                  current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]
                )
              }
            />
            {t(`quiz.kind.${kind}`)}
          </label>
        ))}
      </fieldset>

      <div className="class-form-row">
        <label>
          {t("class.questionCount")}
          <input type="number" min="1" max="20" value={count} onChange={(e) => setCount(e.target.value)} required />
        </label>
        <label>
          {t("class.maxAttempts")}
          <input type="number" min="1" max="10" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} required />
        </label>
      </div>

      <label>
        {t("class.dueAt")}
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
      </label>

      {failed && <p className="class-error" role="status">{t("class.assignmentError")}</p>}

      <button type="submit" className="class-primary" disabled={busy || kinds.length === 0}>
        {t("class.createDraft")}
      </button>
    </form>
  );
}

function TeacherClass({ classItem: initialClass, onBack, onDeleted, countries, onStartTour }) {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const [classItem, setClassItem] = useState(initialClass);
  const toursLoader = useCallback(() => listTours(initialClass.id), [initialClass.id]);
  const tours = useLoad(toursLoader);
  const rosterLoader = useCallback(() => getRoster(classItem.id), [classItem.id]);
  const assignmentLoader = useCallback(() => listAssignments(classItem.id), [classItem.id]);
  const roster = useLoad(rosterLoader);
  const assignments = useLoad(assignmentLoader);
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function act(action, reload) {
    setFailed(false);

    try {
      await action();
      reload?.();
    } catch {
      setFailed(true);
    }
  }

  if (selected?.published) {
    return (
      <Gradebook
        assignment={selected}
        onChanged={assignments.reload}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (selected) {
    return (
      <AssignmentEditor
        assignment={selected}
        onChanged={assignments.reload}
        onBack={() => setSelected(null)}
        onPublished={() => {
          assignments.reload();
          setSelected(null);
        }}
      />
    );
  }

  return (
    <>
      <button type="button" className="class-link" onClick={onBack}>
        ← {t("class.back")}
      </button>
      <h3>{classItem.name}</h3>

      <p className="class-code">
        {t("class.joinCode")}: <strong>{classItem.join_code}</strong>{" "}
        <button
          type="button"
          className="class-link"
          onClick={() => {
            navigator.clipboard
              ?.writeText(classItem.join_code)
              .then(() => setCopied(true))
              .catch(() => {});
          }}
        >
          {copied ? t("card.shared") : t("class.copyCode")}
        </button>{" "}
        <button
          type="button"
          className="class-link"
          onClick={() => {
            if (window.confirm(t("class.confirmRotate"))) {
              act(async () => {
                setClassItem(await rotateJoinCode(classItem.id));
                setCopied(false);
              });
            }
          }}
        >
          {t("class.rotateCode")}
        </button>
      </p>

      {failed && <p className="class-error" role="status">{t("auth.errorGeneric")}</p>}

      <h4>{t("class.assignments")}</h4>
      <LoadState state={assignments}>
        {assignments.data?.length ? (
          <ul className="class-list">
            {assignments.data.map((item) => (
              <li key={item.id}>
                <button type="button" className="class-row" onClick={() => setSelected(item)}>
                  <strong>
                    {item.title} {!item.published && <span className="class-tag">{t("class.draft")}</span>}
                  </strong>
                  <span>{t("class.due", { date: formatDate(item.due_at) })}</span>
                </button>
                <button
                  type="button"
                  className="class-link is-danger"
                  onClick={() => {
                    if (window.confirm(t("class.confirmDeleteAssignment", { name: item.title }))) {
                      act(() => deleteAssignment(item.id), assignments.reload);
                    }
                  }}
                >
                  {t("class.delete")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="class-muted">{t("class.noAssignments")}</p>
        )}
      </LoadState>

      <AssignmentForm
        classId={classItem.id}
        onCreated={(created) => {
          assignments.reload();
          setSelected(created);
        }}
      />

      <h4>{t("tour.title")}</h4>
      <LoadState state={tours}>
        {tours.data?.length ? (
          <ul className="class-list">
            {tours.data.map((tour) => (
              <li key={tour.id}>
                <button type="button" className="class-row" onClick={() => onStartTour(tour)}>
                  <strong>{tour.title}</strong>
                  <span>{t("tour.stops", { count: tour.tour_stops.length })}</span>
                </button>
                <button
                  type="button"
                  className="class-link is-danger"
                  onClick={() => {
                    if (window.confirm(t("class.confirmDeleteAssignment", { name: tour.title }))) {
                      act(() => deleteTour(tour.id), tours.reload);
                    }
                  }}
                >
                  {t("class.delete")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="class-muted">{t("tour.empty")}</p>
        )}
      </LoadState>
      <TourEditor classId={classItem.id} countries={countries} onSaved={tours.reload} />

      <h4>{t("class.students")}</h4>
      <LoadState state={roster}>
        {roster.data?.length ? (
          <ul className="class-list">
            {roster.data.map((student) => (
              <li key={student.student_id}>
                <span className="class-row-text">{student.display_name}</span>
                <button
                  type="button"
                  className="class-link is-danger"
                  onClick={() => {
                    if (window.confirm(t("class.confirmRemove", { name: student.display_name }))) {
                      act(() => removeStudent(classItem.id, student.student_id), roster.reload);
                    }
                  }}
                >
                  {t("class.remove")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="class-muted">{t("class.noStudents")}</p>
        )}
      </LoadState>

      <button
        type="button"
        className="class-secondary is-danger"
        onClick={() => {
          if (window.confirm(t("class.confirmDeleteClass", { name: classItem.name }))) {
            act(async () => {
              await deleteClass(classItem.id);
              onDeleted();
            });
          }
        }}
      >
        {t("class.deleteClass")}
      </button>
    </>
  );
}

function TeacherView({ countries, onStartTour }) {
  const { t } = useI18n();
  const classes = useLoad(listClasses);
  const [selected, setSelected] = useState(null);
  const [showBank, setShowBank] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (showBank) return <QuestionBank onBack={() => setShowBank(false)} />;

  if (selected) {
    return (
      <TeacherClass
        classItem={selected}
        countries={countries}
        onStartTour={onStartTour}
        onBack={() => setSelected(null)}
        onDeleted={() => {
          setSelected(null);
          classes.reload();
        }}
      />
    );
  }

  async function handleCreate(event) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);

    try {
      setSelected(await createClass(name));
      setName("");
      classes.reload();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="class-inline" onSubmit={handleCreate}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder={t("class.newClassName")}
          aria-label={t("class.newClassName")}
          required
        />
        <button type="submit" className="class-primary" disabled={busy}>
          {t("class.createClass")}
        </button>
      </form>

      {failed && <p className="class-error" role="status">{t("auth.errorGeneric")}</p>}

      <LoadState state={classes}>
        {classes.data?.length ? (
          <ul className="class-list">
            {classes.data.map((item) => (
              <li key={item.id}>
                <button type="button" className="class-row" onClick={() => setSelected(item)}>
                  <strong>{item.name}</strong>
                  <span>{t("class.joinCode")}: {item.join_code}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="class-muted">{t("class.noClasses")}</p>
        )}
      </LoadState>

      <button type="button" className="class-secondary" onClick={() => setShowBank(true)}>
        {t("bank.title")}
      </button>
    </>
  );
}

function StudentView({ onStartAssignment, onStartTour }) {
  const { t, place } = useI18n();
  const formatDate = useFormatDate();
  const classes = useLoad(listClasses);
  const assignments = useLoad(getMyAssignments);
  const tours = useLoad(listTours);
  const soonLimit = new Date(new Date().getTime() + 48 * 60 * 60 * 1000);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState(null);

  async function handleJoin(event) {
    event.preventDefault();
    setBusy(true);
    setErrorText(null);

    try {
      await joinClass(code);
      setCode("");
      classes.reload();
      tours.reload();
      assignments.reload();
    } catch (error) {
      setErrorText(t(/invalid_code/.test(error?.message ?? "") ? "class.invalidCode" : "auth.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="class-inline" onSubmit={handleJoin}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={8}
          placeholder={t("class.enterCode")}
          aria-label={t("class.enterCode")}
          required
        />
        <button type="submit" className="class-primary" disabled={busy}>
          {t("class.join")}
        </button>
      </form>

      {errorText && <p className="class-error" role="status">{errorText}</p>}

      <h4>{t("class.assignments")}</h4>
      <LoadState state={assignments}>
        {assignments.data?.length ? (
          <ul className="class-list">
            {assignments.data.map((item) => {
              const pastDue = new Date(item.due_at) < new Date();
              const canStart = !pastDue && item.started < item.max_attempts;

              return (
                <li key={item.id}>
                  <div className="class-row-text">
                    <strong>
                      {item.title}{" "}
                      {canStart && item.started === 0 && new Date(item.due_at) < soonLimit && (
                        <span className="class-tag is-warning">{t("class.dueSoon")}</span>
                      )}
                    </strong>
                    <span>
                      {item.class_name} · {item.region ? place(item.region) : t("quiz.allRegions")} ·{" "}
                      {t("class.questionsOf", { count: item.question_count })}
                    </span>
                    <span>{t("class.due", { date: formatDate(item.due_at) })}</span>
                    <span>
                      {t("class.attemptsUsed", { used: item.started, max: item.max_attempts })}
                      {item.best_score != null &&
                        ` · ${t("class.best", { score: item.best_score, total: item.question_count })}`}
                    </span>
                  </div>
                  {canStart ? (
                    <button type="button" className="class-secondary" onClick={() => onStartAssignment(item)}>
                      {t("class.doAssignment")}
                    </button>
                  ) : (
                    <span className="class-muted">{t(pastDue ? "class.closed" : "class.noAttemptsLeft")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="class-muted">{t("class.noAssignments")}</p>
        )}
      </LoadState>

      <h4>{t("tour.title")}</h4>
      <LoadState state={tours}>
        {tours.data?.length ? (
          <ul className="class-list">
            {tours.data.map((tour) => (
              <li key={tour.id}>
                <button type="button" className="class-row" onClick={() => onStartTour(tour)}>
                  <strong>{tour.title}</strong>
                  <span>{t("tour.stops", { count: tour.tour_stops.length })}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="class-muted">{t("tour.empty")}</p>
        )}
      </LoadState>

      <h4>{t("class.myClasses")}</h4>
      <LoadState state={classes}>
        {classes.data?.length ? (
          <ul className="class-list">
            {classes.data.map((item) => (
              <li key={item.id}>
                <span className="class-row-text">{item.name}</span>
                <button
                  type="button"
                  className="class-link is-danger"
                  onClick={async () => {
                    if (!window.confirm(t("class.confirmLeave", { name: item.name }))) return;

                    try {
                      await leaveClass(item.id);
                      classes.reload();
                      assignments.reload();
                    } catch {
                      setErrorText(t("auth.errorGeneric"));
                    }
                  }}
                >
                  {t("class.leave")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="class-muted">{t("class.noClasses")}</p>
        )}
      </LoadState>
    </>
  );
}

function ClassroomPanel({ countries, onClose, onStartAssignment, onStartTour }) {
  const { t } = useI18n();
  const { profile } = useAuth();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="class-overlay">
      <div className="class-panel" role="dialog" aria-modal="true" aria-label={t("class.title")}>
        <header className="class-header">
          <h2>{t("class.title")}</h2>
          <button type="button" className="class-close" onClick={onClose} aria-label={t("card.close")}>
            ×
          </button>
        </header>

        <div className="class-body">
          {profile?.role === "teacher" ? (
            <TeacherView countries={countries} onStartTour={onStartTour} />
          ) : (
            <StudentView onStartAssignment={onStartAssignment} onStartTour={onStartTour} />
          )}
        </div>
      </div>
    </div>
  );
}

export default ClassroomPanel;
