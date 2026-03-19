import * as THREE from "../lib/three.js";

function loadTexture(relativePath) {
  const texture = new THREE.TextureLoader().load(
    new URL(relativePath, import.meta.url).href
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function loadVerticalSpriteFrame(relativePath, frameSize = 16, frameIndex = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = frameSize;
  canvas.height = frameSize;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  new THREE.ImageLoader().load(new URL(relativePath, import.meta.url).href, (image) => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, frameSize, frameSize);
    ctx.drawImage(
      image,
      0,
      frameIndex * frameSize,
      frameSize,
      frameSize,
      0,
      0,
      frameSize,
      frameSize
    );
    texture.needsUpdate = true;
  });

  return texture;
}

function mat(texture, extra = {}) {
  return new THREE.MeshLambertMaterial({ map: texture, ...extra });
}

function colorMat(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}

function createFlowerTexture(petalColor) {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = "#3f8d3f";
  ctx.fillRect(7, 5, 2, 11);
  ctx.fillStyle = "#5ca54f";
  ctx.fillRect(6, 9, 2, 1);
  ctx.fillRect(8, 10, 2, 1);
  ctx.fillRect(6, 12, 2, 1);
  ctx.fillRect(8, 13, 2, 1);

  ctx.fillStyle = petalColor;
  ctx.fillRect(6, 2, 2, 2);
  ctx.fillRect(8, 2, 2, 2);
  ctx.fillRect(5, 4, 2, 2);
  ctx.fillRect(9, 4, 2, 2);
  ctx.fillRect(7, 4, 2, 2);

  ctx.fillStyle = "#f5d76e";
  ctx.fillRect(7, 3, 2, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createBlockMaterials() {
  const bedrock = loadTexture(
    "../../assets/minecraft/textures/block/bedrock.png"
  );
  const dirt = loadTexture("../../assets/minecraft/textures/block/dirt.png");
  const grassTop = loadTexture(
    "../../assets/minecraft/textures/block/grass_block_top.png"
  );
  const grassSide = loadTexture(
    "../../assets/minecraft/textures/block/grass_block_side.png"
  );
  const stone = loadTexture("../../assets/minecraft/textures/block/stone.png");
  const sand = loadTexture("../../assets/minecraft/textures/block/sand.png");
  const waterStill = loadVerticalSpriteFrame(
    "../../assets/minecraft/textures/block/water_still.png"
  );
  const woodSide = loadTexture("../../assets/minecraft/textures/block/oak_log.png");
  const woodTop = loadTexture(
    "../../assets/minecraft/textures/block/oak_log_top.png"
  );
  const leaves = loadTexture(
    "../../assets/minecraft/textures/block/oak_leaves.png"
  );
  const birchWoodSide = loadTexture(
    "../../assets/minecraft/textures/block/birch_log.png"
  );
  const birchWoodTop = loadTexture(
    "../../assets/minecraft/textures/block/birch_log_top.png"
  );
  const birchLeaves = loadTexture(
    "../../assets/minecraft/textures/block/birch_leaves.png"
  );
  const shortGrass = loadTexture(
    "../../assets/minecraft/textures/block/short_grass.png"
  );
  const sugarCane = loadTexture(
    "../../assets/minecraft/textures/block/sugar_cane.png"
  );
  const craftingTop = loadTexture(
    "../../assets/minecraft/textures/block/crafting_table_top.png"
  );
  const craftingSide = loadTexture(
    "../../assets/minecraft/textures/block/crafting_table_side.png"
  );
  const craftingFront = loadTexture(
    "../../assets/minecraft/textures/block/crafting_table_front.png"
  );
  const grassTint = new THREE.Color(0x91bd59);
  const leavesTint = new THREE.Color(0x77ab2f);
  const flowerRed = createFlowerTexture("#d84b55");
  const flowerYellow = createFlowerTexture("#efcf52");
  const flowerBlue = createFlowerTexture("#5d82de");
  const flowerWhite = createFlowerTexture("#f0f3f8");
  const plantExtra = {
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  };

  return {
    bedrock: mat(bedrock),
    dirt: mat(dirt),
    grass: [
      mat(grassSide, { color: grassTint }),
      mat(grassSide, { color: grassTint }),
      mat(grassTop, { color: grassTint }),
      mat(dirt),
      mat(grassSide, { color: grassTint }),
      mat(grassSide, { color: grassTint }),
    ],
    stone: mat(stone),
    sand: mat(sand),
    water: {
      top: mat(waterStill, {
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
        color: new THREE.Color(0x2f63cf),
      }),
    },
    wood: [
      mat(woodSide),
      mat(woodSide),
      mat(woodTop),
      mat(woodTop),
      mat(woodSide),
      mat(woodSide),
    ],
    oak_log: [
      mat(woodSide),
      mat(woodSide),
      mat(woodTop),
      mat(woodTop),
      mat(woodSide),
      mat(woodSide),
    ],
    oak_leaves: mat(leaves, {
      color: leavesTint,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
    birch_log: [
      mat(birchWoodSide),
      mat(birchWoodSide),
      mat(birchWoodTop),
      mat(birchWoodTop),
      mat(birchWoodSide),
      mat(birchWoodSide),
    ],
    birch_leaves: mat(birchLeaves, {
      color: new THREE.Color(0x8ebf4d),
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
    crafting_table: [
      mat(craftingSide),
      mat(craftingSide),
      mat(craftingTop),
      mat(craftingSide),
      mat(craftingFront),
      mat(craftingFront),
    ],
    leaves: mat(leaves, {
      color: leavesTint,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
    short_grass: mat(shortGrass, { ...plantExtra, color: grassTint }),
    sugar_cane: mat(sugarCane, plantExtra),
    flower_red: mat(flowerRed, plantExtra),
    flower_yellow: mat(flowerYellow, plantExtra),
    flower_blue: mat(flowerBlue, plantExtra),
    flower_white: mat(flowerWhite, plantExtra),
  };
}
