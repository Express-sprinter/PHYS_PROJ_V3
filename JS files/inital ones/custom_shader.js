import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const w = window.innerWidth
const h = window.innerHeight
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100000)
camera.position.z = 5
const renderer = new THREE.WebGLRenderer()
renderer.shadowMap.enabled = true
renderer.setSize(w, h)
document.body.appendChild(renderer.domElement)

const light = new THREE.DirectionalLight(0xffffff)
light.position.set(5, 10, 10)
light.castShadow = true
scene.add(light)

const redBasicMaterial = new THREE.MeshBasicMaterial({color: 0xbf243f})  // MeshBasicMaterial does not factor in light sources

function createCustomShaderMaterial() {  // a custom shader that colours the object's surface based on its distance from the camera
    let uniforms = {
        camPos: {type: 'vec3', value: camera.position},
        colourB: {type: 'vec3', value: new THREE.Color('red')},
        colourA: {type: 'vec3', value: new THREE.Color('blue')}
    }
    function vertexShader() {
        return `
        varying vec3 intersectionPoint;
        varying float intersectionDist;
        uniform vec3 camPos;

        void main() {
            intersectionPoint = (modelMatrix * vec4(position, 1.0)).xyz;
            intersectionDist = distance(intersectionPoint, camPos);

            // boilerplate code the caluclates the vertex's position:
            vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewPosition;
        }
    `
    }
    function fragmentShader() {
    return `
        uniform vec3 colourA;
        uniform vec3 colourB;
        varying vec3 intersectionPoint;
        varying float intersectionDist;

        void main() {
            gl_FragColor = vec4(mix(colourA, colourB, (intersectionDist - 4.0) / 2.0), 1.0);
        }
    `
}
    return new THREE.ShaderMaterial ({
        uniforms: uniforms,
        fragmentShader: fragmentShader(),
        vertexShader: vertexShader()
    })
}

// loading a triangular mesh from a wavefront (.obj) file
var mesh
var meshLoaded = false
const loader = new OBJLoader()
loader.load(
    'models/c67p_low_res.obj',

    function(object) {
        object.children[0].geometry.scale(0.0005, 0.0005, 0.0005)
        mesh = new THREE.Mesh(object.children[0].geometry, createCustomShaderMaterial())
        mesh.rotation.x = -0.8
        mesh.rotation.y = -0.7
        scene.add(mesh)
        mesh.castShadow = true
        mesh.receiveShadow = true
        meshLoaded = true
    },

    function(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded')
    },

    function(error) {
        console.log(error)
    }
)

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