import { useEffect, useState } from "react";
import { useI18n } from "../i18n/useI18n";

// Sao chép URL hiện tại (đã chứa ?country= / ?compare=) để chia sẻ.
function ShareButton({ className = "country-card-action" }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2000);

    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          if (!navigator.clipboard?.writeText) {
            throw new Error("Clipboard access is unavailable.");
          }
          await navigator.clipboard.writeText(window.location.href);
          setCopyError(false);
          setCopied(true);
        } catch {
          setCopyError(true);
          setCopied(false);
        }
      }}
    >
      {copyError ? t("card.shareError") : copied ? t("card.shared") : t("card.share")}
    </button>
  );
}

export default ShareButton;
