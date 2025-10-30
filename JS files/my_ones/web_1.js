
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let renderer, scene, camera, clock;
let meshes = [];
     

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 5;

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//second canvas object
const gpuCanvas = document.createElement('canvas');
gpuCanvas.width = window.innerWidth;
gpuCanvas.height = window.innerHeight;
gpuCanvas.style.position = 'absolute';
gpuCanvas.style.top = '0';
gpuCanvas.style.left = '0';
gpuCanvas.style.zIndex = '5'; 
gpuCanvas.setAttribute('id', 'webgpu-canvas');
document.body.appendChild(gpuCanvas);

const light = new THREE.DirectionalLight(0xffffff);
light.position.set(5,5,5);
scene.add(light);

clock = new THREE.Clock();
const loader = new OBJLoader();


function loadMesh(url, scale=0.03, pos=new THREE.Vector3()) {
    loader.load(url, (obj) => {
        obj.traverse(child => {
            if (child.isMesh) {
              //taking the meshes and is a simple rendering of the net - green lines between all verticies
                child.material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
                child.geometry.scale(scale, scale, scale);
                child.geometry.computeVertexNormals();
                child.position.copy(pos);
                scene.add(child);
                
                meshes.push(child);
            }
        });

        console.log("Meshes loaded:", meshes);
        startWebGPU(); 
    });
} 
 
loadMesh('/models/sphere.obj', 0.03, new THREE.Vector3(-1.5,0,0));
loadMesh('/models/cube.obj', 0.03, new THREE.Vector3(1,0,0));


function extractTrianglesFromMeshWorld(mesh) {
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    const triV0 = [], triV1 = [], triV2 = [];
    for (let i = 0; i < pos.count; i += 3) {
        triV0.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
        triV1.push(new THREE.Vector3().fromBufferAttribute(pos, i+1).applyMatrix4(mesh.matrixWorld));
        triV2.push(new THREE.Vector3().fromBufferAttribute(pos, i+2).applyMatrix4(mesh.matrixWorld));
    }
    return { triV0, triV1, triV2 };
}

function flattenTriangles(triV0, triV1, triV2) {
    const total = triV0.length;
    const data = new Float32Array(total*9);
    for (let i=0; i<total; i++) {
        data.set([triV0[i].x, triV0[i].y, triV0[i].z,
                  triV1[i].x, triV1[i].y, triV1[i].z,
                  triV2[i].x, triV2[i].y, triV2[i].z], i*9);
    }
    return data;
}




async function startWebGPU() {
    if (!navigator.gpu) {
        console.error("WebGPU not supported in this browser!");
        return;
    }

   const canvas = document.getElementById('webgpu-canvas');
    if (!canvas) {
      console.error("WebGPU canvas not found!");
      return;
    }
    const context = canvas.getContext('webgpu');
    if (!context) {
      console.error("Failed to get WebGPU context — browser may not support WebGPU or incorrect canvas.");
      return;
    }
    

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
        alphaMode: 'opaque'
    });

    const width = canvas.width = window.innerWidth;
    const height = canvas.height = window.innerHeight;
    console.log("WebGPU ready with device:", device);

    
    const triangleSets = meshes.map(m => extractTrianglesFromMeshWorld(m));
    const triV0 = [], triV1 = [], triV2 = [];
    for (let set of triangleSets) {
        triV0.push(...set.triV0);
        triV1.push(...set.triV1);
        triV2.push(...set.triV2);
    }
    const triData = flattenTriangles(triV0, triV1, triV2);
    console.log("Example triangle count:", triV0.length);

    const triBuffer = device.createBuffer({
        size: triData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    });
    new Float32Array(triBuffer.getMappedRange()).set(triData);
    triBuffer.unmap();

  
    const outTex = device.createTexture({
        size: [width, height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });

    const computeShader = /* wgsl */`
    struct Tri {
        a : vec3<f32>,
        b : vec3<f32>,
        c : vec3<f32>
    };

    @group(0) @binding(0) var<storage, read> tris : array<Tri>;
    @group(0) @binding(1) var outTex : texture_storage_2d<rgba8unorm, write>;

    // Möller-Trumbore intersection test
    fn intersectTriangle(orig: vec3<f32>, dir: vec3<f32>, tri: Tri) -> vec3<f32> {
        let e1 = tri.b - tri.a;
        let e2 = tri.c - tri.a;
        let h = cross(dir, e2);
        let det = dot(e1, h);
        if (abs(det) < 1e-6) { return vec3<f32>(-1.0); }
        let f = 1.0 / det;
        let s = orig - tri.a;
        let u = f * dot(s, h);
        if (u < 0.0 || u > 1.0) { return vec3<f32>(-1.0); }
        let q = cross(s, e1);
        let v = f * dot(dir, q);
        if (v < 0.0 || u + v > 1.0) { return vec3<f32>(-1.0); }
        let t = f * dot(e2, q);
        if (t > 0.0) {
            let n = normalize(cross(e1, e2)); // surface normal
            return n;
        }
        return vec3<f32>(-1.0);
    }

    @compute @workgroup_size(8,8)
    fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
        let dim = textureDimensions(outTex);
        if (gid.x >= u32(dim.x) || gid.y >= u32(dim.y)) { return; }

        let uv = vec2<f32>(f32(gid.x)/f32(dim.x), f32(gid.y)/f32(dim.y));
        let camOrig = vec3<f32>(0.0,0.0,5.0);
        let rayDir = normalize(vec3<f32>((uv.x-0.5)*2.0, (uv.y-0.5)*2.0, -1.0));

        var color = vec3<f32>(0.0);
        for (var i = 0u; i < arrayLength(&tris); i = i + 1u) {
            let n = intersectTriangle(camOrig, rayDir, tris[i]);
            if (n.x >= 0.0) {
                // Encode normal as colour
                color = n * 0.5 + vec3<f32>(0.5);
                break;
            }
        }
        textureStore(outTex, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(color, 1.0));
    }`;

    const computeModule = device.createShaderModule({ code: computeShader });
    const computePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'main' }
    });

    const computeBindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: triBuffer } },
            { binding: 1, resource: outTex.createView() },
        ],
    });


    // Rendering step
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    const renderShader = /* wgsl */`
    @group(0) @binding(0) var myTex: texture_2d<f32>;
    @group(0) @binding(1) var mySampler: sampler;

    struct VSOut {
        @builtin(position) pos: vec4<f32>,
        @location(0) uv: vec2<f32>,
    };

    // Fullscreen triangle
    @vertex
    fn vs_main(@builtin(vertex_index) idx : u32) -> VSOut {
        var pos = array<vec2<f32>, 3>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(3.0, -1.0),
            vec2<f32>(-1.0, 3.0)
        );
        var out : VSOut;
        out.pos = vec4<f32>(pos[idx], 0.0, 1.0);
        out.uv = (out.pos.xy * 0.5) + vec2<f32>(0.5);
        return out;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        return textureSample(myTex, mySampler, uv);
    }`;

    const renderModule = device.createShaderModule({ code: renderShader });
    const renderPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: renderModule, entryPoint: 'vs_main' },
        fragment: {
            module: renderModule,
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
    });

    const renderBindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: outTex.createView() },
            { binding: 1, resource: sampler },
        ],
    });

    
    const commandEncoder = device.createCommandEncoder();


    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(width/8), Math.ceil(height/8));
    computePass.end();

    const textureView = context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: 'store'
        }],
    });

    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(3, 1, 0, 0); // fullscreen triangle
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    console.log("WebGPU ray-tracing compute + render dispatched!");
}



function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();
