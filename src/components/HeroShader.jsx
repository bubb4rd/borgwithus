import { useEffect, useRef } from "react";

// Screenprinted "poured borg": a domain-warped liquid field posterized into
// flat blue ink tones, halftone dots where tones meet, a misregistered acid
// pass, and ragged grit that reboils every frame. Colours mirror :root tokens.
const VERTEX = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uFrame;
out vec4 outColor;

const vec3 INK  = vec3(0.110, 0.106, 0.129); // --ink-soft
const vec3 DEEP = vec3(0.039, 0.310, 0.588); // --blue-deep
const vec3 BLUE = vec3(0.106, 0.608, 0.941); // --blue
const vec3 ACID = vec3(1.000, 0.416, 0.169); // --acid
const vec3 NAVY = mix(INK, DEEP, 0.45);

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i), f), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  const mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p;
    a *= 0.5;
  }
  return v;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Clustered-dot threshold in [0, 1): low at dot centres, so dots grow outward.
float halftone(vec2 frag, float cell, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  vec2 g = fract(mat2(c, s, -s, c) * frag / cell) - 0.5;
  return min(dot(g, g) * 2.0, 0.999);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.05;

  vec2 p = uv * 1.5;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + 0.7 * t),
                fbm(p + 3.0 * q + vec2(8.3, 2.8) - 0.5 * t));
  float f = 0.5 + fbm(p + 3.0 * r);

  // Pool of ink behind the jug (sits at 42.5% across the stage).
  vec2 c = uv - vec2(-0.075 * uRes.x / uRes.y, 0.03);
  float glow = exp(-dot(c, c) * 2.4);

  // Tone: liquid field, pooled at the jug, faded at the edges and the floor
  // so the lede stays legible.
  float v = smoothstep(0.3, 0.8, f) * (0.35 + 0.65 * glow);
  v *= 1.0 - 0.6 * smoothstep(0.25, 1.25, length(uv * vec2(0.75, 1.0)));
  v *= 1.0 - 0.6 * (1.0 - smoothstep(-0.5, 0.05, uv.y));

  // Grit: worn-screen blotches plus per-pixel tooth, reseeded per frame.
  vec2 seed = vec2(hash(vec2(uFrame, 1.0)), hash(vec2(uFrame, 2.0))) * 512.0;
  float grit = noise(frag * 0.09 + seed) * 0.3 + (hash(frag + seed) - 0.5) * 0.2;

  // Posterize into four ink tones; only the seams between tones get halftoned.
  float bands = v * 3.0;
  float seam = smoothstep(0.4, 0.6, fract(bands));
  // Clamped above zero so grit roughens dots but never inks a zero-coverage area.
  float th = clamp(halftone(frag, 6.0, 0.26) + grit, 0.001, 1.0);
  float level = floor(bands) + step(th, seam);
  level = clamp(level, 0.0, 3.0);

  vec3 col = level < 0.5 ? INK : level < 1.5 ? NAVY : level < 2.5 ? DEEP : BLUE;

  // Second drum: sparse acid dots on their own screen angle, nudged off the
  // blue plate like a misregistered print.
  float streak = smoothstep(0.15, 0.35, r.y) * smoothstep(0.45, 0.75, v + 0.15 * glow);
  float acidTh = clamp(halftone(frag + vec2(3.0, -2.0), 9.0, 0.79) + grit * 0.6, 0.001, 1.0);
  float acid = step(acidTh, streak * 0.3);
  col = mix(col, ACID, acid);

  outColor = vec4(col, 1.0);
}`;

// Stepped like stop-motion print; also caps GPU work at FPS draws a second.
const FPS = 12;
// Composition shown when motion is reduced.
const STILL_FRAME = 14 * FPS;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(gl) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export default function HeroShader() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    // No WebGL2: the card's flat CSS background shows instead.
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return undefined;
    const program = link(gl);
    if (!program) return undefined;

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One oversized triangle covers the viewport.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uFrame = gl.getUniformLocation(program, "uFrame");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let elapsed = 0;
    let last = 0;
    let onScreen = true;

    const draw = (index) => {
      gl.uniform1f(uTime, index / FPS);
      gl.uniform1f(uFrame, index);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.classList.add("is-ready");
    };

    let drawn = -1;
    const tick = (now) => {
      elapsed += (now - last) / 1000;
      last = now;
      const index = Math.floor(elapsed * FPS);
      if (index !== drawn) {
        drawn = index;
        draw(index);
      }
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const sync = () => {
      if (reduceMotion.matches) {
        stop();
        draw(STILL_FRAME);
      } else if (onScreen && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      } else if (!onScreen) {
        stop();
      }
    };

    // One canvas pixel per CSS pixel, upscaled pixelated on high-DPR screens:
    // chunkier print texture and bounded fragment cost.
    const resize = () => {
      const width = Math.max(1, Math.round(canvas.clientWidth));
      const height = Math.max(1, Math.round(canvas.clientHeight));
      // Size can already match on a remount, but the new program still needs uRes.
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uRes, width, height);
      // Resizing clears the canvas; repaint now rather than on the next step.
      draw(reduceMotion.matches ? STILL_FRAME : Math.floor(elapsed * FPS));
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    visibility.observe(canvas);

    const onContextLost = () => {
      stop();
      canvas.classList.remove("is-ready");
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    reduceMotion.addEventListener("change", sync);

    resize();
    sync();

    return () => {
      stop();
      resizeObserver.disconnect();
      visibility.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      reduceMotion.removeEventListener("change", sync);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-shader" aria-hidden="true" />;
}
