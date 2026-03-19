import * as THREE from "../lib/three.js";
import { PLAYER_CONFIG } from "../constants.js";

export class PlayerController {
  constructor(camera, domElement, world) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;

    this.pos = new THREE.Vector3(0, 16, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.height = PLAYER_CONFIG.height;
    this.radius = PLAYER_CONFIG.radius;

    this.walkSpeed = PLAYER_CONFIG.walkSpeed;
    this.sprintSpeed = PLAYER_CONFIG.sprintSpeed;
    this.jumpSpeed = PLAYER_CONFIG.jumpSpeed;
    this.gravity = PLAYER_CONFIG.gravity;

    this.onGround = false;
    this.yaw = 0;
    this.pitch = 0;

    this.keys = new Set();
    this.pointerLocked = false;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 7;
  }

  attachListeners({ onPointerLockChange }) {
    document.addEventListener("keydown", (e) => this.keys.add(e.code));
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));

    this.domElement.addEventListener("click", () => this.domElement.requestPointerLock());

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
      onPointerLockChange?.(this.pointerLocked);
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.pitch));
    });
  }

  setFromSave(data) {
    if (!data) return;
    if (typeof data.x === "number" && typeof data.y === "number" && typeof data.z === "number") {
      this.pos.set(data.x, data.y, data.z);
    }
    if (typeof data.yaw === "number") this.yaw = data.yaw;
    if (typeof data.pitch === "number") this.pitch = data.pitch;
  }

  getSaveData() {
    return {
      x: this.pos.x,
      y: this.pos.y,
      z: this.pos.z,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  hasSolidAt(x, y, z) {
    return this.world.isSolidAt(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  resolveCollisions(nextPos) {
    this.onGround = false;

    for (let i = 0; i < 3; i++) {
      const ax = i === 0;
      const ay = i === 1;
      const az = i === 2;

      const p = this.pos.clone();
      if (ax) p.x = nextPos.x;
      if (ay) p.y = nextPos.y;
      if (az) p.z = nextPos.z;

      const minX = p.x - this.radius;
      const maxX = p.x + this.radius;
      const minY = p.y;
      const maxY = p.y + this.height;
      const minZ = p.z - this.radius;
      const maxZ = p.z + this.radius;

      let collided = false;

      for (let x = Math.floor(minX); x <= Math.floor(maxX); x++) {
        for (let y = Math.floor(minY); y <= Math.floor(maxY); y++) {
          for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z++) {
            if (!this.hasSolidAt(x + 0.001, y + 0.001, z + 0.001)) continue;

            const bx0 = x;
            const bx1 = x + 1;
            const by0 = y;
            const by1 = y + 1;
            const bz0 = z;
            const bz1 = z + 1;

            const overlap =
              minX < bx1 && maxX > bx0 && minY < by1 && maxY > by0 && minZ < bz1 && maxZ > bz0;

            if (!overlap) continue;

            collided = true;

            if (ax) {
              if (this.vel.x > 0) nextPos.x = bx0 - this.radius - 0.001;
              if (this.vel.x < 0) nextPos.x = bx1 + this.radius + 0.001;
              this.vel.x = 0;
            }

            if (ay) {
              if (this.vel.y > 0) nextPos.y = by0 - this.height - 0.001;
              if (this.vel.y < 0) {
                nextPos.y = by1;
                this.onGround = true;
              }
              this.vel.y = 0;
            }

            if (az) {
              if (this.vel.z > 0) nextPos.z = bz0 - this.radius - 0.001;
              if (this.vel.z < 0) nextPos.z = bz1 + this.radius + 0.001;
              this.vel.z = 0;
            }
          }
        }
      }

      if (ax && !collided) this.pos.x = nextPos.x;
      if (ay && !collided) this.pos.y = nextPos.y;
      if (az && !collided) this.pos.z = nextPos.z;
      if (collided) {
        if (ax) this.pos.x = nextPos.x;
        if (ay) this.pos.y = nextPos.y;
        if (az) this.pos.z = nextPos.z;
      }
    }
  }

  update(dt) {
    // three.js camera default forward is -Z, so movement vectors must match that basis.
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    const input = new THREE.Vector3();
    if (this.keys.has("KeyW")) input.add(forward);
    if (this.keys.has("KeyS")) input.sub(forward);
    if (this.keys.has("KeyD")) input.add(right);
    if (this.keys.has("KeyA")) input.sub(right);
    if (input.lengthSq() > 0) input.normalize();

    const speed = this.keys.has("ShiftLeft") ? this.sprintSpeed : this.walkSpeed;
    this.vel.x = input.x * speed;
    this.vel.z = input.z * speed;

    this.vel.y -= this.gravity * dt;
    if (this.keys.has("Space") && this.onGround) {
      this.vel.y = this.jumpSpeed;
      this.onGround = false;
    }

    const nextPos = this.pos.clone().addScaledVector(this.vel, dt);
    this.resolveCollisions(nextPos);

    if (this.pos.y < -30) {
      this.pos.set(0, 16, 0);
      this.vel.set(0, 0, 0);
    }

    this.camera.position.set(this.pos.x, this.pos.y + this.height * 0.9, this.pos.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  getLookTarget() {
    this.camera.getWorldDirection(this.raycaster.ray.direction);
    this.raycaster.ray.origin.copy(this.camera.position);
    return this.world.raycastBlock(
      this.raycaster.ray.origin,
      this.raycaster.ray.direction,
      this.raycaster.far
    );
  }

  canPlaceAt(x, y, z) {
    const minX = this.pos.x - this.radius;
    const maxX = this.pos.x + this.radius;
    const minY = this.pos.y;
    const maxY = this.pos.y + this.height;
    const minZ = this.pos.z - this.radius;
    const maxZ = this.pos.z + this.radius;

    const overlap =
      minX < x + 1 &&
      maxX > x &&
      minY < y + 1 &&
      maxY > y &&
      minZ < z + 1 &&
      maxZ > z;

    return !overlap;
  }
}
