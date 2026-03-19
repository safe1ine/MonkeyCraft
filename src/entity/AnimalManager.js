import * as THREE from "../lib/three.js";

// --- Pixel texture generators ---

function createCowTexture() {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // White base with brown patches
  ctx.fillStyle = "#f5f0e8";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#4a3728";
  // Random-ish patches
  ctx.fillRect(2, 2, 8, 6);
  ctx.fillRect(18, 4, 10, 8);
  ctx.fillRect(6, 16, 12, 7);
  ctx.fillRect(22, 20, 8, 6);
  ctx.fillRect(0, 24, 6, 5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function createSheepTexture() {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Fluffy white wool
  ctx.fillStyle = "#e8e4dc";
  ctx.fillRect(0, 0, size, size);
  // Wool puffs
  ctx.fillStyle = "#f5f2ed";
  for (let i = 0; i < 12; i++) {
    const x = (i * 7 + 3) % size;
    const y = (i * 11 + 2) % size;
    ctx.fillRect(x, y, 4, 3);
  }
  ctx.fillStyle = "#d5d0c8";
  for (let i = 0; i < 8; i++) {
    const x = (i * 9 + 1) % size;
    const y = (i * 13 + 5) % size;
    ctx.fillRect(x, y, 3, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function createHeadTexture(type) {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (type === "cow") {
    ctx.fillStyle = "#4a3728";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#f5f0e8";
    ctx.fillRect(3, 6, 4, 4);
    // Eyes
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(3, 4, 2, 2);
    ctx.fillRect(11, 4, 2, 2);
    // Nose
    ctx.fillStyle = "#8a7a6a";
    ctx.fillRect(5, 10, 6, 4);
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(6, 11, 2, 2);
    ctx.fillRect(9, 11, 2, 2);
  } else {
    ctx.fillStyle = "#c8bfb0";
    ctx.fillRect(0, 0, size, size);
    // Eyes
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(3, 5, 2, 2);
    ctx.fillRect(11, 5, 2, 2);
    // Nose
    ctx.fillStyle = "#d4a0a0";
    ctx.fillRect(6, 9, 4, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function createLegTexture(type) {
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = type === "cow" ? "#3a2a1a" : "#6a5a4a";
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

// --- Animal model builder ---

function buildAnimalModel(type, textures) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ map: textures.body });
  const headMat = new THREE.MeshLambertMaterial({ map: textures.head });
  const legMat = new THREE.MeshLambertMaterial({ map: textures.leg });

  // Body
  const bw = type === "cow" ? 0.9 : 0.7;
  const bh = type === "cow" ? 0.65 : 0.55;
  const bd = type === "cow" ? 1.3 : 0.9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bodyMat);
  body.position.y = 0.55;
  group.add(body);

  // Head
  const hs = type === "cow" ? 0.45 : 0.38;
  const head = new THREE.Mesh(new THREE.BoxGeometry(hs, hs, hs), headMat);
  head.position.set(0, 0.72, bd * 0.5 + hs * 0.35);
  group.add(head);
  group.userData.headMesh = head;
  group.userData.headBaseY = head.position.y;

  // Legs (4)
  const legW = 0.18;
  const legH = 0.4;
  const legOffX = bw * 0.35;
  const legOffZ = bd * 0.32;
  const legY = 0.2;
  const legPositions = [
    [-legOffX, legY, legOffZ],
    [legOffX, legY, legOffZ],
    [-legOffX, legY, -legOffZ],
    [legOffX, legY, -legOffZ],
  ];
  const legs = [];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), legMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
    legs.push(leg);
  }
  group.userData.legs = legs;

  group.scale.set(0.85, 0.85, 0.85);
  return group;
}

// --- Shared geometry/texture cache ---

let _textureCache = null;
function getTextures() {
  if (_textureCache) return _textureCache;
  _textureCache = {
    cow: { body: createCowTexture(), head: createHeadTexture("cow"), leg: createLegTexture("cow") },
    sheep: { body: createSheepTexture(), head: createHeadTexture("sheep"), leg: createLegTexture("sheep") },
  };
  return _textureCache;
}

// --- AnimalManager ---

const SPAWN_RADIUS = 8;

export class AnimalManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.animals = [];
    this.textures = getTextures();
  }

  // Find actual surface Y by scanning down from maxHeight using real block data
  _findSurfaceY(x, z) {
    const maxH = this.world.maxHeight;
    for (let y = maxH - 1; y >= 0; y--) {
      const block = this.world.getBlock(x, y, z);
      if (block && block !== "short_grass" && block !== "water" && block !== "sugar_cane"
          && block !== "flower_red" && block !== "flower_yellow"
          && block !== "flower_blue" && block !== "flower_white") {
        return y;
      }
    }
    return -1;
  }

  // Called once after world is ready, spawns 1 cow + 1 sheep near the given position
  spawnNearPoint(centerX, centerZ) {
    this.reset();
    const cx = Math.floor(centerX);
    const cz = Math.floor(centerZ);
    for (const type of ["cow", "sheep"]) {
      if (!this._spawnOne(type, cx, cz)) {
        // Fallback: spawn right next to spawn point
        this._spawnAt(type, cx + (type === "cow" ? 3 : -3), cz + 2);
      }
    }
  }

  // Fallback spawn at exact coordinates
  _spawnAt(type, sx, sz) {
    const height = this._findSurfaceY(sx, sz);
    // If block data not available, use terrainHeight as last resort
    const y = height >= 0 ? height + 1.0 : this.world.terrainHeight(sx, sz) + 1.0;

    const mesh = buildAnimalModel(type, this.textures[type]);
    mesh.position.set(sx + 0.5, y, sz + 0.5);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    this.animals.push({
      type, mesh,
      x: sx + 0.5, y, z: sz + 0.5,
      yaw: mesh.rotation.y,
      state: "idle",
      stateTimer: 2 + Math.random() * 3,
      walkDir: 0,
      walkSpeed: 0.6 + Math.random() * 0.4,
      animTime: Math.random() * 10,
    });
  }

  update(dt) {
    for (const animal of this.animals) {
      this._updateAnimal(animal, dt);
    }
  }

  reset() {
    for (const animal of this.animals) {
      this.scene.remove(animal.mesh);
    }
    this.animals = [];
  }

  _spawnOne(type, cx, cz) {
    // Try random spots close to spawn, within loaded chunks
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * SPAWN_RADIUS;
      const sx = Math.floor(cx + Math.cos(angle) * dist);
      const sz = Math.floor(cz + Math.sin(angle) * dist);

      const height = this._findSurfaceY(sx, sz);
      if (height < 0) continue;

      const above = this.world.getBlock(sx, height + 1, sz);
      if (above && above !== "short_grass") continue;

      const mesh = buildAnimalModel(type, this.textures[type]);
      mesh.position.set(sx + 0.5, height + 1.0, sz + 0.5);
      mesh.rotation.y = Math.random() * Math.PI * 2;

      this.scene.add(mesh);
      this.animals.push({
        type, mesh,
        x: sx + 0.5,
        y: height + 1.0,
        z: sz + 0.5,
        yaw: mesh.rotation.y,
        state: "idle",
        stateTimer: 1 + Math.random() * 3,
        walkDir: 0,
        walkSpeed: 0.6 + Math.random() * 0.4,
        animTime: Math.random() * 10,
      });
      return true;
    }
    return false;
  }

  _updateAnimal(animal, dt) {
    animal.animTime += dt;
    animal.stateTimer -= dt;

    if (animal.stateTimer <= 0) {
      // Switch state
      if (animal.state === "idle") {
        animal.state = Math.random() < 0.3 ? "graze" : "walk";
        animal.stateTimer = 1.5 + Math.random() * 3;
        if (animal.state === "walk") {
          animal.walkDir = animal.yaw + (Math.random() - 0.5) * 1.5;
        }
      } else {
        animal.state = "idle";
        animal.stateTimer = 2 + Math.random() * 4;
      }
    }

    // Movement
    if (animal.state === "walk") {
      const speed = animal.walkSpeed * dt;
      const nx = animal.x + Math.sin(animal.walkDir) * speed;
      const nz = animal.z + Math.cos(animal.walkDir) * speed;

      // Check terrain at new position
      const gx = Math.floor(nx);
      const gz = Math.floor(nz);
      const h = this._findSurfaceY(gx, gz);
      if (h < 0) {
        animal.walkDir += Math.PI;
        animal.state = "idle";
        animal.stateTimer = 1;
        return;
      }
      const block = this.world.getBlock(gx, h + 1, gz);

      // Only walk on passable terrain, avoid water
      if (!block || block === "short_grass") {
        animal.x = nx;
        animal.z = nz;
        animal.y = h + 1.0;
        animal.yaw = animal.walkDir;
      } else {
        // Blocked, turn around
        animal.walkDir += Math.PI * 0.5 + Math.random() * Math.PI;
        animal.state = "idle";
        animal.stateTimer = 1;
      }
    }

    // Animate legs (walking)
    const legs = animal.mesh.userData.legs;
    if (animal.state === "walk" && legs) {
      const swing = Math.sin(animal.animTime * 6) * 0.3;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      legs[2].rotation.x = -swing;
      legs[3].rotation.x = swing;
    } else if (legs) {
      // Ease legs back to neutral
      for (const leg of legs) {
        leg.rotation.x *= 0.85;
      }
    }

    // Animate head (grazing = head dips down)
    const headMesh = animal.mesh.userData.headMesh;
    if (headMesh) {
      const baseY = animal.mesh.userData.headBaseY;
      if (animal.state === "graze") {
        headMesh.position.y += (baseY - 0.2 - headMesh.position.y) * 0.08;
        headMesh.rotation.x += (0.4 - headMesh.rotation.x) * 0.08;
      } else {
        headMesh.position.y += (baseY - headMesh.position.y) * 0.08;
        headMesh.rotation.x *= 0.9;
      }
    }

    // Apply position and rotation
    animal.mesh.position.set(animal.x, animal.y, animal.z);
    animal.mesh.rotation.y = animal.yaw;
  }
}
