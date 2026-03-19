import * as THREE from "../lib/three.js";
import { BLOCKS, WORLD_CONFIG } from "../constants.js";
import { createBlockMaterials } from "./blockMaterials.js";
import { chunkKey, floorDiv, localKey, mod } from "./math.js";

const NEIGHBORS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export class World {
  constructor(scene, saveStore) {
    this.scene = scene;
    this.saveStore = saveStore;

    this.chunkSize = WORLD_CONFIG.chunkSize;
    this.maxHeight = WORLD_CONFIG.maxHeight;
    this.renderDistance = WORLD_CONFIG.renderDistance;
    this.seaLevel = WORLD_CONFIG.seaLevel;
    this.seed = WORLD_CONFIG.seed;

    this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.plantGeometry = new THREE.PlaneGeometry(1, 1);
    this.waterGeometry = new THREE.PlaneGeometry(1, 1);
    this.waterSideGeometry = new THREE.PlaneGeometry(1, 0.86);
    this.materials = createBlockMaterials();

    this.activeChunks = new Map();
    this.loadingChunks = new Set();
  }

  setSeed(seed) {
    this.seed = seed;
  }

  resetLoadedChunks() {
    for (const chunk of this.activeChunks.values()) {
      for (const mesh of chunk.meshes.values()) {
        this.scene.remove(mesh);
      }
    }
    this.activeChunks.clear();
    this.loadingChunks.clear();
  }

  getChunkCoords(x, z) {
    return {
      cx: floorDiv(x, this.chunkSize),
      cz: floorDiv(z, this.chunkSize),
      lx: mod(x, this.chunkSize),
      lz: mod(z, this.chunkSize),
    };
  }

  getChunk(cx, cz) {
    return this.activeChunks.get(chunkKey(cx, cz));
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= this.maxHeight) return null;
    const { cx, cz, lx, lz } = this.getChunkCoords(x, z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return null;
    return chunk.blocks.get(localKey(lx, y, lz)) || null;
  }

  isSolidAt(x, y, z) {
    const block = this.getBlock(x, y, z);
    if (!block) return false;
    return BLOCKS[block]?.solid ?? true;
  }

  isBlockExposed(x, y, z) {
    const type = this.getBlock(x, y, z);
    if (!type) return false;
    if (BLOCKS[type]?.renderType === "cross") return true;
    if (type === "water") {
      return this.getBlock(x, y + 1, z) !== "water";
    }

    for (const [dx, dy, dz] of NEIGHBORS) {
      const neighbor = this.getBlock(x + dx, y + dy, z + dz);
      if (!neighbor || BLOCKS[neighbor]?.occludes === false) {
        return true;
      }
    }
    return false;
  }

  createCrossPlantObject(type, x, y, z) {
    const group = new THREE.Group();
    const material = this.materials[type] || this.materials.flower_red;
    const planeA = new THREE.Mesh(this.plantGeometry, material);
    const planeB = new THREE.Mesh(this.plantGeometry, material);
    planeA.position.set(0, 0.48, 0);
    planeB.position.set(0, 0.48, 0);
    planeA.rotation.y = Math.PI / 4;
    planeB.rotation.y = -Math.PI / 4;
    group.add(planeA, planeB);
    group.position.set(x + 0.5, y, z + 0.5);
    group.userData.blockPos = { x, y, z };
    group.userData.blockType = type;
    return group;
  }

  createWaterObject(x, y, z) {
    const group = new THREE.Group();

    const top = new THREE.Mesh(this.waterGeometry, this.materials.water.top);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0.5, 0.86, 0.5);
    group.add(top);

    const sideDefs = [
      { dx: 1, dz: 0, px: 1, pz: 0.5, ry: -Math.PI / 2 },
      { dx: -1, dz: 0, px: 0, pz: 0.5, ry: Math.PI / 2 },
      { dx: 0, dz: 1, px: 0.5, pz: 1, ry: Math.PI },
      { dx: 0, dz: -1, px: 0.5, pz: 0, ry: 0 },
    ];

    for (const sideDef of sideDefs) {
      const neighbor = this.getBlock(x + sideDef.dx, y, z + sideDef.dz);
      if (neighbor === "water") continue;

      const side = new THREE.Mesh(this.waterSideGeometry, this.materials.water.side);
      side.position.set(sideDef.px, 0.43, sideDef.pz);
      side.rotation.y = sideDef.ry;
      group.add(side);
    }

    group.position.set(x, y, z);
    group.userData.blockPos = { x, y, z };
    group.userData.blockType = "water";
    return group;
  }

  createBlockObject(type, x, y, z) {
    if (type === "water") {
      return this.createWaterObject(x, y, z);
    }
    if (BLOCKS[type]?.renderType === "cross") {
      return this.createCrossPlantObject(type, x, y, z);
    }

    const mesh = new THREE.Mesh(this.cubeGeometry, this.materials[type] || this.materials.dirt);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.userData.blockPos = { x, y, z };
    mesh.userData.blockType = type;
    return mesh;
  }

  ensureBlockMesh(x, y, z, type) {
    const { cx, cz } = this.getChunkCoords(x, z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;

    const globalKey = `${x},${y},${z}`;
    const existing = chunk.meshes.get(globalKey);

    if (!this.isBlockExposed(x, y, z)) {
      if (existing) {
        this.scene.remove(existing);
        chunk.meshes.delete(globalKey);
      }
      return;
    }

    if (existing?.userData?.blockType === type) return;
    if (existing) {
      this.scene.remove(existing);
      chunk.meshes.delete(globalKey);
    }

    const obj = this.createBlockObject(type, x, y, z);
    this.scene.add(obj);
    chunk.meshes.set(globalKey, obj);
  }

  removeBlockMesh(x, y, z) {
    const { cx, cz } = this.getChunkCoords(x, z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const globalKey = `${x},${y},${z}`;
    const mesh = chunk.meshes.get(globalKey);
    if (!mesh) return;
    this.scene.remove(mesh);
    chunk.meshes.delete(globalKey);
  }

  updateBlockVisualAndNeighbors(x, y, z) {
    const type = this.getBlock(x, y, z);
    if (type) {
      this.ensureBlockMesh(x, y, z, type);
    } else {
      this.removeBlockMesh(x, y, z);
    }

    for (const [dx, dy, dz] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      const neighborType = this.getBlock(nx, ny, nz);
      if (neighborType) {
        this.ensureBlockMesh(nx, ny, nz, neighborType);
      } else {
        this.removeBlockMesh(nx, ny, nz);
      }
    }
  }

  setBlock(x, y, z, type, options = {}) {
    if (y < 0 || y >= this.maxHeight) return false;
    const { cx, cz, lx, lz } = this.getChunkCoords(x, z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return false;

    const key = localKey(lx, y, lz);
    if (type) {
      chunk.blocks.set(key, type);
    } else {
      chunk.blocks.delete(key);
    }

    chunk.dirty = !options.skipDirty;
    this.updateBlockVisualAndNeighbors(x, y, z);

    if (chunk.dirty && this.saveStore) {
      this.saveStore.scheduleChunkSave(chunk.key, this.serializeChunk(chunk));
    }

    return true;
  }

  serializeChunk(chunk) {
    const blocks = [];
    for (const [key, type] of chunk.blocks.entries()) {
      const [lx, y, lz] = key.split(",").map(Number);
      blocks.push([lx, y, lz, type]);
    }
    return { blocks };
  }

  deserializeBlocks(payload) {
    const blocks = new Map();
    if (!payload || !Array.isArray(payload.blocks)) return blocks;
    for (const row of payload.blocks) {
      if (!Array.isArray(row) || row.length !== 4) continue;
      const [lx, y, lz, type] = row;
      blocks.set(localKey(lx, y, lz), type);
    }
    return blocks;
  }

  terrainHeight(x, z) {
    const lowlands =
      Math.sin((x + this.seed) * 0.12) * 2.8 +
      Math.cos((z - this.seed) * 0.11) * 2.5 +
      Math.sin((x + z) * 0.05) * 2.2;
    const hills =
      Math.sin((x - this.seed * 0.4) * 0.045) * 6.0 +
      Math.cos((z + this.seed * 0.3) * 0.05) * 5.5;
    const mountainMask = Math.max(
      0,
      Math.sin((x + this.seed * 0.2) * 0.018) +
        Math.cos((z - this.seed * 0.15) * 0.02) -
        0.1
    );
    const ridges =
      Math.abs(Math.sin((x + z + this.seed) * 0.022)) * 10 +
      Math.abs(Math.cos((x - z - this.seed) * 0.018)) * 8;
    const h = Math.floor(12 + lowlands + hills + mountainMask * ridges);
    return Math.max(4, Math.min(this.maxHeight - 3, h));
  }

  hash2(x, z) {
    const v = Math.sin((x + this.seed * 13.37) * 127.1 + (z - this.seed * 7.11) * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }

  noise3(x, y, z) {
    const v =
      Math.sin((x + this.seed * 0.71) * 12.9898 + y * 78.233 + (z - this.seed * 0.37) * 37.719) *
      43758.5453;
    return v - Math.floor(v);
  }

  surfaceType(x, z) {
    const height = this.terrainHeight(x, z);
    const biomeNoise = Math.sin((x + this.seed) * 0.05) + Math.cos((z - this.seed) * 0.06);
    if (height <= this.seaLevel) return "sand";
    if (biomeNoise > 1.0) return "sand";
    if (biomeNoise < -1.1) return "stone";
    return "grass";
  }

  floodNoise(x, z) {
    return (
      Math.sin((x - this.seed * 0.23) * 0.032) +
      Math.cos((z + this.seed * 0.19) * 0.029) +
      this.hash2(x * 0.71 + 17, z * 0.67 - 11) * 0.72
    );
  }

  isFloodSeed(x, z, height) {
    if (height >= this.seaLevel) return false;
    if (height <= this.seaLevel - 4) return true;
    return this.floodNoise(x, z) > 1.15;
  }

  getGeneratedBlockType(x, y, z) {
    if (y <= 0) return "bedrock";
    if (y >= this.maxHeight) return null;

    const height = this.terrainHeight(x, z);
    if (y > height) return null;

    const surface = this.surfaceType(x, z);
    if (y === height) return surface;
    if (y < height - 2) {
      if (this.shouldCarveCave(x, y, z, height)) return null;
      return "stone";
    }
    return "dirt";
  }

  buildFloodedCells(baseX, baseZ) {
    const flooded = new Set();
    const queue = [];

    for (let lx = -1; lx <= this.chunkSize; lx++) {
      for (let lz = -1; lz <= this.chunkSize; lz++) {
        const gx = baseX + lx;
        const gz = baseZ + lz;
        const height = this.terrainHeight(gx, gz);
        if (!this.isFloodSeed(gx, gz, height)) continue;
        const startY = this.seaLevel;
        const startKey = `${lx},${startY},${lz}`;
        flooded.add(startKey);
        queue.push([lx, startY, lz]);
      }
    }

    while (queue.length > 0) {
      const [lx, y, lz] = queue.shift();
      const neighbors = [
        [lx + 1, y, lz],
        [lx - 1, y, lz],
        [lx, y, lz + 1],
        [lx, y, lz - 1],
        [lx, y - 1, lz],
      ];

      for (const [nx, ny, nz] of neighbors) {
        if (ny <= 0 || ny > this.seaLevel) continue;
        if (nx < -1 || nx > this.chunkSize || nz < -1 || nz > this.chunkSize) continue;

        const gx = baseX + nx;
        const gz = baseZ + nz;
        if (this.getGeneratedBlockType(gx, ny, gz)) continue;

        const neighborKey = `${nx},${ny},${nz}`;
        if (flooded.has(neighborKey)) continue;
        flooded.add(neighborKey);
        queue.push([nx, ny, nz]);
      }
    }

    return flooded;
  }

  fillFloodedCells(blocks, floodedCells) {
    for (const key of floodedCells) {
      const [lx, y, lz] = key.split(",").map(Number);
      if (lx < 0 || lx >= this.chunkSize || lz < 0 || lz >= this.chunkSize) {
        continue;
      }
      const blockKey = localKey(lx, y, lz);
      if (!blocks.has(blockKey)) {
        blocks.set(blockKey, "water");
      }
    }
  }

  buildTerrainBlocks(baseX, baseZ) {
    const blocks = new Map();

    for (let lx = 0; lx < this.chunkSize; lx++) {
      for (let lz = 0; lz < this.chunkSize; lz++) {
        const gx = baseX + lx;
        const gz = baseZ + lz;
        const height = this.terrainHeight(gx, gz);
        const surface = this.surfaceType(gx, gz);
        blocks.set(localKey(lx, 0, lz), "bedrock");

        for (let y = 1; y <= height; y++) {
          let type = "dirt";
          if (y === height) type = surface;
          else if (y < height - 2) type = "stone";
          if (type === "stone" && this.shouldCarveCave(gx, y, gz, height)) continue;
          blocks.set(localKey(lx, y, lz), type);
        }
      }
    }

    return blocks;
  }

  isAdjacentToWater(blocks, lx, y, lz) {
    const neighbors = [
      [lx + 1, y, lz],
      [lx - 1, y, lz],
      [lx, y, lz + 1],
      [lx, y, lz - 1],
    ];
    return neighbors.some(([nx, ny, nz]) => blocks.get(localKey(nx, ny, nz)) === "water");
  }

  shouldCarveCave(x, y, z, surfaceHeight) {
    if (y <= 2 || y >= surfaceHeight - 3) return false;
    const tunnelA = this.noise3(x * 0.085, y * 0.14, z * 0.085);
    const tunnelB = this.noise3(x * 0.045 + 31, y * 0.12 + 17, z * 0.045 - 29);
    const worm = Math.abs(Math.sin(x * 0.09 + z * 0.07 + y * 0.22 + this.seed * 0.01));
    return tunnelA > 0.79 && tunnelB > 0.7 && worm > 0.42;
  }

  flowerTypeAt(x, z) {
    const palette = ["flower_red", "flower_yellow", "flower_blue", "flower_white"];
    const idx = Math.floor(this.hash2(x * 1.9 + 11, z * 2.3 - 7) * palette.length);
    return palette[Math.max(0, Math.min(palette.length - 1, idx))];
  }

  isFlatEnoughForFlower(x, z, height) {
    const neighborHeights = [
      this.terrainHeight(x + 1, z),
      this.terrainHeight(x - 1, z),
      this.terrainHeight(x, z + 1),
      this.terrainHeight(x, z - 1),
    ];
    return neighborHeights.every((neighborHeight) => Math.abs(neighborHeight - height) <= 1);
  }

  isFlatEnoughForGrass(x, z, height) {
    const neighborHeights = [
      this.terrainHeight(x + 1, z),
      this.terrainHeight(x - 1, z),
      this.terrainHeight(x, z + 1),
      this.terrainHeight(x, z - 1),
    ];
    return neighborHeights.every((neighborHeight) => Math.abs(neighborHeight - height) <= 2);
  }

  isFlatEnoughForSpawn(x, z, height) {
    const neighborHeights = [
      this.terrainHeight(x + 1, z),
      this.terrainHeight(x - 1, z),
      this.terrainHeight(x, z + 1),
      this.terrainHeight(x, z - 1),
      this.terrainHeight(x + 1, z + 1),
      this.terrainHeight(x - 1, z - 1),
      this.terrainHeight(x + 1, z - 1),
      this.terrainHeight(x - 1, z + 1),
    ];
    return neighborHeights.every((neighborHeight) => Math.abs(neighborHeight - height) <= 1);
  }

  shouldGenerateGrassAt(x, z, height, surface) {
    if (surface !== "grass") return false;
    if (height + 1 >= this.maxHeight) return false;
    if (!this.isFlatEnoughForGrass(x, z, height)) return false;

    const patchNoise =
      Math.sin((x + this.seed * 0.09) * 0.11) +
      Math.cos((z - this.seed * 0.12) * 0.1) +
      Math.sin((x + z) * 0.06);
    if (patchNoise < 1.15) return false;

    const density = this.hash2(x + 23, z - 31);
    const edgeScatter = this.hash2(x * 2.1 - 7, z * 1.7 + 19);
    if (density < 0.6) return false;
    if (patchNoise < 1.45 && edgeScatter < 0.72) return false;
    return true;
  }

  tryGenerateGrass(blocks, lx, height, lz, gx, gz, surface) {
    if (blocks.has(localKey(lx, height + 1, lz))) return;
    if (!this.shouldGenerateGrassAt(gx, gz, height, surface)) return;

    blocks.set(localKey(lx, height + 1, lz), "short_grass");
  }

  shouldGenerateFlowerAt(x, z, height, surface) {
    if (surface !== "grass") return false;
    if (height + 1 >= this.maxHeight) return false;
    if (!this.isFlatEnoughForFlower(x, z, height)) return false;

    const meadowNoise =
      Math.sin((x - this.seed * 0.18) * 0.08) +
      Math.cos((z + this.seed * 0.14) * 0.09);
    if (meadowNoise < 0.85) return false;
    if (this.hash2(x - 13, z + 17) < 0.965) return false;
    if (this.hash2(x + 3, z - 5) > 0.92) return false;
    return true;
  }

  tryGenerateFlower(blocks, lx, height, lz, gx, gz, surface) {
    if (blocks.has(localKey(lx, height + 1, lz))) return;
    if (!this.shouldGenerateFlowerAt(gx, gz, height, surface)) return;

    blocks.set(localKey(lx, height + 1, lz), this.flowerTypeAt(gx, gz));
  }

  shouldGenerateSugarCaneAt(x, z, height, surface) {
    if (surface !== "sand") return false;
    if (height + 2 >= this.maxHeight) return false;

    const patchNoise =
      Math.sin((x + this.seed * 0.08) * 0.12) +
      Math.cos((z - this.seed * 0.06) * 0.1) +
      Math.sin((x - z) * 0.045);
    if (patchNoise < 1.5) return false;

    if (this.hash2(x + 41, z - 23) < 0.978) return false;
    if (this.hash2(x * 1.3 - 9, z * 1.8 + 5) < 0.72) return false;

    return true;
  }

  tryGenerateSugarCane(blocks, lx, height, lz, gx, gz, surface) {
    if (blocks.has(localKey(lx, height + 1, lz))) return;
    if (!this.shouldGenerateSugarCaneAt(gx, gz, height, surface)) return;
    if (!this.isAdjacentToWater(blocks, lx, height + 1, lz)) return;

    const stalkHeight = 2 + Math.floor(this.hash2(gx + 71, gz - 57) * 3);
    for (let dy = 1; dy <= stalkHeight; dy++) {
      const y = height + dy;
      if (y >= this.maxHeight) break;
      blocks.set(localKey(lx, y, lz), "sugar_cane");
    }
  }

  getTreeDescriptor(x, z, height, surface = this.surfaceType(x, z)) {
    if (surface !== "grass") return null;
    const groveNoise =
      Math.sin((x + this.seed * 0.7) * 0.035) +
      Math.cos((z - this.seed * 0.4) * 0.04);
    if (groveNoise < 0.45) return null;

    const treeChance = this.hash2(x, z);
    if (treeChance < 0.975) return null;
    if (this.hash2(x + 1, z) > 0.965) return null;
    if (this.hash2(x, z + 1) > 0.965) return null;

    const trunkHeight = 3 + Math.floor(this.hash2(x + 17, z - 19) * 4);
    const canopyRadius = trunkHeight >= 6 ? 3 : 2;
    const leafBaseY = height + trunkHeight - (canopyRadius >= 3 ? 2 : 1);
    const leafTopY = height + trunkHeight + 1;
    if (leafTopY + 1 >= this.maxHeight) return null;

    const birchBiomeNoise =
      Math.sin((x - this.seed * 0.31) * 0.028) +
      Math.cos((z + this.seed * 0.23) * 0.031);
    const isBirch = birchBiomeNoise > 1.1 && this.hash2(x - 41, z + 13) > 0.35;
    const logType = isBirch ? "birch_log" : "oak_log";
    const leavesType = isBirch ? "birch_leaves" : "oak_leaves";

    return { x, z, height, trunkHeight, canopyRadius, leafBaseY, leafTopY, logType, leavesType };
  }

  treeBlocksColumn(tree, targetX, targetZ, minY, maxY) {
    if (!tree) return false;
    if (tree.x === targetX && tree.z === targetZ) {
      const trunkMinY = tree.height + 1;
      const trunkMaxY = tree.height + tree.trunkHeight;
      if (trunkMaxY >= minY && trunkMinY <= maxY) return true;
    }

    for (let ty = tree.leafBaseY; ty <= tree.leafTopY; ty++) {
      if (ty < minY || ty > maxY) continue;
      const heightRatio = (ty - tree.leafBaseY) / Math.max(1, tree.leafTopY - tree.leafBaseY);
      const radius =
        tree.canopyRadius -
        (heightRatio > 0.7 ? 1 : 0) -
        (heightRatio < 0.15 && tree.canopyRadius > 2 ? 1 : 0);

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const edgeBias = Math.abs(dx) + Math.abs(dz);
          const skipChance = this.hash2(tree.x + dx * 13 + ty, tree.z + dz * 17 - ty);
          if (edgeBias > radius + 1) continue;
          if (edgeBias === radius + 1 && skipChance < 0.8) continue;
          if (edgeBias === radius && skipChance < 0.22) continue;
          if (tree.x + dx === targetX && tree.z + dz === targetZ) return true;
        }
      }
    }

    if (tree.trunkHeight >= 5 && this.hash2(tree.x - 9, tree.z + 5) > 0.45) {
      const crownY = tree.height + tree.trunkHeight + 1;
      if (crownY >= minY && crownY <= maxY && tree.x === targetX && tree.z === targetZ) {
        return true;
      }
    }

    return false;
  }

  isSpawnSafeAt(x, z) {
    const height = this.terrainHeight(x, z);
    const surface = this.surfaceType(x, z);
    if (surface !== "grass") return false;
    if (height <= this.seaLevel) return false;
    if (!this.isFlatEnoughForSpawn(x, z, height)) return false;
    if (this.shouldGenerateGrassAt(x, z, height, surface)) return false;
    if (this.shouldGenerateFlowerAt(x, z, height, surface)) return false;

    const headMinY = height + 1;
    const headMaxY = height + 4;
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        const treeHeight = this.terrainHeight(x + dx, z + dz);
        const tree = this.getTreeDescriptor(x + dx, z + dz, treeHeight, this.surfaceType(x + dx, z + dz));
        if (this.treeBlocksColumn(tree, x, z, headMinY, headMaxY)) {
          return false;
        }
      }
    }

    return true;
  }

  findSpawnPoint() {
    for (let radius = 0; radius <= 48; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = dx;
          const z = dz;
          if (!this.isSpawnSafeAt(x, z)) continue;
          const y = this.terrainHeight(x, z) + 1;
          return { x: x + 0.5, y, z: z + 0.5 };
        }
      }
    }

    const fallbackY = this.terrainHeight(0, 0) + 1;
    return { x: 0.5, y: fallbackY, z: 0.5 };
  }

  tryGenerateTree(blocks, lx, height, lz, gx, gz) {
    if (lx < 3 || lz < 3 || lx > this.chunkSize - 4 || lz > this.chunkSize - 4) return;
    const tree = this.getTreeDescriptor(gx, gz, height);
    if (!tree) return;

    for (let dy = 1; dy <= tree.trunkHeight; dy++) {
      blocks.set(localKey(lx, height + dy, lz), tree.logType);
    }

    for (let ty = tree.leafBaseY; ty <= tree.leafTopY; ty++) {
      const heightRatio = (ty - tree.leafBaseY) / Math.max(1, tree.leafTopY - tree.leafBaseY);
      const radius =
        tree.canopyRadius -
        (heightRatio > 0.7 ? 1 : 0) -
        (heightRatio < 0.15 && tree.canopyRadius > 2 ? 1 : 0);

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const edgeBias = Math.abs(dx) + Math.abs(dz);
          const skipChance = this.hash2(gx + dx * 13 + ty, gz + dz * 17 - ty);
          if (edgeBias > radius + 1) continue;
          if (edgeBias === radius + 1 && skipChance < 0.8) continue;
          if (edgeBias === radius && skipChance < 0.22) continue;

          const tx = lx + dx;
          const tz = lz + dz;
          if (tx < 0 || tx >= this.chunkSize || tz < 0 || tz >= this.chunkSize) continue;
          if (ty < 0 || ty >= this.maxHeight) continue;
          const key = localKey(tx, ty, tz);
          if (!blocks.has(key)) {
            blocks.set(key, tree.leavesType);
          }
        }
      }
    }

    if (tree.trunkHeight >= 5 && this.hash2(gx - 9, gz + 5) > 0.45) {
      const crownY = height + tree.trunkHeight + 1;
      if (crownY < this.maxHeight && !blocks.has(localKey(lx, crownY, lz))) {
        blocks.set(localKey(lx, crownY, lz), tree.leavesType);
      }
    }
  }

  generateChunkBlocks(cx, cz) {
    const baseX = cx * this.chunkSize;
    const baseZ = cz * this.chunkSize;
    const blocks = this.buildTerrainBlocks(baseX, baseZ);
    const floodedCells = this.buildFloodedCells(baseX, baseZ);
    this.fillFloodedCells(blocks, floodedCells);

    for (let lx = 0; lx < this.chunkSize; lx++) {
      for (let lz = 0; lz < this.chunkSize; lz++) {
        const gx = baseX + lx;
        const gz = baseZ + lz;
        const height = this.terrainHeight(gx, gz);
        const surface = this.surfaceType(gx, gz);
        this.tryGenerateTree(blocks, lx, height, lz, gx, gz);
        this.tryGenerateGrass(blocks, lx, height, lz, gx, gz, surface);
        this.tryGenerateFlower(blocks, lx, height, lz, gx, gz, surface);
        this.tryGenerateSugarCane(blocks, lx, height, lz, gx, gz, surface);
      }
    }

    return blocks;
  }

  async ensureChunkLoaded(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.activeChunks.has(key) || this.loadingChunks.has(key)) return;

    this.loadingChunks.add(key);

    try {
      const savedPayload = this.saveStore ? await this.saveStore.loadChunk(key) : null;
      const chunk = {
        key,
        cx,
        cz,
        blocks: savedPayload ? this.deserializeBlocks(savedPayload) : this.generateChunkBlocks(cx, cz),
        meshes: new Map(),
        dirty: false,
      };

      this.activeChunks.set(key, chunk);

      const baseX = cx * this.chunkSize;
      const baseZ = cz * this.chunkSize;

      for (const [k, type] of chunk.blocks.entries()) {
        const [lx, y, lz] = k.split(",").map(Number);
        const gx = baseX + lx;
        const gz = baseZ + lz;
        this.updateBlockVisualAndNeighbors(gx, y, gz);
      }
    } finally {
      this.loadingChunks.delete(key);
    }
  }

  refreshBoundaryAfterUnload(cx, cz) {
    const minX = cx * this.chunkSize;
    const maxX = minX + this.chunkSize - 1;
    const minZ = cz * this.chunkSize;
    const maxZ = minZ + this.chunkSize - 1;

    for (let x = minX - 1; x <= maxX + 1; x++) {
      for (let z = minZ - 1; z <= maxZ + 1; z++) {
        const isBoundary = x === minX - 1 || x === maxX + 1 || z === minZ - 1 || z === maxZ + 1;
        if (!isBoundary) continue;
        for (let y = 0; y < this.maxHeight; y++) {
          const type = this.getBlock(x, y, z);
          if (!type) continue;
          this.ensureBlockMesh(x, y, z, type);
        }
      }
    }
  }

  async unloadChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const chunk = this.activeChunks.get(key);
    if (!chunk) return;

    for (const mesh of chunk.meshes.values()) {
      this.scene.remove(mesh);
    }

    if (chunk.dirty && this.saveStore) {
      await this.saveStore.flushChunk(key, this.serializeChunk(chunk));
    }

    this.activeChunks.delete(key);
    this.refreshBoundaryAfterUnload(cx, cz);
  }

  async updateStreaming(playerPos) {
    const centerX = floorDiv(Math.floor(playerPos.x), this.chunkSize);
    const centerZ = floorDiv(Math.floor(playerPos.z), this.chunkSize);

    const targetKeys = new Set();
    const loads = [];

    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = chunkKey(cx, cz);
        targetKeys.add(key);
        loads.push(this.ensureChunkLoaded(cx, cz));
      }
    }

    await Promise.all(loads);

    const unloads = [];
    for (const key of this.activeChunks.keys()) {
      if (targetKeys.has(key)) continue;
      const [cx, cz] = key.split(",").map(Number);
      unloads.push(this.unloadChunk(cx, cz));
    }
    await Promise.all(unloads);
  }

  async flushAll() {
    if (!this.saveStore) return;
    const pending = [];
    for (const chunk of this.activeChunks.values()) {
      if (!chunk.dirty) continue;
      pending.push(this.saveStore.flushChunk(chunk.key, this.serializeChunk(chunk)));
      chunk.dirty = false;
    }
    await Promise.all(pending);
  }

  getInteractiveMeshes() {
    const meshes = [];
    for (const chunk of this.activeChunks.values()) {
      for (const mesh of chunk.meshes.values()) {
        meshes.push(mesh);
      }
    }
    return meshes;
  }

  getStats() {
    let blockCount = 0;
    let meshCount = 0;
    for (const chunk of this.activeChunks.values()) {
      blockCount += chunk.blocks.size;
      meshCount += chunk.meshes.size;
    }
    return {
      chunks: this.activeChunks.size,
      blocks: blockCount,
      meshes: meshCount,
    };
  }

  raycastBlock(origin, direction, maxDistance = 7) {
    const dir = direction.clone().normalize();
    if (dir.lengthSq() === 0) return null;

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
    const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
    const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

    const nextBoundaryX = stepX > 0 ? x + 1 : x;
    const nextBoundaryY = stepY > 0 ? y + 1 : y;
    const nextBoundaryZ = stepZ > 0 ? z + 1 : z;

    let tMaxX = stepX !== 0 ? (nextBoundaryX - origin.x) / dir.x : Infinity;
    let tMaxY = stepY !== 0 ? (nextBoundaryY - origin.y) / dir.y : Infinity;
    let tMaxZ = stepZ !== 0 ? (nextBoundaryZ - origin.z) / dir.z : Infinity;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let distance = 0;
    let normal = new THREE.Vector3();

    while (distance <= maxDistance) {
      const type = this.getBlock(x, y, z);
      if (type) {
        return {
          distance,
          point: origin.clone().addScaledVector(dir, distance),
          face: { normal: normal.clone() },
          object: { userData: { blockPos: { x, y, z }, blockType: type } },
        };
      }

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        distance = tMaxX;
        tMaxX += tDeltaX;
        normal.set(-stepX, 0, 0);
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        distance = tMaxY;
        tMaxY += tDeltaY;
        normal.set(0, -stepY, 0);
      } else {
        z += stepZ;
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        normal.set(0, 0, -stepZ);
      }
    }

    return null;
  }

}
