import "./LoadingScreen.css";

function LoadingScreen({ progress }) {
return ( <div className="loading-screen"> <div className="loading-content"> <div className="loading-globe">🌍</div>

    <h1>GlobeVision</h1>

    <p>Đang tải bản đồ thế giới...</p>

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
