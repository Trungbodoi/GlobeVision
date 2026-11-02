import { useI18n } from "../i18n/useI18n";

export function LoadState({ state, children }) {
  const { t } = useI18n();

  if (!state.loaded) return <p className="class-muted">{t("card.loading")}</p>;

  if (state.failed) {
    return (
      <p className="class-error" role="status">
        {t("auth.errorGeneric")}{" "}
        <button type="button" className="class-link" onClick={state.reload}>
          {t("card.retry")}
        </button>
      </p>
    );
  }

  return children;
}
