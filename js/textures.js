// Procedural canvas-based textures so the project is fully self-contained.
// No external image dependencies — every body is generated from value noise + colour ramps.

import * as THREE from 'three';

// --- Deterministic noise -----------------------------------------------------

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeValueNoise(seed) {
  const rand = mulberry32(seed);
  const size = 256;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  function smooth(t) { return t * t * (3 - 2 * t); }

  function sample(x, y) {
    x = ((x % size) + size) % size;
    y = ((y % size) + size) % size;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
    const sx = smooth(x - x0), sy = smooth(y - y0);
    const a = grid[y0 * size + x0];
    const b = grid[y0 * size + x1];
    const c = grid[y1 * size + x0];
    const d = grid[y1 * size + x1];
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }

  return function fbm(x, y, octaves = 5, lacunarity = 2.0, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * sample(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  };
}

// --- Colour helpers ----------------------------------------------------------

function hex(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(a, b, t) {
  const ca = hex(a), cb = hex(b);
  return [lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)];
}
function ramp(stops, t) {
  // stops: [[t, color], ...] sorted
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    if (t <= t1) {
      const k = (t - t0) / Math.max(1e-6, t1 - t0);
      return lerpColor(c0, c1, Math.max(0, Math.min(1, k)));
    }
  }
  return hex(stops[stops.length - 1][1]);
}

// --- Texture builder ---------------------------------------------------------

function makeCanvas(w = 1024, h = 512) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

function paint(canvas, colorAt) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);
  const w = canvas.width, h = canvas.height;
  for (let y = 0; y < h; y++) {
    const v = y / h; // 0 north pole .. 1 south pole
    const lat = (v - 0.5) * Math.PI; // -pi/2 .. pi/2
    for (let x = 0; x < w; x++) {
      const u = x / w; // 0..1 longitude
      const lon = u * Math.PI * 2;
      const c = colorAt(u, v, lon, lat);
      const i = (y * w + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Sphere-friendly noise: sample on a sphere so the seam wraps cleanly.
function sphereNoise(noise) {
  return function (lon, lat, scale = 4) {
    const x = Math.cos(lat) * Math.cos(lon);
    const y = Math.cos(lat) * Math.sin(lon);
    const z = Math.sin(lat);
    return noise((x + 1) * scale * 32, (y + 1) * scale * 32 + (z + 1) * scale * 16, 6);
  };
}

// --- Surface generators ------------------------------------------------------

const PALETTES = {
  rocky: {
    base: [[0, 0x3a2e22], [0.4, 0x6b5640], [0.7, 0x8c7853], [1, 0xb39676]],
    crater: 0x2a2218
  },
  moon: {
    base: [[0, 0x4f4d49], [0.45, 0x8c8a86], [0.75, 0xb8b6b1], [1, 0xdedcd6]],
    crater: 0x2a2825
  },
  mars: {
    base: [[0, 0x5b1d0a], [0.4, 0xa83a16], [0.7, 0xc1440e], [0.95, 0xd87a45], [1, 0xeae3d6]]
  },
  venusian: {
    base: [[0, 0xb38050], [0.5, 0xd6a26a], [1, 0xefcfa3]]
  },
  earth: {
    sea: [[0, 0x0a2342], [0.5, 0x12468f], [1, 0x2c7be5]],
    land: [[0, 0x274d1b], [0.4, 0x4f7a2b], [0.7, 0x9c8a4d], [1, 0xd9c89a]],
    ice: 0xf0f4ff
  },
  jupiter: {
    bands: [
      0xc6a979, 0x8e6a44, 0xd8b88a, 0xb9905d, 0xf0d6a8,
      0x9e6e3a, 0xd0a878, 0xa57c4d, 0xe8caa0
    ],
    spot: 0xb24a2a
  },
  saturn: {
    bands: [0xead6a8, 0xd5be8a, 0xf2dfb1, 0xc6a974, 0xeed6a0, 0xd8c08a, 0xf2e0b4]
  },
  uranus: {
    bands: [0x9fdfe5, 0xbce8ec, 0xa9dde1, 0xc4eef0]
  },
  neptune: {
    bands: [0x2447a8, 0x3a64d8, 0x4a7be0, 0x2f56c8, 0x5a8be8],
    spot: 0x152a78
  },
  pluto: {
    base: [[0, 0x6d4f3a], [0.4, 0xb38e6e], [0.7, 0xd9bd9b], [1, 0xf0dfc6]],
    heart: 0xf6e3c8
  },
  icy: {
    base: [[0, 0x6e6e74], [0.4, 0xa8a9ad], [0.7, 0xcdced0], [1, 0xeaeaea]]
  },
  sun: {} // shader, no texture
};

function generateRocky(seed, palette = PALETTES.rocky) {
  const cv = makeCanvas(1024, 512);
  const noise = makeValueNoise(seed);
  const sn = sphereNoise(noise);

  // crater field — a sparse set of impact basins
  const rand = mulberry32(seed + 7);
  const craters = [];
  for (let i = 0; i < 220; i++) {
    craters.push({
      lon: rand() * Math.PI * 2,
      lat: (rand() - 0.5) * Math.PI,
      r: 0.005 + Math.pow(rand(), 4) * 0.06
    });
  }

  paint(cv, (u, v, lon, lat) => {
    const n = sn(lon, lat, 5);
    let c = ramp(palette.base, n);

    let craterShade = 0;
    for (const cr of craters) {
      const dlon = Math.abs(((lon - cr.lon + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const d = Math.sqrt(dlon * dlon + (lat - cr.lat) * (lat - cr.lat));
      if (d < cr.r) {
        const k = 1 - d / cr.r;
        craterShade = Math.max(craterShade, k * 0.6);
      }
    }
    if (craterShade > 0 && palette.crater !== undefined) {
      const cc = hex(palette.crater);
      c = [
        lerp(c[0], cc[0], craterShade),
        lerp(c[1], cc[1], craterShade),
        lerp(c[2], cc[2], craterShade)
      ];
    }
    return c;
  });
  return toTexture(cv);
}

function generateMars(seed) {
  const cv = makeCanvas(1024, 512);
  const noise = makeValueNoise(seed);
  const sn = sphereNoise(noise);
  const palette = PALETTES.mars;
  paint(cv, (u, v, lon, lat) => {
    const n = sn(lon, lat, 4);
    let c = ramp(palette.base, n);
    // polar caps
    const polar = Math.abs(lat) / (Math.PI / 2);
    if (polar > 0.82) {
      const k = (polar - 0.82) / 0.18;
      const ice = [240, 245, 250];
      c = [lerp(c[0], ice[0], k), lerp(c[1], ice[1], k), lerp(c[2], ice[2], k)];
    }
    return c;
  });
  return toTexture(cv);
}

function generateVenus(seed) {
  const cv = makeCanvas(1024, 512);
  const noise = makeValueNoise(seed);
  const sn = sphereNoise(noise);
  const palette = PALETTES.venusian;
  paint(cv, (u, v, lon, lat) => {
    const n1 = sn(lon, lat, 3);
    const n2 = sn(lon * 1.3 + 12, lat * 1.3 + 4, 6);
    const n = (n1 * 0.6 + n2 * 0.4);
    return ramp(palette.base, n);
  });
  return toTexture(cv);
}

function generateEarth(seed) {
  const cv = makeCanvas(2048, 1024);
  const noise = makeValueNoise(seed);
  const sn = sphereNoise(noise);
  const p = PALETTES.earth;
  paint(cv, (u, v, lon, lat) => {
    const continents = sn(lon, lat, 2);
    const detail = sn(lon * 2 + 17, lat * 2 + 9, 5) * 0.4;
    const h = continents + detail - 0.2;
    let c;
    if (h < 0.5) {
      c = ramp(p.sea, h / 0.5);
    } else {
      c = ramp(p.land, (h - 0.5) / 0.5);
    }
    // ice caps
    const polar = Math.abs(lat) / (Math.PI / 2);
    if (polar > 0.78) {
      const k = Math.min(1, (polar - 0.78) / 0.18);
      const ice = hex(p.ice);
      c = [lerp(c[0], ice[0], k), lerp(c[1], ice[1], k), lerp(c[2], ice[2], k)];
    }
    return c;
  });
  return toTexture(cv);
}

function generateEarthClouds(seed) {
  const cv = makeCanvas(1024, 512);
  const ctx = cv.getContext('2d');
  const noise = makeValueNoise(seed + 999);
  const sn = sphereNoise(noise);
  const img = ctx.createImageData(cv.width, cv.height);
  for (let y = 0; y < cv.height; y++) {
    const lat = (y / cv.height - 0.5) * Math.PI;
    for (let x = 0; x < cv.width; x++) {
      const lon = (x / cv.width) * Math.PI * 2;
      const n = sn(lon, lat, 3);
      const a = Math.max(0, Math.min(1, (n - 0.5) * 2.4));
      const i = (y * cv.width + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      img.data[i + 3] = a * 220;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function generateBanded(seed, palette, opts = {}) {
  const cv = makeCanvas(1024, 512);
  const noise = makeValueNoise(seed);
  const sn = sphereNoise(noise);
  paint(cv, (u, v, lon, lat) => {
    // bands by latitude with wavy turbulence
    const turb = (sn(lon, lat, 6) - 0.5) * 0.18;
    const band = (v + turb);
    const idx = Math.floor(band * palette.bands.length * (opts.bandFreq || 1.5)) % palette.bands.length;
    const next = (idx + 1) % palette.bands.length;
    const k = (band * palette.bands.length * (opts.bandFreq || 1.5)) % 1;
    let c = lerpColor(palette.bands[idx], palette.bands[next], k);

    // local storm detail
    const swirl = sn(lon * 2 + 5, lat * 2, 4);
    c = [
      lerp(c[0], c[0] * (0.85 + 0.3 * swirl), 0.35),
      lerp(c[1], c[1] * (0.85 + 0.3 * swirl), 0.35),
      lerp(c[2], c[2] * (0.85 + 0.3 * swirl), 0.35)
    ];

    // optional spot (Great Red Spot, Great Dark Spot)
    if (palette.spot !== undefined && opts.spot) {
      const sx = opts.spot.lon, sy = opts.spot.lat;
      const dx = Math.abs(((lon - sx + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 1.7;
      const dy = (lat - sy) * 3.0;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.45) {
        const k2 = 1 - d / 0.45;
        const sc = hex(palette.spot);
        c = [lerp(c[0], sc[0], k2), lerp(c[1], sc[1], k2), lerp(c[2], sc[2], k2)];
      }
    }
    return c.map(v => Math.max(0, Math.min(255, v)));
  });
  return toTexture(cv);
}

function generatePluto(seed) {
  const cv = makeCanvas(1024, 512);
  const noise = makeValueNoise(seed);
  const sn = sphereNoise(noise);
  const p = PALETTES.pluto;
  paint(cv, (u, v, lon, lat) => {
    const n = sn(lon, lat, 4);
    let c = ramp(p.base, n);
    // bright "heart" region near 0° lon, southern equatorial
    const dx = Math.abs(((lon - 0.4 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const dy = lat + 0.05;
    const d = Math.sqrt(dx * dx * 1.3 + dy * dy * 2);
    if (d < 0.55) {
      const k = Math.pow(1 - d / 0.55, 1.6);
      const hc = hex(p.heart);
      c = [lerp(c[0], hc[0], k * 0.85), lerp(c[1], hc[1], k * 0.85), lerp(c[2], hc[2], k * 0.85)];
    }
    return c;
  });
  return toTexture(cv);
}

// --- Public API --------------------------------------------------------------

const cache = new Map();
function getCached(key, factory) {
  if (cache.has(key)) return cache.get(key);
  const v = factory();
  cache.set(key, v);
  return v;
}

let seedCounter = 1;
function nextSeed(id) {
  // stable seed per body id so the look is reproducible across reloads
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

export function buildSurfaceTexture(body) {
  return getCached('surf:' + body.id, () => {
    const s = nextSeed(body.id);
    switch (body.surface) {
      case 'rocky': return generateRocky(s);
      case 'moon': return generateRocky(s, PALETTES.moon);
      case 'icy': return generateRocky(s, PALETTES.icy);
      case 'mars': return generateMars(s);
      case 'venusian': return generateVenus(s);
      case 'earth': return generateEarth(s);
      case 'jupiter':
        return generateBanded(s, PALETTES.jupiter, { bandFreq: 1.8, spot: { lon: Math.PI * 1.1, lat: -0.3 } });
      case 'saturn':
        return generateBanded(s, PALETTES.saturn, { bandFreq: 1.6 });
      case 'uranus':
        return generateBanded(s, PALETTES.uranus, { bandFreq: 0.8 });
      case 'neptune':
        return generateBanded(s, PALETTES.neptune, { bandFreq: 1.2, spot: { lon: Math.PI * 0.7, lat: -0.5 } });
      case 'pluto': return generatePluto(s);
      default: return generateRocky(s);
    }
  });
}

export function buildEarthCloudsTexture() {
  return getCached('earth-clouds', () => generateEarthClouds(nextSeed('earth-clouds')));
}

// Saturn-style ring texture (radial bands with alpha)
export function buildRingTexture(innerColorHex, outerColorHex, density = 1) {
  return getCached('ring:' + innerColorHex.toString(16) + ':' + outerColorHex.toString(16) + ':' + density, () => {
    const w = 1024, h = 64;
    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    const noise = makeValueNoise(424242);
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const c = lerpColor(innerColorHex, outerColorHex, t);
      // radial density bands and Cassini-like gaps
      let alpha = 0.85 * density;
      const bandNoise = noise(x * 0.6, 0.5, 4);
      alpha *= 0.55 + 0.55 * bandNoise;
      // gap roughly at 60-65%
      if (t > 0.6 && t < 0.66) alpha *= 0.1;
      // soft edges
      if (t < 0.04) alpha *= t / 0.04;
      if (t > 0.96) alpha *= (1 - t) / 0.04;
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = Math.max(0, Math.min(255, alpha * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  });
}

// Bright sun colour ramp painted as a fiery surface texture.
export function buildSunTexture() {
  return getCached('sun', () => {
    const cv = makeCanvas(1024, 512);
    const noise = makeValueNoise(nextSeed('sun'));
    const sn = sphereNoise(noise);
    paint(cv, (u, v, lon, lat) => {
      const n = sn(lon, lat, 8);
      const stops = [[0, 0xb8350a], [0.4, 0xff6a00], [0.75, 0xffb838], [1, 0xfff1b0]];
      return ramp(stops, n);
    });
    return toTexture(cv);
  });
}

// Star field cubemap-ish background as an equirect texture.
export function buildStarfieldTexture() {
  return getCached('stars', () => {
    const w = 2048, h = 1024;
    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#01010a';
    ctx.fillRect(0, 0, w, h);
    // faint nebulae
    const noise = makeValueNoise(7);
    const img = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = noise(x * 0.6, y * 0.6, 4);
        const i = (y * w + x) * 4;
        const tint = Math.pow(n, 4) * 25;
        img.data[i] += tint * 0.4;
        img.data[i + 1] += tint * 0.5;
        img.data[i + 2] += tint;
      }
    }
    ctx.putImageData(img, 0, 0);

    // sprinkle stars
    const rand = mulberry32(31415);
    for (let i = 0; i < 6000; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = Math.pow(rand(), 6) * 1.8 + 0.2;
      const b = 160 + rand() * 95;
      const tintR = b - rand() * 30;
      const tintG = b - rand() * 25;
      const tintB = Math.min(255, b + rand() * 25);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${tintR|0},${tintG|0},${tintB|0},${0.6 + rand() * 0.4})`;
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  });
}
