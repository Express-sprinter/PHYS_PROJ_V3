/*
    This was the frist one that I had done that altered the original code
    it imports an extra object (a mere shpere, but in .ibj form) and attempts to alter the already given redering function for a sphere
    to create the shadow

    Does not actuall assume its a obj file in rendering. it shows the obj file then finds properties of it that it wants - eg, position and radius
    all under the assumption that its a sphere
    


*/

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const w = window.innerWidth
const h = window.innerHeight
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100000)
camera.position.z = 5
const renderer = new THREE.WebGLRenderer()
renderer.shadowMap.enabled = false
renderer.setSize(w, h)
document.body.appendChild(renderer.domElement)

const light = new THREE.DirectionalLight(0xffffff)
light.position.set(5, 10, 10)
light.castShadow = false
scene.add(light)
/*
const sphereR = 0.1
const sphereGeom = new THREE.SphereGeometry(sphereR)
const sphere = new THREE.Mesh(sphereGeom, new THREE.MeshBasicMaterial({color: 'green'}))
sphere.position.set(1, 1, 1)
sphere.castShadow = false
scene.add(sphere)
*/
function createRayCastShadowShaderMaterial() { 
    let uniforms = {
        sunPos: {type: 'vec3', value: light.position},
        spherePos: {type: 'vec3', value: mesh2.position},
        sphereRadius: {type: 'float', value: getMeshRadius(mesh2)},
        colourLit: {type: 'vec3', value: new THREE.Color('yellow')},
        colourShad: {type: 'vec3', value: new THREE.Color('blue')}
    }
    function vertexShader() {
        return `
        varying vec3 intersectionPoint;

        void main() {
            intersectionPoint = (modelMatrix * vec4(position, 1.0)).xyz;

            // boilerplate code the caluclates the vertex's position:
            vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewPosition;
        }
    `
    }
    function fragmentShader() {
    return `
        uniform vec3 sunPos;
        uniform vec3 spherePos;
        uniform float sphereRadius;
        uniform vec3 colourLit;
        uniform vec3 colourShad;
        varying vec3 intersectionPoint;

        // rayDir = ray Direction - 
        bool intersectSphere(vec3 rayOrigin, vec3 rayDir) {
            vec3 L = spherePos - rayOrigin;
            float tca = dot(L, rayDir);
            if (tca < 0.0) {
                return false;
            }

            float d = sqrt(dot(L, L) - dot(tca, tca));
            if (d <= sphereRadius) {
                return true;
            }
            return false;
        }

        void main() {
            // normilise takes a vector and it becomes a unit vector  - direction maintained 
            vec3 toSun = normalize(sunPos - intersectionPoint);

            if (intersectSphere(intersectionPoint, toSun)) {
                gl_FragColor = vec4(colourShad, 1.0);
            } else {
                gl_FragColor = vec4(colourLit, 1.0);
            }
        }
    `
}
    return new THREE.ShaderMaterial ({
        uniforms: uniforms,
        fragmentShader: fragmentShader(),
        vertexShader: vertexShader()
    })
}


var mesh;
var meshLoaded = false;
const loader = new OBJLoader();
loader.load(
    '/models/67p_low_res.obj',

    function(object) {
        object.children[0].geometry.scale(0.0005, 0.0005, 0.0005);
        mesh = new THREE.Mesh(object.children[0].geometry, createRayCastShadowShaderMaterial());
        mesh.rotation.x = -0.8;
        mesh.rotation.y = -0.7;
        scene.add(mesh);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        meshLoaded = true;
    },

    function(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },

    function(error) {
        console.log(error);
    }
)


let mesh2;
let mesh2Loaded = false;

loader.load(
  '/models/sphere.obj', 
  function (object) {
    
    object.children[0].geometry.scale(0.01, 0.01, 0.01);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffff33 });

    mesh2 = new THREE.Mesh(object.children[0].geometry, mat);
    mesh2.position.set(1, 1, 1); // put it somewhere else
    scene.add(mesh2);

    mesh2.castShadow = false;
    mesh2.receiveShadow = false;
    mesh2Loaded = true;
  },

  xhr => console.log((xhr.loaded / xhr.total * 100) + '% loaded second obj'),
  err => console.log(err)
);



const rotate = true
function animate() {
    requestAnimationFrame(animate)

    if (rotate) {
        if (meshLoaded) {
            mesh.rotation.x += 0.004
            mesh.rotation.y += 0.008
        }
        
    }

    renderer.render(scene, camera)
}

animate()

function handleWindowResize () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', handleWindowResize, false)




function getBoundingBox(givenMesh){
    // returns a square box in which the object/mesh can sit within

    const box = new THREE.Box3().setFromObject(givenMesh);
    var size = new THREE.Vector3();
    box.getSize(size); // in [x,y,z] form - puts output into the size varible (needed as parameter for compressing the sizes needed)
    return size;
}
function getMeshRadius(givenMesh){
    /*
    returns the raduis largest radius for the mesh - works for spheres, but otherwise inacruate.
    */
   var S = getBoundingBox(givenMesh);
   return Math.max(S.x, S.y, S.z) / 2; // assuming the sphere is centered.

}