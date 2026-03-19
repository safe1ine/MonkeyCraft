export function floorDiv(n, d) {
  return Math.floor(n / d);
}

export function mod(n, d) {
  return ((n % d) + d) % d;
}

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export function localKey(lx, y, lz) {
  return `${lx},${y},${lz}`;
}
