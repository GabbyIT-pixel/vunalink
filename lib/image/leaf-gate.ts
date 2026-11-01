// Rough check that an image contains enough leaf-like green.
// `rgb` holds raw 0-255 values, three per pixel, as imageToModelInput produces.
export const MIN_GREEN_RATIO = 0.1; // provisional, tune on real images

export function greenRatio(rgb: ArrayLike<number>): number {
  const pixelCount = Math.floor(rgb.length / 3);
  if (pixelCount === 0) return 0;
  let green = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    const r = rgb[i * 3] / 255;
    const g = rgb[i * 3 + 1] / 255;
    const b = rgb[i * 3 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0 || max < 0.15) continue; // grey, white or black
    if (delta / max < 0.15) continue; // washed-out colour
    let hue: number;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
    if (hue >= 45 && hue <= 170) green += 1;
  }
  return green / pixelCount;
}

export function looksLikeLeaf(rgb: ArrayLike<number>): boolean {
  return greenRatio(rgb) >= MIN_GREEN_RATIO;
}
