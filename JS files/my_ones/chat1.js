import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

// WebGL2 float texture support check
if (!renderer.capabilities.isWebGL2) {
    if (!renderer.extensions.get('OES_texture_float')) {
        console.error('Floating point textures not supported.');
    }
}

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, -10, 10);
scene.add(light);

let meshes = [];

// ------------------ Helper functions ------------------
function flattenTriangleVerticesToWorld(triV0, triV1, triV2, meshMatrix) {
    for (let i = 0; i < triV0.length; i++) {
        triV0[i].applyMatrix4(meshMatrix);
        triV1[i].applyMatrix4(meshMatrix);
        triV2[i].applyMatrix4(meshMatrix);
    }
}

function extractTrianglesFromMesh(mesh) {
    if (!mesh || !mesh.geometry) return { triV0: [], triV1: [], triV2: [] };
    const position = mesh.geometry.attributes.position;
    const triV0 = [], triV1 = [], triV2 = [];
    for (let i = 0; i < position.count; i += 3) {
        triV0.push(new THREE.Vector3().fromBufferAttribute(position, i));
        triV1.push(new THREE.Vector3().fromBufferAttribute(position, i + 1));
        triV2.push(new THREE.Vector3().fromBufferAttribute(position, i + 2));
    }
    flattenTriangleVerticesToWorld(triV0, triV1, triV2, mesh.matrixWorld);
    return { triV0, triV1, triV2 };
}

function toThreeLists(triangleSets) {
    const out0 = [], out1 = [], out2 = [];
    for (const set of triangleSets) {
        out0.push(...set.triV0);
        out1.push(...set.triV1);
        out2.push(...set.triV2);
    }
    return { triV0: out0, triV1: out1, triV2: out2 };
}

// ------------------ Triangle Texture ------------------
function makeTriangleTexture(triV0, triV1, triV2) {
    const totalTris = triV0.length;
    const floats = new Float32Array(totalTris * 9);
    for (let i = 0; i < totalTris; i++) {
        floats.set([
            triV0[i].x, triV0[i].y, triV0[i].z,
            triV1[i].x, triV1[i].y, triV1[i].z,
            triV2[i].x, triV2[i].y, triV2[i].z
        ], i * 9);
    }

    const width = 256;
    const height = Math.ceil(floats.length / 4 / width);
    const padded = new Float32Array(width * height * 4);
    padded.set(floats);

    const texture = new THREE.DataTexture(padded, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return { texture, width, height, totalTris };
}

// ------------------ Shadow Shader Material ------------------
function createRayCastShadowShaderMaterial() {
    const triangleSets = meshes.map(mesh => extractTrianglesFromMesh(mesh));
    const { triV0, triV1, triV2 } = toThreeLists(triangleSets);
    const { texture, width, height, totalTris } = makeTriangleTexture(triV0, triV1, triV2);

    const uniforms = {
        sunPos: { value: light.position.clone() },
        colourLit: { value: new THREE.Color('yellow') },
        colourShad: { value: new THREE.Color('blue') },
        numTris: { value: totalTris },
        triTex: { value: texture },
        triTexSize: { value: new THREE.Vector2(width, height) },
    };

    const vertexShader = `
        varying vec3 vWorldPos;
        void main() {
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        precision highp float;
        uniform vec3 sunPos;
        uniform vec3 colourLit;
        uniform vec3 colourShad;
        uniform int numTris;
        uniform sampler2D triTex;
        uniform vec2 triTexSize;
        varying vec3 vWorldPos;

        vec3 getTriVertex(int triIndex, int vertexIndex) {
            int base = triIndex * 3 + vertexIndex;
            int pixelIndex = base * 3 / 4;
            float fx = float(pixelIndex % int(triTexSize.x)) + 0.5;
            float fy = float(pixelIndex / int(triTexSize.x)) + 0.5;
            vec2 uv = vec2(fx / triTexSize.x, fy / triTexSize.y);
            vec4 texel = texture2D(triTex, uv);
            return texel.rgb;
        }

        bool intersectRayTriangle(vec3 orig, vec3 dir, vec3 v0, vec3 v1, vec3 v2, out float t) {
            const float EPS = 1e-6;
            vec3 e1 = v1 - v0;
            vec3 e2 = v2 - v0;
            vec3 pvec = cross(dir, e2);
            float det = dot(e1, pvec);
            if (abs(det) < EPS) return false;
            float invDet = 1.0 / det;
            vec3 tvec = orig - v0;
            float u = dot(tvec, pvec) * invDet;
            if (u < 0.0 || u > 1.0) return false;
            vec3 qvec = cross(tvec, e1);
            float v = dot(dir, qvec) * invDet;
            if (v < 0.0 || u + v > 1.0) return false;
            t = dot(e2, qvec) * invDet;
            return t > EPS;
        }

        void main() {
            vec3 toSun = normalize(sunPos - vWorldPos);
            bool inShadow = false;
            float tHit;

            for (int i = 0; i < 16384; i++) {
                if (i >= numTris) break;
                vec3 v0 = getTriVertex(i, 0);
                vec3 v1 = getTriVertex(i, 1);
                vec3 v2 = getTriVertex(i, 2);
                if (intersectRayTriangle(vWorldPos, toSun, v0, v1, v2, tHit)) {
                    inShadow = true;
                    break;
                }
            }
            gl_FragColor = vec4(inShadow ? colourShad : colourLit, 1.0);
        }
    `;

    return new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
    });
}

// ------------------ Load meshes ------------------
const loader = new OBJLoader();
let meshOccluder, meshTarget;

loader.load('/models/sphere.obj', obj => {
    const geom = obj.children[0].geometry;
    geom.scale(0.01, 0.01, 0.01);
    meshOccluder = new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
    meshOccluder.position.set(1, 1, 1);
    scene.add(meshOccluder);
    meshes.push(meshOccluder);
});

loader.load('/models/67p_low_res.obj', obj => {
    const geom = obj.children[0].geometry;
    geom.scale(0.0005, 0.0005, 0.0005);
    meshTarget = new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
    meshTarget.rotation.set(-0.8, -0.7, 0);
    scene.add(meshTarget);
    meshes.push(meshTarget);

    // Apply shadow shader after both meshes are loaded
    meshTarget.material = createRayCastShadowShaderMaterial();
});

// ------------------ Animate ------------------
function animate() {
    requestAnimationFrame(animate);

    // Rotate target for demo
    if (meshTarget) meshTarget.rotation.y += 0.005;

    // Update light position if needed
    if (meshTarget && meshTarget.material.uniforms) {
        meshTarget.material.uniforms.sunPos.value.copy(light.position);
        meshTarget.material.uniformsNeedUpdate = true;
    }

    renderer.render(scene, camera);
}
animate();
