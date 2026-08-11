import cursorLogoSrc from "../../assets/editor-cursor.svg";
import sublimeLogoSrc from "../../assets/editor-sublime.svg";
import traeLogoSrc from "../../assets/editor-trae.png";
import vscodeLogoSrc from "../../assets/editor-vscode.svg";
import zedLogoSrc from "../../assets/editor-zed.svg";
import type { PreferredEditor } from "./types";

export interface EditorOption {
  id: PreferredEditor;
  label: string;
  appName: string;
  logoSrc: string;
  logoClassName?: string;
}

export const EDITOR_OPTIONS: EditorOption[] = [
  { id: "vscode", label: "VS Code", appName: "Visual Studio Code", logoSrc: vscodeLogoSrc },
  { id: "zed", label: "Zed", appName: "Zed", logoSrc: zedLogoSrc },
  { id: "cursor", label: "Cursor", appName: "Cursor", logoSrc: cursorLogoSrc, logoClassName: "themed-mono-logo" },
  { id: "sublime_text", label: "Sublime Text", appName: "Sublime Text", logoSrc: sublimeLogoSrc },
  { id: "trae", label: "Trae", appName: "Trae", logoSrc: traeLogoSrc },
];

export function getEditorLabel(editorId: PreferredEditor | null): string | null {
  if (!editorId) return null;
  return EDITOR_OPTIONS.find((option) => option.id === editorId)?.label ?? null;
}
