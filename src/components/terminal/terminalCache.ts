import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { TerminalRendererState } from "./terminalRenderer";

export interface TerminalCacheEntry extends TerminalRendererState {
  term: Terminal;
  fitAddon: FitAddon;
  /** True while an IME composition is in flight (CJK, accents, emoji picker). */
  composing: boolean;
  /**
   * Everything recently emitted through onData, used to detect commits that
   * WebKit's IME produced but xterm never delivered (see TerminalView).
   */
  recentInputs: { data: string; at: number }[];
}

// Keep terminal instances alive across tab switches.
export const terminalCache = new Map<number, TerminalCacheEntry>();
