import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// set up the THREE.js camera, scene, renderer and light
const w = window.innerWidth
const h = window.innerHeight
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 100000)
camera.position.z = 5
const renderer = new THREE.WebGLRenderer()
renderer.shadowMap.enabled = true  // sets whether THREE.js will include shadows in its rendering
renderer.setSize(w, h)
document.body.appendChild(renderer.domElement)

const light = new THREE.DirectionalLight(0xffffff)
light.position.set(5, 10, 10)
light.castShadow = true
scene.add(light)

// any object being rendered by THREE.js needs a material, such as these
const redBasicMaterial = new THREE.MeshBasicMaterial({color: 0xbf243f})  // MeshBasicMaterial does not factor in light sources
const greenBasicMaterial = new THREE.MeshBasicMaterial({color: 'green'})
const redMaterial = new THREE.MeshStandardMaterial({color: 0xbf243f})  // MeshStandardMaterial factors in light sources
const greenMaterial = new THREE.MeshStandardMaterial({color: 'green'})

// defining a sphere object to go in the scene:
const sphereGeom = new THREE.SphereGeometry(0.3)
const sphere = new THREE.Mesh(sphereGeom, greenBasicMaterial)
sphere.position.set(1, 1, 1)
sphere.castShadow = true  // sets whether this object can cast shadows onto others
scene.add(sphere)

// loading a triangular mesh (comet 67p) from a wavefront (.obj) file to go in the scene
var mesh
var meshLoaded = false
const loader = new OBJLoader()
loader.load(
    'models/c67p_low_res.obj',

    function(object) {
        object.children[0].geometry.scale(0.0005, 0.0005, 0.0005)
        mesh = new THREE.Mesh(object.children[0].geometry, redMaterial)
        mesh.rotation.x = -0.8
        mesh.rotation.y = -0.7
        scene.add(mesh)
        mesh.castShadow = true  // sets whether this object can cast shadows onto others
        mesh.receiveShadow = true  // sets whether this object can have shadows cast onto it
        meshLoaded = true
    },

    function(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded')
    },

    function(error) {
        console.log(error)
    }
)

const rotate = false
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