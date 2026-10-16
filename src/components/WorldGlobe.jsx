import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";

import { createStars } from "../utils/createStars";
import { createGraticule } from "../utils/createGraticule";
import { createAtmosphere } from "../utils/createAtmosphere";
import { createCountryBorders } from "../utils/createCountryBorders";
import { readCountryParam, writeCountryParam } from "../utils/urlState";
import { getCountryInfo } from "../services/countryApi";
import { loadCountries } from "../data/countries";
import { useI18n } from "../i18n/useI18n";

import CountryCard from "./CountryCard";
import CountrySearch from "./CountrySearch";
import "./WorldGlobe.css";

// Chiều rộng thẻ thông tin + lề (xem CountryCard.css).
const CARD_SPACE = 370 + 24 * 2;
const MOBILE_BREAKPOINT = 600;

const COLORS = {
  default: "#eeeeee",
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

  const globeRef = useRef();
  const globeInstanceRef = useRef(null);
  const highlightRef = useRef({ hoverId: null, selectedId: null, neighborIds: new Set() });
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
    let disposed = false;

    function applyColors() {
      const { hoverId, selectedId: current, neighborIds } = highlightRef.current;

      globe?.polygonCapColor(({ properties }) => {
        if (properties.id === hoverId) return COLORS.hover;
        if (properties.id === current) return COLORS.selected;
        if (neighborIds.has(properties.id)) return COLORS.neighbor;

        return COLORS.default;
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
        globeInstanceRef.current = { globe, applyColors, fitGlobe };
        if (onProgress) onProgress(55);

        const scene = globe.scene();

        // Nền
        scene.background = new THREE.Color(0x000000);

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
        globe
          .showAtmosphere(false)
          .globeMaterial(
            new THREE.MeshStandardMaterial({
              color: 0x061238,
              roughness: 0.7,
              metalness: 0.05,
            })
          )
          .polygonSideColor(() => "#cccccc")
          .polygonStrokeColor(() => "rgba(0,0,0,0)")
          .polygonAltitude(0.01)
          .polygonLabel(({ properties }) => {
            const name = langRef.current === "en" ? properties.nameEn : properties.nameVi;

            return `
              <div style="
                background: white;
                padding: 6px 10px;
                border-radius: 5px;
                color: black;
                font-size: 14px;
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
        controls.minDistance = 150;
        controls.maxDistance = 400;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = false;

        controls.addEventListener("change", () => {
          if (starMaterial) {
            starMaterial.uniforms.uCameraPosition.value.copy(globe.camera().position);
          }

          if (atmosMat) {
            atmosMat.uniforms.uViewPos.value.copy(globe.camera().position);
          }
        });

        setCountryData(data);

        // Mở quốc gia trong liên kết được chia sẻ (?country=VN)
        const initialId = readCountryParam();

        if (initialId && data.byId.has(initialId)) {
          setSelectedId(initialId);
        } else if (initialId) {
          writeCountryParam(null, { replace: true });
        }

        if (onLoaded) {
          requestAnimationFrame(() => {
            onLoaded();
          });
        }
      } catch (error) {
        console.error("ERROR:", error);

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
    // Địa cầu chỉ được tạo một lần khi component mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // Nút Back/Forward của trình duyệt
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!countryData) return;

    const handlePopState = () => {
      const id = readCountryParam();

      setSelectedId(id && countryData.byId.has(id) ? id : null);
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [countryData]);

  const selectedCountry = selectedId ? countryData?.byId.get(selectedId) ?? null : null;

  // ----------------------------------------------------------------
  // Đưa camera đến quốc gia được chọn
  // ----------------------------------------------------------------
  useEffect(() => {
    const globe = globeInstanceRef.current?.globe;

    if (!globe || !selectedCountry) return;

    globe.pointOfView(
      {
        lat: selectedCountry.labelLat,
        lng: selectedCountry.labelLng,
        altitude: altitudeFor(selectedCountry),
      },
      1000
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

  // Tô màu quốc gia đang chọn và các nước láng giềng
  useEffect(() => {
    highlightRef.current.selectedId = selectedId;
    highlightRef.current.neighborIds = new Set(neighbors.map((country) => country.id));
    globeInstanceRef.current?.applyColors();
  }, [selectedId, neighbors]);

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
