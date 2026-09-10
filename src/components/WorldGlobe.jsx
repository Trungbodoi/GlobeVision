import { useEffect, useRef , useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import * as turf from "@turf/turf";


import { createStars } from "../utils/createStars";
import { createGraticule } from "../utils/createGraticule";
import { createAtmosphere } from "../utils/createAtmosphere";
import { createCountryBorders } from "../utils/createCountryBorders";
import { getCountryInfo } from "../services/countryApi";

import CountryCard from "./CountryCard";


function WorldGlobe() {
  
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [loadingCountry, setLoadingCountry] = useState(false);
  const globeRef = useRef();

  useEffect(() => {
    let globe;
    let stars;
    let graticuleGroup;
    let atmosphere;
    let borders;
    let starMaterial;
    let atmosMat;

    async function loadGlobe() {
      try {
        const [countryResponse, boundaryResponse] = await Promise.all([
            fetch(`${import.meta.env.BASE_URL}custom.geojson`),
            fetch(`${import.meta.env.BASE_URL}boundary-lines.geojson`),
        ]);

        const countries = await countryResponse.json();
        const boundaryData = await boundaryResponse.json();

        console.log(
          "Tổng số features:",
          countries.features.length
        );
        console.log("===== DANH SÁCH QUỐC GIA =====");

countries.features.forEach((feature, index) => {
  const name =
    feature.properties?.name ||
    feature.properties?.NAME ||
    feature.properties?.ADMIN ||
    "Unknown";

  const code =
    feature.properties?.ISO_A2 ||
    feature.properties?.ISO_A3 ||
    feature.properties?.iso_a2 ||
    feature.properties?.iso_a3 ||
    "";

  console.log(`${index + 1}. ${name} (${code})`);
});

console.log("==============================");

        const validFeatures = countries.features.filter(
          (feature) =>
            feature.geometry &&
            (feature.geometry.type === "Polygon" ||
              feature.geometry.type === "MultiPolygon")
        );

        console.log(
          "Boundary features:",
          boundaryData.features.length
        );

        console.log(
          `Render ${validFeatures.length}/${countries.features.length}`
        );

        globe = Globe()(globeRef.current);

        const scene = globe.scene();

        // Nền
        scene.background = new THREE.Color(0x000000);

        // Ánh sáng
        const ambientLight = new THREE.AmbientLight(
          0x4488cc,
          2.5
        );
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(
          0xffffff,
          3
        );
        sunLight.position.set(15, 5, 10);
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(
          0x4488cc,
          0.8
        );
        fillLight.position.set(-5, -2, -5);
        scene.add(fillLight);

        // Các lớp Three.js riêng
        ({ stars, starMaterial } = createStars(globe, scene));
        graticuleGroup = createGraticule(scene, 100);
        ({ atmosphere, atmosMat } = createAtmosphere(scene, globe, 100));
        borders = createCountryBorders(scene, globe ,boundaryData);

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
          .polygonCapColor(() => "#eeeeee")
          .polygonSideColor(() => "#cccccc")
          .polygonStrokeColor(() => "rgba(0,0,0,0)")
          .polygonAltitude(0.01)
          .polygonLabel(({ properties }) => {
            const name =
              properties?.name ||
              properties?.NAME ||
              properties?.ADMIN ||
              "Unknown";

            return `
              <div style="
                background: white;
                padding: 6px 10px;
                border-radius: 5px;
                color: black;
                font-size: 14px;
              ">
                <b>${name}</b>
              </div>
            `;
          })
          .onPolygonClick(async (feature) => {
            const name =
              feature.properties?.name ||
              feature.properties?.NAME ||
              feature.properties?.ADMIN ||
              "Unknown";

            const code =
              feature.properties?.["ISO3166-1-Alpha-3"] ||
              feature.properties?.["iso_a3"] ||
              feature.properties?.ISO_A3 ||
              feature.properties?.[
                "ISO3166-1-Alpha-2"
              ];

            console.log("CLICK:", name);
            console.log("ISO code:", code);

            // Tính tâm quốc gia
            const centroid = turf.centroid(feature);

            const [lng, lat] =
              centroid.geometry.coordinates;

            console.log("CENTER:", lat, lng);

            // Xoay quả địa cầu
            globe.pointOfView(
              {
                lat,
                lng,
                altitude: 2.5,
              },
              1000
            );

            // Mở card ngay
            setSelectedCountry({
              feature,
              name,
              code,
              lat,
              lng,
              apiData: null,
            });

            // Loading
            setLoadingCountry(true);

            try {
              const country =
                await getCountryInfo(code);

              console.log(
                "COUNTRY API:",
                country
              );

              setSelectedCountry((prev) => ({
                ...prev,
                apiData: country,
              }));
            } catch (error) {
              console.error(error);
            } finally {
              setLoadingCountry(false);
            }
          })
          .onPolygonHover((feature) => {
            globe.polygonCapColor((d) => {
              if (d === feature) {
                return "#4dabf7";
              }

              return "#eeeeee";
            });
          })
          .polygonsData(validFeatures);

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
            starMaterial.uniforms.uCameraPosition.value.copy(
              globe.camera().position
            );
          }

          if (atmosMat) {
            atmosMat.uniforms.uViewPos.value.copy(
              globe.camera().position
            );
          }
        });
      } catch (error) {
        console.error("ERROR:", error);
      }
    }

    loadGlobe();

    return () => {
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
  }, []);

return (
  <div
    style={{
      width: "100vw",
      height: "100vh",
      background: "#000",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {/* Globe */}
    <div
      ref={globeRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    />

    {/* Country Card */}
    <CountryCard
      country={selectedCountry}
      loading={loadingCountry}
      onClose={() => setSelectedCountry(null)}
    />
  </div>
);
}

export default WorldGlobe;
