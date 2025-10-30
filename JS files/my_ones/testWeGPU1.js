import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let device, context, pipeline;
let vertexBuffer, indexBuffer, indexCount;


if (!navigator.gpu) {
  console.error("WebGPU not supported in this browser!");
}


const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

context = canvas.getContext("webgpu");


const adapter = await navigator.gpu.requestAdapter();
device = await adapter.requestDevice();

context.configure({
  device: device,
  format: navigator.gpu.getPreferredCanvasFormat(),
  alphaMode: "opaque"
});




const loader = new OBJLoader();
function loadMesh(url, scale = 0.03) {
  loader.load(url, (obj) => {
    const mesh = obj.children.find(c => c.isMesh);
    if (!mesh) return console.error("No mesh found in OBJ");

    const geom = mesh.geometry;
    const posAttr = geom.attributes.position;

    // Create vertex array with scaling
    const vertices = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      vertices[i*3 + 0] = posAttr.getX(i) * scale;
      vertices[i*3 + 1] = posAttr.getY(i) * scale;
      vertices[i*3 + 2] = posAttr.getZ(i) * scale;
    }

    // Create index array (typed for WebGPU)
    let indices = geom.index ? geom.index.array : Array.from({ length: posAttr.count }, (_, i) => i);
    indices = new Uint32Array(indices);

    // ---------- CREATE BUFFERS ----------
    vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();

    indexCount = indices.length;
    indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint32Array(indexBuffer.getMappedRange()).set(indices);
    indexBuffer.unmap();

    // ---------- SETUP PIPELINE ----------
    setupPipeline();
    draw();
  });
}





// ---------- SIMPLE SHADER ----------
function setupPipeline() {
  const shaderModule = device.createShaderModule({
    code: `
@vertex
fn vs_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
  return vec4(position, 1.0);
}

@fragment
fn fs_main(@builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
  // Simple random per-fragment colour
  let r = fract(sin(frag_coord.x * 12.9898 + frag_coord.y * 78.233) * 43758.5453);
  if (r > 0.5) {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0); // Red
  }
  return vec4<f32>(0.0, 0.0, 1.0, 1.0); // Blue
}

`
  });

  pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [{
        arrayStride: 12,
        attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }]
      }]
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
    },
    primitive: { topology: "triangle-list" }
  });
}

// ---------- DRAW LOOP ----------
function draw() {
  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
      storeOp: "store"
    }]
  });

  renderPass.setPipeline(pipeline);
  renderPass.setVertexBuffer(0, vertexBuffer);
  renderPass.setIndexBuffer(indexBuffer, "uint32");
  renderPass.drawIndexed(indexCount);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(draw);
}


loadMesh("/models/sphere.obj"); 
loadMesh("/models/cube.obj"); 