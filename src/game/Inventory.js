export class Inventory {
  constructor(initialItems = null) {
    this.items = new Map();
    if (initialItems && typeof initialItems === "object") {
      for (const [key, value] of Object.entries(initialItems)) {
        if (!Number.isFinite(value) || value <= 0) continue;
        this.items.set(key, Math.floor(value));
      }
    }
  }

  get(item) {
    return this.items.get(item) || 0;
  }

  has(item, count = 1) {
    return this.get(item) >= count;
  }

  add(item, count = 1) {
    if (!item || count <= 0) return;
    this.items.set(item, this.get(item) + Math.floor(count));
  }

  consume(item, count = 1) {
    const n = Math.floor(count);
    if (!this.has(item, n)) return false;
    const next = this.get(item) - n;
    if (next <= 0) this.items.delete(item);
    else this.items.set(item, next);
    return true;
  }

  canCraft(recipe) {
    for (const [item, count] of Object.entries(recipe.inputs || {})) {
      if (!this.has(item, count)) return false;
    }
    return true;
  }

  craft(recipe) {
    if (!this.canCraft(recipe)) return false;
    for (const [item, count] of Object.entries(recipe.inputs || {})) {
      this.consume(item, count);
    }
    for (const [item, count] of Object.entries(recipe.outputs || {})) {
      this.add(item, count);
    }
    return true;
  }

  toObject() {
    const out = {};
    for (const [k, v] of this.items.entries()) {
      out[k] = v;
    }
    return out;
  }
}

