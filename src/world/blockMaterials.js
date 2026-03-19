import * as THREE from "../lib/three.js";

function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255,
  };
}

function clampByte(v) {
  return Math.max(0, Math.min(255, v | 0));
}

function createTexture(size, drawPixel) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const data = image.data;

  let i = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pixel = drawPixel(x, y);
      data[i++] = pixel.r;
      data[i++] = pixel.g;
      data[i++] = pixel.b;
      data[i++] = pixel.a ?? 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makeNoiseTexture(baseHex, range = 20, size = 16) {
  const base = hexToRgb(baseHex);
  return createTexture(size, (x, y) => {
    const n = Math.sin((x + 1.23) * 12.9898 + (y + 4.56) * 78.233) * 43758.5453;
    const frac = n - Math.floor(n);
    const delta = (frac - 0.5) * range * 2;
    return {
      r: clampByte(base.r + delta),
      g: clampByte(base.g + delta),
      b: clampByte(base.b + delta),
      a: 255,
    };
  });
}

function makeGrassSideTexture() {
  const dirt = hexToRgb(0x8b5a2b);
  const grass = hexToRgb(0x65b84f);
  return createTexture(16, (x, y) => {
    const n = Math.sin((x + 2.1) * 19.17 + (y + 3.8) * 47.63) * 14375.13;
    const frac = n - Math.floor(n);

    if (y < 4) {
      const delta = (frac - 0.5) * 34;
      return {
        r: clampByte(grass.r + delta),
        g: clampByte(grass.g + delta),
        b: clampByte(grass.b + delta),
        a: 255,
      };
    }

    const delta = (frac - 0.5) * 28;
    const grassBlend = y < 7 ? (7 - y) / 3 : 0;
    return {
      r: clampByte(dirt.r + delta + grassBlend * 30),
      g: clampByte(dirt.g + delta + grassBlend * 35),
      b: clampByte(dirt.b + delta + grassBlend * 10),
      a: 255,
    };
  });
}

function makeWoodSideTexture() {
  const base = hexToRgb(0x8a5a2a);
  return createTexture(16, (x, y) => {
    const stripe = Math.sin((x / 16) * Math.PI * 8) * 14;
    const n = Math.sin((x + 0.1) * 11.1 + (y + 0.7) * 71.7) * 9173.23;
    const frac = n - Math.floor(n);
    const delta = (frac - 0.5) * 16 + stripe;
    return {
      r: clampByte(base.r + delta),
      g: clampByte(base.g + delta * 0.7),
      b: clampByte(base.b + delta * 0.45),
      a: 255,
    };
  });
}

function makeWoodTopTexture() {
  const base = hexToRgb(0xa06e35);
  return createTexture(16, (x, y) => {
    const cx = x - 7.5;
    const cy = y - 7.5;
    const dist = Math.sqrt(cx * cx + cy * cy);
    const rings = Math.sin(dist * 2.4) * 18;
    const n = Math.sin((x + 1.7) * 33.7 + (y + 9.1) * 41.2) * 7531.33;
    const frac = n - Math.floor(n);
    const delta = rings + (frac - 0.5) * 10;
    return {
      r: clampByte(base.r + delta),
      g: clampByte(base.g + delta * 0.7),
      b: clampByte(base.b + delta * 0.4),
      a: 255,
    };
  });
}

function makeCraftingTopTexture() {
  const base = hexToRgb(0xb78952);
  return createTexture(16, (x, y) => {
    const grid = ((x % 4 === 0) || (y % 4 === 0)) ? -18 : 0;
    const n = Math.sin((x + 3.3) * 17.1 + (y + 6.6) * 52.4) * 6123.1;
    const frac = n - Math.floor(n);
    const delta = (frac - 0.5) * 12 + grid;
    return {
      r: clampByte(base.r + delta),
      g: clampByte(base.g + delta * 0.8),
      b: clampByte(base.b + delta * 0.55),
      a: 255,
    };
  });
}

function makeLeavesTexture() {
  const base = hexToRgb(0x3f8f45);
  return createTexture(16, (x, y) => {
    const n = Math.sin((x + 7.2) * 18.3 + (y + 1.4) * 61.8) * 9217.1;
    const frac = n - Math.floor(n);
    if (frac > 0.88) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const delta = (frac - 0.5) * 26;
    return {
      r: clampByte(base.r + delta),
      g: clampByte(base.g + delta),
      b: clampByte(base.b + delta * 0.55),
      a: 255,
    };
  });
}

function mat(texture, extra = {}) {
  return new THREE.MeshLambertMaterial({ map: texture, ...extra });
}

export function createBlockMaterials() {
  const dirt = makeNoiseTexture(0x8b5a2b, 24);
  const grassTop = makeNoiseTexture(0x65b84f, 24);
  const grassSide = makeGrassSideTexture();
  const stone = makeNoiseTexture(0x8f8f8f, 18);
  const sand = makeNoiseTexture(0xd8c07a, 12);
  const woodSide = makeWoodSideTexture();
  const woodTop = makeWoodTopTexture();
  const craftingTop = makeCraftingTopTexture();
  const leaves = makeLeavesTexture();

  return {
    dirt: mat(dirt),
    grass: [
      mat(grassSide),
      mat(grassSide),
      mat(grassTop),
      mat(dirt),
      mat(grassSide),
      mat(grassSide),
    ],
    stone: mat(stone),
    sand: mat(sand),
    wood: [
      mat(woodSide),
      mat(woodSide),
      mat(woodTop),
      mat(woodTop),
      mat(woodSide),
      mat(woodSide),
    ],
    crafting_table: [
      mat(woodSide),
      mat(woodSide),
      mat(craftingTop),
      mat(woodTop),
      mat(woodSide),
      mat(woodSide),
    ],
    leaves: mat(leaves, { transparent: true, alphaTest: 0.5 }),
  };
}
