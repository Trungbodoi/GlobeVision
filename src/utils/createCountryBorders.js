import * as THREE from "three";

const COUNTRY_ALTITUDE = 0.01;

export function createCountryBorders(scene, globe, boundaryData) {
  const positions = [];

  function addLine(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return;

    for (let i = 0; i < coords.length - 1; i++) {
      const current = coords[i];
      const next = coords[i + 1];

      if (
        !Array.isArray(current) ||
        !Array.isArray(next) ||
        current.length < 2 ||
        next.length < 2
      ) {
        continue;
      }

      const [lng1, lat1] = current;
      const [lng2, lat2] = next;

      // Không nối nhầm một đường thẳng xuyên qua quả địa cầu
      // khi đường biên đi qua kinh tuyến 180°.
      if (Math.abs(lng1 - lng2) > 180) {
        continue;
      }

      // QUAN TRỌNG:
      // Không tự tính XYZ nữa.
      // globe.gl có sẵn getCoords() và đây chính là
      // hệ tọa độ mà globe.gl đang sử dụng.
      const p1 = globe.getCoords(
        lat1,
        lng1,
        COUNTRY_ALTITUDE + 0.0015
      );

      const p2 = globe.getCoords(
        lat2,
        lng2,
        COUNTRY_ALTITUDE + 0.0015
      );

      positions.push(
        p1.x,
        p1.y,
        p1.z,
        p2.x,
        p2.y,
        p2.z
      );
    }
  }

  if (!boundaryData?.features) {
    console.warn("Không có dữ liệu boundary.");
    return null;
  }

  boundaryData.features.forEach((feature) => {
    const geometry = feature?.geometry;
    if (!geometry) return;

    if (geometry.type === "LineString") {
      addLine(geometry.coordinates);
    } else if (geometry.type === "MultiLineString") {
      geometry.coordinates.forEach(addLine);
    }
  });

  if (positions.length === 0) {
    console.warn("Boundary GeoJSON không có LineString/MultiLineString hợp lệ.");
    return null;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const material = new THREE.LineBasicMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
    depthWrite: false,
  });

  const borders = new THREE.LineSegments(geometry, material);

  // Border được vẽ sau các object phụ khác nhưng vẫn tôn trọng depth buffer.
  borders.renderOrder = 2;

  scene.add(borders);

  console.log(
    "Đã tạo border:",
    positions.length / 6,
    "đoạn"
  );

  return borders;
}
