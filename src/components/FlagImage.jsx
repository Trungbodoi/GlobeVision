import { useState } from "react";
import { getFlagUrl } from "../education/quizEngine";

function FlagImage({ iso2, alt = "", className, fallback = null }) {
  const url = getFlagUrl(iso2);
  const [failedUrl, setFailedUrl] = useState(null);

  if (!url || failedUrl === url) return fallback;

  return <img className={className} src={url} alt={alt} onError={() => setFailedUrl(url)} />;
}

export default FlagImage;
