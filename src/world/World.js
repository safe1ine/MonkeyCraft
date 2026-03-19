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
    this.seed = WORLD_CONFIG.seed;

    this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
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
    for (const [dx, dy, dz] of NEIGHBORS) {
      if (!this.getBlock(x + dx, y + dy, z + dz)) {
        return true;
      }
    }
    return false;
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

    if (existing) return;

    const mesh = new THREE.Mesh(this.cubeGeometry, this.materials[type] || this.materials.dirt);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.userData.blockPos = { x, y, z };
    this.scene.add(mesh);
    chunk.meshes.set(globalKey, mesh);
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
    const a = Math.sin((x + this.seed) * 0.16) * 2.2;
    const b = Math.cos((z - this.seed) * 0.14) * 2.0;
    const c = Math.sin((x + z) * 0.08) * 1.6;
    const h = Math.floor(8 + a + b + c);
    return Math.max(2, Math.min(this.maxHeight - 2, h));
  }

  hash2(x, z) {
    const v = Math.sin((x + this.seed * 13.37) * 127.1 + (z - this.seed * 7.11) * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }

  surfaceType(x, z) {
    const biomeNoise = Math.sin((x + this.seed) * 0.05) + Math.cos((z - this.seed) * 0.06);
    if (biomeNoise > 1.0) return "sand";
    if (biomeNoise < -1.1) return "stone";
    return "grass";
  }

  tryGenerateTree(blocks, lx, height, lz, gx, gz) {
    if (lx < 2 || lz < 2 || lx > this.chunkSize - 3 || lz > this.chunkSize - 3) return;
    if (height + 6 >= this.maxHeight) return;
    if (this.surfaceType(gx, gz) !== "grass") return;
    const groveNoise =
      Math.sin((gx + this.seed * 0.7) * 0.035) +
      Math.cos((gz - this.seed * 0.4) * 0.04);
    if (groveNoise < 0.45) return;

    const treeChance = this.hash2(gx, gz);
    if (treeChance < 0.975) return;

    // Keep a little breathing room between trunks so forests do not become walls.
    if (this.hash2(gx + 1, gz) > 0.965) return;
    if (this.hash2(gx, gz + 1) > 0.965) return;

    const trunkHeight = 3 + Math.floor(this.hash2(gx + 17, gz - 19) * 2);
    for (let dy = 1; dy <= trunkHeight; dy++) {
      blocks.set(localKey(lx, height + dy, lz), "wood");
    }

    const leafY = height + trunkHeight;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          if (dist > 4) continue;
          const tx = lx + dx;
          const ty = leafY + dy;
          const tz = lz + dz;
          if (tx < 0 || tx >= this.chunkSize || tz < 0 || tz >= this.chunkSize) continue;
          if (ty < 0 || ty >= this.maxHeight) continue;
          const key = localKey(tx, ty, tz);
          if (!blocks.has(key)) {
            blocks.set(key, "leaves");
          }
        }
      }
    }
  }

  generateChunkBlocks(cx, cz) {
    const blocks = new Map();
    const baseX = cx * this.chunkSize;
    const baseZ = cz * this.chunkSize;

    for (let lx = 0; lx < this.chunkSize; lx++) {
      for (let lz = 0; lz < this.chunkSize; lz++) {
        const gx = baseX + lx;
        const gz = baseZ + lz;
        const height = this.terrainHeight(gx, gz);
        const surface = this.surfaceType(gx, gz);
        for (let y = 0; y <= height; y++) {
          let type = "dirt";
          if (y === height) type = surface;
          else if (y < height - 2) type = "stone";
          blocks.set(localKey(lx, y, lz), type);
        }
        this.tryGenerateTree(blocks, lx, height, lz, gx, gz);
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
