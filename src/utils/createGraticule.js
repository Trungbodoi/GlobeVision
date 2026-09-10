import * as THREE from "three";

export function createGraticule(scene, globeRadius = 100) {
  const graticuleGroup = new THREE.Group();

  const graticuleMaterial = new THREE.LineBasicMaterial({
    color: 0x336699,
    transparent: true,
    opacity: 0.35,
    depthTest: true,
  });

  const r = globeRadius * 1.001;

  // Vĩ tuyến
  for (let lat = -75; lat <= 75; lat += 15) {
    const points = [];

    const rad = r * Math.cos(THREE.MathUtils.degToRad(lat));
    const y = r * Math.sin(THREE.MathUtils.degToRad(lat));

    for (let lon = -180; lon <= 180; lon += 2) {
      const theta = THREE.MathUtils.degToRad(lon + 90);

      points.push(
        new THREE.Vector3(
          rad * Math.cos(theta),
          y,
          rad * Math.sin(theta)
        )
      );
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    graticuleGroup.add(new THREE.Line(geo, graticuleMaterial));
  }

  // Kinh tuyến
  for (let lon = -180; lon < 180; lon += 15) {
    const points = [];

    const theta = THREE.MathUtils.degToRad(lon + 90);

    for (let lat = -90; lat <= 90; lat += 2) {
      const phi = THREE.MathUtils.degToRad(90 - lat);

      points.push(
        new THREE.Vector3().setFromSpherical(
          new THREE.Spherical(r, phi, theta)
        )
      );
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    graticuleGroup.add(new THREE.Line(geo, graticuleMaterial));
  }

  scene.add(graticuleGroup);

  return graticuleGroup;
}
