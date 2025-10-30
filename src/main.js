import * as THREE from 'three';
//import fragShader from './shaders/raycastShadow.frag.glsl?raw';  // import as text
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { vec3 } from 'three/tsl';

let renderer;
if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
}



const loader = new OBJLoader();

var globalModels = {};
 
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 120;

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//these state the position of the two objects for later - makes it easier to play with coordinatesh
const scales = [
  1,
  0.1,
];
const startpos1 =[ 
  new THREE.Vector3(90, 0, 0),
  new THREE.Vector3(-120, 0, 0),
  new THREE.Vector3(0, 7, 0),
  new THREE.Vector3(0,0, -8),
];
const NAMES101 = [
//  'sphere',               // 2208 triangles
//  'weirdCube1',           // 4240 triangles
//  'ring',                 // 2304 triangles
  'cube',                 // 12   triangles
  '67p_low_res',          // 62908 traingles
//  'cylinder1',            // 2820 triangles
//  'pointyCone',           // 4896 triangles
//  'shape1',               // 20   triangles
//  'shape2',               // 1256 triangles


];
const light = new THREE.DirectionalLight(0xffffff);
light.position.set(-5000,0,0);
scene.add(light);


const geometry = new THREE.BoxGeometry();
var meshes = [];
var edgesTheSuperVarible = {};

function getMinMax() {
  const overallBox = new THREE.Box3();

  for (const mesh of meshes) {
    const meshBox = new THREE.Box3().setFromObject(mesh);
    overallBox.union(meshBox);
  }
  var X = {
    minX: overallBox.min.x,
    minY: overallBox.min.y,
    minZ: overallBox.min.z,
    maxX: overallBox.max.x,
    maxY: overallBox.max.y,
    maxZ: overallBox.max.z
  };
  edgesTheSuperVarible = X;
  return X;
}


function filterFunction1(x,y,z){
  var edges = {};
  if(!edgesTheSuperVarible.minX){
      edges = getMinMax();
  }else{
      edges = edgesTheSuperVarible;
  }

  if(edges.minX <= x && edges.maxX >= x && edges.minY <= y && edges.maxY >= y && edges.minZ <= z && edges.maxZ >= z){
    return false;
  }else{
    return true;
  }
}

var cubeDexCoeffient = [1,1,1]; //the thing to divide the coord by to get the cube index value - after flooring

function createCubdexStuff(numBoxes = 55) {

    const B = getMinMax();  // expects {minX, minY, minZ, maxX, maxY, maxZ}
    const xL = B.maxX - B.minX;
    const yL = B.maxY - B.minY;
    const zL = B.maxZ - B.minZ;
    const cubeRoot = Math.cbrt(numBoxes);

    let nx = Math.round(cubeRoot * (xL / Math.cbrt(xL * yL * zL)));
    let ny = Math.round(cubeRoot * (yL / Math.cbrt(xL * yL * zL)));
    let nz = Math.round(cubeRoot * (zL / Math.cbrt(xL * yL * zL)));

    nx = Math.max(1, nx);
    ny = Math.max(1, ny);
    nz = Math.max(1, nz);

    cubeDexCoeffient[0] = xL / nx;
    cubeDexCoeffient[1] = yL / ny;
    cubeDexCoeffient[2] = zL / nz;


}

function computeCoord(x, y, z) {
  // in this, we are assuming the box is centered on origin / the offset for all x/y/z is 0, but we could do x-a etc in the lines
  let B = getMinMax();
  let ix = Math.floor((x - B.minX) / cubeDexCoeffient[0]);
  let iy = Math.floor((y - B.minY) / cubeDexCoeffient[1]);
  let iz = Math.floor((z - B.minZ) / cubeDexCoeffient[2]);

  return { ix, iy, iz };
}

function createJSONcubdex(x,y,z){
  return "(" + x + "," + y + "," + z + ")";
}

var theJSONstuff = {};

function addItemToJSONSUPERSTUFF(key, value) {
  if (key in theJSONstuff) {
    theJSONstuff[key].push(value);
  } else {
    theJSONstuff[key] = [value]; 
  }
}

function addPointToJSON(x,y,z){
  var {ix, iy, iz} = computeCoord(x,y,z);
  var coord = createJSONcubdex(ix, iy, iz);
  addItemToJSONSUPERSTUFF(coord, new THREE.Vector3(x, y, z));
}


function createJSON_stuff(){
  var outJSON = {};
  const overallBox = new THREE.Box3();
  for(let a=0;a<meshes.length;a++){
    let mesh = meshes[a];
    const geometry = mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const indexAttr = geometry.index ? geometry.index.array : null;
    const vertex = new THREE.Vector3(); 
    const meshBox = new THREE.Box3().setFromObject(mesh);
    overallBox.union(meshBox);

    if (indexAttr) {
      for (let j = 0; j < indexAttr.length; j += 3) {
        const triangle = [];
        for (let k = 0; k < 3; k++) {
          vertex.fromBufferAttribute(positionAttr, indexAttr[j + k]);
          vertex.applyMatrix4(mesh.matrixWorld);
            
          const v = vertex.clone(); 
          triangle.push(v);

          const x = v.x;
          const y = v.y;
          const z = v.z;

          addPointToJSON(x, y, z);
          
        }
      }
    } else {
      // Non-indexed geometry
      for (let j = 0; j < positionAttr.count; j += 3) {
        const triangle = [];
        for (let k = 0; k < 3; k++) {
          vertex.fromBufferAttribute(positionAttr, j + k);
          vertex.applyMatrix4(mesh.matrixWorld);
            
          const v = vertex.clone(); 
          triangle.push(v);

          const x = v.x;
          const y = v.y;
          const z = v.z;

          addPointToJSON(x, y, z);
        }
      }
    }
  }
}

function countMershes(){


  /**
   * for the sphere and weird cube meshes, we get around 6448 triangles via this method
   */
  var out = 0;
  const overallBox = new THREE.Box3();
  for(let a=0;a<meshes.length;a++){
    let mesh = meshes[a];
    const geometry = mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const indexAttr = geometry.index ? geometry.index.array : null;
    const vertex = new THREE.Vector3(); 
    const meshBox = new THREE.Box3().setFromObject(mesh);
    overallBox.union(meshBox);

    if (indexAttr) {
      for (let j = 0; j < indexAttr.length; j += 3) {
        const triangle = [];
        for (let k = 0; k < 3; k++) {
          vertex.fromBufferAttribute(positionAttr, indexAttr[j + k]);
          vertex.applyMatrix4(mesh.matrixWorld);
            
          const v = vertex.clone(); 
          triangle.push(v);

          
          
        }
        out = out + 1;
      }
    } else {
      // Non-indexed geometry
      for (let j = 0; j < positionAttr.count; j += 3) {
        const triangle = [];
        for (let k = 0; k < 3; k++) {
          vertex.fromBufferAttribute(positionAttr, j + k);
          vertex.applyMatrix4(mesh.matrixWorld);
            
          const v = vertex.clone(); 
          triangle.push(v);

          
        }
        out = out + 1;
      }
    }
  }
  return out;
}


function collectMeshVertices(meshes) {
  const allVertices = []; // store all vertices in world coordinates
  const overallBox = new THREE.Box3(); // bounding box for all meshes

  meshes.forEach(mesh => {


    
  });

  return { allVertices, overallBox };
}




/*
function loadCubdexes__afterMeshesLoaded(){
  var output = {};
  for(var i=0;i<meshes.length;i++){
    var thisMesh = meshes[i];
    var position = thisMesh.geometry.attributes.position;
    var index = thisMesh.geometry.index ? thisMesh.geometry.index.array : null; //if it has an index, use that, else set it to null
    var vertex = new THREE.Vector3();

    const meshBox = new THREE.Box3().setFromObject(thisMesh);
    overallBox.union(meshBox);

    if(index){
      for(let j=0;j<index.length;j+=3){
        var triangles1 = [];
        for(let k=0; k<3;k++){
          vertex.fromBufferAttribute(position, index[j+k]);
          vertex.applyMatrix4(thisMesh.matrixWorld); 
          triangles1.push(vertex.clone());
        }


        if (vertex.x > 0.5 && vertex.y < 2.0) {
          filteredPoints.push(vertex.clone());
        }

        // APPLY FILTERING CRITERIA HERE - push to output or catcher varible
        if(false){

        }
      }

    }else{

      for(let j=0;j<position.count;j+=3){
        var triangles1 = [];
        for(let k=0; k<3;k++){
          vertex.fromBufferAttribute(position, j+k);
          vertex.applyMatrix4(thisMesh.matrixWorld); 
          triangles1.push(vertex.clone());
        }
        // APPLY FILTERING CRITERIA HERE - push to output or catcher varible
        
      }
    }
  }
}
*/



function testLoadFile(){

  fetch('/models/json_objs/partitioned_ring.json')
  .then(response => response.json())
  .then(data => {
    console.log('Loaded JSON:', data);
  })
  .catch(err => console.error('Error loading JSON:', err));

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
/**
 * gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
 * 
 * This line is converting the vertex position in model space (eg, relative to the origin in the model) to a point
 * in the space that the screen sees, 
 * 
 * 
 * 
 * modelMatrix = local object space to world space
 * viewmatrix = world space to camera space (cameras poition and orientation inverted - moves the world such that teh camera is at origin, and looking donw the Z axis - thus, high Z values are not shows to the camera if the camera is at z=5 (z=20 wont show then))
 * modelViewMatrix - object space directly to viewing space
 * prjectionMaxtrix - view space to clip space - 
 * normalMatrix - object space normals into view space normals
 * 
 * camera matrix world - camera space to world space - inverse of viewmatrix etc
 * 
 */


  vertexShader: `
    varying vec3 vWorldPos;
    varying vec3 vNormalWorld;
    void main() {
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vNormalWorld = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

 // for pheong Shadering stuff 
uniform vec3 ka;         // ambient reflectivity
uniform vec3 kd;         // diffuse reflectivity
uniform vec3 ks;         // specular reflectivity
uniform float shininess; // specular exponent
uniform vec3 Ia;         // ambient light intensity
uniform vec3 Il;         // sun light intensity
uniform vec3 camPos; // dont use -> cameraPosition   its a predefined keyword type of thing;  //camera position

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
// 

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

    //pheong shadering from here
    
    vec3 N = normalize(vNormalWorld);
    vec3 V = normalize(camPos-vWorldPos); // if camera was at origin, no need for camera position to come in here
    vec3 L = normalize(sunPos - vWorldPos);

    //ambient is the defaul/basic colour ==  this vec3 at the end is some residue ligt to allow you to see the actual left object
       // alter it to all vary the default colour
    vec3 ambient = ka * Ia + vec3(0,0, 0.2);
    vec3 colour = ambient;

    if (!inShadow) {
    /* could remove this line of code i belive / get ride of all intersectino stuff - might still work fine    
        But this if's is still needed so that things that are behind others are still blocked out - although for soft shadows
        or for the small bit of radiant light that makes it around an obsticle is 

    */
        float NdotL = max(dot(N, L), 0.0);
        vec3 diffuse = kd * Il * NdotL;
        
        vec3 R = reflect(-L, N);
        float RdotV = max(dot(R, V), 0.0);
        vec3 specular = ks * Il * pow(RdotV, shininess);

        colour = colour + diffuse + specular;
    }
    colour = clamp(colour, 0.0, 1.0);
    gl_FragColor = vec4(colour, 1.0);

}
  
  
  `,
  uniforms: {
    //pheong shadering inputs 
       
    ka: { value: new THREE.Color(0.1,0.1,0.1) },// ambient reflectivity
    kd: { value: new THREE.Color(1.0,1.0,1.0) },// diffuse reflectivity
    ks: { value: new THREE.Color(1.0,1.0,1.0) },// specular reflectivity
    shininess: { value: 32.0 },                 // specular exponent
    Ia: { value: new THREE.Color(0.2,0.2,0.2) },// ambient light intensity
    Il: { value: new THREE.Color(1.0,0.0,1.0) },// sun light intensity - assuming entirly white
    cameraPosition:{value:camera.position.clone() },

    // core inputs
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

function loadModelAndJSON(name, scale, pos) {
  return new Promise(res => {
    loader.load(`/models/${name}.obj`, obj => {
      // Loading the matching JSON
      console.log("Time to search /models/json_objs/partitioned_${name[0]}.json");
      fetch(`/models/json_objs/partitioned_${name[0]}.json`)
        .then(r => r.json())
        .then(jsonData => {
          res({ obj, jsonData, scale, pos });
          
        })
        .catch(() => {
          console.warn(`No JSON data found for ${name}`);
          res({name,  obj, jsonData: null, scale, pos});
        });
    });
  });
}


Promise.all(
  NAMES101.map((name, i) => loadModelAndJSON(name, scales[i], startpos1[i]))
).then(loaded => {
  loaded.forEach(loadedItem => {
    const { name, obj, jsonData, scale, pos } = loadedItem;
    console.warn(name);
    obj.traverse(child => {
      if (child.isMesh) {
        const mesh = new THREE.Mesh(child.geometry, material1);
        mesh.scale.set(scale, scale, scale);
        mesh.position.copy(pos);
        scene.add(mesh);
        meshes.push(mesh);

       
        globalModels[name] = mesh;
        // fetch relevent json data here
      }
    });
  });


  finalSetUp();
});

function finalSetUp(){
  // update the meshes list here
  meshes.forEach(m => m.updateMatrixWorld(true));  // world transforms applied

  //now stuff for the JSON / cube index stuff here
  //createCubdexStuff(55);                             
  //createJSON_stuff();                                
  //console.log("Cube JSON ready:", theJSONstuff);

  // this is all mesh related
  const triangleSets = meshes.map(m => extractTrianglesFromMeshWorld(m));
  const { out1: triV0, out2: triV1, out3: triV2 } = toThreeLists(triangleSets);
  const { texture, width, height, totalTris } = makeTriangleTexture(triV0, triV1, triV2);

  material1.uniforms.triTex.value = texture;
  material1.uniforms.triTexSize.value = new THREE.Vector2(width, height);
  material1.uniforms.numTris.value = totalTris;

}

let clock = new THREE.Clock();

var tickkk = 0;
const spheremeshAsOBJ = meshes[1];

var tickBool = 100;

function setUpworld(){
/*
    Inital set up stuff
    should include

    cube index creation stuff - setting it all up 
    then creation of the JSON type files
*/  
  
  //createJSON_stuff();
  //console.log(theJSONstuff);
}

function animate() {
    if(tickkk<50000){
      requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      console.log("The total number of triangles is:" + countMershes());

      globalModels[NAMES101[1]].rotation.y += 0.02;
      globalModels[NAMES101[1]].rotation.z += 0.01;
      globalModels[NAMES101[1]].rotation.x += 0.009;
    
      

      theJSONstuff = {} //resetting the JSON stuff each time now
     if (globalModels.sphere) {
      if(tickBool < 200){
        globalModels[NAMES101[0]].position.y += 0.05;

       
      }else if(tickBool<402){
        globalModels[NAMES101[0]].position.y -= 0.05;
      }
      if(tickBool>405){
        tickBool = 0;
      }else{
        tickBool = tickBool + 1;
      }
    }else{
      console.log("no movement yet");
    }

   // loadCubdexes__afterMeshesLoaded();
      // end stuff
      finalSetUp() // update all the meshs ect
      getMinMax(); // then find the new min and max`s
      console.log("Tick: ", elapsed);
      renderer.render(scene, camera);
      tickkk = tickkk+1;
    }
}



// maybe need to create a quick set up fucntion first around here
setUpworld();
animate();
if (!renderer.capabilities.isWebGL2) {
  if (!renderer.extensions.get('OES_texture_float')) {
    console.error('Textures wont work on this device');
  }
}