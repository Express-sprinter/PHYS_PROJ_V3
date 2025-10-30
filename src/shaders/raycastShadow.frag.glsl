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
