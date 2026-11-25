// Procedural Magic Block & Rimeshell pixel renderer (docs/ART.md §6).
// Deterministic from (tone, grade, purityBp, pattern) using Ninja Adventure's 53-color palette.

export interface BlockSpec {
  tone: number;
  grade: number;
  purityBp: number;
  pattern: number;
}

interface Ramp {
  deep: string;
  shadow: string;
  base: string;
  light: string;
  highlight: string;
}

const OUTLINE = "#141b1b";

const RAMPS: Record<number, Ramp> = {
  0: { deep: "#543c52", shadow: "#8f3e56", base: "#e0394c", light: "#ef9597", highlight: "#f2eaf1" }, // Dawn
  1: { deep: "#965340", shadow: "#d78b4a", base: "#f1c471", light: "#ffe18d", highlight: "#f2eaf1" }, // Noon
  2: { deep: "#4a5270", shadow: "#548789", base: "#79b8ce", light: "#b8dce5", highlight: "#f2eaf1" }, // Blue Hour pale
  3: { deep: "#3b3643", shadow: "#543c52", base: "#a5608b", light: "#d3a2c0", highlight: "#f2eaf1" }, // Dusk
};

const BLUE_DEEP: Ramp = {
  deep: "#3b3643",
  shadow: "#4a5270",
  base: "#2d697b",
  light: "#79b8ce",
  highlight: "#f2eaf1",
};

const LEGENDARY_PATTERNS: Record<number, number[]> = {
  0: [1, 108, 451],
  1: [12, 360, 606],
  2: [42, 314, 661],
  3: [555, 777, 888],
};

function isNotableBlue(tone: number, pattern: number): boolean {
  if (tone !== 2) return false;
  if (LEGENDARY_PATTERNS[2].includes(pattern)) return true;
  return pattern % 50 === 11 || pattern === 661;
}

function rampFor(tone: number, pattern: number): Ramp {
  if (tone === 2 && isNotableBlue(tone, pattern)) {
    return pattern === 661 ? { ...BLUE_DEEP, highlight: "#8feff1" } : BLUE_DEEP;
  }
  return RAMPS[tone] ?? RAMPS[0];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSpec(spec: BlockSpec): number {
  let h = 2166136261;
  for (const v of [spec.tone, spec.grade, spec.purityBp, spec.pattern]) {
    h ^= v;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const cache = new Map<string, string>();

/** Renders a Magic Block into a crisp data URL (cached by visual attributes). */
export function renderBlockDataUrl(spec: BlockSpec, px: 16 | 64 = 64): string {
  const key = `gem:${spec.tone}:${spec.grade}:${spec.purityBp}:${spec.pattern}:${px}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingEnabled = false;

  const scale = px === 64 ? 4 : 1;
  const rand = mulberry32(hashSpec(spec));
  const ramp = rampFor(spec.tone, spec.pattern);
  const grade = Math.max(0, Math.min(4, spec.grade));
  const purity = Math.max(0, Math.min(1, spec.purityBp / 10000));

  const put = (x: number, y: number, color: string, alpha = 1) => {
    if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  };

  // Glow behind the cube (grades 1..4).
  if (grade >= 1) {
    const radius = [0, 2, 3, 4, 6][grade];
    const alpha = [0, 0.18, 0.25, 0.33, 0.45][grade];
    const glowColor = spec.tone === 2 && spec.pattern === 661 ? "#71ddee" : ramp.light;
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const dx = Math.max(1 - x, 0, x - 14);
        const dy = Math.max(1 - y, 0, y - 14);
        const d = Math.hypot(dx, dy);
        if (d > 0 && d <= radius && (d < radius - 1 || ((x + y) & 1) === 0)) {
          put(x, y, glowColor, alpha);
        }
      }
    }
  }
  ctx.globalAlpha = 1;

  // Classify each pixel of the 16x16 3/4 cube.
  const topColor = grade === 0 ? ramp.base : ramp.light;
  const frontColor = grade === 0 ? ramp.shadow : ramp.base;
  const sideColor = grade === 0 ? ramp.deep : ramp.shadow;

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const kind = cubeCell(x, y);
      if (kind === 0) continue;
      if (grade === 0 && kind === 1 && rand() < 0.38) continue;
      if (grade === 1 && kind === 1 && ((x === 5 && y === 1) || (x === 14 && y === 1)) && rand() < 0.85) continue;

      if (kind === 1) {
        put(x, y, OUTLINE);
      } else if (kind === 2) {
        put(x, y, topColor);
      } else if (kind === 3) {
        put(x, y, frontColor);
      } else {
        put(x, y, sideColor);
      }
    }
  }

  // Swirl pattern across front & top faces.
  const arms = 1 + (spec.pattern % 3);
  const twist = ((spec.pattern >> 2) % 5) - 2;
  const phase = ((spec.pattern * 13) % 628) / 100;
  for (let y = 5; y <= 14; y += 1) {
    for (let x = 1; x <= 10; x += 1) {
      const rx = (x - 5.5) / 5;
      const ry = (y - 9.5) / 5;
      const r = Math.hypot(rx, ry);
      const a = Math.atan2(ry, rx);
      const v = Math.sin(arms * (a + twist * r * 0.6) + phase);
      if (v > 0.68) put(x, y, grade >= 3 ? ramp.highlight : ramp.light, 0.78);
      else if (v > 0.52) put(x, y, ramp.light, 0.45);
    }
  }

  // Grade bevels & cores.
  if (grade >= 2) {
    for (let x = 1; x <= 10; x += 1) put(x, 5, grade === 4 ? ramp.highlight : ramp.light);
    for (let y = 5; y <= 14; y += 1) put(1, y, grade === 4 ? ramp.highlight : ramp.light);
  }
  if (grade >= 3) {
    for (let x = 2; x <= 10; x += 1) put(x, 14, ramp.shadow);
    for (let y = 6; y <= 14; y += 1) put(10, y, ramp.shadow);
    put(5, 9, ramp.highlight);
    put(6, 9, ramp.highlight);
    put(5, 10, ramp.highlight);
    put(6, 10, ramp.highlight);
    // 4-point sparkle at far top corner.
    put(13, 2, ramp.highlight);
    put(12, 2, ramp.light);
    put(14, 2, ramp.light);
    put(13, 1, ramp.light);
    put(13, 3, ramp.light);
  }
  if (grade === 4) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) put(5 + dx, 9 + dy, ramp.highlight);
    }
  }

  // Purity inclusions + low-purity haze.
  const specks = Math.round((1 - purity) * 6) + (grade === 0 ? 4 : 0);
  const speckColor = grade === 4 ? ramp.shadow : ramp.deep;
  for (let i = 0; i < specks; i += 1) {
    const sx = 2 + Math.floor(rand() * 8);
    const sy = 6 + Math.floor(rand() * 8);
    put(sx, sy, speckColor);
  }
  if (purity < 0.45) {
    const density = (0.45 - purity) / 0.45;
    for (let y = 6; y <= 13; y += 1) {
      for (let x = 2; x <= 9; x += 1) {
        if (((x + y) & 1) === 0 && rand() < density * 0.55) put(x, y, ramp.light, 0.35);
      }
    }
  }

  // Legendary named motifs (ART.md §6).
  if (spec.tone === 0 && spec.pattern === 1) {
    // Green Flash rim
    for (let x = 5; x <= 14; x += 1) put(x, 1, "#adbc3a");
    put(14, 2, "#74a334");
  } else if (spec.tone === 0 && spec.pattern === 451) {
    // Six-Ray Star
    for (let i = -3; i <= 3; i += 1) {
      put(5, 9 + i, "#f2eaf1");
      put(5 + i, 9 + Math.round(i * 0.6), "#f2eaf1");
      put(5 + i, 9 - Math.round(i * 0.6), "#f2eaf1");
    }
  } else if (spec.tone === 3 && spec.pattern === 777) {
    // Gloam's Eye
    for (let dx = -2; dx <= 2; dx += 1) {
      put(5 + dx, 8, "#f2eaf1");
      put(5 + dx, 11, "#f2eaf1");
    }
    put(5, 9, OUTLINE);
    put(5, 10, OUTLINE);
  } else if (spec.tone === 1 && spec.pattern === 606) {
    // Sunwheel
    for (const [dx, dy] of [[0, 0], [0, -2], [2, -1], [2, 1], [0, 2], [-2, 1], [-2, -1]]) {
      put(5 + dx, 9 + dy, "#f2eaf1");
    }
  }

  ctx.globalAlpha = 1;
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

/** Deterministic pixel-identical Rimeshell sprite (no per-instance leaks!). */
export function renderShellDataUrl(shell: number, px: 16 | 64 = 64): string {
  const key = `geode:${shell}:${px}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingEnabled = false;
  const scale = px === 64 ? 4 : 1;

  const put = (x: number, y: number, color: string) => {
    if (x < 0 || y < 0 || x >= 16 || y >= 16) return;
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  };

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const kind = cubeCell(x, y);
      if (kind === 0) continue;
      // Rounded frosted silhouette: drop the extreme corners.
      if ((x === 5 && y === 0) || (x === 0 && y === 5) || (x === 14 && y === 0)) continue;
      if (kind === 1) put(x, y, OUTLINE);
      else if (kind === 2) put(x, y, "#f2eaf1");
      else if (kind === 3) put(x, y, (x * 7 + y * 13) % 5 === 0 ? "#8feff1" : "#b8dce5");
      else put(x, y, "#abc2bc");
    }
  }

  // Frost spikes along top edge (Small 1, Medium 2, Large 3, Crater 4, Boss glowing).
  const spikes = shell >= 3 ? [4, 7, 10, 13] : shell === 2 ? [5, 8, 11] : shell === 1 ? [6, 10] : [8];
  for (const sx of spikes) {
    put(sx, 1, "#f2eaf1");
    put(sx, 0, "#8feff1");
  }
  if (shell === 3) {
    for (let x = 1; x <= 10; x += 1) put(x, 5, "#ffe18d");
  } else if (shell === 4) {
    for (let x = 2; x <= 9; x += 1) put(x, 5, "#ef9597");
  }

  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

/**
 * 3/4 cube geometry from docs/ART.md §6:
 * 0 = empty, 1 = outline, 2 = top, 3 = front, 4 = side.
 */
function cubeCell(x: number, y: number): 0 | 1 | 2 | 3 | 4 {
  if (y === 0) return x >= 5 && x <= 14 ? 1 : 0;
  if (y >= 1 && y <= 4) {
    const left = 5 - y;
    const rightTop = 14 - y;
    if (x === left || x === 15) return 1;
    if (x > left && x <= rightTop) return 2;
    if (x > rightTop && x < 15) return 4;
    return 0;
  }
  if (y >= 5 && y <= 10) {
    if (x === 0 || x === 15) return 1;
    if (x >= 1 && x <= 10) return 3;
    if (x >= 11 && x <= 14) return 4;
    return 0;
  }
  if (y >= 11 && y <= 14) {
    const right = 25 - y;
    if (x === 0 || x === right) return 1;
    if (x >= 1 && x <= 10) return 3;
    if (x >= 11 && x < right) return 4;
    return 0;
  }
  if (y === 15) return x >= 1 && x <= 10 ? 1 : 0;
  return 0;
}
