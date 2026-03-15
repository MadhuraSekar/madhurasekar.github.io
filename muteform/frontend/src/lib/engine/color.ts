// ─── Color utilities: deltaE2000, contrast ratio, luminance ──

/** Parse hex (#RGB, #RRGGBB) to [r,g,b] 0-255 */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')
}

/** sRGB channel to linear */
function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

/** WCAG contrast ratio between two hex colors */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ─── CIE Lab conversion for deltaE2000 ──

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b)
  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750,
    rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041,
  ]
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const xn = 0.95047, yn = 1.0, zn = 1.08883
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
  const fx = f(x / xn), fy = f(y / yn), fz = f(z / zn)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  const [x, y, z] = rgbToXyz(r, g, b)
  return xyzToLab(x, y, z)
}

/** deltaE2000 — perceptual color difference */
export function deltaE2000(hex1: string, hex2: string): number {
  const [L1, a1, b1] = hexToLab(hex1)
  const [L2, a2, b2] = hexToLab(hex2)

  const kL = 1, kC = 1, kH = 1
  const C1 = Math.sqrt(a1 * a1 + b1 * b1)
  const C2 = Math.sqrt(a2 * a2 + b2 * b2)
  const Cb = (C1 + C2) / 2
  const Cb7 = Math.pow(Cb, 7)
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + Math.pow(25, 7))))
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G)
  const C1p = Math.sqrt(a1p * a1p + b1 * b1)
  const C2p = Math.sqrt(a2p * a2p + b2 * b2)
  let h1p = Math.atan2(b1, a1p) * 180 / Math.PI
  if (h1p < 0) h1p += 360
  let h2p = Math.atan2(b2, a2p) * 180 / Math.PI
  if (h2p < 0) h2p += 360

  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp: number
  if (C1p * C2p === 0) {
    dhp = 0
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360
  } else {
    dhp = h2p - h1p + 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360)

  const Lbp = (L1 + L2) / 2
  const Cbp = (C1p + C2p) / 2
  let Hbp: number
  if (C1p * C2p === 0) {
    Hbp = h1p + h2p
  } else if (Math.abs(h1p - h2p) <= 180) {
    Hbp = (h1p + h2p) / 2
  } else if (h1p + h2p < 360) {
    Hbp = (h1p + h2p + 360) / 2
  } else {
    Hbp = (h1p + h2p - 360) / 2
  }

  const T = 1 - 0.17 * Math.cos((Hbp - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * Hbp * Math.PI / 180)
    + 0.32 * Math.cos((3 * Hbp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * Hbp - 63) * Math.PI / 180)

  const SL = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2))
  const SC = 1 + 0.045 * Cbp
  const SH = 1 + 0.015 * Cbp * T

  const Cbp7 = Math.pow(Cbp, 7)
  const RT = -2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)))
    * Math.sin(60 * Math.exp(-Math.pow((Hbp - 275) / 25, 2)) * Math.PI / 180)

  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  )
}

/** Find nearest color from a palette by deltaE2000 */
export function findNearestColor(target: string, palette: Record<string, string>): { name: string; hex: string; distance: number } {
  let best = { name: '', hex: '', distance: Infinity }
  for (const [name, hex] of Object.entries(palette)) {
    const d = deltaE2000(target, hex)
    if (d < best.distance) best = { name, hex, distance: d }
  }
  return best
}

/** Adjust foreground color to meet target contrast ratio against a background */
export function adjustForegroundForContrast(fg: string, bg: string, targetRatio: number = 4.5): string {
  const bgLum = relativeLuminance(bg)
  let [r, g, b] = hexToRgb(fg)
  const fgLum = relativeLuminance(fg)

  // Determine if we need to lighten or darken
  const shouldLighten = fgLum > bgLum

  for (let i = 0; i < 100; i++) {
    const currentRatio = contrastRatio(rgbToHex(r, g, b), bg)
    if (currentRatio >= targetRatio) break

    if (shouldLighten) {
      r = Math.min(255, r + 3)
      g = Math.min(255, g + 3)
      b = Math.min(255, b + 3)
    } else {
      r = Math.max(0, r - 3)
      g = Math.max(0, g - 3)
      b = Math.max(0, b - 3)
    }
  }

  // If still not meeting ratio, try the opposite direction
  if (contrastRatio(rgbToHex(r, g, b), bg) < targetRatio) {
    ;[r, g, b] = hexToRgb(fg)
    for (let i = 0; i < 200; i++) {
      const currentRatio = contrastRatio(rgbToHex(r, g, b), bg)
      if (currentRatio >= targetRatio) break
      if (!shouldLighten) {
        r = Math.min(255, r + 2)
        g = Math.min(255, g + 2)
        b = Math.min(255, b + 2)
      } else {
        r = Math.max(0, r - 2)
        g = Math.max(0, g - 2)
        b = Math.max(0, b - 2)
      }
    }
  }

  return rgbToHex(r, g, b)
}
