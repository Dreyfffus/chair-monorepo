import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import VERT_SRC from "../shaders/session.vert?raw";
import FRAG_SRC from "../shaders/session.frag?raw";

interface HSL {
  h: number;
  s: number;
  l: number;
}

function parseToHsl(color: string): HSL {
  const m = color.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
  if (m) return { h: +m[1], s: +m[2] / 100, l: +m[3] / 100 };

  const hex = color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lv = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lv };
  const d = max - min;
  const sv = lv > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hv = 0;
  if (max === r) hv = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hv = ((b - r) / d + 2) / 6;
  else hv = ((r - g) / d + 4) / 6;
  return { h: hv * 360, s: sv, l: lv };
}

function shortHueDelta(a: HSL, b: HSL): number {
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return dh;
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? "Shader error");
  return s;
}

function buildProgram(gl: WebGLRenderingContext): WebGLProgram {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? "Link error");
  return p;
}

export function useWebGLSession(
  canvasRef: RefObject<HTMLCanvasElement>,
  lightColor: string,
  bgColor: string,
  total: number,
  onComplete: (elapsed: number) => void,
) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.warn("WebGL Unavailable");
      return;
    }

    const lightHsl = parseToHsl(lightColor);
    const bgHsl = parseToHsl(bgColor);
    const hueDelta = shortHueDelta(lightHsl, bgHsl);

    let prog: WebGLProgram;
    try {
      prog = buildProgram(gl);
    } catch (e) {
      console.error(e);
      return;
    }

    gl.useProgram(prog);

    // Fullscreen quad — two triangles
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const posLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uProgress = gl.getUniformLocation(prog, "u_progress");
    const uLight = gl.getUniformLocation(prog, "u_light_hsl");
    const uBg = gl.getUniformLocation(prog, "u_bg_hsl");
    const uHueDelta = gl.getUniformLocation(prog, "u_hue_delta");

    // Static uniforms — set once
    gl.uniform3f(uLight, lightHsl.h, lightHsl.s, lightHsl.l);
    gl.uniform3f(uBg, bgHsl.h, bgHsl.s, bgHsl.l);
    gl.uniform1f(uHueDelta, hueDelta);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const sessionStart = Date.now();
    let rafTs0 = 0;
    let raf: number;
    let completed = false;

    const tick = (ts: number) => {
      if (rafTs0 === 0) rafTs0 = ts;
      const relTime = (ts - rafTs0) / 1000;
      const elapsed = (Date.now() - sessionStart) / 1000;
      const progress = Math.min(elapsed / total, 1);

      gl.uniform1f(uTime, relTime);
      gl.uniform1f(uProgress, progress);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (progress >= 1 && !completed) {
        completed = true;
        onCompleteRef.current(Math.round(elapsed));
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, []);
}
