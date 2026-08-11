import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Copy, ClipboardPaste, TextSelect, Eraser } from "lucide-react";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { writePty, resizePty, openUrl } from "../../lib/tauri";
import {
  flushPendingOutput,
  registerTerminal,
  recordTerminalTitle,
  unregisterTerminal,
} from "../../hooks/usePty";
import { TERMINAL_LINE_HEIGHT, buildCSSFontFamily } from "../../lib/terminalConfig";
import {
  preserveTerminalViewport,
  resyncTerminalViewport,
  terminalBottomOffset,
} from "../../lib/terminalViewport";
import { createTerminalTheme } from "./terminalTheme";
import { useThemeStore } from "../../stores/useThemeStore";
import { notifyAgent } from "../../lib/notifications";
import { KEYBINDING_PRESETS } from "../../lib/keybindingPresets";
import { useKeybindingStore } from "../../stores/useKeybindingStore";
import { useTerminalSettingsStore } from "../../stores/useTerminalSettingsStore";
import { useTerminalStore } from "../../stores/useTerminalStore";
import { terminalCache } from "./terminalCache";
import { reconcileTerminalRenderer } from "./terminalRenderer";
import ContextMenu from "../shared/ContextMenu";
import type { ContextMenuItem } from "../shared/ContextMenu";
import { useT } from "../../stores/useLanguageStore";
import { useNoticeStore } from "../../stores/useNoticeStore";
import { getErrorMessage } from "../../lib/errors";

interface TerminalViewProps {
  ptyId: number;
  visible: boolean;
}

export default function TerminalView({
  ptyId,
  visible,
}: TerminalViewProps) {
  const t = useT();
  const pushNotice = useNoticeStore((s) => s.pushNotice);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Right-click menu anchor, plus the selection captured when it opened. */
  const [menu, setMenu] = useState<{ x: number; y: number; selection: string } | null>(null);
  const mountedRef = useRef(false);
  const attachedRef = useRef(false);
  const pinnedToBottomRef = useRef(true);
  /** True while an IME composition is in flight (CJK, accents, emoji picker). */
  const composingRef = useRef(false);
  const columnResizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getOrCreateTerminal = useCallback(() => {
    const cached = terminalCache.get(ptyId);
    if (cached) return cached;

    const termSettings = useTerminalSettingsStore.getState().settings;
    const term = new Terminal({
      cursorBlink: termSettings.cursorBlink,
      cursorStyle: termSettings.cursorStyle,
      fontSize: termSettings.fontSize,
      fontFamily: buildCSSFontFamily(termSettings.fontFamily),
      lineHeight: TERMINAL_LINE_HEIGHT,
      theme: createTerminalTheme(useThemeStore.getState().theme),
      scrollback: termSettings.scrollback,
      allowTransparency: true,
      allowProposedApi: true,
      linkHandler: {
        activate: (_ev, url) => {
          void openUrl(url);
        },
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    const unicodeAddon = new Unicode11Addon();
    term.loadAddon(unicodeAddon);
    term.unicode.activeVersion = "11";
    term.loadAddon(new WebLinksAddon((_ev, url) => {
      void openUrl(url);
    }));

    // Send input to PTY
    term.onData((data) => {
      pinnedToBottomRef.current = true;
      term.scrollToBottom();
      writePty(ptyId, data).catch((error) => {
        if (import.meta.env.DEV) {
          console.error("Failed to write PTY input:", error);
        }
      });
    });

    // Track terminal bell (attention request)
    term.onBell(() => {
      void notifyAgent(ptyId, "Terminal bell");
    });

    // OSC 0/2 title changes are the provider-neutral baseline for naming
    // terminal and agent tabs. Explicit user renames remain authoritative.
    term.onTitleChange((title) => {
      recordTerminalTitle(ptyId, title);
      useTerminalStore.getState().setTabTitleFromPty(ptyId, title);
    });

    // Intercept OSC 9 notifications from coding agents (Claude Code, Codex, Gemini)
    term.parser.registerOscHandler(9, (data) => {
      const message = data.startsWith("2;") ? data.slice(2) : data;
      if (message) {
        void notifyAgent(ptyId, message);
      }
      return true;
    });

    // Intercept key combos for custom keybindings
    term.attachCustomKeyEventHandler((ev) => {
      const settings = useKeybindingStore.getState().settings;
      for (const preset of KEYBINDING_PRESETS) {
        if (settings[preset.id] && preset.match(ev)) {
          if (ev.type === "keydown") {
            writePty(ptyId, preset.sequence).catch((error) => {
              if (import.meta.env.DEV) {
                console.error("Failed to write PTY keybinding:", error);
              }
            });
          }
          return false; // prevent xterm default handling
        }
      }
      return true; // let xterm handle normally
    });

    const entry = {
      term,
      fitAddon,
      rendererAddon: null as WebglAddon | null,
      webglFailed: false,
    };
    terminalCache.set(ptyId, entry);
    return entry;
  }, [ptyId]);

  // The WebView's own context menu is suppressed app-wide (see main.tsx), so
  // the terminal supplies its own copy/paste menu instead of losing right-click
  // entirely. The selection is captured on open because clicking a menu item
  // moves focus away from xterm.
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    const cached = terminalCache.get(ptyId);
    if (!cached) return;
    setMenu({
      x: event.clientX,
      y: event.clientY,
      selection: cached.term.getSelection(),
    });
  }, [ptyId]);

  const closeMenu = useCallback(() => {
    setMenu(null);
    terminalCache.get(ptyId)?.term.focus();
  }, [ptyId]);

  // Clipboard goes through the Tauri plugin rather than navigator.clipboard:
  // WKWebView gates reads behind a native paste prompt.
  const menuItems: ContextMenuItem[] = [
    ...(menu?.selection
      ? [{
          label: t("terminal.copy"),
          icon: <Copy size={14} />,
          onClick: () => {
            writeText(menu.selection).catch((error) => {
              pushNotice({
                tone: "error",
                title: "Couldn't copy selection",
                message: getErrorMessage(error),
              });
            });
          },
        }]
      : []),
    {
      label: t("terminal.paste"),
      icon: <ClipboardPaste size={14} />,
      onClick: () => {
        readText()
          .then((text) => {
            // paste() honours bracketed-paste mode, so multi-line text lands
            // intact in agent TUIs instead of being run line by line.
            if (text) terminalCache.get(ptyId)?.term.paste(text);
          })
          .catch((error) => {
            pushNotice({
              tone: "error",
              title: "Couldn't paste from clipboard",
              message: getErrorMessage(error),
            });
          });
      },
    },
    { separator: true, label: "_sep_view" },
    {
      label: t("terminal.selectAll"),
      icon: <TextSelect size={14} />,
      onClick: () => terminalCache.get(ptyId)?.term.selectAll(),
    },
    {
      label: t("terminal.clear"),
      icon: <Eraser size={14} />,
      onClick: () => terminalCache.get(ptyId)?.term.clear(),
    },
  ];

  const applyTerminalSize = useCallback(async (cols: number, rows: number) => {
    const cached = terminalCache.get(ptyId);
    if (!cached) return;

    const size = { cols: Math.max(2, cols), rows: Math.max(2, rows) };
    if (cached.term.cols === size.cols && cached.term.rows === size.rows) return;

    preserveTerminalViewport(cached.term, () => {
      cached.term.resize(size.cols, size.rows);
    });

    await resizePty(ptyId, size.cols, size.rows).catch((error) => {
      if (import.meta.env.DEV) {
        console.error("Failed to resize PTY:", error);
      }
    });
  }, [ptyId]);

  const fitAndResize = useCallback(async () => {
    const cached = terminalCache.get(ptyId);
    if (!cached) return;

    const proposedSize = cached.fitAddon.proposeDimensions();
    if (!proposedSize) return;

    const nextSize = { cols: proposedSize.cols, rows: proposedSize.rows };
    const columnsChanged = cached.term.cols !== nextSize.cols;
    const rowsChanged = cached.term.rows !== nextSize.rows;
    if (!columnsChanged && !rowsChanged) return;

    const shouldDebounceColumns =
      columnsChanged && cached.term.buffer.active.length > 200;

    if (!shouldDebounceColumns) {
      if (columnResizeTimerRef.current) {
        clearTimeout(columnResizeTimerRef.current);
        columnResizeTimerRef.current = null;
      }
      await applyTerminalSize(nextSize.cols, nextSize.rows);
      return;
    }

    // Reflowing a long scrollback buffer on every width observation is costly.
    // Apply row changes immediately at the current width and settle columns
    // after the resize gesture has been quiet for 100 ms.
    if (rowsChanged) {
      await applyTerminalSize(cached.term.cols, nextSize.rows);
    }
    if (columnResizeTimerRef.current) clearTimeout(columnResizeTimerRef.current);
    columnResizeTimerRef.current = setTimeout(() => {
      columnResizeTimerRef.current = null;
      void applyTerminalSize(nextSize.cols, nextSize.rows);
    }, 100);
  }, [applyTerminalSize, ptyId]);

  useEffect(() => {
    if (!containerRef.current || !visible) return;

    const { term } = getOrCreateTerminal();
    let disposed = false;

    if (!mountedRef.current) {
      term.open(containerRef.current);
      mountedRef.current = true;

      // Load WebGL after open() so it can access the DOM. Initialization or
      // context-loss failures restore xterm's built-in DOM renderer.
      const cached = terminalCache.get(ptyId);
      if (cached) {
        reconcileTerminalRenderer(
          term,
          cached,
          useThemeStore.getState().theme,
        );
      }
    }

    const surface = containerRef.current;
    const syncPinnedAfterEvent = () => {
      queueMicrotask(() => {
        if (disposed) return;
        pinnedToBottomRef.current = terminalBottomOffset(term) === 0;
      });
    };
    const handleWheelCapture = (event: WheelEvent) => {
      if (event.deltaY < 0) pinnedToBottomRef.current = false;
      else syncPinnedAfterEvent();
    };
    const handleKeyDownCapture = (event: KeyboardEvent) => {
      // While an IME is composing, every keystroke is part of an unfinished
      // character — arrow keys and digits navigate the candidate window, so
      // none of the viewport handling below may run. keyCode 229 is the legacy
      // signal some IMEs still send instead of isComposing.
      if (composingRef.current || event.isComposing || event.keyCode === 229) return;

      const viewportKey = event.shiftKey && [
        "PageUp",
        "PageDown",
        "Home",
        "End",
        "ArrowUp",
        "ArrowDown",
      ].includes(event.key);
      if (viewportKey) {
        if (["PageUp", "Home", "ArrowUp"].includes(event.key)) {
          pinnedToBottomRef.current = false;
        }
        syncPinnedAfterEvent();
        return;
      }

      // No scrollToBottom here: scrolling repositions xterm's hidden textarea,
      // and WebKit drops IME input whose textarea moves mid-transition. The
      // composing guard above can't cover the boundary keystrokes — an IME
      // commits punctuation with composition events that begin and end inside
      // a single keydown, and rapid candidate-digit input lands right after
      // compositionend clears the flag — which cost exactly one lost keypress
      // ("type twice"). Follow mode is restored in onData instead, which fires
      // only once input has actually committed and the candidate window is
      // gone.
    };
    // compositionend fires before the final keydown, so the flag is cleared on
    // the next tick to cover that trailing event too.
    const handleCompositionStart = () => {
      composingRef.current = true;
    };
    const handleCompositionEnd = () => {
      window.setTimeout(() => {
        composingRef.current = false;
      }, 0);
    };

    surface.addEventListener("wheel", handleWheelCapture, { capture: true });
    surface.addEventListener("keydown", handleKeyDownCapture, { capture: true });
    surface.addEventListener("compositionstart", handleCompositionStart, { capture: true });
    surface.addEventListener("compositionend", handleCompositionEnd, { capture: true });

    // Focus now, not only in the deferred pass below: that one runs a frame
    // plus 100ms after the switch, and keystrokes in between land on whatever
    // button was clicked to get here.
    term.focus();

    const attachTerminal = async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (disposed) return;

      // Re-apply the current theme now that the container is visible.
      // Theme changes that occurred while hidden were deferred to avoid
      // corrupting xterm's scroll state.
      const currentTheme = useThemeStore.getState().theme;
      const cachedEntry = terminalCache.get(ptyId);
      if (currentTheme.isTransparent && cachedEntry) {
        reconcileTerminalRenderer(term, cachedEntry, currentTheme);
      }
      term.options.theme = createTerminalTheme(currentTheme);
      if (!currentTheme.isTransparent && cachedEntry) {
        reconcileTerminalRenderer(term, cachedEntry, currentTheme);
      }

      // Re-apply terminal settings (font, cursor, scrollback) that may have
      // changed while this terminal was hidden. `applyTerminalSettings` skips
      // hidden terminals to avoid corrupting xterm state, so we catch up here
      // once the container is visible again. If the font changed, the
      // renderer's texture atlas is cleared so glyphs are re-measured.
      const currentTermSettings = useTerminalSettingsStore.getState().settings;
      const nextCssFont = buildCSSFontFamily(currentTermSettings.fontFamily);
      const fontMetricsChanged =
        term.options.fontFamily !== nextCssFont ||
        term.options.fontSize !== currentTermSettings.fontSize;

      term.options.cursorStyle = currentTermSettings.cursorStyle;
      term.options.cursorBlink = currentTermSettings.cursorBlink;
      term.options.scrollback = currentTermSettings.scrollback;
      term.options.fontFamily = nextCssFont;
      term.options.fontSize = currentTermSettings.fontSize;

      if (fontMetricsChanged) {
        cachedEntry?.rendererAddon?.clearTextureAtlas?.();
      }

      // Refresh the viewport so rendering is restored after visibility
      // changes (e.g. closing settings overlay).
      term.refresh(0, term.rows - 1);

      await fitAndResize();
      if (disposed) return;

      // fitAndResize skips the fit (and its viewport preservation) when the
      // dimensions didn't change — the common case when returning to a tab —
      // so the zeroed DOM scrollTop must be re-asserted unconditionally.
      // Recompute immediately before the pending-output flush. The buffer may
      // have changed while theme/settings/fit work ran, so an earlier offset
      // is not safe to reuse here.
      resyncTerminalViewport(term, terminalBottomOffset(term));

      if (!attachedRef.current) {
        registerTerminal(ptyId, term, () => {
          // Dragging out a selection emits no wheel events, so follow mode is
          // still on and the next chunk of output would yank the selection out
          // from under the pointer. Follow mode itself is left untouched:
          // clearing the selection — a click, a keystroke — resumes it on the
          // very next write.
          if (pinnedToBottomRef.current && !term.hasSelection()) term.scrollToBottom();
        });
        flushPendingOutput(ptyId);
        attachedRef.current = true;
      }

      window.setTimeout(() => {
        if (disposed) return;
        void fitAndResize();
        term.focus();
      }, 100);

      if ("fonts" in document) {
        void document.fonts.ready.then(() => {
          if (disposed) return;
          void fitAndResize();
          if (import.meta.env.DEV) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const cssFont = term.options.fontFamily ?? "";
              const fonts = cssFont.split(",").map(f => f.trim().replace(/^["']|["']$/g, ""));
              ctx.font = `${term.options.fontSize}px serif`;
              const serifW = ctx.measureText("mmmm").width;
              for (const font of fonts) {
                ctx.font = `${term.options.fontSize}px "${font}", serif`;
                const w = ctx.measureText("mmmm").width;
                if (w !== serifW) {
                  console.log(`Terminal font: "${font}" (active)`);
                  break;
                }
              }
            }
          }
        });
      }
    };

    void attachTerminal();

    // ResizeObserver for auto-fitting. fitAndResize applies rows immediately
    // and owns the long-buffer column debounce.
    const observer = new ResizeObserver(() => {
      if (disposed) return;
      void fitAndResize();
    });
    observer.observe(containerRef.current);

    return () => {
      disposed = true;
      observer.disconnect();
      surface.removeEventListener("wheel", handleWheelCapture, { capture: true });
      surface.removeEventListener("keydown", handleKeyDownCapture, { capture: true });
      surface.removeEventListener("compositionstart", handleCompositionStart, { capture: true });
      surface.removeEventListener("compositionend", handleCompositionEnd, { capture: true });
      if (columnResizeTimerRef.current) {
        clearTimeout(columnResizeTimerRef.current);
        columnResizeTimerRef.current = null;
      }
    };
  }, [ptyId, visible, getOrCreateTerminal, fitAndResize]);


  useEffect(() => {
    return () => {
      const cached = terminalCache.get(ptyId);
      if (cached) {
        cached.term.dispose();
        terminalCache.delete(ptyId);
        unregisterTerminal(ptyId);
      }
      mountedRef.current = false;
      attachedRef.current = false;
      pinnedToBottomRef.current = true;
      if (columnResizeTimerRef.current) {
        clearTimeout(columnResizeTimerRef.current);
        columnResizeTimerRef.current = null;
      }
    };
  }, [ptyId]);

  return (
    <div
      className="terminal-view"
      style={{
        display: visible ? "block" : "none",
      }}
    >
      <div className="terminal-underlay" />
      <div
        ref={containerRef}
        className="terminal-surface"
        onContextMenu={handleContextMenu}
      />
      {menu && createPortal(
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={closeMenu}
        />,
        document.body,
      )}
    </div>
  );
}
