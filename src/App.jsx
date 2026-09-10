import { useState } from "react";
import WorldGlobe from "./components/WorldGlobe";
import LoadingScreen from "./components/LoadingScreen";

function App() {
const [progress, setProgress] = useState(0);
const [loading, setLoading] = useState(true);

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
<>
{loading && <LoadingScreen progress={progress} />}


  <WorldGlobe
    onProgress={handleProgress}
    onLoaded={handleLoaded}
  />
</>

);
}

export default App;
