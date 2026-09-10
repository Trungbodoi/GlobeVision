import * as THREE from "three";

export function createStars(globe, scene) {
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];

  for (let i = 0; i < 2000; i++) {
    const r = 250 + Math.random() * 150;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    starPositions.push(x, y, z);
  }

  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3)
  );

  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uCameraPosition: {
        value: globe.camera().position.clone(),
      },
    },
    vertexShader: `
      uniform vec3 uCameraPosition;
      varying float vFront;

      void main() {
        vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 starDirection = normalize(worldPosition);
        vec3 cameraDirection = normalize(uCameraPosition);

        vFront = dot(starDirection, cameraDirection);

        gl_Position = projectionMatrix *
                      modelViewMatrix *
                      vec4(position, 1.0);

        gl_PointSize = 2.0;
      }
    `,
    fragmentShader: `
      varying float vFront;

      void main() {
        if (vFront > 0.0) {
          discard;
        }

        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);

        if (d > 0.5) {
          discard;
        }

        gl_FragColor = vec4(1.0, 1.0, 1.0, 0.8);
      }
    `,
    size: 0.5,
    opacity: 0.7,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  return { stars, starMaterial };
}
