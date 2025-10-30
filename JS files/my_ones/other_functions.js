//example code - not actually usable
function createCombinedInfoShader() {
    return new THREE.ShaderMaterial({
        uniforms: {
            objectID: { value: 1.0 },
            sunPos: { value: new THREE.Vector3(5, 10, 10) },
            spherePos: { value: new THREE.Vector3(1, 1, 1) },
            sphereRadius: { value: 0.5 }
        },
        vertexShader: `
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec3 vIntersectionPoint;

            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;

                vNormal = normalize(normalMatrix * normal);

                // intersection point with sphere is just the vertex world position
                vIntersectionPoint = worldPos.xyz;

                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec3 vIntersectionPoint;

            uniform vec3 spherePos;
            uniform float sphereRadius;

            void main() {
                // encode normals as 0..1
                vec3 normalCol = normalize(vNormal) * 0.5 + 0.5;

                // encode world position (remap for display)
                vec3 posCol = (vWorldPos + 5.0) / 10.0;

                // simple ray-sphere intersection check (returns 1.0 if intersected)
                vec3 rayDir = normalize(spherePos - vIntersectionPoint);
                vec3 L = spherePos - vIntersectionPoint;
                float tca = dot(L, rayDir);
                float d2 = dot(L, L) - tca * tca;
                float hit = (tca > 0.0 && d2 < sphereRadius * sphereRadius) ? 1.0 : 0.0;

                // pack data into colour channels (for debugging)
                gl_FragColor = vec4(normalCol * hit, 1.0); 
                // could also output posCol instead or use multiple render targets
            }
        `
    });
}

function createInfoShaderMaterial(objectID) {
  return new THREE.ShaderMaterial({
    uniforms: {
      objectID: { value: objectID } // each mesh gets a unique ID
    },
    vertexShader: `
        varying vec3 vWorldPos;          // exact world location
        varying vec3 vNormal;                // the normal of the vertex
        varying vec3 vIntersectionPoint;    // the 

        void main() {
            // compute world-space position of this vertex
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;

            // compute world-space normal
            vNormal = normalize(normalMatrix * normal);

            // standard projection
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      uniform float objectID;

      void main() {
        // Just encode as colour for debugging (normalised to 0–1 range)

        // position → encode x,y,z in RGB (scaled into 0..1)
        vec3 posCol = (vWorldPos + 5.0) / 10.0; // crude remap

        // normal → encode as 0..1
        vec3 normCol = normalize(vNormal) * 0.5 + 0.5;

        // object ID in alpha channel
        gl_FragColor = vec4(normCol, objectID / 255.0);
      }
    `
  });
}
