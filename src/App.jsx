import { useEffect, useState } from "react";
import WorldGlobe from "./components/WorldGlobe";
import LoadingScreen from "./components/LoadingScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

function App() {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Xóa loader tĩnh trong index.html khi React đã mount
    const initialLoader = document.getElementById("initial-loader");
    if (initialLoader) {
      initialLoader.remove();
    }
  }, []);

  const handleProgress = (value) => {
    setProgress(value);
  };

  const handleLoaded = () => {
    setProgress(100);
    setTimeout(() => {
      setLoading(false);
    }, 400);
  };

  return (
    <ErrorBoundary>
      {loading && <LoadingScreen progress={progress} />}
      <WorldGlobe onProgress={handleProgress} onLoaded={handleLoaded} />
    </ErrorBoundary>
  );
}

export default App;
