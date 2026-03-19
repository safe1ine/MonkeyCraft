import { PLACEABLE_BLOCKS } from "../constants.js";
import { resolveHotbarIcon } from "./itemModelIcons.js";

export class Hud {
  constructor() {
    this.hudEl = document.getElementById("hud");
    this.welcomeScreenEl = document.getElementById("welcome-screen");
    this.startButtonEl = document.getElementById("start-game-button");
    this.welcomeStatusEl = document.getElementById("welcome-status");
    this.welcomeLoadingEl = document.getElementById("welcome-loading");
    this.underwaterOverlayEl = document.getElementById("underwater-overlay");
    this.tipsEl = document.getElementById("tips");
    this.statusEl = document.getElementById("status");
    this.hotbarEl = document.getElementById("hotbar");
    this.hotbarLabelEl = document.getElementById("hotbar-label");
    this.hotbarXpFillEl = document.getElementById("hotbar-xp-fill");
    this.healthBarEl = document.getElementById("health-bar");
    this.hungerBarEl = document.getElementById("hunger-bar");
    this.toolboxEl = document.getElementById("toolbox");
    this.playerCanvasEl = document.getElementById("inventory-player-canvas");
    this.inventoryListEl = document.getElementById("inventory-list");
    this.inventoryHotbarEl = document.getElementById("inventory-hotbar-grid");
    this.recipeListEl = document.getElementById("recipe-list");
    this.recipePanelEl = document.getElementById("recipe-panel");
    this.recipeBookToggleEl = document.getElementById("recipe-book-toggle");
    this.selectedLabel = "泥土";
    this.selectedHotbarIndex = 0;
    this.miningLabel = "";
    this.miningProgress = 0;
    this.inventorySummary = "";
    this.hotbarItems = PLACEABLE_BLOCKS.slice(0, 9);
    this.toolboxOpen = false;
    this.health = 10;
    this.hunger = 10;
    this.recipePanelOpen = false;
    this.underwater = false;

    this.recipeBookToggleEl?.addEventListener("click", () => {
      this.recipePanelOpen = !this.recipePanelOpen;
      this.recipePanelEl?.classList.toggle("hidden", !this.recipePanelOpen);
    });

    this.renderPlayerPreview();
    this.renderHotbar({});
    this.renderVitals();
  }

  renderPlayerPreview() {
    if (!this.playerCanvasEl) return;
    const canvas = this.playerCanvasEl;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = new URL("../../assets/minecraft/textures/entity/player/wide/steve.png", import.meta.url).href;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      const draw = (sx, sy, sw, sh, dx, dy, dw, dh) => {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      };

      draw(8, 8, 8, 8, 42, 8, 56, 56);
      draw(20, 20, 8, 12, 38, 62, 64, 82);
      draw(44, 20, 4, 12, 14, 62, 24, 82);
      draw(44, 20, 4, 12, 102, 62, 24, 82);
      draw(4, 20, 4, 12, 44, 140, 24, 72);
      draw(4, 20, 4, 12, 72, 140, 24, 72);
    };
  }

  waitForStart(onStart) {
    if (!this.startButtonEl) return;
    this.startButtonEl.disabled = false;
    this.startButtonEl.onclick = () => {
      this.startButtonEl.disabled = true;
      onStart?.();
    };
  }

  setWelcomeStatus(text) {
    if (this.welcomeStatusEl) {
      this.welcomeStatusEl.textContent = text;
    }
    const loading = /正在|创建|生成|加载/.test(text || "");
    this.welcomeLoadingEl?.classList.toggle("hidden", !loading);
  }

  hideWelcome() {
    this.welcomeScreenEl?.classList.add("hidden");
    this.hudEl?.classList.remove("hidden");
  }

  setUnderwater(active) {
    this.underwater = !!active;
    this.underwaterOverlayEl?.classList.toggle("hidden", !this.underwater);
    this.underwaterOverlayEl?.classList.toggle("is-active", this.underwater);
  }

  setPointerLock(locked) {
    if (!this.tipsEl) return;
    this.tipsEl.textContent = locked
      ? "WASD 移动 | Space 跳跃 | Shift 冲刺 | 左键挖掘 | 右键放置 | 1-6 切换方块 | E 工具箱"
      : "点击屏幕开始 | WASD 移动 | Space 跳跃 | Shift 冲刺 | 左键挖掘 | 右键放置 | 1-6 切换方块 | E 工具箱";
  }

  setSelectedBlock(label) {
    this.selectedLabel = label;
    this.renderHotbarLabel();
  }

  setSelectedHotbar(index) {
    this.selectedHotbarIndex = Math.max(0, Math.min(8, index || 0));
    this.renderHotbar();
  }

  setMiningProgress(label, progress) {
    this.miningLabel = label || "";
    this.miningProgress = Math.max(0, Math.min(1, progress || 0));
    this.renderHotbarLabel();
  }

  setVitals({ health, hunger }) {
    if (typeof health === "number") {
      this.health = Math.max(0, Math.min(10, Math.floor(health)));
    }
    if (typeof hunger === "number") {
      this.hunger = Math.max(0, Math.min(10, Math.floor(hunger)));
    }
    this.renderVitals();
  }

  setInventory(items, labels) {
    if (!this.inventoryListEl) return;
    const entries = Object.entries(items || {}).filter(([, count]) => count > 0);
    const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0], "zh-CN"));

    if (entries.length === 0) {
      this.inventorySummary = "背包空";
      this.renderInventorySlots([]);
      this.renderHotbar({});
      return;
    }

    const summary = [];
    for (const [id, count] of sortedEntries) {
      const name = labels?.[id] || id;
      summary.push(`${name}:${count}`);
    }
    this.inventorySummary = summary.slice(0, 4).join(" ");
    this.renderInventorySlots(sortedEntries);
    this.renderHotbar(items || {});
  }

  setRecipes(recipes, labels, onCraft, canCraft = null) {
    if (!this.recipeListEl) return;
    this.recipeListEl.innerHTML = "";
    for (const recipe of recipes || []) {
      const row = document.createElement("div");
      row.className = "recipe-item";

      const label = document.createElement("div");
      label.className = "recipe-name";
      label.textContent = recipe.name || recipe.id;

      const req = document.createElement("div");
      req.className = "recipe-need";
      req.textContent = Object.entries(recipe.inputs || {})
        .map(([id, count]) => `${labels?.[id] || id}x${count}`)
        .join(" + ");

      const button = document.createElement("button");
      button.textContent = "合成";
      const craftable = typeof canCraft === "function" ? !!canCraft(recipe) : true;
      button.disabled = !craftable;
      button.addEventListener("click", () => onCraft?.(recipe.id));

      const left = document.createElement("div");
      left.className = "recipe-left";
      left.appendChild(label);
      left.appendChild(req);

      row.appendChild(left);
      row.appendChild(button);
      this.recipeListEl.appendChild(row);
    }
  }

  toggleToolbox() {
    this.toolboxOpen = !this.toolboxOpen;
    this.toolboxEl?.classList.toggle("hidden", !this.toolboxOpen);
    const crosshairEl = document.getElementById("crosshair");
    crosshairEl?.classList.toggle("hidden", this.toolboxOpen);
    if (!this.toolboxOpen) {
      this.recipePanelOpen = false;
      this.recipePanelEl?.classList.add("hidden");
    }
    return this.toolboxOpen;
  }

  renderInventorySlots(entries) {
    if (!this.inventoryListEl || !this.inventoryHotbarEl) return;

    const storageEntries = entries.slice(0, 27);
    const hotbarEntries = entries.slice(27, 36);

    this.inventoryListEl.innerHTML = "";
    this.inventoryHotbarEl.innerHTML = "";

    this.fillInventoryGrid(this.inventoryListEl, storageEntries, 27);
    this.fillInventoryGrid(this.inventoryHotbarEl, hotbarEntries, 9);
  }

  fillInventoryGrid(container, entries, totalSlots) {
    for (let i = 0; i < totalSlots; i += 1) {
      const entry = entries[i];
      const slot = document.createElement("div");
      slot.className = entry ? "inventory-item-slot" : "inventory-empty-slot";

      if (entry) {
        const [itemId, count] = entry;
        const icon = document.createElement("div");
        icon.className = "inventory-item-icon";
        const iconDef = resolveHotbarIcon(itemId);
        if (iconDef?.url) {
          icon.style.backgroundImage = `url("${iconDef.url}")`;
          if (iconDef.tint === "grass") {
            icon.style.filter = "hue-rotate(-8deg) saturate(1.1) brightness(1.02)";
          }
        }

        const amount = document.createElement("div");
        amount.className = "inventory-item-count";
        amount.textContent = String(count);

        slot.appendChild(icon);
        slot.appendChild(amount);
      }

      container.appendChild(slot);
    }
  }

  renderHotbar(items = null) {
    if (!this.hotbarEl) return;
    if (items) {
      this.hotbarInventory = items;
    }
    const inventory = this.hotbarInventory || {};

    // Create slot elements once, then update in-place
    if (!this._hotbarSlots || this._hotbarSlots.length !== 9) {
      this.hotbarEl.innerHTML = "";
      this._hotbarSlots = [];
      for (let i = 0; i < 9; i++) {
        const slot = document.createElement("div");
        slot.className = "hotbar-slot";
        const icon = document.createElement("div");
        icon.className = "hotbar-icon";
        const count = document.createElement("div");
        count.className = "hotbar-count";
        slot.appendChild(icon);
        slot.appendChild(count);
        this.hotbarEl.appendChild(slot);
        this._hotbarSlots.push({ slot, icon, count });
      }
    }

    for (let i = 0; i < 9; i++) {
      const itemId = this.hotbarItems[i] || "";
      const { slot, icon, count } = this._hotbarSlots[i];

      const selected = i === this.selectedHotbarIndex;
      const empty = !itemId;
      const wantClass = `hotbar-slot${selected ? " is-selected" : ""}${empty ? " is-empty" : ""}`;
      if (slot.className !== wantClass) slot.className = wantClass;

      if (itemId) {
        const iconDef = resolveHotbarIcon(itemId);
        const bgImg = iconDef?.url ? `url("${iconDef.url}")` : "";
        if (icon.style.backgroundImage !== bgImg) icon.style.backgroundImage = bgImg;
        const filterVal = iconDef?.tint === "grass" ? "hue-rotate(-8deg) saturate(1.1) brightness(1.02)" : "";
        if (icon.style.filter !== filterVal) icon.style.filter = filterVal;
        icon.textContent = bgImg ? "" : itemId.slice(0, 2).toUpperCase();

        const amount = inventory[itemId] || 0;
        const countText = amount > 0 ? String(amount) : "";
        if (count.textContent !== countText) count.textContent = countText;
      } else {
        if (icon.style.backgroundImage) icon.style.backgroundImage = "";
        if (icon.style.filter) icon.style.filter = "";
        if (icon.textContent) icon.textContent = "";
        if (count.textContent) count.textContent = "";
      }
    }

    const xpFill = Math.min(100, Math.max(8, Object.keys(inventory).length * 12));
    if (this.hotbarXpFillEl) {
      this.hotbarXpFillEl.style.width = `${xpFill}%`;
    }
    this.renderHotbarLabel();
  }

  renderHotbarLabel() {
    if (!this.hotbarLabelEl) return;
    if (this.miningProgress > 0 && this.miningLabel) {
      this.hotbarLabelEl.textContent = `${this.miningLabel} ${Math.floor(this.miningProgress * 100)}%`;
      return;
    }
    this.hotbarLabelEl.textContent = this.selectedLabel || "";
  }

  renderVitals() {
    if (this.healthBarEl) {
      this._ensureVitalIcons(this.healthBarEl, 10, "heart", "_heartIcons");
      for (let i = 0; i < 10; i++) {
        const filled = i < this.health;
        const el = this._heartIcons[i];
        if (filled && !el.classList.contains("is-filled")) el.classList.add("is-filled");
        else if (!filled && el.classList.contains("is-filled")) el.classList.remove("is-filled");
      }
    }

    if (this.hungerBarEl) {
      this._ensureVitalIcons(this.hungerBarEl, 10, "hunger", "_hungerIcons");
      for (let i = 0; i < 10; i++) {
        const filled = i < this.hunger;
        const el = this._hungerIcons[i];
        if (filled && !el.classList.contains("is-filled")) el.classList.add("is-filled");
        else if (!filled && el.classList.contains("is-filled")) el.classList.remove("is-filled");
      }
    }
  }

  _ensureVitalIcons(container, count, type, cacheKey) {
    if (this[cacheKey] && this[cacheKey].length === count) return;
    container.innerHTML = "";
    this[cacheKey] = [];
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = `vital-icon ${type}`;
      container.appendChild(el);
      this[cacheKey].push(el);
    }
  }

  renderStatus(player, worldStats) {
    this.statusEl.textContent = `${Math.floor(player.pos.x)}, ${Math.floor(player.pos.y)}, ${Math.floor(player.pos.z)}`;
  }
}
