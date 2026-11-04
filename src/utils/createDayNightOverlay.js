import * as THREE from "three";
import { getSolarCoordinates } from "./geography";

export function createDayNightOverlay(globe, scene) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      uTwilight: { value: 0.09 },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform float uTwilight;
      varying vec3 vWorldNormal;
      void main() {
        float sunlight = dot(normalize(vWorldNormal), normalize(uSunDirection));
        float night = 1.0 - smoothstep(-uTwilight, uTwilight, sunlight);
        gl_FragColor = vec4(vec3(0.012, 0.026, 0.09), night * 0.46);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(101.22, 96, 64), material);
  mesh.name = "globe-day-night-overlay";
  mesh.renderOrder = 1;
  mesh.visible = false;
  scene.add(mesh);

  function update(date = new Date()) {
    const sun = getSolarCoordinates(date);
    const coordinates = globe.getCoords(sun.lat, sun.lng, 0.02);
    material.uniforms.uSunDirection.value
      .set(coordinates.x, coordinates.y, coordinates.z)
      .normalize();
  }

  update();
  return { mesh, material, update };
}
