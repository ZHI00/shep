import assert from "node:assert/strict";
import test from "node:test";

import { contrastRatio, resolveSelectionBackground } from "../src/lib/terminalSelection.ts";
import { THEMES, THEME_LIST, hexLuminance } from "../src/lib/themes.ts";
import type { ShepTheme } from "../src/lib/themes.ts";

const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const flatten = (color: string, over: string): string => {
  const alpha = color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
  return mix(over, color.slice(0, 7), alpha);
};

/** The 50% blend xterm's WebGL renderer applies over a cell with its own bg. */
const mix = (base: string, overlay: string, amount: number): string => {
  const [br, bg, bb] = rgb(base);
  const [or, og, ob] = rgb(overlay);
  return `#${[
    br + (or - br) * amount,
    bg + (og - bg) * amount,
    bb + (ob - bb) * amount,
  ]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
};

test("the default theme's selection is strengthened", () => {
  const theme = THEMES.catppuccin;
  const resolved = resolveSelectionBackground(theme);
  assert.notEqual(resolved, theme.termSelection);
  assert.ok(contrastRatio(resolved, theme.appBg) >= 2.4);
  assert.ok(contrastRatio(resolved, theme.termForeground) >= 4);
});

test("a selection that already reads is left untouched", () => {
  const theme = THEMES.jellybeans;
  assert.equal(resolveSelectionBackground(theme), theme.termSelection);
});

test("a selection too dark for its own text is pulled back", () => {
  // GitHub Light ships VS Code Dark+'s selection, which hides the near-black
  // text it covers.
  const theme = THEMES["github-light"];
  assert.ok(contrastRatio(theme.termSelection, theme.termForeground) < 2);
  const resolved = resolveSelectionBackground(theme);
  assert.ok(contrastRatio(resolved, theme.termForeground) >= 4);
  assert.ok(contrastRatio(resolved, theme.appBg) >= 2.4);
});

test("glass themes stay translucent", () => {
  for (const theme of THEME_LIST.filter((entry) => entry.isTransparent)) {
    const resolved = resolveSelectionBackground(theme);
    assert.equal(resolved.length, 9, `${theme.id} lost its alpha channel: ${resolved}`);
    // Slightly under the 2.4 target: keeping the terminal text legible on the
    // selection is allowed to stop the tuning short.
    assert.ok(
      contrastRatio(flatten(resolved, theme.appBg), theme.appBg) >= 2.2,
      `${theme.id} selection is still too faint`,
    );
  }
});

test("selections survive xterm's 50% blend over a colored cell", () => {
  // The reported bug: an agent's prompt box paints its own background, xterm
  // halves the selection over it, and the highlight all but vanishes.
  for (const theme of THEME_LIST.filter((entry) => hexLuminance(entry.appBg) <= 0.3)) {
    const resolved = flatten(resolveSelectionBackground(theme), theme.appBg);
    const halved = mix(theme.appBg, resolved, 0.5);
    assert.ok(
      contrastRatio(halved, theme.appBg) >= 1.4,
      `${theme.id} selection disappears over a colored cell (${contrastRatio(halved, theme.appBg).toFixed(2)})`,
    );
  }
});

test("text stays legible on every tuned selection", () => {
  for (const theme of THEME_LIST) {
    const resolved = flatten(resolveSelectionBackground(theme), theme.appBg);
    if (resolved === flatten(theme.termSelection, theme.appBg)) continue;
    assert.ok(
      contrastRatio(resolved, theme.termForeground) >= 4,
      `${theme.id} washes out its terminal text`,
    );
  }
});

test("an unparseable selection color passes through untouched", () => {
  const theme = { ...THEMES.catppuccin, termSelection: "var(--nope)" } as ShepTheme;
  assert.equal(resolveSelectionBackground(theme), "var(--nope)");
});
