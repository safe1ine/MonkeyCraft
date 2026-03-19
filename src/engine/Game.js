import * as THREE from "../lib/three.js";
import { BLOCK_LABELS, BLOCKS, ITEM_LABELS, PLACEABLE_BLOCKS, RECIPES } from "../constants.js";
import { SaveStore } from "../storage/saveStore.js";
import { World } from "../world/World.js";
import { PlayerController } from "../player/PlayerController.js";
import { Hud } from "../ui/Hud.js";
import { Inventory } from "../game/Inventory.js";
import { Sfx } from "../audio/Sfx.js";
import { createCrackTextures } from "../world/crackTextures.js";

export class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9edbff);
    this.scene.fog = new THREE.Fog(0x9edbff, 70, 220);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    document.body.appendChild(this.renderer.domElement);

    this.sunDirection = new THREE.Vector3(20, 30, 15).normalize();
    this.addLights();

    this.clock = new THREE.Clock();
    this.hud = new Hud();
    this.saveStore = new SaveStore();
    this.world = new World(this.scene, this.saveStore);
    this.player = new PlayerController(this.camera, this.renderer.domElement, this.world);
    this.inventory = new Inventory();
    this.sfx = new Sfx();

    this.lastStreamAt = 0;
    this.lastPlayerSaveAt = 0;
    this.interactionCooldown = 0;
    this.streamingInFlight = false;
    this.playerSaveInFlight = false;
    this.selectedBlockIndex = 0;
    this.currentLookTarget = null;
    this.leftMouseDown = false;
    this.mining = {
      active: false,
      targetKey: "",
      blockPos: null,
      blockType: "",
      progress: 0,
      duration: 0.5,
      cooldown: 0,
    };
    this.mineTickSfxAt = 0;
    this.started = false;

    this.createSelectionOutline();
    this.createMiningOverlay();
    this.createSunBillboard();
    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);
    this.refreshRecipesUI();
  }

  addLights() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x7a8b66, 0.85);
    this.scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.copy(this.sunDirection.clone().multiplyScalar(80));
    this.scene.add(sun);
  }

  createSunBillboard() {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.06,
      size * 0.5,
      size * 0.5,
      size * 0.5
    );
    gradient.addColorStop(0.0, "rgba(255,255,255,0.98)");
    gradient.addColorStop(0.18, "rgba(255,255,250,0.95)");
    gradient.addColorStop(0.4, "rgba(210,236,255,0.42)");
    gradient.addColorStop(0.72, "rgba(170,215,255,0.16)");
    gradient.addColorStop(1.0, "rgba(150,205,255,0.0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const sunTexture = new THREE.CanvasTexture(canvas);
    sunTexture.colorSpace = THREE.SRGBColorSpace;
    const sunMaterial = new THREE.SpriteMaterial({
      map: sunTexture,
      fog: false,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      opacity: 1,
    });
    this.sunSprite = new THREE.Sprite(sunMaterial);
    this.sunSprite.scale.set(42, 42, 1);
    this.scene.add(this.sunSprite);
  }

  createSelectionOutline() {
    const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01));
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x111111 });
    this.selectionOutline = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    this.selectionOutline.visible = false;
    this.scene.add(this.selectionOutline);
  }

  createMiningOverlay() {
    this.crackTextures = createCrackTextures(10);
    this.miningOverlayMaterial = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.miningOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.012, 1.012, 1.012),
      this.miningOverlayMaterial,
    );
    this.miningOverlay.visible = false;
    this.scene.add(this.miningOverlay);
  }

  bindEvents() {
    this.player.attachListeners({
      onPointerLockChange: (locked) => {
        this.hud.setPointerLock(locked);
        if (!locked) {
          this.leftMouseDown = false;
          this.stopMining();
        }
      },
    });

    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    document.addEventListener("mouseup", (e) => this.handleMouseUp(e));
    document.addEventListener("keydown", (e) => this.handleGlobalKeyDown(e));
    window.addEventListener("resize", this.onResize);
    window.addEventListener("beforeunload", () => {
      this.world.flushAll();
      this.saveStore.savePlayer(this.player.getSaveData());
    });
  }

  async initFromSave() {
    const playerData = await this.saveStore.loadPlayer();
    this.player.setFromSave(playerData);
    await this.world.updateStreaming(this.player.pos);
  }

  createRandomSeed() {
    return Math.floor(Math.random() * 2147483647);
  }

  resetRunState() {
    this.world.resetLoadedChunks();
    this.player.pos.set(0, 16, 0);
    this.player.vel.set(0, 0, 0);
    this.player.yaw = 0;
    this.player.pitch = 0;
    this.player.onGround = false;
    this.inventory.clear();
    this.selectedBlockIndex = 0;
    this.currentLookTarget = null;
    this.leftMouseDown = false;
    this.interactionCooldown = 0;
    this.stopMining();
    this.selectionOutline.visible = false;
  }

  handleBlockHotkeys(event) {
    if (!event.code.startsWith("Digit")) return;
    const idx = Number(event.code.replace("Digit", "")) - 1;
    if (Number.isNaN(idx)) return;
    if (idx < 0 || idx >= PLACEABLE_BLOCKS.length) return;
    this.selectedBlockIndex = idx;
    this.hud.setSelectedBlock(BLOCK_LABELS[PLACEABLE_BLOCKS[this.selectedBlockIndex]] || PLACEABLE_BLOCKS[this.selectedBlockIndex]);
  }

  handleGlobalKeyDown(event) {
    if (!this.started) return;
    if (event.code === "KeyE") {
      const open = this.hud.toggleToolbox();
      if (open && document.pointerLockElement) {
        document.exitPointerLock();
      }
      return;
    }
    this.handleBlockHotkeys(event);
  }

  refreshInventoryUI() {
    this.hud.setInventory(this.inventory.toObject(), ITEM_LABELS);
    this.refreshRecipesUI();
  }

  refreshRecipesUI() {
    this.hud.setRecipes(
      RECIPES,
      ITEM_LABELS,
      (recipeId) => this.handleCraft(recipeId),
      (recipe) => this.inventory.canCraft(recipe),
    );
  }

  handleCraft(recipeId) {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    const ok = this.inventory.craft(recipe);
    if (!ok) return;
    this.refreshInventoryUI();
  }

  handleMouseDown(event) {
    this.sfx.prime();
    if (!this.started) return;
    if (!this.player.pointerLocked) return;
    if (this.hud.toolboxOpen) return;

    if (event.button === 0) {
      this.leftMouseDown = true;
      const hit = this.currentLookTarget || this.player.getLookTarget();
      if (!hit || !hit.object?.userData?.blockPos) return;
      this.tryStartMining(hit);
      return;
    }

    if (this.interactionCooldown > 0) return;
    const hit = this.currentLookTarget || this.player.getLookTarget();
    if (!hit || !hit.object?.userData?.blockPos) return;
    const { x, y, z } = hit.object.userData.blockPos;

    if (event.button === 2) {
      const normal = hit.face.normal;
      const tx = Math.round(x + normal.x);
      const ty = Math.round(y + normal.y);
      const tz = Math.round(z + normal.z);
      const blockType = PLACEABLE_BLOCKS[this.selectedBlockIndex] || "dirt";
      if (!this.inventory.consume(blockType, 1)) return;
      if (!this.world.getBlock(tx, ty, tz) && this.player.canPlaceAt(tx, ty, tz)) {
        this.world.setBlock(tx, ty, tz, blockType);
        this.sfx.playPlace();
        this.refreshInventoryUI();
      } else {
        this.inventory.add(blockType, 1);
      }
    }

    this.interactionCooldown = 0.06;
  }

  handleMouseUp(event) {
    if (event.button !== 0) return;
    this.leftMouseDown = false;
    this.stopMining();
  }

  getBlockKey(pos) {
    return `${pos.x},${pos.y},${pos.z}`;
  }

  stopMining() {
    this.mining.active = false;
    this.mining.targetKey = "";
    this.mining.blockPos = null;
    this.mining.blockType = "";
    this.mining.progress = 0;
    this.mineTickSfxAt = 0;
    this.miningOverlay.visible = false;
    this.hud.setMiningProgress("", 0);
  }

  tryStartMining(hit) {
    const pos = hit?.object?.userData?.blockPos;
    if (!pos) {
      this.stopMining();
      return;
    }

    const type = this.world.getBlock(pos.x, pos.y, pos.z);
    if (!type) {
      this.stopMining();
      return;
    }
    if (BLOCKS[type]?.breakable === false) {
      this.stopMining();
      return;
    }

    this.mining.active = true;
    this.mining.targetKey = this.getBlockKey(pos);
    this.mining.blockPos = { x: pos.x, y: pos.y, z: pos.z };
    this.mining.blockType = type;
    this.mining.progress = 0;
    this.mining.duration = Math.max(0.15, BLOCKS[type]?.breakTime ?? 0.5);
    this.mineTickSfxAt = 0;
    this.hud.setMiningProgress(BLOCK_LABELS[type] || type, 0);
  }

  updateMining(dt) {
    this.mining.cooldown = Math.max(0, this.mining.cooldown - dt);
    if (!this.player.pointerLocked || !this.leftMouseDown) {
      this.stopMining();
      return;
    }
    if (this.mining.cooldown > 0) {
      this.miningOverlay.visible = false;
      this.hud.setMiningProgress("", 0);
      return;
    }

    const hit = this.currentLookTarget;
    const pos = hit?.object?.userData?.blockPos;
    if (!pos) {
      this.stopMining();
      return;
    }

    const key = this.getBlockKey(pos);
    if (!this.mining.active || this.mining.targetKey !== key) {
      this.tryStartMining(hit);
      if (!this.mining.active) return;
    }

    this.mining.progress += dt / this.mining.duration;
    this.hud.setMiningProgress(BLOCK_LABELS[this.mining.blockType] || this.mining.blockType, this.mining.progress);
    this.updateMiningOverlay(this.mining.blockPos, this.mining.progress);

    this.mineTickSfxAt -= dt;
    if (this.mineTickSfxAt <= 0) {
      this.sfx.playMineTick();
      this.mineTickSfxAt = 0.16;
    }

    if (this.mining.progress < 1) return;

    const p = this.mining.blockPos;
    const minedType = this.mining.blockType;
    this.world.setBlock(p.x, p.y, p.z, null);
    if (minedType) {
      this.inventory.add(minedType, 1);
      this.refreshInventoryUI();
    }
    this.sfx.playBreak();
    this.mining.cooldown = 0.08;
    this.mining.active = false;
    this.mining.targetKey = "";
    this.mining.blockPos = null;
    this.mining.blockType = "";
    this.mining.progress = 0;
    this.mineTickSfxAt = 0;
    this.miningOverlay.visible = false;
    this.hud.setMiningProgress("", 0);
  }

  updateMiningOverlay(pos, progress) {
    if (!pos) {
      this.miningOverlay.visible = false;
      return;
    }
    const index = Math.max(0, Math.min(9, Math.floor(progress * 10)));
    this.miningOverlayMaterial.map = this.crackTextures[index];
    this.miningOverlayMaterial.needsUpdate = true;
    this.miningOverlay.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
    this.miningOverlay.visible = true;
  }

  updateSelectionOutline() {
    if (!this.player.pointerLocked) {
      this.currentLookTarget = null;
      this.selectionOutline.visible = false;
      return;
    }

    const hit = this.player.getLookTarget();
    this.currentLookTarget = hit;
    if (!hit || !hit.object?.userData?.blockPos) {
      this.selectionOutline.visible = false;
      return;
    }

    const { x, y, z } = hit.object.userData.blockPos;
    this.selectionOutline.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.selectionOutline.visible = true;
  }

  updateSun() {
    if (!this.sunSprite) return;
    const sunOffset = this.sunDirection.clone().multiplyScalar(180);
    const sunPosition = this.camera.position.clone().add(sunOffset);
    this.sunSprite.position.copy(sunPosition);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  async maybeStreamWorld(nowMs) {
    if (nowMs - this.lastStreamAt < 250) return;
    if (this.streamingInFlight) return;
    this.lastStreamAt = nowMs;
    this.streamingInFlight = true;
    try {
      await this.world.updateStreaming(this.player.pos);
    } finally {
      this.streamingInFlight = false;
    }
  }

  async maybeSavePlayer(nowMs) {
    if (nowMs - this.lastPlayerSaveAt < 2000) return;
    if (this.playerSaveInFlight) return;
    this.lastPlayerSaveAt = nowMs;
    this.playerSaveInFlight = true;
    try {
      await this.saveStore.savePlayer(this.player.getSaveData());
    } finally {
      this.playerSaveInFlight = false;
    }
  }

  async start() {
    this.bindEvents();
    this.hud.setWelcomeStatus("等待开始");
    this.hud.waitForStart(() => {
      this.beginGame().catch((err) => {
        console.error("Game start failed", err);
        this.hud.setWelcomeStatus("地图生成失败，请刷新重试");
      });
    });
  }

  async beginGame() {
    if (this.started) return;
    this.hud.setWelcomeStatus("正在创建新世界...");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await this.saveStore.clearAll();
    this.resetRunState();
    this.world.setSeed(this.createRandomSeed());
    this.hud.setWelcomeStatus("正在生成地图...");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await this.world.updateStreaming(this.player.pos);
    this.started = true;
    this.hud.hideWelcome();
    this.hud.setPointerLock(false);
    this.hud.setSelectedBlock(BLOCK_LABELS[PLACEABLE_BLOCKS[this.selectedBlockIndex]]);
    this.refreshInventoryUI();
    this.animate();
  }

  animate() {
    const dt = Math.min(0.033, this.clock.getDelta());
    const nowMs = performance.now();

    this.player.update(dt);
    this.updateSun();
    this.updateSelectionOutline();
    this.updateMining(dt);

    this.interactionCooldown = Math.max(0, this.interactionCooldown - dt);

    this.maybeStreamWorld(nowMs);
    this.maybeSavePlayer(nowMs);

    this.hud.renderStatus(this.player, this.world.getStats());
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  }
}
