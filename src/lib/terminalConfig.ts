export const TERMINAL_FONT_SIZE = 14;
export const TERMINAL_FONT_FAMILY = "MesloLGS NF";
export const TERMINAL_LINE_HEIGHT = 1;

// Latin monospace first (macOS, then Windows), then CJK. None of the monospace
// fonts carry Han glyphs, and without a CJK family named here WebView2 falls
// back to SimSun, a thin bitmap-era serif that looks broken next to Meslo.
// xterm pins wide characters to two cells, so a proportional CJK face is fine.
const DEFAULT_FALLBACKS = [
  "MesloLGS NF",
  "Menlo",
  "Monaco",
  "Cascadia Mono",
  "Consolas",
  "Courier",
  "Andale Mono",
  "PingFang SC",
  "Microsoft YaHei UI",
  "Microsoft YaHei",
  "Noto Sans CJK SC",
  "monospace",
];
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
]);

export const FONT_OPTIONS = [
  { id: "MesloLGS NF", label: "MesloLGS Nerd Font" },
  { id: "Menlo", label: "Menlo" },
  { id: "Monaco", label: "Monaco" },
  { id: "Courier", label: "Courier" },
  { id: "Andale Mono", label: "Andale Mono" },
] as const;

export const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 18] as const;

/**
 * Normalize a fontFamily value to a clean font name for storage.
 * Strips CSS quotes and fallback chains from legacy config values.
 */
export function normalizeTerminalFontFamily(fontFamily: string): string {
  const trimmed = fontFamily.trim();
  if (!trimmed) return TERMINAL_FONT_FAMILY;

  // If it matches a preset exactly, return it
  if (FONT_OPTIONS.some((font) => font.id === trimmed)) return trimmed;

  // Strip legacy CSS-style values: "'0xProto', monospace" → "0xProto"
  const primary = trimmed.split(",")[0]!.trim();
  const unquoted = primary.replace(/^['"]|['"]$/g, "");
  return unquoted || TERMINAL_FONT_FAMILY;
}

function escapeCSSFontFamily(fontFamily: string): string {
  return fontFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Build a CSS font-family string for xterm.js from a stored font name.
 * Wraps each font in double quotes and appends fallback chain.
 */
export function buildCSSFontFamily(fontName: string): string {
  const fonts = [fontName, ...DEFAULT_FALLBACKS.filter((f) => f !== fontName)];
  return fonts
    .map((font) => {
      const trimmed = font.trim();
      return GENERIC_FAMILIES.has(trimmed.toLowerCase())
        ? trimmed
        : `"${escapeCSSFontFamily(trimmed)}"`;
    })
    .join(", ");
}
