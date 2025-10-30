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

const sphereR = 0.1
const sphereGeom = new THREE.SphereGeometry(sphereR)
const sphere = new THREE.Mesh(sphereGeom, new THREE.MeshBasicMaterial({color: 'green'}))
sphere.position.set(1, 1, 1)
sphere.castShadow = false
scene.add(sphere)

function createRayCastShadowShaderMaterial() {  // a custom shader that ray traces a sphere to check if it is casting a shadow
    let uniforms = {
        sunPos: {type: 'vec3', value: light.position},
        spherePos: {type: 'vec3', value: sphere.position},
        sphereRadius: {type: 'float', value: sphereR},
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

// loading a triangular mesh from a wavefront (.obj) file
var mesh
var meshLoaded = false
const loader = new OBJLoader()
loader.load(
    'models/c67p_low_res.obj',

    function(object) {
        object.children[0].geometry.scale(0.0005, 0.0005, 0.0005)
        mesh = new THREE.Mesh(object.children[0].geometry, createRayCastShadowShaderMaterial())
        mesh.rotation.x = -0.8
        mesh.rotation.y = -0.7
        scene.add(mesh)
        mesh.castShadow = false
        mesh.receiveShadow = false
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