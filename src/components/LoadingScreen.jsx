import { useI18n } from "../i18n/useI18n";
import "./LoadingScreen.css";

function LoadingScreen({ progress }) {
const { t } = useI18n();

return ( <div className="loading-screen"> <div className="loading-content"> <div className="loading-globe">🌍</div>

    <h1>GlobeVision</h1>

    <p>{t("app.loading")}</p>

    <div className="loading-bar">
      <div
        className="loading-bar-fill"
        style={{ width: `${progress}%` }}
      />
    </div>

    <div className="loading-percent">
      {progress}%
    </div>
  </div>
</div>

);
}

export default LoadingScreen;
