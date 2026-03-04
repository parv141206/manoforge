"use client";

import { useEffect, useRef } from "react";

export default function ShaderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }

    let program: WebGLProgram;
    let animationFrameId: number;

    const vertexShaderSource = `#version 300 es
    precision mediump float;
    layout(location = 0) in vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }`;

    async function init(
      glContext: WebGL2RenderingContext,
      canvasElement: HTMLCanvasElement,
    ) {
      const fragRes = await fetch("/shaders/stars.frag");
      const fragmentShaderSource = await fragRes.text();

      const vertexShader = createShader(
        glContext,
        glContext.VERTEX_SHADER,
        vertexShaderSource,
      );
      const fragmentShader = createShader(
        glContext,
        glContext.FRAGMENT_SHADER,
        fragmentShaderSource,
      );

      if (!vertexShader || !fragmentShader) return;

      const createdProgram = createProgram(
        glContext,
        vertexShader,
        fragmentShader,
      );
      if (!createdProgram) return;

      program = createdProgram;

      const positionBuffer = glContext.createBuffer();
      glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);

      glContext.bufferData(
        glContext.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        glContext.STATIC_DRAW,
      );

      glContext.useProgram(program);

      const positionLocation = 0;
      glContext.enableVertexAttribArray(positionLocation);
      glContext.vertexAttribPointer(
        positionLocation,
        2,
        glContext.FLOAT,
        false,
        0,
        0,
      );

      const resolutionLocation = glContext.getUniformLocation(
        program,
        "u_resolution",
      );
      const timeLocation = glContext.getUniformLocation(program, "u_time");

      function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvasElement.width = canvasElement.clientWidth * dpr;
        canvasElement.height = canvasElement.clientHeight * dpr;
        glContext.viewport(0, 0, canvasElement.width, canvasElement.height);
      }

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      const start = performance.now();

      function render() {
        const now = performance.now();
        const time = (now - start) / 1000;

        glContext.useProgram(program);

        glContext.uniform2f(
          resolutionLocation,
          canvasElement.width,
          canvasElement.height,
        );
        glContext.uniform1f(timeLocation, time);

        glContext.drawArrays(glContext.TRIANGLES, 0, 6);

        animationFrameId = requestAnimationFrame(render);
      }

      render();
    }

    void init(gl, canvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-screen w-full" />;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}
