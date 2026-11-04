import { useState } from "react";
import { useI18n } from "../i18n/useI18n";
import Icon from "./Icon";
import "./GlobeControls.css";

function GlobeControls({
  onZoomIn,
  onZoomOut,
  onResetView,
  liteMode,
  onToggleLiteMode,
  theme,
  onToggleTheme,
}) {
  const { t } = useI18n();
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <aside className="globe-controls" aria-label={t("controls.globeNavigation")}>
      <div className="globe-controls-group" role="group" aria-label={t("controls.globeNavigation")}>
        <button
          type="button"
          className="globe-ctrl-btn"
          onClick={onZoomIn}
          aria-label={t("controls.zoomIn")}
          title={t("controls.zoomIn")}
        >
          <Icon name="Plus" size={19} />
        </button>

        <button
          type="button"
          className="globe-ctrl-btn"
          onClick={onZoomOut}
          aria-label={t("controls.zoomOut")}
          title={t("controls.zoomOut")}
        >
          <Icon name="Minus" size={19} />
        </button>

        <button
          type="button"
          className="globe-ctrl-btn"
          onClick={onResetView}
          aria-label={t("controls.resetView")}
          title={t("controls.resetView")}
        >
          <Icon name="RotateCcw" size={18} />
        </button>
      </div>

      <div className="globe-controls-group" role="group" aria-label={t("controls.globeTools")}>
        <button
          type="button"
          className={"globe-ctrl-btn" + (liteMode ? " is-active" : "")}
          onClick={onToggleLiteMode}
          aria-label={liteMode ? t("controls.liteModeOn") : t("controls.liteModeOff")}
          title={t("controls.liteModeDesc")}
        >
          <Icon name="Zap" size={18} />
        </button>

        <button
          type="button"
          className="globe-ctrl-btn"
          onClick={onToggleTheme}
          aria-label={theme === "light" ? t("controls.themeLight") : t("controls.themeDark")}
          title={theme === "light" ? t("controls.themeLight") : t("controls.themeDark")}
        >
          <Icon name={theme === "light" ? "Sun" : "Moon"} size={18} />
        </button>

        <button
          type="button"
          className={"globe-ctrl-btn" + (showShortcuts ? " is-active" : "")}
          onClick={() => setShowShortcuts((v) => !v)}
          aria-label={t("controls.shortcuts")}
          title={t("controls.shortcuts")}
        >
          <Icon name="Keyboard" size={18} />
        </button>
      </div>

      {showShortcuts && (
        <div className="shortcuts-dialog" role="dialog" aria-label={t("controls.shortcutsTitle")}>
          <div className="shortcuts-dialog-header">
            <h3>{t("controls.shortcutsTitle")}</h3>
            <button
              type="button"
              className="shortcuts-close"
              onClick={() => setShowShortcuts(false)}
              aria-label={t("card.close")}
            >
              <Icon name="X" size={18} />
            </button>
          </div>
          <ul className="shortcuts-list">
            <li>
              <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
              <span>{t("controls.shortcutsRotate")}</span>
            </li>
            <li>
              <kbd>+</kbd> <kbd>-</kbd>
              <span>{t("controls.shortcutsZoom")}</span>
            </li>
            <li>
              <kbd>Home</kbd> / <kbd>R</kbd>
              <span>{t("controls.shortcutsReset")}</span>
            </li>
            <li>
              <kbd>Esc</kbd>
              <span>{t("controls.shortcutsClose")}</span>
            </li>
          </ul>
        </div>
      )}
    </aside>
  );
}

export default GlobeControls;
