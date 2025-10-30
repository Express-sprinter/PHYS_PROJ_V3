import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

//checking required version/libiary exists
if (!renderer.capabilities.isWebGL2) {
    if (!renderer.extensions.get('OES_texture_float')) {
        console.error('Floating point textures not supported.');
    }
}

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff);
light.position.set(5, -10, 10);
scene.add(light);

function flattenTriangleVerticesToWorld(triV0, triV1, triV2, meshMatrix) {
    for (let i = 0; i < triV0.length; i++) {
        triV0[i].applyMatrix4(meshMatrix);
        triV1[i].applyMatrix4(meshMatrix);
        triV2[i].applyMatrix4(meshMatrix);
    }
}

function extractTrianglesFromMesh(mesh) {
    let geom;
    if (mesh.geometry) geom = mesh.geometry;
    else if (mesh.isObject3D && mesh.children.length > 0) {
        for (let child of mesh.children) {
            if (child.geometry) {
                geom = child.geometry;
                break;
            }
        }
    }
    if (!geom) return { triV0: [], triV1: [], triV2: [] };

    const position = geom.attributes.position;
    const triV0 = [], triV1 = [], triV2 = [];
    for (let i = 0; i < position.count; i += 3) {
        triV0.push(new THREE.Vector3().fromBufferAttribute(position, i));
        triV1.push(new THREE.Vector3().fromBufferAttribute(position, i + 1));
        triV2.push(new THREE.Vector3().fromBufferAttribute(position, i + 2));
    }
    console.log({ triV0, triV1, triV2 });

    return { triV0, triV1, triV2 };
}

function arrayPadding(initalArray, shouldbe){
    var out = [];
    if(initalArray.length != shouldbe){
        if(initalArray.length > shouldbe){
            console.log("had an array bigger than what was defined");
            return null;
        }else{
            for(var i=0;i<shouldbe;i++){
                if(i<initalArray.length){
                    out.push(initalArray[i]);
                }else{
                    out.push(new THREE.Vector3(0,0,0));
                }
            }
        }
    }else{
        out = initalArray;
    }
    return out;
}

function getAllTriangles(){
    var out = [];
    for(var i=0;i<meshes.length;i++){
        out.push(extractTrianglesFromMesh(meshes[i]));
    }
    return out
}

function toThreeLists(INPU_T){
    var out1 = [];
    var out2 = [];
    var out3 = [];

    for(var i=0;i<INPU_T.length;i++){
        var thisSet1 = INPU_T[i].triV0;
        var thisSet2 = INPU_T[i].triV1;
        var thisSet3 = INPU_T[i].triV2;

        for(var j=0;j<thisSet1.length;j++){
            out1.push(thisSet1[j]);
            out2.push(thisSet2[j]);
            out3.push(thisSet3[j]);
        }
    }
    return {out1, out2, out3};

}
function distance(p1, p2){
    return Math.sqrt((p1.x - p2.x) ** 2 + (p2.y-p2.y) ** 2 + (p2.z-p2.z) ** 2);
}

function maxD(l1, l2, l3){
    var maxD = 0;
    for(var i=0;i<l1.length;i++){
        var d1 = distance(l1[i],l2[i]);
        var d2 = distance(l3[i],l2[i]);
        var d3 = distance(l3[i],l1[i]);
        if(d1>maxD){
            maxD = d1;
        }
        if(d2>maxD){
            maxD = d2;
        }
        if(d3>maxD){
            maxD = d3;
        }
    }
    return maxD; // the maxium distance between any two points in a face. 
}



function createRayCastShadowShaderMaterial(secondaryMesh, thisMesh = null) {
    
    const { triV0, triV1, triV2 } = toThreeLists(getAllTriangles());
    const { sm1, sm2, sm3 } = extractTrianglesFromMesh(thisMesh);

    const { texture, width, height, totalTris } = makeTriangleTexture(triV0, triV1, triV2);

    
    const uniforms = {
        sunPos:     { value: light.position.clone() },
        colourLit:  { value: new THREE.Color('yellow') }, // change these?
        colourShad: { value: new THREE.Color('blue') },
        numTris:    { value: totalTris },
        triTex:     { value: texture },
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


        //undoing compression trick for larger datasets
        vec3 getTriVertex(int triIndex, int vertexIndex) {

            // Each triangle = 3 vertices * 3 components = 9 floats
            int base = triIndex * 3 + vertexIndex; // vertex index in all data
            int pixelIndex = base * 3 / 4;         // 4 floats per texel (RGBA)

            float fx = float(pixelIndex % int(triTexSize.x)) + 0.5;
            float fy = float(pixelIndex / int(triTexSize.x)) + 0.5;

            vec2 uv = vec2(fx / triTexSize.x, fy / triTexSize.y);
            vec4 texel = texture2D(triTex, uv);
            return texel.rgb; // each texel holds xyz of one vertex
        }

        // --------------------------------------------------
        // Ray-triangle intersection (Möller–Trumbore)
        // --------------------------------------------------
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
            if (u < 0.0 || u > 1.0){ 
                return false
            };
            vec3 qvec = cross(tvec, e1);
            float v = dot(dir, qvec) * invDet;
            if (v < 0.0 || u + v > 1.0) return false;
            t = dot(e2, qvec) * invDet;
            return (t > EPS);
        }

        void main() {
            vec3 toSun = normalize(sunPos - vWorldPos);             // the main line
            bool inShadow = false;
            float tHit;

            // Iterate through all triangles in the texture
            for (int i = 0; i < 16384; i++) {                       // 16384 is max value ? could try higher, but may crash
                if (i >= numTris){
                    break;                                          //if the full iterations are not needed, quit
                }

                vec3 v0 = getTriVertex(i, 0);
                vec3 v1 = getTriVertex(i, 1);
                vec3 v2 = getTriVertex(i, 2);

                if (intersectRayTriangle(vWorldPos, toSun, v0, v1, v2, tHit)) {
                    if (tHit > 0.0) {                               /// distance along the line to the target - if negative, dont bother.
                        inShadow = true;
                        break;
                    }
                }
            }

            gl_FragColor = vec4(inShadow ? colourShad : colourLit, 1.0); 
                                // if in shadow, return one colour, else return the other - change probably
        }
    `;

    return new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
    });
}

// -----------------------------------------------------------------------------
// Helper to create triangle data texture
// -----------------------------------------------------------------------------
function makeTriangleTexture(triV0, triV1, triV2) {
    const totalTris = triV0.length;
    const floats = new Float32Array(totalTris * 3 * 3); // 3 vertices × 3 components

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



var meshes = []

const loader = new OBJLoader();

let meshOccluder;
let meshOccluderLoaded = false;
let meshTarget;
let meshTargetLoaded = false;

loader.load('/models/sphere.obj', obj => {
    obj.children[0].geometry.scale(0.01, 0.01, 0.01);
    meshOccluder = new THREE.Mesh(obj.children[0].geometry, new THREE.MeshStandardMaterial());
    meshOccluder.position.set(1,1,1);
    scene.add(meshOccluder);

   

    meshes.push(meshOccluder); 


    meshOccluderLoaded = true;
}, xhr => {}, err => {});



loader.load('/models/67p_low_res.obj', obj => {
    obj.children[0].geometry.scale(0.0005,0.0005,0.0005);
    meshTarget = new THREE.Mesh(obj.children[0].geometry, new THREE.MeshStandardMaterial());
    meshTarget.rotation.x = -0.8;
    meshTarget.rotation.y = -0.7;

    scene.add(meshTarget);
    meshTargetLoaded = true;

    meshes.push(meshTarget);

    if(meshOccluderLoaded) {
        meshTarget.material = createRayCastShadowShaderMaterial(meshOccluder);
    }
}, xhr => {}, err => {});



function animate() {
    requestAnimationFrame(animate);

//    const time = Date.now() * 0.001;
//    light.position.x = Math.sin(time) * 10;
//    light.position.z = Math.cos(time) * 10; 
     var {triV0, triV1, triV2} = toThreeLists(getAllTriangles());
    console.log(triV0);
    if(meshTargetLoaded) {
        meshTarget.rotation.y += 0.005;
    }
    renderer.render(scene, camera);
}
animate();





/*
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################
###################################################################################################

*/
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
