import * as THREE from "../lib/three.js";

function makeCrackTexture(level, size = 32) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(20,20,20,0.95)";
  ctx.lineCap = "square";

  const lines = 6 + level * 2;
  const jitter = 0.35 + level * 0.06;

  for (let i = 0; i < lines; i++) {
    const x0 = Math.random() * size;
    const y0 = Math.random() * size;
    const x1 = Math.random() * size;
    const y1 = Math.random() * size;

    ctx.lineWidth = level < 4 ? 1 : 1 + (i % 2 === 0 ? 1 : 0);
    ctx.beginPath();
    ctx.moveTo(x0, y0);

    const segments = 3 + Math.floor(level / 2);
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const x = x0 + (x1 - x0) * t + (Math.random() - 0.5) * size * jitter * 0.08;
      const y = y0 + (y1 - y0) * t + (Math.random() - 0.5) * size * jitter * 0.08;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createCrackTextures(steps = 10) {
  const textures = [];
  for (let i = 0; i < steps; i++) {
    textures.push(makeCrackTexture(i));
  }
  return textures;
}

