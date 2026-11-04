import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/useI18n";
import Icon from "./Icon";
import "./DataSourcesModal.css";

const DATA_SOURCES = [
  {
    id: "naturalEarth",
    url: "https://www.naturalearthdata.com/",
  },
  {
    id: "countries",
    url: "https://countries.dev/",
  },
  {
    id: "wikipedia",
    url: "https://www.wikimedia.org/",
  },
  {
    id: "worldBank",
    url: "https://data.worldbank.org/",
  },
  {
    id: "weather",
    url: "https://open-meteo.com/",
  },
  {
    id: "holidays",
    url: "https://date.nager.at/",
  },
];

function DataSourcesModal({ isOpen, onClose }) {
  const { t } = useI18n();
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="sources-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sources-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sources-modal-container">
        <header className="sources-modal-header">
          <div>
            <h2 id="sources-modal-title">
              {t("sources.modal.title")}
            </h2>
            <p className="sources-modal-subtitle">
              {t("sources.modal.description")}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="sources-modal-close"
            onClick={onClose}
            aria-label={t("card.close")}
          >
            <Icon name="X" size={18} />
          </button>
        </header>

        <div className="sources-modal-body">
          <section className="sources-list" aria-label={t("sources.modal.listLabel")}>
            {DATA_SOURCES.map((src) => (
              <article key={src.id} className="source-item">
                <div className="source-item-header">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="source-name"
                  >
                    {t(`home.sources.${src.id}.name`)} <Icon name="ArrowUpRight" size={14} />
                  </a>
                  <span className="source-license">{t(`home.sources.${src.id}.license`)}</span>
                </div>
                <p className="source-desc">
                  {t(`sources.modal.${src.id}`)}
                </p>
              </article>
            ))}
          </section>

          <div className="sources-disputed-statement">
            <h4>
              {t("sources.modal.neutralityTitle")}
            </h4>
            <p>{t("sources.modal.neutrality")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataSourcesModal;
