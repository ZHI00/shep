import { hexLuminance } from "./themes";
import type { ShepTheme } from "./themes";

/**
 * xterm's WebGL renderer paints the selection at 50% over any cell that carries
 * its own background — an agent's prompt box, a diff row, a search hit — so a
 * selection tuned to only just read against the terminal background disappears
 * inside them. Ask for enough contrast that half of it still registers.
 */
const MIN_BACKGROUND_CONTRAST = 2.4;

/** ...but never so much that the text sitting on the selection stops reading. */
const MIN_TEXT_CONTRAST = 4;

/** Granularity of the search for a color that satisfies both. */
const STEP = 0.05;

/** How far a glass theme's selection may be thickened before it turns opaque. */
const MAX_TRANSLUCENT_ALPHA = 0.75;

type Rgb = [number, number, number];

interface ParsedColor {
  rgb: Rgb;
  alpha: number;
}

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`;
}

function parseColor(value: string): ParsedColor | null {
  const color = value.trim().toLowerCase();
  const hex = color.match(/^#([\da-f]{6})([\da-f]{2})?$/);
  if (hex) {
    const channels = [0, 2, 4].map((offset) =>
      parseInt(hex[1].slice(offset, offset + 2), 16),
    ) as Rgb;
    return { rgb: channels, alpha: hex[2] ? parseInt(hex[2], 16) / 255 : 1 };
  }
  // Custom themes build their selection color with rgba() — see customThemes.ts.
  const rgba = color.match(/^rgba?\(([^)]+)\)$/);
  if (!rgba) return null;
  const parts = rgba[1].split(",").map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) return null;
  const alpha = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
  return { rgb: parts.slice(0, 3) as Rgb, alpha };
}

function mixHex(base: string, overlay: string, amount: number): string {
  const from = parseColor(base);
  const to = parseColor(overlay);
  if (!from || !to) return overlay;
  return toHex(from.rgb.map((channel, i) => channel + (to.rgb[i] - channel) * amount) as Rgb);
}

/** WCAG contrast ratio between two opaque `#rrggbb` colors (1 = identical). */
export function contrastRatio(a: string, b: string): number {
  const first = hexLuminance(a) + 0.05;
  const second = hexLuminance(b) + 0.05;
  return first > second ? first / second : second / first;
}

function tune(flat: string, background: string, foreground: string): string {
  if (contrastRatio(flat, background) < MIN_BACKGROUND_CONTRAST) {
    // Too faint to notice: step toward the text color, stopping as soon as the
    // selection reads — or as soon as the text on it would stop reading, which
    // is what keeps light themes from turning into dark bands.
    let tuned = flat;
    for (let amount = STEP; amount <= 1; amount += STEP) {
      const candidate = mixHex(flat, foreground, amount);
      if (contrastRatio(candidate, foreground) < MIN_TEXT_CONTRAST) break;
      tuned = candidate;
      if (contrastRatio(candidate, background) >= MIN_BACKGROUND_CONTRAST) break;
    }
    return tuned;
  }

  if (contrastRatio(flat, foreground) < MIN_TEXT_CONTRAST) {
    // Loud enough to swallow whatever it covers — a dark theme's selection
    // color used by a light theme, say. Step back toward the background.
    let tuned = flat;
    for (let amount = STEP; amount <= 1; amount += STEP) {
      tuned = mixHex(flat, background, amount);
      if (contrastRatio(tuned, foreground) >= MIN_TEXT_CONTRAST) break;
      if (contrastRatio(tuned, background) <= MIN_BACKGROUND_CONTRAST) break;
    }
    return tuned;
  }

  return flat;
}

/**
 * Glass themes keep their translucency: find the color that lands on `tuned`
 * once the window tint shows through it, thickening the layer only when the
 * theme's own opacity can't carry that much color.
 */
function keepTranslucent(tuned: string, background: string, alpha: number): string | null {
  const target = parseColor(tuned);
  const base = parseColor(background);
  if (!target || !base) return null;

  for (let opacity = alpha; opacity <= MAX_TRANSLUCENT_ALPHA; opacity += STEP) {
    const raw = target.rgb.map(
      (channel, i) => base.rgb[i] + (channel - base.rgb[i]) / opacity,
    ) as Rgb;
    if (raw.some((channel) => channel < -0.5 || channel > 255.5)) continue;
    return `${toHex(raw)}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
  }
  return null;
}

/**
 * The selection background xterm should use for a theme: the theme's own color
 * whenever it already works, otherwise the nearest one that stays visible over
 * an agent's colored prompt box without washing out the text on top of it.
 */
export function resolveSelectionBackground(theme: ShepTheme): string {
  const selection = parseColor(theme.termSelection);
  const background = parseColor(theme.appBg);
  const foreground = parseColor(theme.termForeground);
  if (!selection || !background || !foreground) return theme.termSelection;

  const backgroundHex = toHex(background.rgb);
  const foregroundHex = toHex(foreground.rgb);
  // What the selection actually looks like once the terminal composites it.
  const flat = mixHex(backgroundHex, toHex(selection.rgb), selection.alpha);
  const tuned = tune(flat, backgroundHex, foregroundHex);

  if (tuned === flat) return theme.termSelection;
  if (selection.alpha >= 1) return tuned;
  return keepTranslucent(tuned, backgroundHex, selection.alpha) ?? tuned;
}
