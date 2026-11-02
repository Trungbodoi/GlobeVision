import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/useAuth";
import { useI18n } from "../i18n/useI18n";
import { supabase } from "../lib/supabase";
import { getMyAssignments } from "../services/classroomApi";
import "./AccountControls.css";

function authErrorKey(error) {
  const code = error?.code;
  const message = error?.message ?? "";

  if (code === "invalid_credentials" || /invalid login/i.test(message)) return "auth.errorCredentials";
  if (code === "email_not_confirmed" || /not confirmed/i.test(message)) return "auth.errorUnconfirmed";
  if (code === "user_already_exists" || /already registered/i.test(message)) return "auth.errorExists";
  if (code === "weak_password" || /password should/i.test(message)) return "auth.errorWeakPassword";
  if (code === "over_email_send_rate_limit" || error?.status === 429) return "auth.errorRateLimit";

  return "auth.errorGeneric";
}

function Dialog({ title, onClose, children }) {
  const { t } = useI18n();
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.querySelector("input, button:not(.auth-close)")?.focus();

    if (!onClose) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Portal: thanh công cụ tạo stacking context riêng, nằm dưới thẻ thông tin.
  return createPortal(
    <div className="auth-overlay">
      <div ref={dialogRef} className="auth-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="auth-header">
          <h2>{title}</h2>
          {onClose && (
            <button type="button" className="auth-close" onClick={onClose} aria-label={t("card.close")}>
              ×
            </button>
          )}
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
}

function AuthDialog({ onClose }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  // Quay lại đúng trang đang xem sau khi bấm liên kết trong email.
  const redirectTo = window.location.href;

  function switchMode(next) {
    setMode(next);
    setMessage(null);
  }

  async function run(action) {
    setBusy(true);
    setMessage(null);

    try {
      await action();
    } catch (error) {
      setMessage({ type: "error", text: t(authErrorKey(error)) });
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    run(async () => {
      if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) throw error;

        onClose();
      } else if (mode === "signUp") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, emailRedirectTo: redirectTo },
        });

        if (error) throw error;

        if (data.session) onClose();
        else setMessage({ type: "info", text: t("auth.checkEmail") });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

        if (error) throw error;

        setMessage({ type: "info", text: t("auth.resetSent") });
      }
    });
  }

  const title = t(`auth.title.${mode}`);

  return (
    <Dialog title={title} onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === "signUp" && (
          <label>
            {t("auth.name")}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              autoComplete="name"
              required
            />
          </label>
        )}

        <label>
          {t("auth.email")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        {mode !== "reset" && (
          <label>
            {t("auth.password")}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              minLength={mode === "signUp" ? 8 : undefined}
              required
            />
          </label>
        )}

        {message && (
          <p className={`auth-message is-${message.type}`} role="status">
            {message.text}
          </p>
        )}

        <button type="submit" className="auth-primary" disabled={busy}>
          {t(`auth.submit.${mode}`)}
        </button>
      </form>

      <div className="auth-links">
        {mode === "signIn" && (
          <>
            <button type="button" onClick={() => switchMode("signUp")}>{t("auth.toSignUp")}</button>
            <button type="button" onClick={() => switchMode("reset")}>{t("auth.toReset")}</button>
          </>
        )}
        {mode !== "signIn" && (
          <button type="button" onClick={() => switchMode("signIn")}>{t("auth.toSignIn")}</button>
        )}
      </div>
    </Dialog>
  );
}

function RoleDialog() {
  const { t } = useI18n();
  const { chooseRole, reloadProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(role) {
    setBusy(true);
    setFailed(false);

    try {
      await chooseRole(role);
    } catch (error) {
      // Đã chọn ở thiết bị khác: tải lại hồ sơ thay vì báo lỗi.
      if (/role_already_chosen/.test(error?.message ?? "")) reloadProfile();
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title={t("auth.role.title")}>
      <p className="auth-text">{t("auth.role.note")}</p>

      <div className="auth-roles">
        {["student", "teacher"].map((role) => (
          <button key={role} type="button" className="auth-role" onClick={() => choose(role)} disabled={busy}>
            <strong>{t(`auth.role.${role}`)}</strong>
            <span>{t(`auth.role.${role}Hint`)}</span>
          </button>
        ))}
      </div>

      {failed && (
        <p className="auth-message is-error" role="status">
          {t("auth.errorGeneric")}
        </p>
      )}

      <button type="button" className="auth-secondary" onClick={() => supabase.auth.signOut()} disabled={busy}>
        {t("auth.signOut")}
      </button>
    </Dialog>
  );
}

function NewPasswordDialog() {
  const { t } = useI18n();
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErrorText(null);

    const { error } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (error) setErrorText(t(authErrorKey(error)));
    else finishRecovery();
  }

  return (
    <Dialog title={t("auth.newPassword.title")} onClose={finishRecovery}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          {t("auth.newPassword.label")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        {errorText && (
          <p className="auth-message is-error" role="status">
            {errorText}
          </p>
        )}

        <button type="submit" className="auth-primary" disabled={busy}>
          {t("auth.newPassword.submit")}
        </button>
      </form>
    </Dialog>
  );
}

function PendingBadge() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMyAssignments()
      .then((rows) => {
        const now = new Date();

        if (!cancelled) {
          setCount(rows.filter((row) => row.started === 0 && new Date(row.due_at) > now).length);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className="account-badge" title={t("class.pendingBadge", { count })}>
      {count}
    </span>
  );
}

function AccountControls({ onOpenQuiz, onOpenClassroom }) {
  const { t } = useI18n();
  const { enabled, loading, user, profile, profileError, recovering, reloadProfile } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!enabled) return null;

  if (!user) {
    return (
      <>
        <button type="button" className="account-button" onClick={() => setDialogOpen(true)} disabled={loading}>
          {t("auth.signIn")}
        </button>
        {dialogOpen && <AuthDialog onClose={() => setDialogOpen(false)} />}
      </>
    );
  }

  return (
    <div className="account-signed-in">
      {profileError ? (
        <button type="button" className="account-button" onClick={reloadProfile}>
          {t("card.retry")}
        </button>
      ) : (
        <span className="account-name" title={profile?.display_name}>
          {loading ? "…" : profile?.display_name}
          {profile?.role && <small>{t(`auth.role.${profile.role}`)}</small>}
        </span>
      )}

      {profile?.role && (
        <>
          <button type="button" className="account-button" onClick={onOpenClassroom}>
            {t("class.title")}
            {profile.role === "student" && <PendingBadge />}
          </button>
          <button type="button" className="account-button" onClick={onOpenQuiz}>
            {t("quiz.title")}
          </button>
        </>
      )}

      <button type="button" className="account-button" onClick={() => supabase.auth.signOut()}>
        {t("auth.signOut")}
      </button>

      {!loading && profile && !profile.role && <RoleDialog />}
      {recovering && <NewPasswordDialog />}
    </div>
  );
}

export default AccountControls;
