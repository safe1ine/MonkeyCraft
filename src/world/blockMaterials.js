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

function mat(texture, extra = {}) {
  return new THREE.MeshLambertMaterial({ map: texture, ...extra });
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
  const woodSide = loadTexture("../../assets/minecraft/textures/block/oak_log.png");
  const woodTop = loadTexture(
    "../../assets/minecraft/textures/block/oak_log_top.png"
  );
  const leaves = loadTexture(
    "../../assets/minecraft/textures/block/oak_leaves.png"
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
    wood: [
      mat(woodSide),
      mat(woodSide),
      mat(woodTop),
      mat(woodTop),
      mat(woodSide),
      mat(woodSide),
    ],
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
  };
}
