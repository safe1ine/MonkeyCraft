export class Hud {
  constructor() {
    this.tipsEl = document.getElementById("tips");
    this.statusEl = document.getElementById("status");
    this.toolboxEl = document.getElementById("toolbox");
    this.inventoryListEl = document.getElementById("inventory-list");
    this.recipeListEl = document.getElementById("recipe-list");
    this.selectedLabel = "泥土";
    this.miningLabel = "";
    this.miningProgress = 0;
    this.inventorySummary = "";
    this.toolboxOpen = false;
  }

  setPointerLock(locked) {
    this.tipsEl.textContent = locked
      ? "WASD 移动 | Space 跳跃 | Shift 冲刺 | 左键挖掘 | 右键放置 | 1-6 切换方块 | E 工具箱"
      : "点击屏幕开始 | WASD 移动 | Space 跳跃 | Shift 冲刺 | 左键挖掘 | 右键放置 | 1-6 切换方块 | E 工具箱";
  }

  setSelectedBlock(label) {
    this.selectedLabel = label;
  }

  setMiningProgress(label, progress) {
    this.miningLabel = label || "";
    this.miningProgress = Math.max(0, Math.min(1, progress || 0));
  }

  setInventory(items, labels) {
    if (!this.inventoryListEl) return;
    const entries = Object.entries(items || {}).filter(([, count]) => count > 0);
    this.inventoryListEl.innerHTML = "";

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "toolbox-empty";
      empty.textContent = "背包为空，先去挖点方块。";
      this.inventoryListEl.appendChild(empty);
      this.inventorySummary = "背包空";
      return;
    }

    const grid = document.createElement("div");
    grid.className = "slot-grid";

    const summary = [];
    for (const [id, count] of entries) {
      const row = document.createElement("div");
      row.className = "slot-item";
      const name = labels?.[id] || id;
      row.title = `${name} x${count}`;

      const badge = document.createElement("div");
      badge.className = "slot-badge";
      badge.textContent = name.slice(0, 2).toUpperCase();

      const amount = document.createElement("div");
      amount.className = "slot-count";
      amount.textContent = String(count);

      row.appendChild(badge);
      row.appendChild(amount);
      grid.appendChild(row);
      summary.push(`${name}:${count}`);
    }
    this.inventoryListEl.appendChild(grid);
    this.inventorySummary = summary.slice(0, 4).join(" ");
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
    return this.toolboxOpen;
  }

  renderStatus(player, worldStats) {
    const miningText =
      this.miningProgress > 0
        ? ` | 挖掘: ${Math.floor(this.miningProgress * 100)}% ${this.miningLabel}`
        : "";
    const bagText = this.inventorySummary ? ` | 背包: ${this.inventorySummary}` : "";
    this.statusEl.textContent = `位置: ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)} | 区块: ${worldStats.chunks} | 显示方块: ${worldStats.meshes} | 当前: ${this.selectedLabel}${bagText}${miningText}`;
  }
}
