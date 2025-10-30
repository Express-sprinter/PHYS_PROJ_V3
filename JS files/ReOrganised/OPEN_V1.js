import * as THREE from 'three';
//import fragShader from './shaders/raycastShadow.frag.glsl?raw';  // import as text
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let renderer;
if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
}



const loader = new OBJLoader();
let meshOccluder, meshTarget;

 
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff);
light.position.set(5,5,-5);
scene.add(light);


const geometry = new THREE.BoxGeometry();
var meshes = [];

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
    if(!Array.isArray(initalArray)){
        console.log(typeof initalArray);
    }
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

function extractTrianglesFromMeshWorld(mesh) {
  let geom = mesh.geometry;
  if (!geom && mesh.isObject3D && mesh.children.length > 0) {
    for (let child of mesh.children) {
      if (child.geometry) { geom = child.geometry; break; }
    }
  }
  if (!geom) return { triV0: [], triV1: [], triV2: [] };

  const pos = geom.attributes.position;
  const triV0 = [], triV1 = [], triV2 = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    const v0 = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const v1 = new THREE.Vector3().fromBufferAttribute(pos, i+1).applyMatrix4(mesh.matrixWorld);
    const v2 = new THREE.Vector3().fromBufferAttribute(pos, i+2).applyMatrix4(mesh.matrixWorld);
    triV0.push(v0); triV1.push(v1); triV2.push(v2);
  }
  return { triV0, triV1, triV2 };
}


function makeTriangleTexture(triV0, triV1, triV2) {
  const totalTris = triV0.length;
  const totalVerts = totalTris * 3; 
  const width = Math.ceil(Math.sqrt(totalVerts));
  const height = Math.ceil(totalVerts / width);
  const data = new Float32Array(width * height * 4);
  let vertIndex = 0;
  for (let i = 0; i < totalTris; i++) {
    const verts = [triV0[i], triV1[i], triV2[i]];
    for (let j = 0; j < 3; j++) {
      const v = verts[j];
      const texelOffset = vertIndex * 4;
      data[texelOffset + 0] = v.x;
      data[texelOffset + 1] = v.y;
      data[texelOffset + 2] = v.z;
      data[texelOffset + 3] = 0.0;
      vertIndex++;
    }
  }


  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return { texture, width, height, totalTris, totalVerts };
}


const material1 = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vWorldPos;
    varying vec3 vNormalWorld;
    void main() {
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vNormalWorld = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
precision highp float;

uniform vec3 sunPos;
uniform vec3 colourLit;
uniform vec3 colourShad;

uniform sampler2D triTex;    // DataTexture containing one vertex per texel (RGBA)
uniform vec2 triTexSize;     // texture width,height
uniform int numTris;         // number of triangles in the texture

varying vec3 vWorldPos;
varying vec3 vNormalWorld;

vec3 getTriVertex(int triIndex, int vertexIndex) {
    // linear vertex index (0..totalVerts-1)
    int base = triIndex * 3 + vertexIndex; // vertex number
    float idx = float(base);
    float fx = mod(idx, triTexSize.x);
    float fy = floor(idx / triTexSize.x);
    vec2 uv = (vec2(fx, fy) + 0.5) / triTexSize;
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
    return (t > EPS);
}

void main() {
    // offset origin slightly along normal to avoid self-shadowing
    vec3 origin = vWorldPos + vNormalWorld * 0.001; 
    vec3 toSun = normalize(sunPos - origin);
    bool inShadow = false;
    float tHit;

    // compile-time loop bound must be constant; pick a large cap (safe)
    const int MAX_TRIS = 16384; 

    for (int i = 0; i < MAX_TRIS; i++) {
        if (i >= numTris) break;

        vec3 v0 = getTriVertex(i, 0);
        vec3 v1 = getTriVertex(i, 1);
        vec3 v2 = getTriVertex(i, 2);

        if (intersectRayTriangle(origin, toSun, v0, v1, v2, tHit)) {
            // ensure intersection is between fragment and the light
            // optional: compare tHit to distance to sun to ignore hits beyond the light
            float distToLight = length(sunPos - origin);
            if (tHit > 0.0 && tHit < distToLight) {
                inShadow = true;
                break;
            }
        }
    }

    gl_FragColor = vec4(inShadow ? colourShad : colourLit, 1.0);
}
  
  
  `,
  uniforms: {
    sunPos: { value: light.position.clone() },
    colourLit: { value: new THREE.Color('yellow') },
    colourShad: { value: new THREE.Color('blue') },
    triTex: { value: null },
    triTexSize: { value: new THREE.Vector2(1,1) },
    numTris: { value: 0 },
  }
});


function loadMesh(url, scale = 0.03, position = new THREE.Vector3()) {
  loader.load(url, obj => {
    const geom = obj.children[0].geometry;
    geom.scale(scale, scale, scale);

    const mesh = new THREE.Mesh(geom, material1);
    mesh.position.copy(position);
    scene.add(mesh);
    meshes.push(mesh);

  
    mesh.updateMatrixWorld(true);

  
    const triangleSets = meshes.map(m => extractTrianglesFromMeshWorld(m));
    const { out1: triV0, out2: triV1, out3: triV2 } = toThreeLists(triangleSets);
    const { texture, width, height, totalTris } = makeTriangleTexture(triV0, triV1, triV2);

 
    material1.uniforms.triTex.value = texture;
    material1.uniforms.triTexSize.value = new THREE.Vector2(width, height);
    material1.uniforms.numTris.value = totalTris;
    material1.needsUpdate = true;
  });
}


//loadMesh('/models/sphere.obj', 0.03, new THREE.Vector3(9, 0, 0));
//loadMesh('/models/67p_low_res.obj', 0.01, new THREE.Vector3(0, 0, 0));console.log("Meshes in scene:", meshes);

Promise.all([
  new Promise(res => loader.load('/models/sphere.obj', obj => res({ obj, scale: 0.03, pos: new THREE.Vector3(1,0,0) }))),
  new Promise(res => loader.load('/models/67p_low_res.obj', obj => res({ obj, scale: 0.001, pos: new THREE.Vector3(1,0,0) })))
]).then(loadedMeshes => {
  for (let {obj, scale, pos} of loadedMeshes) {
    const geom = obj.children[0].geometry;
    geom.scale(scale, scale, scale);
    const mesh = new THREE.Mesh(geom, material1);
    mesh.position.copy(pos);
    scene.add(mesh);
    meshes.push(mesh);
  }

  // AFTER all are in scene, now build the texture
  meshes.forEach(m => m.updateMatrixWorld(true));
  const triangleSets = meshes.map(m => extractTrianglesFromMeshWorld(m));
  const { out1: triV0, out2: triV1, out3: triV2 } = toThreeLists(triangleSets);
  const { texture, width, height, totalTris } = makeTriangleTexture(triV0, triV1, triV2);

  material1.uniforms.triTex.value = texture;
  material1.uniforms.triTexSize.value = new THREE.Vector2(width, height);
  material1.uniforms.numTris.value = totalTris;
});



let clock = new THREE.Clock();

var tickkk = 0;

function animate() {
    if(tickkk<500){
      requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      console.log("Tick: ", elapsed);
      renderer.render(scene, camera);
      tickkk = tickkk+1;
    }
}

animate();
if (!renderer.capabilities.isWebGL2) {
  if (!renderer.extensions.get('OES_texture_float')) {
    console.error('Textures wont work on this device');
  }
}