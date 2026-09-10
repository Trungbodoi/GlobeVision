import * as THREE from "three";

export function createAtmosphere(scene, globe, globeRadius = 100) {
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);

      vPosition = worldPos.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);

      gl_Position = projectionMatrix *
                    modelViewMatrix *
                    vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform vec3 uViewPos;

    void main() {
      vec3 viewDir = normalize(uViewPos - vPosition);

      float fresnel = 1.0 - abs(dot(viewDir, vNormal));
      fresnel = pow(fresnel, 3.0);

      float alpha = fresnel * 0.4;

      vec3 color = mix(
        vec3(0.3, 0.6, 1.0),
        vec3(0.5, 0.8, 1.0),
        fresnel
      );

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const atmosGeo = new THREE.SphereGeometry(
    globeRadius * 1.08,
    64,
    64
  );

  const atmosMat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uViewPos: {
        value: globe.camera().position,
      },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
  atmosphere.name = "atmosphere";
  scene.add(atmosphere);

  return { atmosphere, atmosMat };
}
