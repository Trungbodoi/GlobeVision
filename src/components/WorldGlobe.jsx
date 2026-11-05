import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import { booleanPointInPolygon, point } from "@turf/turf";

import { createStars } from "../utils/createStars";
import { createGraticule } from "../utils/createGraticule";
import { createAtmosphere } from "../utils/createAtmosphere";
import { createCountryBorders } from "../utils/createCountryBorders";
import { createDayNightOverlay } from "../utils/createDayNightOverlay";
import {
  readCompareParam,
  readCountryParam,
  readRouteSearchParams,
  updateUrlParams,
  writeCompareParam,
  writeCountryParam,
} from "../utils/urlState";
import { getExplorerCountryColor } from "../utils/geography";
import { recordRecentCountry } from "../utils/recentCountries";
import { getCountryInfo } from "../services/countryApi";
import { loadStaticGeoJson } from "../services/staticDataApi";
import { loadCountries } from "../data/countries";
import { COMPARE_COLORS, MAX_COMPARE } from "../data/compare";
import WorldExplorer from "./WorldExplorer";
import { useI18n } from "../i18n/useI18n";
import { PLACE_NAMES_VI } from "../i18n/strings";

import CountryCard from "./CountryCard";
import CountrySearch from "./CountrySearch";
import Icon from "./Icon";
import CompareTray from "./CompareTray";
import ComparePanel from "./ComparePanel";
import GlobeControls from "./GlobeControls";
import DataSourcesModal from "./DataSourcesModal";
import EducationCenter from "./EducationCenter";
import "./WorldGlobe.css";

// Chiều rộng thẻ thông tin + lề (xem CountryCard.css).
const CARD_SPACE = 370 + 24 * 2;
const MOBILE_BREAKPOINT = 600;
// Bảng học tập khi nhường chỗ cho địa cầu (xem EducationCenter.css).
const DOCKED_PANEL_SPACE = 430 + 20 * 2;
const DOCKED_PANEL_BREAKPOINT = 900;

const COLORS = {
  defaultDark: "#eeeeee",
  hover: "#4dabf7",
  selected: "#1c7ed6",
  neighbor: "#a5d8ff",
  quizCorrect: "#22c55e",
  quizWrong: "#ef4444",
};

const DEFAULT_ALTITUDE = 2.5;

const SCENE_COLORS = { background: 0x000000, globe: 0x061238, sides: "#cccccc" };

function getPolygonSideColor(feature) {
  if (feature.properties.layer === "lake") return "#7dd3fc";
  if (feature.properties.layer === "mountainRange") return "#c4a484";
  return SCENE_COLORS.sides;
}

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}

// Nước nhỏ cần zoom gần hơn để nhìn thấy.
function altitudeFor(country) {
  if (!Number.isFinite(country.span)) return 2.5;
  return Math.min(2.5, Math.max(0.65, 0.6 + country.span * 0.018));
}

function flyToCountry(globe, country) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  globe.pointOfView(
    {
      lat: country.labelLat,
      lng: country.labelLng,
      altitude: altitudeFor(country),
    },
    prefersReducedMotion ? 0 : 1000
  );
}

function getPathFeatures(features) {
  return features.flatMap((feature) => {
    if (feature.geometry.type === "LineString") return [feature];
    if (feature.geometry.type !== "MultiLineString") return [];
    return feature.geometry.coordinates.map((coordinates) => ({
      ...feature,
      geometry: { type: "LineString", coordinates },
    }));
  });
}

function WorldGlobe({ onProgress, onLoaded, theme, onToggleTheme, onHome }) {
  const { lang, t } = useI18n();
  const [educationConfig] = useState(() => {
    const params = readRouteSearchParams();
    const quiz = params.get("quiz");
    const path = params.get("path");
    const intent = params.get("intent");
    const view = ["flashcards", "paths", "progress"].includes(intent) ? intent : "quiz";
    return {
      open: Boolean(quiz || path || intent),
      region: quiz?.toLowerCase() === "asean" ? "ASEAN" : quiz || "all",
      difficulty: params.get("difficulty") || "easy",
      type: params.get("quizType") || "mixed",
      path: path || "",
      intent,
      view,
    };
  });
  const [educationOpen, setEducationOpen] = useState(educationConfig.open);
  const [educationDocked, setEducationDocked] = useState(false);
  const [quizState, setQuizState] = useState(null);
  const [explorerOpen, setExplorerOpen] = useState(() => {
    const params = readRouteSearchParams();
    return ["metric", "layer", "layers", "group"].some((key) => params.has(key));
  });
  const [explorerState, setExplorerState] = useState(null);

  const [countryData, setCountryData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showNeighborHighlight, setShowNeighborHighlight] = useState(true);
  const [details, setDetails] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);

  const [liteMode, setLiteMode] = useState(() => {
    try {
      return localStorage.getItem("globevision.liteMode") === "true";
    } catch {
      return false;
    }
  });

  const globeRef = useRef();
  const globeInstanceRef = useRef(null);
  const educationAnswerRef = useRef(null);
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
    setShowNeighborHighlight(true);
  }, []);

  const closeCountry = useCallback(() => {
    writeCountryParam(null);
    setSelectedId(null);
    setShowNeighborHighlight(true);
  }, []);

  const setEducationAnswerHandler = useCallback((handler) => {
    educationAnswerRef.current = handler;
  }, []);

  // Bảng học tập dời sang một bên: đóng bảng khám phá để địa cầu không bị che.
  const handleEducationDock = useCallback((docked) => {
    setEducationDocked(docked);
    if (docked) setExplorerOpen(false);
  }, []);

  const closeEducation = useCallback(() => {
    setEducationOpen(false);
    updateUrlParams({
      quiz: null,
      difficulty: null,
      quizType: null,
      path: null,
      intent: null,
    });
  }, []);

  const handleExplorerChange = useCallback((nextState) => {
    setExplorerState(nextState);
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
    let dayNightOverlay;
    let dayNightTimer;
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
        quizState: quiz,
      } = highlightRef.current;
      const explorer = highlightRef.current.explorer;
      const defaultColor = COLORS.defaultDark;

      globe?.polygonCapColor(({ properties }) => {
        if (properties.layer === "lake") return "#38bdf8";
        if (properties.layer === "mountainRange") return "#a78b6a";
        if (!properties.id) return defaultColor;
        if (quiz?.reveal?.correctIds.includes(properties.id)) return COLORS.quizCorrect;
        if (quiz?.reveal?.chosenId === properties.id) return COLORS.quizWrong;
        if (properties.id === hoverId) return COLORS.hover;
        // Khi làm quiz, các nước đang chọn hoặc so sánh không được tô để tránh lộ đáp án.
        if (!quiz) {
          if (compareColors.has(properties.id)) return compareColors.get(properties.id);
          if (properties.id === current) return COLORS.selected;
          if (neighborIds.has(properties.id)) return COLORS.neighbor;
        }

        return getExplorerCountryColor(properties, explorer) ?? defaultColor;
      });
    }

    // Khi thẻ thông tin đang mở, thu nhỏ vùng vẽ để quốc gia được chọn
    // nằm giữa phần màn hình còn trống thay vì bị thẻ che.
    function fitGlobe() {
      if (!globe) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const docked = highlightRef.current.educationDocked;
      const cardOpen = !docked && Boolean(highlightRef.current.selectedId);

      if (docked && width > DOCKED_PANEL_BREAKPOINT) {
        globe.width(width - DOCKED_PANEL_SPACE).height(height);
      } else if (docked) {
        globe.width(width).height(Math.round(height * 0.5));
      } else if (cardOpen && width > MOBILE_BREAKPOINT) {
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
          loadStaticGeoJson("boundaries.geojson").then(({ data: geojson }) => geojson),
        ]);

        if (disposed) return;
        if (onProgress) onProgress(45);

        globe = Globe()(globeRef.current);
        const scene = globe.scene();

        // Nền
        sceneBackground = new THREE.Color(SCENE_COLORS.background);
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
          color: SCENE_COLORS.globe,
          roughness: 0.7,
          metalness: 0.05,
        });

        // Khi đang làm quiz, bấm trên địa cầu là trả lời thay vì chọn quốc gia.
        const pickCountry = (countryId) => {
          if (educationAnswerRef.current) educationAnswerRef.current(countryId);
          else selectCountry(countryId);
        };

        globe
          .showAtmosphere(false)
          .globeMaterial(globeMat)
          .polygonSideColor(getPolygonSideColor)
          .polygonStrokeColor(() => "rgba(0,0,0,0)")
          .polygonAltitude(({ properties }) => {
            if (properties.layer === "lake") return 0.014;
            if (properties.layer === "mountainRange") return 0.012;
            return 0.01;
          })
          .polygonLabel((feature) => {
            // Khi làm quiz, tên nước khi rê chuột sẽ làm lộ đáp án.
            if (highlightRef.current.quizState) return "";
            const { properties } = feature;
            const name = langRef.current === "en" ? properties.nameEn : properties.nameVi;
            const label = properties.layer
              ? `${properties.name} · ${
                  properties.layer === "lake"
                    ? t("globe.layer.lake")
                    : properties.layer === "mountainRange"
                      ? t("globe.layer.mountainRange")
                      : t("globe.layer.default")
                }`
              : name;

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
                <b>${escapeHtml(label)}</b>
              </div>
            `;
          })
          .onPolygonClick((feature, _event, coordinates) => {
            const clickedPoint =
              Number.isFinite(coordinates?.lat) && Number.isFinite(coordinates?.lng)
                ? point([coordinates.lng, coordinates.lat])
                : null;
            const countryId = feature.properties.id || (clickedPoint
              ? data.features.find((countryFeature) =>
                  booleanPointInPolygon(clickedPoint, countryFeature)
                )?.properties.id
              : null);
            if (countryId) pickCountry(countryId);
          })
          .onPolygonHover((feature) => {
            highlightRef.current.hoverId = feature?.properties.id ?? null;
            applyColors();
          })
          .polygonsData(data.features)
          .pathsData([])
          .pathPoints(({ geometry }) => geometry.coordinates)
          .pathPointLat((point) => point[1])
          .pathPointLng((point) => point[0])
          .pathPointAlt(() => 0.016)
          .pathColor(({ properties }) =>
            properties.layer === "dateLine" ? "#fb7185" : "#38bdf8"
          )
          .pathStroke(({ properties }) => (properties.layer === "dateLine" ? 0.8 : 0.5))
          .pathResolution(2)
          .pathTransitionDuration(0)
          .pointsData([])
          .pointLat((feature) => feature.geometry.coordinates[1])
          .pointLng((feature) => feature.geometry.coordinates[0])
          .pointAltitude(0.012)
          .pointRadius(0.1)
          .pointColor(() => "#ff0000")
          .pointLabel((feature) => {
            if (highlightRef.current.quizState) return "";
            const { name } = feature.properties;
            const label = langRef.current === "vi" ? PLACE_NAMES_VI[name] || name : name;
            return `
              <div style="background:white;padding:6px 9px;border-radius:6px;color:#0f172a;font-size:13px;font-weight:600">
                <b>${escapeHtml(label)}</b>
              </div>
            `;
          })
          .onPointClick((feature) => {
            if (feature.properties.countryId) pickCountry(feature.properties.countryId);
          })
          .arcsData([])
          .arcStartLat((arc) => arc.start.lat)
          .arcStartLng((arc) => arc.start.lng)
          .arcEndLat((arc) => arc.end.lat)
          .arcEndLng((arc) => arc.end.lng)
          .arcColor(() => "#f97316")
          .arcStroke(() => 0.55)
          .arcAltitudeAutoScale(0.35)
          .arcDashLength(0.45)
          .arcDashGap(0.18)
          .arcDashAnimateTime(1800);

        dayNightOverlay = createDayNightOverlay(globe, scene);
        dayNightTimer = window.setInterval(() => dayNightOverlay?.update(), 60_000);

        globeInstanceRef.current = {
          globe,
          scene,
          stars,
          atmosphere,
          graticuleGroup,
          globeMat,
          applyColors,
          fitGlobe,
          updateExplorer(explorer) {
            highlightRef.current.explorer = explorer;
            const features = explorer?.features ?? [];
            const polygons = features.filter((feature) =>
              ["lake", "mountainRange"].includes(feature.properties.layer)
            );
            const polygonKey = polygons
              .map((feature) => `${feature.properties.layer}:${feature.properties.name}`)
              .join("|");
            if (polygonKey !== this.polygonKey) {
              globe.polygonsData([...data.features, ...polygons]);
              this.polygonKey = polygonKey;
            }

            const paths = getPathFeatures(features.filter((feature) =>
              ["river", "dateLine"].includes(feature.properties.layer)
            ));
            const pathKey = paths
              .map((feature) => `${feature.properties.layer}:${feature.properties.name}:${feature.geometry.coordinates.length}`)
              .join("|");
            if (pathKey !== this.pathKey) {
              globe.pathsData(paths);
              this.pathKey = pathKey;
            }

            const capitalsEnabled = Boolean(explorer?.layers?.capitals);
            const capitalFeatures = capitalsEnabled
              ? features
                  .filter((feature) => feature.properties.layer === "capital")
                  .map((feature) => ({
                    ...feature,
                    properties: {
                      ...feature.properties,
                      countryId:
                        data.byId.get(feature.properties.iso2)?.id ??
                        data.byIso3.get(feature.properties.iso3)?.id ??
                        null,
                    },
                  }))
              : [];
            const pointKey = capitalsEnabled
              ? capitalFeatures
                  .map((feature) => feature.geometry.coordinates.join(","))
                  .join("|")
              : "";
            if (pointKey !== this.pointKey) {
              globe.pointsData(capitalFeatures);
              this.pointKey = pointKey;
            }

            dayNightOverlay.mesh.visible = Boolean(explorer?.layers?.dayNight);
            const route = explorer?.route;
            const arcKey = route
              ? `${route.startId}:${route.endId}:${route.start.lat}:${route.start.lng}:${route.end.lat}:${route.end.lng}`
              : "";
            if (arcKey !== this.arcKey) {
              globe.arcsData(route ? [route] : []);
              this.arcKey = arcKey;
            }
            this.applyColors();
          },
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
      window.clearInterval(dayNightTimer);

      if (globe) {
        globe._destructor();
      }

      // Giải phóng các layer đã tạo ngoài Globe.gl
      [stars, graticuleGroup, atmosphere, borders, dayNightOverlay?.mesh].forEach((object) => {
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
  // Cập nhật Lite Mode trên Three.js instance
  // ----------------------------------------------------------------
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
      // Không chiếm phím của ô nhập liệu, ô chọn và các phím tắt trình duyệt (Ctrl+R...).
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

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
          if (educationOpen) {
            closeEducation();
          } else if (compareOpen) {
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
  }, [compareOpen, selectedId, educationOpen, closeEducation, closeCountry]);

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
      setShowNeighborHighlight(true);
      const sharedCompare = readCompareParam();
      const nextCompare = [...new Set(sharedCompare)]
        .filter((countryId) => countryData.byId.has(countryId))
        .slice(0, MAX_COMPARE);
      setCompareIds(nextCompare);
      setCompareOpen(nextCompare.length >= 2);
      if (nextCompare.join(",") !== sharedCompare.join(",")) {
        writeCompareParam(nextCompare);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [countryData, compareIds]);

  useEffect(() => {
    if (selectedId) recordRecentCountry(selectedId);
  }, [selectedId]);

  const selectedCountry = selectedId ? countryData?.byId.get(selectedId) ?? null : null;

  // ----------------------------------------------------------------
  // Đưa camera đến quốc gia được chọn (tôn trọng prefers-reduced-motion)
  // ----------------------------------------------------------------
  useEffect(() => {
    const globe = globeInstanceRef.current?.globe;

    if (!globe || !selectedCountry) return;

    flyToCountry(globe, selectedCountry);
  }, [selectedCountry]);

  // ----------------------------------------------------------------
  // Quiz: ẩn gợi ý trên địa cầu, sau khi trả lời thì tô và bay đến đáp án
  // ----------------------------------------------------------------
  const revealShownRef = useRef(false);

  useEffect(() => {
    highlightRef.current.quizState = quizState;
    const instance = globeInstanceRef.current;
    if (!instance) return;

    instance.applyColors();

    const target = quizState?.reveal ? countryData?.byId.get(quizState.reveal.focusId) : null;
    if (target) {
      flyToCountry(instance.globe, target);
    } else if (revealShownRef.current) {
      // Sang câu mới thì lùi camera ra để người học thấy cả địa cầu.
      instance.globe.pointOfView(
        { ...instance.globe.pointOfView(), altitude: DEFAULT_ALTITUDE },
        600
      );
    }
    revealShownRef.current = Boolean(target);
  }, [quizState, countryData]);

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
    highlightRef.current.neighborIds = showNeighborHighlight
      ? new Set(neighbors.map((country) => country.id))
      : new Set();
    highlightRef.current.compareColors = new Map(
      compareIds.map((id, index) => [id, COMPARE_COLORS[index]])
    );
    globeInstanceRef.current?.applyColors();
  }, [selectedId, neighbors, compareIds, showNeighborHighlight]);

  useEffect(() => {
    if (explorerState) globeInstanceRef.current?.updateExplorer(explorerState);
  }, [explorerState, countryData]);

  // Co giãn vùng vẽ khi mở/đóng thẻ thông tin
  useEffect(() => {
    highlightRef.current.educationDocked = educationDocked;
    globeInstanceRef.current?.fitGlobe();
  }, [selectedId, countryData, educationDocked]);

  // Nhãn khi rê chuột theo ngôn ngữ hiện tại
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  return (
    <div className="world-globe">
      {/* Globe */}
      <div ref={globeRef} className="world-globe-canvas" />

      {countryData && (
        <CountrySearch
          countries={countryData.list}
          onSelect={selectCountry}
          onHome={onHome}
        />
      )}
      <div className="globe-actionbar" role="group" aria-label={t("controls.globeTools")}>
        <button
          type="button"
          className="education-launcher"
          onClick={() => setEducationOpen(true)}
        >
          <Icon name="GraduationCap" size={17} />
          <span>{t("education.launch")}</span>
        </button>
        {countryData && (
          <WorldExplorer
            countries={countryData.list}
            isOpen={explorerOpen}
            onToggleOpen={() => setExplorerOpen((open) => !open)}
            onChange={handleExplorerChange}
          />
        )}
      </div>

      {/* Country Card */}
      <CountryCard
        key={educationDocked ? "none" : selectedCountry?.id || "none"}
        country={educationDocked ? null : selectedCountry}
        details={currentDetails}
        loading={loadingDetails}
        neighbors={neighbors}
        onNeighborVisibilityChange={setShowNeighborHighlight}
        onSelectNeighbor={selectCountry}
        onRetry={() => setRetryCount((count) => count + 1)}
        onClose={closeCountry}
        compareIds={compareIds}
        onToggleCompare={toggleCompare}
        onOpenSources={() => setIsSourcesModalOpen(true)}
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
        onToggleTheme={onToggleTheme}
      />

      <SourceNote onOpenSources={() => setIsSourcesModalOpen(true)} />

      {/* Modal Nguồn dữ liệu & Giấy phép */}
      <DataSourcesModal
        isOpen={isSourcesModalOpen}
        onClose={() => setIsSourcesModalOpen(false)}
      />

      {educationOpen && countryData && (
        <EducationCenter
          countries={countryData.list}
          initialConfig={educationConfig}
          onClose={closeEducation}
          onSelectCountry={selectCountry}
          onGlobeAnswer={setEducationAnswerHandler}
          onDockChange={handleEducationDock}
          onQuizStateChange={setQuizState}
        />
      )}
    </div>
  );
}

function SourceNote({ onOpenSources }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className="world-globe-sources"
      onClick={onOpenSources}
      title={t("sources.viewDetails")}
      style={{
        background: "none",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        pointerEvents: "auto",
        padding: 0,
      }}
    >
      {t("footer.sources")}
    </button>
  );
}

export default WorldGlobe;
