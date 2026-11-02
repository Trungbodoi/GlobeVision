import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";

import { createStars } from "../utils/createStars";
import { createGraticule } from "../utils/createGraticule";
import { createAtmosphere } from "../utils/createAtmosphere";
import { createCountryBorders } from "../utils/createCountryBorders";
import {
  readCompareParam,
  readCountryParam,
  writeCompareParam,
  writeCountryParam,
} from "../utils/urlState";
import { getCountryInfo } from "../services/countryApi";
import { loadCountries } from "../data/countries";
import { COMPARE_COLORS, MAX_COMPARE } from "../data/compare";
import { useI18n } from "../i18n/useI18n";

import CountryCard from "./CountryCard";
import CountrySearch from "./CountrySearch";
import CompareTray from "./CompareTray";
import ComparePanel from "./ComparePanel";
import GlobeControls from "./GlobeControls";
import "./WorldGlobe.css";

// Chiều rộng thẻ thông tin + lề (xem CountryCard.css).
const CARD_SPACE = 370 + 24 * 2;
const MOBILE_BREAKPOINT = 600;

const COLORS = {
  defaultDark: "#eeeeee",
  defaultLight: "#f8fafc",
  hover: "#4dabf7",
  selected: "#1c7ed6",
  neighbor: "#a5d8ff",
};

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}

// Nước nhỏ cần zoom gần hơn để nhìn thấy.
function altitudeFor(country) {
  if (country.span < 5) return 1.2;
  if (country.span < 20) return 1.8;

  return 2.5;
}

function WorldGlobe({ onProgress, onLoaded }) {
  const { lang } = useI18n();

  const [countryData, setCountryData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);

  // Theme & Lite Mode state
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem("globevision.theme");
      if (stored === "light" || stored === "dark") return stored;
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  const [liteMode, setLiteMode] = useState(() => {
    try {
      return localStorage.getItem("globevision.liteMode") === "true";
    } catch {
      return false;
    }
  });

  const globeRef = useRef();
  const globeInstanceRef = useRef(null);
  const highlightRef = useRef({
    hoverId: null,
    selectedId: null,
    neighborIds: new Set(),
    compareColors: new Map(),
    theme: "dark",
  });
  const langRef = useRef(lang);

  // Chọn quốc gia từ thao tác người dùng (bấm trên địa cầu, tìm kiếm,
  // bấm nước láng giềng): cập nhật URL để có thể chia sẻ và Back.
  const selectCountry = useCallback((id) => {
    writeCountryParam(id);
    setSelectedId(id);
  }, []);

  const closeCountry = useCallback(() => {
    writeCountryParam(null);
    setSelectedId(null);
  }, []);

  // ----------------------------------------------------------------
  // Danh sách so sánh (tối đa MAX_COMPARE quốc gia), đồng bộ ?compare=
  // ----------------------------------------------------------------
  const updateCompare = useCallback((nextIds) => {
    writeCompareParam(nextIds);
    setCompareIds(nextIds);

    if (nextIds.length < 2) setCompareOpen(false);
  }, []);

  const toggleCompare = useCallback(
    (id) => {
      if (compareIds.includes(id)) {
        updateCompare(compareIds.filter((item) => item !== id));
      } else if (compareIds.length < MAX_COMPARE) {
        updateCompare([...compareIds, id]);
      }
    },
    [compareIds, updateCompare]
  );

  const closeCompare = useCallback(() => setCompareOpen(false), []);

  // ----------------------------------------------------------------
  // Khởi tạo địa cầu (chạy một lần)
  // ----------------------------------------------------------------
  useEffect(() => {
    let globe;
    let stars;
    let graticuleGroup;
    let atmosphere;
    let borders;
    let starMaterial;
    let atmosMat;
    let sceneBackground;
    let globeMat;
    let disposed = false;
    let isUpdatingUniforms = false;

    function applyColors() {
      const {
        hoverId,
        selectedId: current,
        neighborIds,
        compareColors,
        theme: currentTheme,
      } = highlightRef.current;
      const defaultColor =
        currentTheme === "light" ? COLORS.defaultLight : COLORS.defaultDark;

      globe?.polygonCapColor(({ properties }) => {
        if (properties.id === hoverId) return COLORS.hover;
        if (compareColors.has(properties.id)) return compareColors.get(properties.id);
        if (properties.id === current) return COLORS.selected;
        if (neighborIds.has(properties.id)) return COLORS.neighbor;

        return defaultColor;
      });
    }

    // Khi thẻ thông tin đang mở, thu nhỏ vùng vẽ để quốc gia được chọn
    // nằm giữa phần màn hình còn trống thay vì bị thẻ che.
    function fitGlobe() {
      if (!globe) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const cardOpen = Boolean(highlightRef.current.selectedId);

      if (cardOpen && width > MOBILE_BREAKPOINT) {
        globe.width(width - CARD_SPACE).height(height);
      } else if (cardOpen) {
        globe.width(width).height(Math.round(height * 0.45));
      } else {
        globe.width(width).height(height);
      }
    }

    window.addEventListener("resize", fitGlobe);

    async function loadGlobe() {
      try {
        if (onProgress) onProgress(10);

        const [data, boundaryData] = await Promise.all([
          loadCountries(),
          fetch(`${import.meta.env.BASE_URL}data/boundaries.geojson`).then((response) =>
            response.json()
          ),
        ]);

        if (disposed) return;
        if (onProgress) onProgress(45);

        globe = Globe()(globeRef.current);
        const scene = globe.scene();

        // Nền
        const isLight = document.documentElement.getAttribute("data-theme") === "light";
        sceneBackground = new THREE.Color(isLight ? 0xdbeafe : 0x000000);
        scene.background = sceneBackground;

        // Ánh sáng
        const ambientLight = new THREE.AmbientLight(0x4488cc, 2.5);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 3);
        sunLight.position.set(15, 5, 10);
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x4488cc, 0.8);
        fillLight.position.set(-5, -2, -5);
        scene.add(fillLight);

        // Các lớp Three.js riêng
        ({ stars, starMaterial } = createStars(globe, scene));
        graticuleGroup = createGraticule(scene, 100);
        ({ atmosphere, atmosMat } = createAtmosphere(scene, globe, 100));
        borders = createCountryBorders(scene, globe, boundaryData);
        if (onProgress) onProgress(70);

        // Globe.gl
        globeMat = new THREE.MeshStandardMaterial({
          color: isLight ? 0xa4caf6 : 0x061238,
          roughness: 0.7,
          metalness: 0.05,
        });

        globe
          .showAtmosphere(false)
          .globeMaterial(globeMat)
          .polygonSideColor(() => (isLight ? "#cbd5e1" : "#cccccc"))
          .polygonStrokeColor(() => "rgba(0,0,0,0)")
          .polygonAltitude(0.01)
          .polygonLabel(({ properties }) => {
            const name = langRef.current === "en" ? properties.nameEn : properties.nameVi;

            return `
              <div style="
                background: white;
                padding: 6px 10px;
                border-radius: 6px;
                color: #0f172a;
                font-size: 14px;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              ">
                <b>${escapeHtml(name)}</b>
              </div>
            `;
          })
          .onPolygonClick((feature) => {
            selectCountry(feature.properties.id);
          })
          .onPolygonHover((feature) => {
            highlightRef.current.hoverId = feature?.properties.id ?? null;
            applyColors();
          })
          .polygonsData(data.features);

        globeInstanceRef.current = {
          globe,
          scene,
          stars,
          atmosphere,
          graticuleGroup,
          globeMat,
          applyColors,
          fitGlobe,
        };

        applyColors();
        if (onProgress) onProgress(90);

        // Camera
        globe.pointOfView({
          lat: 20,
          lng: 0,
          altitude: 2.5,
        });

        const controls = globe.controls();
        controls.enableZoom = true;
        controls.minDistance = 140;
        controls.maxDistance = 450;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = false;

        // Throttle updates bằng requestAnimationFrame để tối ưu hiệu năng
        controls.addEventListener("change", () => {
          if (isUpdatingUniforms) return;
          isUpdatingUniforms = true;

          requestAnimationFrame(() => {
            if (starMaterial && stars?.visible) {
              starMaterial.uniforms.uCameraPosition.value.copy(globe.camera().position);
            }

            if (atmosMat && atmosphere?.visible) {
              atmosMat.uniforms.uViewPos.value.copy(globe.camera().position);
            }
            isUpdatingUniforms = false;
          });
        });

        setCountryData(data);

        // Mở quốc gia trong liên kết được chia sẻ (?country=VN)
        const initialId = readCountryParam();

        if (initialId && data.byId.has(initialId)) {
          setSelectedId(initialId);
        } else if (initialId) {
          writeCountryParam(null, { replace: true });
        }

        // Danh sách so sánh trong liên kết được chia sẻ (?compare=VN,JP,FR)
        const sharedCompare = readCompareParam();
        const initialCompare = [...new Set(sharedCompare)]
          .filter((id) => data.byId.has(id))
          .slice(0, MAX_COMPARE);

        if (initialCompare.join(",") !== sharedCompare.join(",")) {
          writeCompareParam(initialCompare);
        }

        setCompareIds(initialCompare);
        setCompareOpen(initialCompare.length >= 2);

        if (onLoaded) {
          requestAnimationFrame(() => {
            onLoaded();
          });
        }
      } catch (error) {
        console.error("ERROR loading globe:", error);

        if (onProgress) onProgress(100);

        if (onLoaded) {
          setTimeout(() => {
            onLoaded();
          }, 300);
        }
      }
    }

    loadGlobe();

    return () => {
      disposed = true;
      globeInstanceRef.current = null;
      window.removeEventListener("resize", fitGlobe);

      if (globe) {
        globe._destructor();
      }

      // Giải phóng các layer đã tạo ngoài Globe.gl
      [stars, graticuleGroup, atmosphere, borders].forEach((object) => {
        object?.traverse?.((child) => {
          child.geometry?.dispose?.();

          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material?.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // Cập nhật Theme & Lite Mode trên Three.js instance
  // ----------------------------------------------------------------
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("globevision.theme", theme);
    } catch {
      // bỏ qua
    }

    const inst = globeInstanceRef.current;
    if (!inst) return;

    highlightRef.current.theme = theme;
    inst.applyColors();

    const isLight = theme === "light";
    inst.scene.background = new THREE.Color(isLight ? 0xdbeafe : 0x000000);
    inst.globeMat.color.set(isLight ? 0xa4caf6 : 0x061238);
    inst.globe.polygonSideColor(() => (isLight ? "#cbd5e1" : "#cccccc"));
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("globevision.liteMode", String(liteMode));
    } catch {
      // bỏ qua
    }

    const inst = globeInstanceRef.current;
    if (!inst) return;

    if (inst.atmosphere) inst.atmosphere.visible = !liteMode;
    if (inst.stars) inst.stars.visible = !liteMode;
    if (inst.graticuleGroup) inst.graticuleGroup.visible = !liteMode;
  }, [liteMode]);

  // ----------------------------------------------------------------
  // Bàn phím điều hướng (Keyboard Navigation)
  // ----------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) {
        return;
      }

      const globe = globeInstanceRef.current?.globe;
      if (!globe) return;

      const currentPov = globe.pointOfView();

      switch (event.key) {
        case "ArrowLeft":
        case "a":
        case "A": {
          event.preventDefault();
          globe.pointOfView({ ...currentPov, lng: currentPov.lng - 15 }, 200);
          break;
        }
        case "ArrowRight":
        case "d":
        case "D": {
          event.preventDefault();
          globe.pointOfView({ ...currentPov, lng: currentPov.lng + 15 }, 200);
          break;
        }
        case "ArrowUp":
        case "w":
        case "W": {
          event.preventDefault();
          globe.pointOfView(
            { ...currentPov, lat: Math.min(85, currentPov.lat + 10) },
            200
          );
          break;
        }
        case "ArrowDown":
        case "s":
        case "S": {
          event.preventDefault();
          globe.pointOfView(
            { ...currentPov, lat: Math.max(-85, currentPov.lat - 10) },
            200
          );
          break;
        }
        case "+":
        case "=": {
          event.preventDefault();
          globe.pointOfView(
            { ...currentPov, altitude: Math.max(0.6, currentPov.altitude * 0.8) },
            200
          );
          break;
        }
        case "-":
        case "_": {
          event.preventDefault();
          globe.pointOfView(
            { ...currentPov, altitude: Math.min(4.0, currentPov.altitude * 1.25) },
            200
          );
          break;
        }
        case "Home":
        case "r":
        case "R": {
          event.preventDefault();
          globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 500);
          break;
        }
        case "Escape": {
          if (compareOpen) {
            setCompareOpen(false);
          } else if (selectedId) {
            closeCountry();
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [compareOpen, selectedId, closeCountry]);

  // ----------------------------------------------------------------
  // Điều khiển camera từ giao diện (GlobeControls actions)
  // ----------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    const globe = globeInstanceRef.current?.globe;
    if (!globe) return;
    const pov = globe.pointOfView();
    globe.pointOfView({ ...pov, altitude: Math.max(0.6, pov.altitude * 0.75) }, 300);
  }, []);

  const handleZoomOut = useCallback(() => {
    const globe = globeInstanceRef.current?.globe;
    if (!globe) return;
    const pov = globe.pointOfView();
    globe.pointOfView({ ...pov, altitude: Math.min(4.0, pov.altitude * 1.3) }, 300);
  }, []);

  const handleResetView = useCallback(() => {
    const globe = globeInstanceRef.current?.globe;
    if (!globe) return;
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 600);
  }, []);

  // ----------------------------------------------------------------
  // Nút Back/Forward của trình duyệt
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!countryData) return;

    const handlePopState = () => {
      const id = readCountryParam();

      setSelectedId(id && countryData.byId.has(id) ? id : null);
      writeCompareParam(compareIds);
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [countryData, compareIds]);

  const selectedCountry = selectedId ? countryData?.byId.get(selectedId) ?? null : null;

  // ----------------------------------------------------------------
  // Đưa camera đến quốc gia được chọn (tôn trọng prefers-reduced-motion)
  // ----------------------------------------------------------------
  useEffect(() => {
    const globe = globeInstanceRef.current?.globe;

    if (!globe || !selectedCountry) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? 0 : 1000;

    globe.pointOfView(
      {
        lat: selectedCountry.labelLat,
        lng: selectedCountry.labelLng,
        altitude: altitudeFor(selectedCountry),
      },
      duration
    );
  }, [selectedCountry]);

  // ----------------------------------------------------------------
  // Tải thông tin chi tiết từ API
  // ----------------------------------------------------------------
  const requestKey = selectedCountry?.apiCode ? `${selectedCountry.apiCode}:${retryCount}` : null;

  useEffect(() => {
    if (!requestKey) return;

    const code = requestKey.split(":")[0];
    let cancelled = false;

    getCountryInfo(code)
      .then((result) => {
        if (!cancelled) setDetails({ key: requestKey, ...result, error: null });
      })
      .catch((error) => {
        if (!cancelled) setDetails({ key: requestKey, data: null, error });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const currentDetails = details?.key === requestKey ? details : null;
  const loadingDetails = Boolean(requestKey) && !currentDetails;

  // ----------------------------------------------------------------
  // Quốc gia láng giềng (API trả mã alpha-3)
  // ----------------------------------------------------------------
  const neighbors = useMemo(() => {
    const borders = currentDetails?.data?.borders;

    if (!countryData || !Array.isArray(borders)) return [];

    return borders.map((code) => countryData.byIso3.get(code)).filter(Boolean);
  }, [countryData, currentDetails]);

  const compareCountries = useMemo(
    () => (countryData ? compareIds.map((id) => countryData.byId.get(id)).filter(Boolean) : []),
    [countryData, compareIds]
  );

  // Tô màu quốc gia đang chọn, các nước láng giềng và các nước đang so sánh
  useEffect(() => {
    highlightRef.current.selectedId = selectedId;
    highlightRef.current.neighborIds = new Set(neighbors.map((country) => country.id));
    highlightRef.current.compareColors = new Map(
      compareIds.map((id, index) => [id, COMPARE_COLORS[index]])
    );
    globeInstanceRef.current?.applyColors();
  }, [selectedId, neighbors, compareIds]);

  // Co giãn vùng vẽ khi mở/đóng thẻ thông tin
  useEffect(() => {
    globeInstanceRef.current?.fitGlobe();
  }, [selectedId, countryData]);

  // Nhãn khi rê chuột theo ngôn ngữ hiện tại
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  return (
    <div className="world-globe">
      {/* Globe */}
      <div ref={globeRef} className="world-globe-canvas" />

      {countryData && <CountrySearch countries={countryData.list} onSelect={selectCountry} />}

      {/* Country Card */}
      <CountryCard
        country={selectedCountry}
        details={currentDetails}
        loading={loadingDetails}
        neighbors={neighbors}
        onSelectNeighbor={selectCountry}
        onRetry={() => setRetryCount((count) => count + 1)}
        onClose={closeCountry}
        compareIds={compareIds}
        onToggleCompare={toggleCompare}
      />

      <CompareTray
        countries={compareCountries}
        onRemove={(id) => updateCompare(compareIds.filter((item) => item !== id))}
        onClear={() => updateCompare([])}
        onOpen={() => setCompareOpen(true)}
      />

      {compareOpen && compareCountries.length >= 2 && (
        <ComparePanel
          countries={compareCountries}
          byIso3={countryData.byIso3}
          onClose={closeCompare}
        />
      )}

      {/* Visual Controls for Navigation, Lite Mode, Theme & Shortcuts */}
      <GlobeControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        liteMode={liteMode}
        onToggleLiteMode={() => setLiteMode((v) => !v)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      />

      <SourceNote />
    </div>
  );
}

function SourceNote() {
  const { t } = useI18n();

  return <p className="world-globe-sources">{t("footer.sources")}</p>;
}

export default WorldGlobe;
